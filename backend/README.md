# Backend email notifications

## Voice provider and models

Set `VOICE_PROVIDER` in `backend/.env` to choose the interview voice transport:

```env
VOICE_PROVIDER=groq
GROQ_TEXT_MODEL=openai/gpt-oss-120b
GROQ_API_KEY=your_groq_api_key
```

`groq` is the default. It uses direct browser microphone PCM capture (encoded
as WAV), Groq Whisper transcription (`whisper-large-v3-turbo`), and Groq text
generation for interview questions, answer scoring, follow-ups, and HR
evaluation. `GROQ_TEXT_MODEL` can be changed to another active Groq chat model.
Use a current Chrome version for the most reliable browser audio support.
Set `VOICE_PROVIDER=openai` to use the preserved OpenAI
Realtime WebRTC route instead. Restart the backend after changing the value;
the frontend reads the selected mode from `GET /config`.

Install backend dependencies with `pip install -r requirements.txt`.

HR outcome emails use the SMTP server configured in the backend environment.
Set these values in `backend/.env` before using **Send outcome email**:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=hr@example.com
SMTP_USE_TLS=true
```

`SMTP_USERNAME` and `SMTP_PASSWORD` may both be omitted when the SMTP server
allows unauthenticated relay. `SMTP_FROM_EMAIL` is required. TLS uses STARTTLS
when enabled. The HR email action is available only after an interview has
been evaluated, and sends to the email address on the candidate's account.

Candidates can see only their interview status and pass/fail outcome. Numeric
scores and evaluation feedback remain restricted to HR endpoints.
