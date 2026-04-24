/**
 * Unit tests for frontend/src/services/apiClient.ts — evaluateCandidates()
 *
 * Why we stub global.fetch instead of using MSW:
 *   MSW (Mock Service Worker) is the ideal tool for integration-level fetch
 *   interception, but for unit tests that only verify *how* evaluateCandidates
 *   builds and sends the request, vi.stubGlobal is enough. It lets us inspect
 *   the exact FormData entries without spinning up a service worker.
 *
 * FormData inspection note:
 *   FormData.get() / .has() are available in jsdom's FormData implementation,
 *   but the values are always strings or File objects — never numbers — so
 *   comparisons must account for that.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { evaluateCandidates } from '../../frontend/src/services/apiClient.js';
import type { CandidatePayload } from '../../frontend/src/services/apiClient.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock Response that satisfies the fetch API surface used
 * by evaluateCandidates: .ok, .status, .json().
 */
function makeFetchResponse(
  ok: boolean,
  body: Record<string, unknown>,
  status = ok ? 200 : 400,
): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

/** Minimal text-only candidate payload used across tests. */
const textCandidate: CandidatePayload = {
  name: 'Alice',
  cv: 'Five years of TypeScript experience.',
  cvFile: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evaluateCandidates', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Replace the global fetch with a controllable mock.
    // vi.stubGlobal restores the original automatically when vi.unstubAllGlobals()
    // is called — we do this in afterEach to avoid leaking state between suites.
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Request shape — text job description ─────────────────────────────────

  it('sends POST to /api/evaluate with jobDescription as a FormData field', async () => {
    fetchMock.mockResolvedValue(
      makeFetchResponse(true, { result: 'Evaluation markdown' }),
    );

    await evaluateCandidates('We need a TypeScript engineer.', null, [textCandidate]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/evaluate');
    expect(init.method).toBe('POST');

    // Verify that the body is a FormData instance (not JSON).
    // This matters because the backend uses multer, which only handles multipart.
    expect(init.body).toBeInstanceOf(FormData);

    const form = init.body as FormData;
    expect(form.get('jobDescription')).toBe('We need a TypeScript engineer.');
    // When text is provided, no file field should be appended
    expect(form.has('jobDescriptionFile')).toBe(false);
  });

  it('appends candidate name and cv text under indexed bracket keys', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(true, { result: 'ok' }));

    await evaluateCandidates('JD text', null, [textCandidate]);

    const form = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .body as FormData;

    expect(form.get('candidates[0][name]')).toBe('Alice');
    expect(form.get('candidates[0][cv]')).toBe(
      'Five years of TypeScript experience.',
    );
    // No file field when candidate.cvFile is null
    expect(form.has('candidates[0][cvFile]')).toBe(false);
  });

  // ── Request shape — file job description ─────────────────────────────────

  it('appends jobDescriptionFile instead of jobDescription when a File is provided', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(true, { result: 'file result' }));

    // Use a real File object — jsdom's File constructor is available in the
    // jsdom environment configured for frontend tests.
    const jdFile = new File(['JD file content'], 'job-description.txt', {
      type: 'text/plain',
    });

    await evaluateCandidates(null, jdFile, [textCandidate]);

    const form = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .body as FormData;

    // File object should be appended under jobDescriptionFile
    expect(form.get('jobDescriptionFile')).toBe(jdFile);
    // When a file is provided, the text field must NOT be appended
    expect(form.has('jobDescription')).toBe(false);
  });

  it('appends cvFile under the indexed bracket key when candidate has a file', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(true, { result: 'ok' }));

    const cvFile = new File(['CV content'], 'alice-cv.pdf', {
      type: 'application/pdf',
    });
    const fileCandidate: CandidatePayload = {
      name: 'Alice',
      cv: '',
      cvFile,
    };

    await evaluateCandidates('JD text', null, [fileCandidate]);

    const form = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .body as FormData;

    expect(form.get('candidates[0][cvFile]')).toBe(cvFile);
    // When a cvFile is provided, cv text must NOT be appended
    expect(form.has('candidates[0][cv]')).toBe(false);
  });

  // ── Multiple candidates ───────────────────────────────────────────────────

  it('appends multiple candidates with incrementing indexes', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(true, { result: 'multi' }));

    const candidates: CandidatePayload[] = [
      { name: 'Alice', cv: 'Alice CV', cvFile: null },
      { name: 'Bob', cv: 'Bob CV', cvFile: null },
    ];

    await evaluateCandidates('JD', null, candidates);

    const form = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .body as FormData;

    expect(form.get('candidates[0][name]')).toBe('Alice');
    expect(form.get('candidates[1][name]')).toBe('Bob');
    expect(form.get('candidates[1][cv]')).toBe('Bob CV');
  });

  // ── No Content-Type header ────────────────────────────────────────────────

  it('does not set Content-Type header so the browser can set the multipart boundary', async () => {
    fetchMock.mockResolvedValue(makeFetchResponse(true, { result: 'ok' }));

    await evaluateCandidates('JD', null, [textCandidate]);

    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    // If Content-Type were set manually to 'multipart/form-data', the browser
    // would not append the boundary parameter, causing the server to reject the
    // request. The correct approach is to omit it and let the browser fill it in.
    const headers = init.headers as Record<string, string> | undefined;
    expect(headers?.['Content-Type']).toBeUndefined();
  });

  // ── Error handling ─────────────────────────────────────────────────────────

  it('throws with the server error message when the response is 4xx', async () => {
    fetchMock.mockResolvedValue(
      makeFetchResponse(false, { error: 'Candidate name is required' }, 400),
    );

    await expect(
      evaluateCandidates('JD', null, [textCandidate]),
    ).rejects.toThrow('Candidate name is required');
  });

  it('throws with the server error message when the response is 5xx', async () => {
    fetchMock.mockResolvedValue(
      makeFetchResponse(false, { error: 'GEMINI_API_KEY not set' }, 500),
    );

    await expect(
      evaluateCandidates('JD', null, [textCandidate]),
    ).rejects.toThrow('GEMINI_API_KEY not set');
  });

  it('throws with a fallback message when the error response has no body', async () => {
    // Simulate a response where .json() fails (e.g. empty body or HTML error page).
    // evaluateCandidates catches .json() failures via .catch(() => ({})) and
    // falls back to a generic "Server error: <status>" message.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON')),
    });

    await expect(
      evaluateCandidates('JD', null, [textCandidate]),
    ).rejects.toThrow(/server error.*503/i);
  });

  // ── Return value ─────────────────────────────────────────────────────────

  it('returns the markdown string from data.result on success', async () => {
    const markdown = '## Score\n**8.5 / 10 — APTO**';
    fetchMock.mockResolvedValue(makeFetchResponse(true, { result: markdown }));

    const result = await evaluateCandidates('JD', null, [textCandidate]);

    expect(result).toBe(markdown);
  });
});
