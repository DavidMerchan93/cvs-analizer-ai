# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AI Recruiter Evaluator - A React-based web application that uses Google's Gemini AI to objectively evaluate candidate CVs against job descriptions. Originally created in Google AI Studio.

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

- **Start dev server**: `npm run dev` (runs on port 3000, accessible at http://0.0.0.0:3000)
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`
- **Type checking**: `npm run lint` (runs TypeScript compiler without emitting files)
- **Clean build artifacts**: `npm run clean`

## Architecture

### Tech Stack
- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6.2
- **Styling**: Tailwind CSS 4.1 (via @tailwindcss/vite plugin)
- **AI Integration**: Google Gemini AI (@google/genai)
- **Animations**: Motion library (v12)
- **Markdown Rendering**: react-markdown (for displaying evaluation results)

### Application Structure

**Single-Page Application (SPA)** with a two-panel layout:
- **Left Panel** (40% width): Input form for job description and candidate CVs
- **Right Panel** (60% width): Displays AI-generated evaluation results

### Core Components

**Entry Point**: `src/main.tsx` - Standard React 19 app initialization with StrictMode

**Main Application**: `src/App.tsx` - Contains all UI logic and state management:
- State managed via React hooks (no external state management library)
- Form handling for job description and multiple candidates
- Integration with Gemini AI service for evaluation
- Real-time validation and error handling

**AI Service**: `src/services/geminiService.ts` - Encapsulates Gemini AI integration:
- Exports `evaluateCandidates()` function that takes job description and candidate array
- Uses `gemini-3.1-pro-preview` model with temperature set to 0.2 for consistent results
- Contains extensive system instruction prompt (~95 lines) that defines the AI agent's behavior as an expert recruiter
- System instruction implements a 5-step evaluation process:
  1. CV data extraction
  2. Knockout criteria verification (binary pass/fail)
  3. Desirable criteria scoring (0-10 scale)
  4. Global score calculation with weighted average
  5. Markdown-formatted output generation

### Environment Variable Handling

The Gemini API key is injected at build time through Vite's `define` configuration:
```typescript
// vite.config.ts
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
}
```

This allows the API key from `.env.local` to be accessed as `process.env.GEMINI_API_KEY` in the browser bundle.

### Hot Module Replacement (HMR)

HMR can be disabled via `DISABLE_HMR=true` environment variable (used in AI Studio to prevent flickering during agent edits). File watching is also disabled in this mode.

### Path Aliases

TypeScript and Vite are configured with `@/*` alias pointing to the root directory, though currently not used in the codebase.

## Design System

The application uses a custom "natural" color palette defined in CSS custom properties (see `src/index.css`):
- `--natural-olive`: Primary brand color
- `--natural-sage`: Secondary accent color
- `--natural-apto`: Success/approval state (green)
- `--natural-descartar`: Error/reject state (red)
- `--natural-bg`, `--natural-card`, `--natural-line`: Layout and borders
- `--natural-text`, `--natural-sub`: Text hierarchy

## Key Features Implementation

1. **Dynamic Candidate Management**: Users can add/remove candidates dynamically. Minimum of 1 candidate enforced in UI.

2. **Validation**: Client-side validation ensures job description and at least one complete candidate (name + CV) before evaluation.

3. **AI Evaluation Flow**:
   - Constructs prompt combining job description + all candidate CVs
   - Sends to Gemini with low temperature (0.2) for consistency
   - Receives markdown-formatted evaluation
   - Renders results using ReactMarkdown component

4. **Loading States**: Three distinct UI states:
   - Empty state (pre-evaluation)
   - Loading state (during API call)
   - Results state (post-evaluation)

## TypeScript Configuration

- Target: ES2022
- JSX: react-jsx (new JSX transform)
- Module resolution: bundler
- Experimental decorators enabled
- `noEmit: true` (Vite handles compilation)
- `allowImportingTsExtensions: true` (for .tsx imports)
