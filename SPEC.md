# Project Specification: Multimodal Chatbot (Lab Edition)

## 1. Overview & Objectives
The Multimodal Chatbot is a lightweight, browser-based conversational application designed for a student laboratory setting. It allows users to interact with a multimodal AI model (Google Gemini) using text, image attachments, and audio uploads in an intuitive single-page interface.

---

## 2. Scope & Boundaries (Non-Goals)
To keep the application accessible, beginner-friendly, and maintainable for students:
* **No Database**: No conversation persistence, chat logging, or external storage layer.
* **No User Authentication**: No signup, sign-in, sessions, or account management.
* **Stateless Operation**: Each interaction is processed per request; state resets upon browser refresh.

---

## 3. Functional Requirements

### F1: Text Chat
* **F1.1**: The user can input a text question or prompt into a multi-line auto-resizing text area.
* **F1.2**: The user can submit the message by clicking a dedicated "Send" button or pressing `Enter` (with `Shift + Enter` reserved for new lines).
* **F1.3**: The user's query and the AI's response are rendered in distinct, readable chat bubbles within a scrollable history container.

### F2: Image Upload
* **F2.1**: The user can attach an image file (`.png`, `.jpg`, `.jpeg`, `.webp`) alongside an optional or mandatory text prompt.
* **F2.2**: The UI displays a thumbnail/preview badge of the staged image with an option to remove/cancel it before sending.
* **F2.3**: The AI model analyzes the image and returns contextual answers (e.g., visual descriptions, object identification, reasoning).

### F3: Audio Upload
* **F3.1**: The user can attach an audio file (`.mp3`, `.wav`, `.ogg`, `.m4a`).
* **F3.2**: The UI displays an attachment chip indicating the audio file name and size with an option to remove it prior to submission.
* **F3.3**: The AI model processes the audio track and returns summaries, transcript-style answers, or analysis based on the user's prompt.

### F4: Feedback & State Indicators
* **F4.1 (Loading State)**:
  * Input fields, file pickers, and the send button are disabled while an AI request is in flight.
  * A clear visual loading indicator (e.g., animated dots or spinner) displays in the chat stream.
* **F4.2 (Success State)**:
  * Response content renders clearly into a newly appended assistant chat bubble.
  * Input fields are cleared, file attachments are detached, and the view auto-scrolls to the bottom.
* **F4.3 (Error State)**:
  * Failed requests (network failure, server error, rejected file, rate limits) surface non-blocking, human-readable error messages/toasts.
  * The user's text remains intact so they do not lose their prompt upon failure.

---

## 4. Non-Functional Requirements

### N1: Server-Side API Key Security
* **N1.1**: The Gemini API key must strictly reside on the backend server, stored in an environment variable (loaded from a local `.env` file).
* **N1.2**: Under no circumstances should the API key be embedded in HTML, JavaScript, client network requests, or client responses.
* **N1.3**: A `.gitignore` file must prevent `.env` and sensitive files from being committed to version control. A `.env.example` file must be provided as a template.

### N2: File Validation (Client & Server Side)
* **N2.1 (Allowed File Types)**:
  * **Images**: `image/jpeg`, `image/png`, `image/webp` (extensions: `.jpg`, `.jpeg`, `.png`, `.webp`).
  * **Audio**: `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp4`, `audio/x-m4a` (extensions: `.mp3`, `.wav`, `.ogg`, `.m4a`).
* **N2.2 (Size Limits)**:
  * **Maximum Image Size**: 10 MB.
  * **Maximum Audio Size**: 20 MB.
  * **Overall Request Payload Limit**: 25 MB.
* **N2.3 (Enforcement Strategy)**:
  * **Client-side**: Check `file.size` and MIME type upon file selection; immediately alert the user and clear invalid files before sending.
  * **Server-side**: Validate file extensions and payload lengths in Flask; reject invalid uploads with a `400 Bad Request` JSON error.

### N3: Keyboard Accessibility & Usability
* **N3.1**: All interactive elements (input area, file attachment buttons, remove attachment buttons, send button) must be reachable and operable using `Tab` and `Shift + Tab`.
* **N3.2**: Form submission can be triggered using the `Enter` key from within the text area without clicking the Send button.
* **N3.3**: Interactive controls must have clear `:focus-visible` outlines and descriptive `aria-label` attributes for screen readers.

---

## 5. Technology Stack & File Structure

### Technology Stack
* **Backend**: Python 3, Flask, `python-dotenv`, `google-genai` SDK
* **Frontend**: HTML5, CSS3, Vanilla JavaScript (Fetch API + `FormData`)

### Proposed Project Tree
```text
multimodal-chatbot/
├── .env.example
├── .env
├── .gitignore
├── requirements.txt
├── app.py
├── SPEC.md
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
└── templates/
    └── index.html
```

---

## 6. API Interface Contract

### Endpoint: `POST /api/chat`
* **Content-Type**: `multipart/form-data`
* **Request Parameters**:
  * `prompt` (string, optional if media is attached)
  * `image` (file binary, optional)
  * `audio` (file binary, optional)

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "reply": "This image shows a domestic cat resting on a windowsill..."
}
```

#### Error Response (`400 Bad Request` or `500 Internal Server Error`):
```json
{
  "status": "error",
  "message": "The uploaded audio file exceeds the maximum allowed limit of 20 MB."
}
```

---

## 7. Acceptance & Verification Matrix

| ID | Requirement | Verification Method | Pass Criteria |
|---|---|---|---|
| **V1** | F1: Text Chat | Submit text prompt "Hello world". | Response renders; text field clears; scroll snaps to bottom. |
| **V2** | F2: Image Upload | Attach `.jpg` file with query "Describe this". | Preview chip shows; model describes image content accurately. |
| **V3** | F3: Audio Upload | Upload `.mp3` with "Summarize this clip". | File chip shows; response summarizes audio. |
| **V4** | F4: Feedback States | Monitor UI during request lifecycle. | Inputs disable & spinner appears during generation; clean result on finish. |
| **V5** | N1: Key Security | Inspect browser network tab and source files. | No API key present in client headers, payloads, or JS scripts. |
| **V6** | N2: Validation | Attempt upload of `.exe` and 35MB file. | UI displays warning; server returns `400 Bad Request` if bypassed. |
| **V7** | N3: Accessibility | Navigate interface using only `Tab`, `Shift+Tab`, and `Enter`. | Full chat workflow executable without a mouse. |
