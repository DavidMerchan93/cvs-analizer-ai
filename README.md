# AI Recruiter Evaluator

A React + Node.js application that uses Google's Gemini AI to objectively
evaluate candidate CVs against job descriptions.

## Architecture

The app uses a **client-server architecture** with a clear directory split:

```
frontend/   ← React + Vite (port 3000)
backend/    ← Express + Node.js (port 3001)
```

- **Frontend** (`frontend/`) — React 19 SPA served by Vite. Sends evaluation requests to the API.
- **Backend** (`backend/`) — Express server. Holds the Gemini API key securely and calls the AI model.
- In development, Vite proxies `/api` requests to the Express backend — no CORS configuration needed.

```
Browser → Vite (3000) → /api proxy → Express (3001) → Gemini API
```

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set `GEMINI_API_KEY` in [.env.local](.env.local):
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. Start both frontend and backend with a single command:
   ```bash
   npm run dev
   ```
   This runs the Vite frontend (`[client]`) and Express backend (`[server]`)
   concurrently.

## Available Scripts

| Script                 | Description                                  |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Start frontend + backend concurrently        |
| `npm run dev:client`   | Start Vite frontend only (port 3000)         |
| `npm run dev:server`   | Start Express backend only (port 3001)       |
| `npm run build`        | Build frontend for production                |
| `npm run build:server` | Compile backend TypeScript to `dist/backend/`|
| `npm start`            | Run compiled production server               |
| `npm run lint`         | Type-check frontend and backend              |
| `npm run preview`      | Preview production frontend build            |
| `npm run clean`        | Remove `dist/` directory                     |

## API

### `POST /api/evaluate`

Evaluates candidate CVs against a job description.

**Request body:**

```json
{
   "jobDescription": "string",
   "candidates": [{ "name": "string", "cv": "string" }]
}
```

**Response (200):**

```json
{ "result": "markdown-formatted evaluation" }
```
