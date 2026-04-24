/**
 * Integration tests for POST /api/evaluate
 *
 * Strategy: use supertest to fire real HTTP requests against the Express app
 * without binding to a port. This tests the full request/validation/response
 * pipeline while keeping the suite fast and side-effect-free.
 *
 * Why we mock @google/genai:
 *   Calling the real Gemini API in tests would (a) cost money, (b) be flaky
 *   depending on network/quota, and (c) make tests slow. We only care that the
 *   route correctly wires up the SDK and maps its response to { result: string }.
 *
 * Why we mock fileParser:
 *   fileParser.ts has its own unit-test suite. Here we only verify the route's
 *   behaviour when extraction succeeds or fails — we don't need real file I/O.
 *
 * Multipart note:
 *   The route uses multer.memoryStorage() and reads req.body fields *after*
 *   multer runs. supertest's `.field()` / `.attach()` methods produce a valid
 *   multipart/form-data body, so the middleware chain executes correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted before any import resolves)
// ---------------------------------------------------------------------------

// Intercept the Gemini SDK so we never make real API calls.
// We store the mock in module scope so individual tests can change its behaviour
// (e.g., mockResolvedValue for happy path, mockRejectedValue for 502 tests).
//
// Why we use a `function` keyword (not an arrow) for the mockImplementation:
// GoogleGenAI is used as a constructor (`new GoogleGenAI(...)`). Vitest requires
// constructor mocks to be defined with `function` or `class` — arrow functions
// lack a prototype and cannot be invoked with `new`, resulting in the
// "is not a constructor" error.
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function (
    this: { models: { generateContent: typeof mockGenerateContent } },
  ) {
    this.models = { generateContent: mockGenerateContent };
  }),
}));

// Intercept fileParser so tests that exercise the file-upload code path don't
// need real PDF/DOCX parsers. The default behaviour is a successful extraction.
vi.mock('../../backend/utils/fileParser.js', () => ({
  extractTextFromFile: vi.fn().mockResolvedValue('Mocked extracted text from file'),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------
import request from 'supertest';
import { app } from '../../backend/index.js';
import { extractTextFromFile } from '../../backend/utils/fileParser.js';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a supertest agent pre-configured with the /api/evaluate path so
 * each test just calls `.field()` / `.attach()` / `.expect()`.
 */
const postEvaluate = () => request(app).post('/api/evaluate');

/**
 * Builds the minimal valid multipart body for a single text-only candidate.
 * Reused across many tests — keeps the signal-to-noise ratio high in each case.
 */
function validTextRequest(agent: ReturnType<typeof postEvaluate>) {
  return agent
    .field('jobDescription', 'We need a senior TypeScript engineer.')
    .field('candidates[0][name]', 'Alice')
    .field('candidates[0][cv]', 'Alice has 5 years of TypeScript experience.');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/evaluate', () => {
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore a valid API key before each test so happy-path tests don't
    // accidentally hit the "missing key" branch.
    process.env.GEMINI_API_KEY = 'test-api-key-12345';
  });

  afterEach(() => {
    // Restore the original value so we don't leak state between test files.
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  // ── 400 — Input validation ─────────────────────────────────────────────

  it('returns 400 when jobDescription is missing and no file is uploaded', async () => {
    const res = await postEvaluate()
      .field('candidates[0][name]', 'Bob')
      .field('candidates[0][cv]', 'Bob has 3 years of experience.');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    // The error message should tell the client which field is missing
    expect(res.body.error).toMatch(/jobDescription/i);
  });

  it('returns 400 when no candidates are provided', async () => {
    const res = await postEvaluate().field(
      'jobDescription',
      'We need a senior engineer.',
    );

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/candidate/i);
  });

  it('returns 400 when a candidate is missing a name', async () => {
    const res = await postEvaluate()
      .field('jobDescription', 'We need a senior engineer.')
      // Send cv but omit the name field entirely
      .field('candidates[0][cv]', 'Some CV text here.');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('returns 400 when a candidate has neither cv text nor cvFile', async () => {
    const res = await postEvaluate()
      .field('jobDescription', 'We need a senior engineer.')
      // Name present but neither cv nor cvFile — the route must reject this
      .field('candidates[0][name]', 'Carol');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cv/i);
  });

  it('returns 400 when jobDescription exceeds the 20 000 character limit', async () => {
    // Generate a string just over the limit.
    // This simulates a user pasting an enormous document into the text field.
    const oversizedJD = 'x'.repeat(20_001);

    const res = await postEvaluate()
      .field('jobDescription', oversizedJD)
      .field('candidates[0][name]', 'Dave')
      .field('candidates[0][cv]', 'Short CV.');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too long/i);
  });

  it('returns 400 when a CV exceeds the 30 000 character limit', async () => {
    const oversizedCV = 'y'.repeat(30_001);

    const res = await postEvaluate()
      .field('jobDescription', 'We need a senior engineer.')
      .field('candidates[0][name]', 'Eve')
      .field('candidates[0][cv]', oversizedCV);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too long/i);
  });

  // ── 500 — Server misconfiguration ─────────────────────────────────────

  it('returns 500 when GEMINI_API_KEY is not set', async () => {
    // Temporarily unset the key to simulate a misconfigured deployment.
    // We do NOT mock the SDK here because the route should bail out before
    // reaching the Gemini call.
    delete process.env.GEMINI_API_KEY;

    const res = await validTextRequest(postEvaluate());

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/GEMINI_API_KEY/i);
    // Verify the SDK was NOT called — the guard should have short-circuited
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  // ── 502 — Upstream (Gemini) failure ────────────────────────────────────

  it('returns 502 when the Gemini SDK throws an error', async () => {
    // The SDK throws (e.g. quota exceeded, network timeout) — the route must
    // map this to a 502 Bad Gateway rather than a 500 Internal Server Error,
    // signalling to the client that the failure is in an upstream dependency.
    mockGenerateContent.mockRejectedValue(new Error('Quota exceeded'));

    const res = await validTextRequest(postEvaluate());

    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Quota exceeded/i);
  });

  // ── 200 — Happy path ────────────────────────────────────────────────────

  it('returns 200 with { result } on a valid text-only request', async () => {
    // The mock returns the shape that GoogleGenAI.models.generateContent() resolves to.
    // `response.text` is the string accessor the route reads.
    mockGenerateContent.mockResolvedValue({ text: '## Evaluation\nScore: 8.5' });

    const res = await validTextRequest(postEvaluate());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: '## Evaluation\nScore: 8.5' });
  });

  it('forwards all candidates to Gemini in submission order', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'multi-candidate result' });

    const res = await postEvaluate()
      .field('jobDescription', 'We need two engineers.')
      .field('candidates[0][name]', 'Alice')
      .field('candidates[0][cv]', 'Alice CV text.')
      .field('candidates[1][name]', 'Bob')
      .field('candidates[1][cv]', 'Bob CV text.');

    expect(res.status).toBe(200);

    // Inspect the prompt that was passed to Gemini to verify both candidates appear.
    const callArg = mockGenerateContent.mock.calls[0][0] as { contents: string };
    expect(callArg.contents).toMatch(/CANDIDATO 1.*Alice/s);
    expect(callArg.contents).toMatch(/CANDIDATO 2.*Bob/s);
  });

  // ── File upload path ────────────────────────────────────────────────────

  it('accepts a jobDescriptionFile instead of jobDescription text', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'file-based result' });
    // extractTextFromFile mock already returns 'Mocked extracted text from file'

    const res = await postEvaluate()
      // Attach a fake file buffer; mimetype must be acceptable to multer
      .attach('jobDescriptionFile', Buffer.from('JD file content'), {
        filename: 'job-description.txt',
        contentType: 'text/plain',
      })
      .field('candidates[0][name]', 'Frank')
      .field('candidates[0][cv]', 'Frank CV text.');

    expect(res.status).toBe(200);
    // Verify the file parser was actually invoked for the JD file
    expect(extractTextFromFile).toHaveBeenCalled();
  });

  it('returns 422 when fileParser throws during job description parsing', async () => {
    // Simulate a corrupt file that the parser cannot handle.
    // 422 Unprocessable Entity is the correct HTTP status: the request was
    // well-formed (valid multipart) but the content could not be processed.
    (extractTextFromFile as Mock).mockRejectedValueOnce(
      new Error('Corrupt PDF: unexpected end of stream'),
    );

    const res = await postEvaluate()
      .attach('jobDescriptionFile', Buffer.from('bad-pdf'), {
        filename: 'broken.pdf',
        contentType: 'application/pdf',
      })
      .field('candidates[0][name]', 'Grace')
      .field('candidates[0][cv]', 'Grace CV text.');

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Corrupt PDF/i);
  });

  it('returns 422 when fileParser throws during CV file parsing', async () => {
    // First call (for JD) succeeds; second call (for CV file) fails.
    // mockResolvedValueOnce + mockRejectedValueOnce lets us sequence responses.
    (extractTextFromFile as Mock)
      .mockResolvedValueOnce('Parsed JD text')
      .mockRejectedValueOnce(new Error('Invalid DOCX structure'));

    const res = await postEvaluate()
      .attach('jobDescriptionFile', Buffer.from('jd-file'), {
        filename: 'jd.txt',
        contentType: 'text/plain',
      })
      .field('candidates[0][name]', 'Hector')
      .attach('candidates[0][cvFile]', Buffer.from('bad-docx'), {
        filename: 'hector-cv.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Invalid DOCX/i);
  });
});
