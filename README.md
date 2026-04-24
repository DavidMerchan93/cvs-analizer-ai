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

| Script                  | Description                                   |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Start frontend + backend concurrently         |
| `npm run dev:client`    | Start Vite frontend only (port 3000)          |
| `npm run dev:server`    | Start Express backend only (port 3001)        |
| `npm run build`         | Build frontend for production                 |
| `npm run build:server`  | Compile backend TypeScript to `dist/backend/` |
| `npm start`             | Run compiled production server                |
| `npm run lint`          | Type-check frontend and backend               |
| `npm run preview`       | Preview production frontend build             |
| `npm run clean`         | Remove `dist/` directory                      |
| `npm test`              | Run all tests (frontend + backend)            |
| `npm run test:frontend` | Run frontend tests only (jsdom environment)   |
| `npm run test:backend`  | Run backend tests only (Node environment)     |
| `npm run test:coverage` | Run all tests with V8 coverage report         |

## Testing

Tests live in `tests/` and use **Vitest**. Two separate configs handle environment differences:

| Config | Scope | Environment |
|---|---|---|
| `vitest.config.ts` | `tests/frontend/` | jsdom (React + DOM APIs) |
| `vitest.node.config.ts` | `tests/backend/` | node (Express, file parsing) |

| File | What it tests |
|---|---|
| `tests/backend/fileParser.test.ts` | Text extraction for PDF / DOCX / TXT, unsupported types, error propagation |
| `tests/backend/evaluate.test.ts` | POST /api/evaluate — validation, file uploads, char limits, Gemini mocking |
| `tests/frontend/apiClient.test.ts` | FormData construction, text vs file branching, error handling |
| `tests/frontend/FileUpload.test.tsx` | Drag-and-drop component rendering, keyboard a11y, file select / remove |

No real API calls are made in tests — Gemini SDK and file parsers are mocked at the module level.

## File Upload Support

CVs and job descriptions can be provided as **typed text** or as uploaded files. Supported formats:

| Format | MIME type |
|---|---|
| PDF | `application/pdf` |
| Word (DOCX) | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| Plain text | `text/plain` |

- Max file size: **10 MB per file**
- Max text length after extraction: **20 000 chars** for job description, **30 000 chars** per CV
- Files are processed in server memory and never written to disk

## API

### `POST /api/evaluate`

Evaluates candidate CVs against a job description. Accepts `multipart/form-data`.

**Fields:**

| Field | Type | Required |
|---|---|---|
| `jobDescription` | text | One of these two |
| `jobDescriptionFile` | file (PDF/DOCX/TXT) | One of these two |
| `candidates[N][name]` | text | Yes, for each candidate |
| `candidates[N][cv]` | text | One of these two per candidate |
| `candidates[N][cvFile]` | file (PDF/DOCX/TXT) | One of these two per candidate |

Max candidates: 10.

**Response (200):**

```json
{ "result": "markdown-formatted evaluation" }
```

**Error responses:** `400` bad input · `422` unreadable file · `500` missing API key · `502` Gemini failure — all return `{ "error": "string" }`.
