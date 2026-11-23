import os
import io
import logging
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Request and file size bounds
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024  # 25 MB max request size
MAX_IMAGE_SIZE = 10 * 1024 * 1024                    # 10 MB max image size
MAX_AUDIO_SIZE = 20 * 1024 * 1024                    # 20 MB max audio size
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
ALLOWED_IMAGE_MIMETYPES = {'image/png', 'image/jpeg', 'image/webp'}
ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'ogg', 'm4a'}
ALLOWED_AUDIO_MIMETYPES = {'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def is_allowed_image(filename: str, mimetype: str) -> bool:
    """Validate image extension and MIME type."""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_IMAGE_EXTENSIONS and mimetype.lower() in ALLOWED_IMAGE_MIMETYPES


def is_allowed_audio(filename: str, mimetype: str) -> bool:
    """Validate audio extension and MIME type."""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_AUDIO_EXTENSIONS and (mimetype.lower() in ALLOWED_AUDIO_MIMETYPES or mimetype.startswith('audio/'))


@app.route('/')
def index():
    """Serves the main single-page chat interface."""
    return render_template('index.html')


@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Multimodal chat endpoint.
    Accepts:
      - prompt (text, optional if image or audio is present)
      - image (file, optional)
      - audio (file, optional)
    Returns:
      JSON with 'status' and 'reply' (or 'message' on error).
    """
    prompt = request.form.get('prompt', '').strip()
    image_file = request.files.get('image')
    audio_file = request.files.get('audio')

    # Ensure at least one input is provided
    has_image = image_file is not None and image_file.filename != ''
    has_audio = audio_file is not None and audio_file.filename != ''

    if not prompt and not has_image and not has_audio:
        return jsonify({
            'status': 'error',
            'message': 'Please provide a text question or attach an image/audio file.'
        }), 400

    image_bytes = None
    image_mime = None
    audio_bytes = None
    audio_mime = None

    # Handle image attachment
    if has_image:
        filename = image_file.filename or 'upload'
        mimetype = image_file.mimetype or ''

        # 1. Validate file extension and MIME type
        if not is_allowed_image(filename, mimetype):
            return jsonify({
                'status': 'error',
                'message': f'Unsupported image format for "{filename}". Allowed formats: PNG, JPG, JPEG, WEBP.'
            }), 400

        # 2. Read bytes and validate file size
        image_bytes = image_file.read()
        if len(image_bytes) > MAX_IMAGE_SIZE:
            return jsonify({
                'status': 'error',
                'message': f'Image "{filename}" exceeds the maximum allowed size of 10 MB.'
            }), 400

        # 3. Validate image integrity with PIL
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                img.verify()
        except Exception:
            return jsonify({
                'status': 'error',
                'message': 'The uploaded file is not a valid or readable image.'
            }), 400

        image_mime = mimetype

    # Handle audio attachment
    if has_audio:
        filename = audio_file.filename or 'audio_upload'
        mimetype = audio_file.mimetype or 'audio/mpeg'

        # 1. Validate audio extension and MIME type
        if not is_allowed_audio(filename, mimetype):
            return jsonify({
                'status': 'error',
                'message': f'Unsupported audio format for "{filename}". Allowed formats: MP3, WAV, OGG, M4A.'
            }), 400

        # 2. Read bytes and validate audio size
        audio_bytes = audio_file.read()
        if len(audio_bytes) > MAX_AUDIO_SIZE:
            return jsonify({
                'status': 'error',
                'message': f'Audio "{filename}" exceeds the maximum allowed size of 20 MB.'
            }), 400

        audio_mime = mimetype

    # Check for Gemini API key on the server
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key or api_key.strip() == '' or api_key == 'your_gemini_api_key_here':
        return jsonify({
            'status': 'error',
            'message': 'Gemini API key is not configured on the server. Please add your GEMINI_API_KEY to the .env file.'
        }), 500

    try:
        # Initialize Google GenAI client securely on the server
        client = genai.Client(api_key=api_key)

        contents = []

        # Add image part if provided
        if image_bytes is not None:
            image_part = types.Part.from_bytes(
                data=image_bytes,
                mime_type=image_mime
            )
            contents.append(image_part)

        # Add audio part if provided
        if audio_bytes is not None:
            audio_part = types.Part.from_bytes(
                data=audio_bytes,
                mime_type=audio_mime
            )
            contents.append(audio_part)

        # Add prompt (with sensible default if user submitted only media)
        if prompt:
            contents.append(prompt)
        elif has_image and not has_audio:
            contents.append("Describe this image in detail and highlight key elements visible in it.")
        elif has_audio and not has_image:
            contents.append("Please provide a clear transcription, summary, and key points of this audio recording.")
        else:
            contents.append("Analyze and synthesize the provided image, audio, and details.")

        # Call Gemini 2.5 Flash model
        logger.info("Sending request to Gemini model (has_image=%s, has_audio=%s, prompt_len=%d)",
                    has_image, has_audio, len(prompt))
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents
        )

        reply_text = response.text or "I processed your request, but no text response was returned."
        return jsonify({
            'status': 'success',
            'reply': reply_text
        })

    except Exception as exc:
        logger.exception("Error calling Gemini API")
        error_msg = str(exc)
        # Provide helpful guidance for common issues
        if "API_KEY_INVALID" in error_msg or "invalid api key" in error_msg.lower():
            friendly_msg = "Invalid Gemini API key. Please check your GEMINI_API_KEY in the .env file."
        elif "quota" in error_msg.lower():
            friendly_msg = "Gemini API quota exceeded. Please check your account limits or try again shortly."
        else:
            friendly_msg = f"Server error while contacting Gemini API: {error_msg}"

        return jsonify({
            'status': 'error',
            'message': friendly_msg
        }), 500


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle uploads exceeding Flask's MAX_CONTENT_LENGTH."""
    return jsonify({
        'status': 'error',
        'message': 'Request payload exceeds the maximum allowed server limit of 25 MB.'
    }), 413


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 't')
    app.run(host='127.0.0.1', port=port, debug=debug)
