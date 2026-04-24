/**
 * Unit tests for backend/utils/fileParser.ts
 *
 * Why we mock pdf-parse and mammoth:
 *   - These libraries do real I/O / WASM work. In a unit test we only care that
 *     fileParser.ts calls the right adapter with the right arguments. Testing
 *     the adapters themselves would be integration-testing third-party code —
 *     not our responsibility.
 *   - Mocking also keeps the tests fast (< 10 ms per test) and avoids needing
 *     real PDF/DOCX fixture files tracked in the repo.
 *
 * vi.mock() is hoisted by Vitest to the top of the module graph before any
 * imports are evaluated, so the mock is in place when fileParser.ts is loaded.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before the module under test is imported
// ---------------------------------------------------------------------------

// Mock pdf-parse so we never spin up pdfjs-dist's WASM worker in tests.
// The factory returns a class whose constructor/getText we can control per test.
// Why we don't use vi.fn() directly as the mock class:
// Vitest requires that a mock used as a constructor (with `new`) is defined as a
// real class or a function — plain vi.fn() doesn't satisfy the `new` contract
// and will throw "not a constructor". We use a class-based mock here so Vitest
// accepts `new PDFParse(...)` and individual tests can override the prototype
// methods via mockImplementation.
vi.mock('pdf-parse', () => {
  return {
    // Named export matching `import { PDFParse } from 'pdf-parse'`
    PDFParse: vi.fn().mockImplementation(function (this: { getText: () => Promise<{ text: string }> }) {
      // Default implementation: tests override this per-test with mockImplementation
      this.getText = vi.fn().mockResolvedValue({ text: '' });
    }),
  };
});

// Mock mammoth so we don't load the full DOCX processing engine.
vi.mock('mammoth', () => ({
  // Default export with `extractRawText` matching the shape used in fileParser.ts
  default: {
    extractRawText: vi.fn(),
  },
}));

// Import after mocks are registered so the SUT receives the mock instances
import { extractTextFromFile } from '../../backend/utils/fileParser.js';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Express.Multer.File from a buffer and mimetype.
 *
 * Why a helper: multer File objects have ~12 fields. Creating the full object
 * in every test would be noisy. We only need the fields actually read by
 * extractTextFromFile (mimetype, buffer, originalname).
 */
function makeFile(
  mimetype: string,
  content: Buffer,
  originalname = 'test-file',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    buffer: content,
    size: content.length,
    // These fields are required by the type but unused by extractTextFromFile
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractTextFromFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TXT ──────────────────────────────────────────────────────────────────

  it('returns buffer content as UTF-8 for text/plain files', async () => {
    const content = 'Hello, world! Experiencia: 5 años';
    const file = makeFile('text/plain', Buffer.from(content, 'utf-8'));

    const result = await extractTextFromFile(file);

    // No adapter called — the function just calls buffer.toString('utf-8')
    expect(result).toBe(content);
    expect(PDFParse).not.toHaveBeenCalled();
    expect(mammoth.extractRawText).not.toHaveBeenCalled();
  });

  // ── Unsupported MIME type ─────────────────────────────────────────────────

  it('throws an error that includes the unsupported mime type', async () => {
    const file = makeFile('image/png', Buffer.from('fake-image-data'));

    await expect(extractTextFromFile(file)).rejects.toThrow('image/png');
  });

  it('throws an error that mentions accepted formats for unsupported type', async () => {
    const file = makeFile('application/zip', Buffer.from('PK'), 'archive.zip');

    await expect(extractTextFromFile(file)).rejects.toThrow(/PDF|DOCX|TXT/i);
  });

  it('throws an error that includes the original filename for unsupported type', async () => {
    const file = makeFile('video/mp4', Buffer.from(''), 'cv-video.mp4');

    await expect(extractTextFromFile(file)).rejects.toThrow('cv-video.mp4');
  });

  // ── PDF ───────────────────────────────────────────────────────────────────

  it('calls PDFParse and returns getText().text for application/pdf', async () => {
    const expectedText = 'Extracted PDF text content';

    // Override the constructor implementation for this test. We use a proper
    // `function` (not an arrow) so `this` refers to the newly created instance,
    // matching how the real PDFParse constructor works.
    const mockGetText = vi.fn().mockResolvedValue({ text: expectedText });
    (PDFParse as unknown as Mock).mockImplementation(function (
      this: { getText: typeof mockGetText },
    ) {
      this.getText = mockGetText;
    });

    const fileBuffer = Buffer.from('%PDF-fake-content');
    const file = makeFile('application/pdf', fileBuffer, 'resume.pdf');

    const result = await extractTextFromFile(file);

    // Verify the constructor was called with a Uint8Array (not a Buffer).
    // The SUT converts Buffer → Uint8Array for the pdfjs-dist engine.
    expect(PDFParse).toHaveBeenCalledOnce();
    const constructorArg = (PDFParse as unknown as Mock).mock.calls[0][0] as {
      data: Uint8Array;
    };
    expect(constructorArg.data).toBeInstanceOf(Uint8Array);

    expect(mockGetText).toHaveBeenCalledOnce();
    expect(result).toBe(expectedText);
  });

  it('propagates errors thrown by PDFParse.getText()', async () => {
    const pdfError = new Error('Corrupt PDF: unexpected end of stream');
    const mockGetText = vi.fn().mockRejectedValue(pdfError);
    (PDFParse as unknown as Mock).mockImplementation(function (
      this: { getText: typeof mockGetText },
    ) {
      this.getText = mockGetText;
    });

    const file = makeFile('application/pdf', Buffer.from('bad-pdf'));

    // The SUT should NOT swallow the error — it propagates so the route can
    // return a 422 instead of silently passing an empty string to Gemini.
    await expect(extractTextFromFile(file)).rejects.toThrow(
      'Corrupt PDF: unexpected end of stream',
    );
  });

  // ── DOCX ─────────────────────────────────────────────────────────────────

  it('calls mammoth.extractRawText and returns .value for DOCX files', async () => {
    const expectedText = 'Raw DOCX paragraph text';
    (mammoth.extractRawText as Mock).mockResolvedValue({ value: expectedText });

    const docxBuffer = Buffer.from('PK-fake-docx-content');
    const file = makeFile(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docxBuffer,
      'cv.docx',
    );

    const result = await extractTextFromFile(file);

    // extractRawText must receive the buffer (not the whole file object) because
    // mammoth's BufferInput interface only accepts { buffer: Buffer }.
    expect(mammoth.extractRawText).toHaveBeenCalledOnce();
    expect((mammoth.extractRawText as Mock).mock.calls[0][0]).toEqual({
      buffer: docxBuffer,
    });
    expect(result).toBe(expectedText);
  });

  it('propagates errors thrown by mammoth.extractRawText()', async () => {
    const mammothError = new Error('Invalid DOCX structure');
    (mammoth.extractRawText as Mock).mockRejectedValue(mammothError);

    const file = makeFile(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      Buffer.from('bad-docx'),
    );

    await expect(extractTextFromFile(file)).rejects.toThrow('Invalid DOCX structure');
  });
});
