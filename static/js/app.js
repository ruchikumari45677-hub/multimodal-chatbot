/**
 * Multimodal AI Chatbot - Client Controller
 * Handles chat interactions, image/audio attachment staging,
 * file validation, and async communication with /api/chat.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const chatViewport = document.getElementById('chat-viewport');
    const messagesContainer = document.getElementById('messages-container');
    const chatForm = document.getElementById('chat-form');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    
    // File inputs & action buttons
    const attachImageBtn = document.getElementById('attach-image-btn');
    const attachAudioBtn = document.getElementById('attach-audio-btn');
    const imageInput = document.getElementById('image-input');
    const audioInput = document.getElementById('audio-input');

    // Attachment Tray
    const attachmentTray = document.getElementById('attachment-tray');
    const imageChip = document.getElementById('image-chip');
    const imageChipThumb = document.getElementById('image-chip-thumb');
    const imageChipName = document.getElementById('image-chip-name');
    const imageChipSize = document.getElementById('image-chip-size');
    const removeImageBtn = document.getElementById('remove-image-btn');

    const audioChip = document.getElementById('audio-chip');
    const audioChipName = document.getElementById('audio-chip-name');
    const audioChipSize = document.getElementById('audio-chip-size');
    const removeAudioBtn = document.getElementById('remove-audio-btn');

    // Error Toast
    const errorToast = document.getElementById('error-toast');
    const errorMessage = document.getElementById('error-message');
    const dismissErrorBtn = document.getElementById('dismiss-error-btn');

    // --- Validation Rules ---
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
    const MAX_AUDIO_SIZE = 20 * 1024 * 1024; // 20 MB
    const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
    const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a'];

    // --- Local Staging State ---
    let stagedImage = null; // { file, previewUrl }
    let stagedAudio = null; // { file }

    // --- Helper: Format File Sizes ---
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // --- Helper: Show/Hide Error Toast ---
    function showError(msg) {
        errorMessage.textContent = msg;
        errorToast.classList.remove('hidden');
    }

    function hideError() {
        errorToast.classList.add('hidden');
        errorMessage.textContent = '';
    }

    dismissErrorBtn.addEventListener('click', hideError);

    // --- Auto-resize Textarea ---
    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        promptInput.style.height = Math.min(promptInput.scrollHeight, 150) + 'px';
    });

    // --- Enter to Submit, Shift+Enter for Newline ---
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.requestSubmit();
        }
    });

    // --- Staging Tray Visibility ---
    function updateTrayVisibility() {
        if (stagedImage || stagedAudio) {
            attachmentTray.classList.remove('hidden');
        } else {
            attachmentTray.classList.add('hidden');
        }
    }

    // --- Image Attachment Handling ---
    attachImageBtn.addEventListener('click', () => {
        imageInput.value = '';
        imageInput.click();
    });

    imageInput.addEventListener('change', () => {
        hideError();
        const file = imageInput.files[0];
        if (!file) return;

        // Validate type
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        const isAllowedType = ALLOWED_IMAGE_TYPES.includes(file.type) || 
                              ['.png', '.jpg', '.jpeg', '.webp'].includes(fileExt);

        if (!isAllowedType) {
            showError(`Unsupported image format (${file.name}). Please attach a PNG, JPG, or WEBP.`);
            imageInput.value = '';
            return;
        }

        // Validate size
        if (file.size > MAX_IMAGE_SIZE) {
            showError(`Image "${file.name}" exceeds the maximum allowed size of 10 MB.`);
            imageInput.value = '';
            return;
        }

        // Clean up previous image preview URL if any
        if (stagedImage && stagedImage.previewUrl) {
            URL.revokeObjectURL(stagedImage.previewUrl);
        }

        const previewUrl = URL.createObjectURL(file);
        stagedImage = { file, previewUrl };

        // Update UI Chip
        imageChipThumb.src = previewUrl;
        imageChipName.textContent = file.name;
        imageChipSize.textContent = formatFileSize(file.size);
        imageChip.classList.remove('hidden');
        updateTrayVisibility();
    });

    removeImageBtn.addEventListener('click', () => {
        if (stagedImage && stagedImage.previewUrl) {
            URL.revokeObjectURL(stagedImage.previewUrl);
        }
        stagedImage = null;
        imageInput.value = '';
        imageChip.classList.add('hidden');
        updateTrayVisibility();
    });

    // --- Audio Attachment Handling ---
    attachAudioBtn.addEventListener('click', () => {
        audioInput.value = '';
        audioInput.click();
    });

    audioInput.addEventListener('change', () => {
        hideError();
        const file = audioInput.files[0];
        if (!file) return;

        // Validate extension
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        const isAudioExt = ALLOWED_AUDIO_EXTENSIONS.includes(fileExt);
        const isAudioMime = file.type.startsWith('audio/') || file.type === 'video/mp4';

        if (!isAudioExt && !isAudioMime) {
            showError(`Unsupported audio format (${file.name}). Please attach an MP3, WAV, OGG, or M4A.`);
            audioInput.value = '';
            return;
        }

        // Validate size
        if (file.size > MAX_AUDIO_SIZE) {
            showError(`Audio file "${file.name}" exceeds the maximum allowed size of 20 MB.`);
            audioInput.value = '';
            return;
        }

        stagedAudio = { file };

        // Update UI Chip
        audioChipName.textContent = file.name;
        audioChipSize.textContent = formatFileSize(file.size);
        audioChip.classList.remove('hidden');
        updateTrayVisibility();
    });

    removeAudioBtn.addEventListener('click', () => {
        stagedAudio = null;
        audioInput.value = '';
        audioChip.classList.add('hidden');
        updateTrayVisibility();
    });

    // --- Scroll to Bottom ---
    function scrollToBottom() {
        chatViewport.scrollTop = chatViewport.scrollHeight;
    }

    // --- Append User Message Bubble ---
    function appendUserMessage(text, imageObj, audioObj) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Add media if attached
        if (imageObj || audioObj) {
            const mediaGroup = document.createElement('div');
            mediaGroup.className = 'sent-media-group';

            if (imageObj) {
                const img = document.createElement('img');
                img.src = imageObj.previewUrl;
                img.alt = 'Uploaded image';
                img.className = 'sent-image';
                mediaGroup.appendChild(img);
            }

            if (audioObj) {
                const audioTag = document.createElement('div');
                audioTag.className = 'sent-audio-tag';
                audioTag.innerHTML = `<span>🎵</span> <span>${escapeHtml(audioObj.file.name)}</span>`;
                mediaGroup.appendChild(audioTag);
            }

            contentDiv.appendChild(mediaGroup);
        }

        if (text) {
            const textPara = document.createElement('p');
            textPara.textContent = text;
            contentDiv.appendChild(textPara);
        }

        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    }

    // --- Append Bot Message Bubble ---
    function appendBotMessage(replyText) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Render plain text with line breaks preserved
        const formatted = renderMarkdownish(replyText);
        contentDiv.innerHTML = formatted;

        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    }

    // --- Loading Typing Indicator ---
    let typingIndicatorElement = null;

    function showTypingIndicator() {
        if (typingIndicatorElement) return;

        typingIndicatorElement = document.createElement('div');
        typingIndicatorElement.className = 'message bot-message typing-indicator';
        typingIndicatorElement.innerHTML = `
            <div class="message-content typing-bubble" aria-label="Gemini is typing...">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        messagesContainer.appendChild(typingIndicatorElement);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        if (typingIndicatorElement) {
            typingIndicatorElement.remove();
            typingIndicatorElement = null;
        }
    }

    // --- Basic Safe HTML Escaping and Formatting ---
    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderMarkdownish(rawText) {
        if (!rawText) return '';
        // Escape HTML first for XSS safety
        let safe = escapeHtml(rawText);

        // Convert code blocks ```code```
        safe = safe.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });

        // Convert inline `code`
        safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Convert bold **text**
        safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Convert newlines to <br>
        safe = safe.replace(/\n/g, '<br>');

        return safe;
    }

    // --- Form Submission Handler ---
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const promptText = promptInput.value.trim();
        const imageToSend = stagedImage;
        const audioToSend = stagedAudio;

        // Must have at least text or media
        if (!promptText && !imageToSend && !audioToSend) {
            showError('Please type a message or attach an image/audio file.');
            promptInput.focus();
            return;
        }

        // Display user message in chat
        appendUserMessage(promptText, imageToSend, audioToSend);

        // Build multipart/form-data for the backend
        const formData = new FormData();
        if (promptText) {
            formData.append('prompt', promptText);
        }
        if (imageToSend) {
            formData.append('image', imageToSend.file);
        }
        if (audioToSend) {
            formData.append('audio', audioToSend.file);
        }

        // Clear input form & attachment tray
        promptInput.value = '';
        promptInput.style.height = 'auto';
        imageInput.value = '';
        audioInput.value = '';
        imageChip.classList.add('hidden');
        audioChip.classList.add('hidden');
        attachmentTray.classList.add('hidden');

        stagedImage = null;
        stagedAudio = null;

        // Loading state
        showTypingIndicator();
        sendBtn.disabled = true;
        attachImageBtn.disabled = true;
        attachAudioBtn.disabled = true;
        promptInput.disabled = true;

        try {
            // Send payload to backend endpoint
            const response = await fetch('/api/chat', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            removeTypingIndicator();

            if (!response.ok || data.status === 'error') {
                const errMessage = data.message || `Server returned status ${response.status}`;
                showError(errMessage);
                // Restore prompt text so user does not lose their input
                if (promptText) {
                    promptInput.value = promptText;
                }
            } else {
                // Success: render AI response
                appendBotMessage(data.reply);
            }
        } catch (err) {
            removeTypingIndicator();
            showError(`Network connection error: ${err.message}. Please verify the server is running.`);
            if (promptText) {
                promptInput.value = promptText;
            }
        } finally {
            // Restore input controls
            sendBtn.disabled = false;
            attachImageBtn.disabled = false;
            attachAudioBtn.disabled = false;
            promptInput.disabled = false;
            promptInput.focus();
        }
    });
});
