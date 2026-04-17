# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## NON-NEGOTIABLE RULE — Documentation Sync

**After every task that adds, removes, or modifies files**, you MUST review and update these three files before considering the task complete:

| File | Update when… |
|---|---|
| `README.md` | New scripts, changed ports/commands, new API endpoints, architecture changes |
| `CLAUDE.md` | New files or directories, changed file responsibilities, new environment variables, new rules or constraints |
| `.gitignore` | New build output directories, new generated files, new secrets or local-only files added to the project |

Do not update a file if the change is truly unrelated to its content. But when in doubt, update it.

## NON-NEGOTIABLE RULE — Code Comments

**Every code change must be accompanied by inline comments that document the intent.** Comments must explain the *why*, not restate the *what* (the code already shows what it does).

Required comment coverage:

| Situation | What to comment |
|---|---|
| New function or route | One-line summary of its purpose and any non-obvious constraints |
| Non-trivial logic | Why this approach was chosen, especially if a simpler alternative was rejected |
| Environment variables / config values | Why the value exists and where it comes from |
| Workarounds or edge cases | The specific condition being handled and why |
| External API calls | Which service is called and what the response shape is |

Do **not** add comments that merely repeat the code (e.g., `// loop over candidates` above a `forEach`). A comment that adds no information is worse than no comment.

## Overview

AI Recruiter Evaluator - A React + Node.js application that uses Google's Gemini AI to objectively evaluate candidate CVs against job descriptions. Originally created in Google AI Studio.

**AI Studio Link**: https://ai.studio/apps/7acb60db-b7f0-42a1-ad7a-9e6277c15f0d

## Environment Setup

**Prerequisites**: Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` file in root directory and set your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

## Development Commands

- **Start both servers**: `npm run dev` (frontend on port 3000, backend on port 3001)
- **Frontend only**: `npm run dev:client`
- **Backend only**: `npm run dev:server`
- **Build frontend**: `npm run build`
- **Build server**: `npm run build:server` (compiles to `dist/server/`)
- **Run production server**: `npm start`
- **Preview production build**: `npm run preview`
- **Type checking**: `npm run lint` (checks both frontend and server tsconfigs)
- **Clean build artifacts**: `npm run clean`

## Architecture

### Client-Server Overview

The app uses a **client-server architecture** connected by a REST API:

```
Browser → Vite dev server (3000) → /api proxy → Express server (3001) → Gemini API
```

- **Frontend**: React SPA served by Vite. Makes `fetch('/api/evaluate')` calls.
- **Backend**: Express server. Holds the Gemini API key and calls the AI model.
- In development, Vite proxies `/api/*` to `localhost:3001` — no CORS needed.
- The API key is **never** sent to the browser or included in the JS bundle.

### Tech Stack

**Frontend**
- React 19 with TypeScript
- Vite 6.2 (build tool + dev proxy)
- Tailwind CSS 4.1 (via @tailwindcss/vite plugin)
- Motion library v12 (animations)
- react-markdown (renders evaluation results)

**Backend**
- Node.js + Express 4
- @google/genai (Gemini SDK)
- dotenv (loads `.env.local`)
- tsx (runs TypeScript directly in development)

### File Structure

```
/
├── frontend/
│   ├── index.html            # HTML entry point (references /src/main.tsx)
│   └── src/
│       ├── main.tsx          # React entry point
│       ├── App.tsx           # All UI and state management
│       ├── index.css         # Global styles + custom color palette
│       └── services/
│           └── apiClient.ts  # fetch-based client for the backend API
├── server/
│   ├── index.ts              # Express entry point (port 3001)
│   └── routes/
│       └── evaluate.ts       # POST /api/evaluate — Gemini logic lives here
├── tsconfig.json             # Frontend TypeScript config (bundler mode, DOM)
├── tsconfig.server.json      # Server TypeScript config (NodeNext module)
└── vite.config.ts            # Vite config — root: frontend/, /api proxy
```

### Core Components

**Entry Point**: `frontend/src/main.tsx` — Standard React 19 initialization with StrictMode.

**Main Application**: `frontend/src/App.tsx` — All UI logic and state management:
- State via React hooks (no external state library)
- Form handling for job description and multiple candidates
- Calls `evaluateCandidates()` from `apiClient.ts`
- Real-time validation and error handling

**API Client**: `frontend/src/services/apiClient.ts` — Browser-side API wrapper:
- Exports `evaluateCandidates(jobDescription, candidates)` — same signature as the old geminiService
- Posts to `POST /api/evaluate` and returns the markdown string
- Throws descriptive errors on non-2xx responses

**Express Server**: `server/index.ts` — Starts Express on port 3001, loads `.env.local` via dotenv.

**Evaluate Route**: `server/routes/evaluate.ts` — `POST /api/evaluate` handler:
- Validates request body
- Reads `GEMINI_API_KEY` from `process.env` (never from client)
- Instantiates `GoogleGenAI` per-request
- Contains the full system instruction prompt (~95 lines)
- Returns `{ result: string }` on success, `{ error: string }` on failure

### API Contract

**`POST /api/evaluate`**

Request:
```json
{
  "jobDescription": "string",
  "candidates": [{ "name": "string", "cv": "string" }]
}
```

Response (200):
```json
{ "result": "markdown-formatted evaluation" }
```

Error responses: `400` (bad input), `500` (missing key), `502` (Gemini failure) — all return `{ "error": "string" }`.

### AI Evaluation Logic

The system instruction defines a 5-step evaluation process:
1. CV data extraction
2. Knockout criteria verification (binary pass/fail)
3. Desirable criteria scoring (0–10 scale)
4. Global score calculation with weighted average
5. Markdown-formatted output generation

Score thresholds: `8.0–10.0` → APTO, `5.5–7.9` → REVISAR, `0.0–5.4` → NO APTO.

Model: `gemini-3.1-pro-preview` at temperature `0.2` (low, for consistent results).

### Environment Variable Handling

`GEMINI_API_KEY` is read exclusively by the Express server at request time via dotenv:

```typescript
// server/index.ts — runs before any route handler
import { config } from 'dotenv';
config({ path: '.env.local' });
```

The key is **not** referenced anywhere in the frontend code or Vite config. It never enters the browser bundle.

### TypeScript Configuration

Two separate tsconfigs:

| File | Scope | Module system | Purpose |
|---|---|---|---|
| `tsconfig.json` | `src/`, `vite.config.ts` | ESNext + bundler | Frontend (Vite handles compilation) |
| `tsconfig.server.json` | `server/` | NodeNext | Server (emits to `dist/server/`) |

**NodeNext import rule**: Relative imports inside `server/` must use `.js` extensions in source (e.g., `'./routes/evaluate.js'`). tsx resolves `.js` → `.ts` at dev time; Node uses the compiled `.js` in production.

### Hot Module Replacement (HMR)

HMR can be disabled via `DISABLE_HMR=true` environment variable (used in AI Studio to prevent flickering during agent edits).

### Path Aliases

`@/*` alias points to the root directory (configured in both Vite and tsconfig, currently unused).

## Design System

The application uses a custom "natural" color palette defined in CSS custom properties (see `src/index.css`):
- `--natural-olive`: Primary brand color
- `--natural-sage`: Secondary accent color
- `--natural-apto`: Success/approval state (green)
- `--natural-revisar`: Review/warning state (amber)
- `--natural-descartar`: Error/reject state (red)
- `--natural-bg`, `--natural-card`, `--natural-line`: Layout and borders
- `--natural-text`, `--natural-sub`: Text hierarchy

## Key Features Implementation

1. **Dynamic Candidate Management**: Users can add/remove candidates dynamically. Minimum of 1 candidate enforced in UI.

2. **Validation**: Client-side validation ensures job description and at least one complete candidate (name + CV) before evaluation.

3. **AI Evaluation Flow**:
   - Frontend sends `POST /api/evaluate` with job description + candidates
   - Express server builds the Gemini prompt and calls the API
   - Returns markdown-formatted evaluation to the browser
   - Frontend renders results using ReactMarkdown

4. **Loading States**: Three distinct UI states:
   - Empty state (pre-evaluation)
   - Loading state (during API call)
   - Results state (post-evaluation)
