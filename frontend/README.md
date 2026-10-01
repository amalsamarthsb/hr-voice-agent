# HR Voice Interview Agent frontend

## Run locally

Install dependencies once:

```powershell
npm install
```

Start the Vite development server:

```powershell
npm run dev
```

The frontend calls the FastAPI backend at `http://127.0.0.1:8000` by default.
Set `VITE_API_URL` in a local frontend environment file to use another backend
URL.

## Production build

```powershell
npm run build
```
