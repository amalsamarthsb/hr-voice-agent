# HR Voice Interview Agent

React/Vite frontend and FastAPI backend for candidate interviews and HR review.

## Local development

1. Create `backend/.env` from `backend/.env.example`, then set PostgreSQL
   connection values, `SECRET_KEY`, and `GROQ_API_KEY`.
2. Start the backend:

   ```powershell
   cd backend
   .\venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

3. In another terminal, create `frontend/.env` from `frontend/.env.example`,
   install dependencies if needed, and start Vite:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

4. Open the local Vite URL (normally `http://localhost:5173`). The backend
   health check is at `http://127.0.0.1:8000/health`.

## Deploy the backend to Render

Create a Render **Web Service** from this repository:

- Root directory: `backend`
- Runtime: Python
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Create a hosted PostgreSQL database (for example, Neon or Supabase) and set
`DATABASE_URL` from that provider in Render. Also configure `SECRET_KEY`,
`GROQ_API_KEY`, `GROQ_TEXT_MODEL`, `VOICE_PROVIDER=groq`, and
`FRONTEND_URL=https://YOUR-FRONTEND.vercel.app`. Configure SMTP variables if HR
outcome emails are required. Set OpenAI credentials only if using OpenAI
Realtime instead of Groq browser voice.

After the first deploy, initialize the database schema from the backend root:

```powershell
python create_tables.py
```

Use a one-off Render shell/job with that command, or run it in a controlled
local environment using the production `DATABASE_URL`. Do not run schema
creation against production until you have verified the target database.

Verify the deployed service at `https://YOUR-BACKEND.onrender.com/health`.

## Deploy the frontend to Vercel

Import the same GitHub repository into Vercel:

- Root directory: `frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://YOUR-BACKEND.onrender.com`

After Vercel assigns the real domain, set the exact frontend origin in Render's
`FRONTEND_URL` environment variable, then redeploy/restart the backend.

## Storage and privacy

Resume files are read in memory for text extraction; the original file is not
saved to Render's local disk. Extracted resume text and interview data are
stored in PostgreSQL. Recorded audio is sent to the backend for Groq
transcription and is not persisted by this application. Scores and evaluation
feedback remain restricted to HR-protected APIs; candidates receive only their
status and pass/fail outcome.
