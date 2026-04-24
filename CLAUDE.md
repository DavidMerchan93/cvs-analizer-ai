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

## NON-NEGOTIABLE RULE — Automatic Agent Routing

**Every request, question, adjustment, or task entered in this project must be automatically evaluated to determine which agent should handle it.** Do not answer or execute without first identifying the responsible agent and delegating to it.

### Evaluation Process (required before every task)

```
1. Read the request
2. Identify the domain: backend? frontend? infra? DB? security? QA? cloud?
3. Select the matching agent from the roster
4. If the request spans multiple domains → sequence the agents (see Handoff Rules)
5. Execute via the selected agent — not as the default assistant
```

### Selection Criteria

| If the request involves… | Route to… |
|---|---|
| Express, Node.js, API routes, Gemini SDK, env vars | `@senior-backend-engineer` |
| React, Tailwind, Vite, UI components, animations | `@senior-frontend-engineer` |
| Docker, GitHub Actions, npm scripts, build/deploy pipeline | `@senior-devops-engineer` |
| Database schema, Prisma, migrations, persistence | `@senior-database-engineer` |
| Tests, coverage, Vitest, Playwright, test strategy | `@senior-qa-engineer` |
| AWS, Firebase, cloud architecture, CDN, scaling | `@cloud-architect` |
| Security, auth, rate limiting, CORS, OWASP, secrets | `@senior-cybersecurity-engineer` |
| Multiple domains simultaneously | Sequence agents per Handoff Rules |

### Example — How to Apply This Rule

**User input:**
> "Quiero agregar un historial de evaluaciones que persista entre sesiones"

**Correct routing evaluation:**
```
→ "persista entre sesiones"  requires a database         → @senior-database-engineer first
→ "historial"                requires a new API endpoint  → @senior-backend-engineer second
→ "historial"                requires a new UI section    → @senior-frontend-engineer third
→ new endpoint + user data   security review required     → @senior-cybersecurity-engineer fourth
→ all of the above           needs tests                  → @senior-qa-engineer last
```

**Wrong approach** — answering the question directly without agent routing, as a generic assistant.

**Right approach** — delegate to `@senior-database-engineer` first, follow the sequence above.

---

> **If a request is ambiguous**, default to `@senior-backend-engineer` for server-side doubts and `@senior-frontend-engineer` for UI doubts. Never skip routing.

---

## Development Team Agents

The project has 7 specialized Claude Code sub-agents in `.claude/agents/`. Each agent knows the exact stack, file structure, and current gaps of this project — they don't need onboarding context.

### Agent Roster

| Agent | File | Invoke when… |
|---|---|---|
| Senior Backend Engineer | `.claude/agents/senior-backend-engineer.md` | Express routes, Gemini SDK, middleware, TypeScript NodeNext |
| Senior Frontend Engineer | `.claude/agents/senior-frontend-engineer.md` | React components, Tailwind v4, Vite config, API client |
| Senior DevOps Engineer | `.claude/agents/senior-devops-engineer.md` | Docker, GitHub Actions, npm scripts, build pipeline |
| Senior Database Engineer | `.claude/agents/senior-database-engineer.md` | Schema design, Prisma/ORM setup, migrations, persistence |
| Senior QA Engineer | `.claude/agents/senior-qa-engineer.md` | Vitest/Playwright tests, coverage, test strategy |
| Cloud Architect | `.claude/agents/cloud-architect.md` | AWS (ECS, S3, CloudFront, RDS) or Firebase deployment |
| Senior Cybersecurity Engineer | `.claude/agents/senior-cybersecurity-engineer.md` | Security audits, rate limiting, helmet, CORS, auth |

All agents share the same conventions defined in this file (comments, doc sync, no secret leaks).

---

## Agent Workflow Guide

### How to Invoke an Agent

Use `@` mention syntax in Claude Code followed by the agent name:

```
@senior-backend-engineer agrega rate limiting al endpoint /api/evaluate
@senior-frontend-engineer crea un componente de historial de evaluaciones
@senior-qa-engineer escribe tests de integración para POST /api/evaluate
```

Claude Code also routes automatically — if you describe a task without `@`, it will select the most appropriate agent based on the task description.

---

### Standard Development Lifecycle

Every feature follows this sequence. Skip steps only when the change is trivially small.

```
1. PLAN          → Define scope (you + Claude Code, no agent needed)
2. IMPLEMENT     → Backend Engineer and/or Frontend Engineer write the code
3. SECURE        → Cybersecurity Engineer reviews for vulnerabilities
4. TEST          → QA Engineer writes tests and verifies coverage
5. SHIP          → DevOps Engineer (Docker/CI) + Cloud Architect (deploy)
```

---

### Workflow by Scenario

#### Adding a New API Endpoint

```
1. @senior-backend-engineer   → design and implement the route in backend/routes/
2. @senior-cybersecurity-engineer → review for input validation, rate limiting, auth gaps
3. @senior-qa-engineer        → write unit + integration tests for the new endpoint
4. @senior-frontend-engineer  → extend apiClient.ts and wire up the UI (if needed)
```

#### Adding a New UI Feature

```
1. @senior-frontend-engineer  → build components, update App.tsx or split into new files
2. @senior-backend-engineer   → create supporting API routes if needed
3. @senior-qa-engineer        → write component tests and E2E flow
```

#### Adding the Database (not yet implemented)

```
1. @senior-database-engineer  → design schema, set up Prisma, write migrations
2. @senior-backend-engineer   → integrate Prisma client into existing routes
3. @senior-cybersecurity-engineer → verify DATABASE_URL is not committed, review query security
4. @senior-qa-engineer        → add integration tests for persistence layer
5. @senior-devops-engineer    → add DB to Docker Compose and CI environment
```

#### Security Hardening Sprint

```
1. @senior-cybersecurity-engineer → audit current vulnerabilities (helmet, rate-limit, CORS, auth)
2. @senior-backend-engineer       → implement the fixes in backend/index.ts and routes
3. @senior-qa-engineer            → write abuse-case tests (oversized payloads, missing auth, flood)
```

#### First Production Deployment

```
1. @senior-devops-engineer    → write Dockerfile (multi-stage), add health check endpoint
2. @senior-cloud-architect    → choose AWS vs Firebase, write IaC (CDK/Terraform or firebase.json)
3. @senior-cybersecurity-engineer → production security checklist (HTTPS, CORS origin, secrets)
4. @senior-devops-engineer    → configure GitHub Actions CI/CD pipeline
```

#### Setting Up CI/CD from Scratch

```
1. @senior-devops-engineer    → add GitHub Actions workflow (lint → build → test → deploy)
2. @senior-qa-engineer        → ensure tests run cleanly in CI (no real Gemini calls, no flaky)
3. @senior-cybersecurity-engineer → verify no secrets in workflow files or build outputs
```

#### Scaling / Performance Work

```
1. @senior-backend-engineer   → identify bottlenecks (Gemini latency, no caching, no connection pool)
2. @senior-database-engineer  → add indexes, optimize queries, consider read replicas
3. @senior-cloud-architect    → horizontal scaling strategy (ECS auto-scaling, Firebase scaling rules)
4. @senior-devops-engineer    → update Docker resource limits, health check thresholds
```

---

### Agent Handoff Rules

When one agent's output is the input for the next, follow these handoff conventions:

1. **Backend → Frontend**: Backend defines the API contract first (request/response shape, error codes). Frontend implements against that contract — never the reverse.

2. **Any agent → QA**: The implementing agent should note which behaviors are critical to test. QA writes tests for those behaviors plus failure/edge cases.

3. **Any agent → Cybersecurity**: Security review happens *after* implementation but *before* merge. The implementing agent should flag any shortcuts taken (e.g., "skipped auth for now").

4. **DevOps → Cloud Architect**: DevOps owns the build/container layer. Cloud Architect owns the infrastructure that runs it. Both must agree on port exposure, health check path, and environment variable injection.

5. **Database → Backend**: Database Engineer defines the schema and Prisma client. Backend Engineer uses the generated types — never writes raw SQL that bypasses Prisma.

---

### When to Use Multiple Agents in Parallel

Claude Code can run agents concurrently for independent tasks. Use parallel invocation when:

- Frontend UI work and backend route work don't share files
- Writing tests (QA) while the Cloud Architect works on deployment config
- Security review of an existing feature while DevOps writes the CI pipeline

Do **not** run agents in parallel when their changes touch the same files — serialize those to avoid conflicts.

---

### Quick Reference: Agent by File

| File modified | Primary agent | Secondary agent |
|---|---|---|
| `backend/index.ts` | Backend Engineer | Cybersecurity Engineer |
| `backend/routes/*.ts` | Backend Engineer | QA Engineer |
| `frontend/src/App.tsx` | Frontend Engineer | QA Engineer |
| `frontend/src/services/apiClient.ts` | Frontend Engineer | Backend Engineer |
| `frontend/src/index.css` | Frontend Engineer | — |
| `vite.config.ts` | DevOps Engineer | Frontend Engineer |
| `package.json` | DevOps Engineer | — |
| `tsconfig*.json` | DevOps Engineer | Backend/Frontend Engineer |
| `Dockerfile` / `docker-compose.yml` | DevOps Engineer | Cloud Architect |
| `.github/workflows/*.yml` | DevOps Engineer | Cybersecurity Engineer |
| `prisma/schema.prisma` | Database Engineer | Backend Engineer |
| `tests/**` | QA Engineer | — |
| IaC files (`*.tf`, `cdk.ts`, `firebase.json`) | Cloud Architect | DevOps Engineer |

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
- **Build server**: `npm run build:server` (compiles to `dist/backend/`)
- **Run production server**: `npm start`
- **Preview production build**: `npm run preview`
- **Type checking**: `npm run lint` (checks both frontend and backend tsconfigs)
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
- multer (multipart/form-data file uploads, memory storage)
- pdf-parse (PDF text extraction)
- mammoth (DOCX text extraction)
- dotenv (loads `.env.local`)
- tsx (runs TypeScript directly in development)

**Testing**
- Vitest (test runner for both frontend and backend)
- @testing-library/react + @testing-library/jest-dom + @testing-library/user-event (component tests)
- supertest (HTTP integration tests against Express app)
- jsdom (browser environment for frontend tests)

### File Structure

```
/
├── frontend/
│   ├── index.html            # HTML entry point (references /src/main.tsx)
│   └── src/
│       ├── main.tsx          # React entry point
│       ├── App.tsx           # All UI and state management
│       ├── index.css         # Global styles + custom color palette
│       ├── components/
│       │   └── FileUpload.tsx  # Reusable drag-and-drop file upload component
│       └── services/
│           └── apiClient.ts  # FormData-based client for the backend API
├── backend/
│   ├── index.ts              # Express entry point (port 3001); exports `app` for tests
│   ├── routes/
│   │   └── evaluate.ts       # POST /api/evaluate — multer + Gemini logic
│   └── utils/
│       └── fileParser.ts     # Extracts plain text from PDF / DOCX / TXT files
├── tests/
│   ├── setup.ts              # @testing-library/jest-dom global setup for jsdom tests
│   ├── backend/
│   │   ├── fileParser.test.ts   # Unit tests for text extraction utility
│   │   └── evaluate.test.ts     # Integration tests for POST /api/evaluate via supertest
│   └── frontend/
│       ├── apiClient.test.ts    # Unit tests for FormData construction and fetch calls
│       └── FileUpload.test.tsx  # Component tests for drag-and-drop upload UI
├── vitest.config.ts          # Vitest config for frontend tests (jsdom environment)
├── vitest.node.config.ts     # Vitest config for backend tests (node environment)
├── tsconfig.json             # Frontend TypeScript config (bundler mode, DOM)
├── tsconfig.server.json      # Backend TypeScript config (NodeNext module)
└── vite.config.ts            # Vite config — root: frontend/, /api proxy
```

### Core Components

**Entry Point**: `frontend/src/main.tsx` — Standard React 19 initialization with StrictMode.

**Main Application**: `frontend/src/App.tsx` — All UI logic and state management:
- State via React hooks (no external state library)
- Form handling for job description and multiple candidates
- Calls `evaluateCandidates()` from `apiClient.ts`
- Real-time validation and error handling

**File Upload Component**: `frontend/src/components/FileUpload.tsx` — Controlled, reusable drag-and-drop zone:
- Accepts PDF, DOCX, TXT files
- Controlled via `currentFile` prop (state lives in App.tsx)
- Accessible: keyboard-navigable, ARIA roles, drag-over highlight

**API Client**: `frontend/src/services/apiClient.ts` — Browser-side API wrapper:
- Exports `evaluateCandidates(jobDescription, jobDescriptionFile, candidates)`
- Sends `multipart/form-data` via `FormData` (no `Content-Type` header set manually — browser fills in the boundary)
- Posts to `POST /api/evaluate` and returns the markdown string
- Throws descriptive errors on non-2xx responses

**Express Server**: `backend/index.ts` — Starts Express on port 3001, loads `.env.local` via dotenv.

**Evaluate Route**: `backend/routes/evaluate.ts` — `POST /api/evaluate` handler:
- Parses multipart/form-data via multer (memory storage, 10 MB per file, max 12 files)
- Resolves job description and each CV from either text field or file upload
- Character-limits extracted text: 20 000 chars for JD, 30 000 chars per CV
- Reads `GEMINI_API_KEY` from `process.env` (never from client)
- Contains the full system instruction prompt
- Returns `{ result: string }` on success, `{ error: string }` on failure

**File Parser**: `backend/utils/fileParser.ts` — Single `extractTextFromFile(file)` function:
- PDF → pdf-parse · DOCX → mammoth · TXT → buffer.toString('utf-8')
- Files are never written to disk (multer memoryStorage)
- Throws on unsupported MIME type (surfaced as 422 by the route)

### API Contract

**`POST /api/evaluate`** — accepts `multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `jobDescription` | text | Required if no `jobDescriptionFile` |
| `jobDescriptionFile` | file | PDF / DOCX / TXT — required if no `jobDescription` |
| `candidates[N][name]` | text | Required for each candidate |
| `candidates[N][cv]` | text | Required if no `candidates[N][cvFile]` |
| `candidates[N][cvFile]` | file | PDF / DOCX / TXT — required if no `candidates[N][cv]` |

Max candidates: 10. Max files per request: 12. Max file size: 10 MB.

Response (200):
```json
{ "result": "markdown-formatted evaluation" }
```

Error responses: `400` (bad input / too many files), `422` (unreadable file), `500` (missing key), `502` (Gemini failure) — all return `{ "error": "string" }`.

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
// backend/index.ts — runs before any route handler
import { config } from 'dotenv';
config({ path: '.env.local' });
```

The key is **not** referenced anywhere in the frontend code or Vite config. It never enters the browser bundle.

### TypeScript Configuration

Two separate tsconfigs:

| File | Scope | Module system | Purpose |
|---|---|---|---|
| `tsconfig.json` | `src/`, `vite.config.ts` | ESNext + bundler | Frontend (Vite handles compilation) |
| `tsconfig.server.json` | `backend/` | NodeNext | Backend (emits to `dist/backend/`) |

**NodeNext import rule**: Relative imports inside `backend/` must use `.js` extensions in source (e.g., `'./routes/evaluate.js'`). tsx resolves `.js` → `.ts` at dev time; Node uses the compiled `.js` in production.

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

2. **File Upload**: Job description and each candidate CV can be provided as typed text **or** as an uploaded file (PDF, DOCX, TXT). The `FileUpload` component supports drag-and-drop and click-to-browse. Mode toggles (text / file) are available for both the JD and each candidate card. Switching modes preserves already-typed text.

3. **Validation**: Client-side validation accepts either text or file per field — both are not required simultaneously. At least one candidate with name + (text or file) must be present before evaluation.

3. **AI Evaluation Flow**:
   - Frontend sends `POST /api/evaluate` with job description + candidates
   - Express server builds the Gemini prompt and calls the API
   - Returns markdown-formatted evaluation to the browser
   - Frontend renders results using ReactMarkdown

4. **Loading States**: Three distinct UI states:
   - Empty state (pre-evaluation)
   - Loading state (during API call)
   - Results state (post-evaluation)
