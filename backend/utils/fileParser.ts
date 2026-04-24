// pdf-parse v2 exports a class-based API (PDFParse) rather than a function.
// We import only the specific names we use to keep the type surface narrow.
import { PDFParse } from 'pdf-parse';

// mammoth uses `export =` (CommonJS interop style), so we need the `* as`
// import form in NodeNext to get the module's default namespace object.
import mammoth from 'mammoth';

// Supported MIME types. Checked before attempting any extraction so we can
// return a clear error rather than a confusing parsing failure downstream.
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

/**
 * Extracts plain text from an uploaded file.
 *
 * We keep this as a single dispatching function so the route only needs to
 * call one API regardless of file type. Throwing here (rather than returning
 * an empty string) ensures callers treat an unreadable file as a hard failure
 * instead of silently submitting garbage to the AI model.
 */
export async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const { mimetype, buffer, originalname } = file;

  if (!SUPPORTED_MIME_TYPES.has(mimetype)) {
    // Surface the actual mime type in the error so the client can diagnose it
    // without needing server logs.
    throw new Error(
      `Unsupported file type "${mimetype}" for file "${originalname}". ` +
        'Accepted formats: PDF, DOCX, TXT.',
    );
  }

  if (mimetype === 'application/pdf') {
    // pdf-parse v2 uses a class. We pass the buffer as Uint8Array (more
    // memory-efficient than Buffer for the underlying pdfjs-dist engine).
    // getText() returns a TextResult whose `.text` holds the full document
    // content with page breaks preserved as newlines.
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return result.text;
  }

  if (
    mimetype ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    // mammoth.extractRawText strips all DOCX formatting and returns only
    // paragraph text, which is exactly what we want for AI evaluation.
    // We deliberately avoid convertToHtml to keep the output clean.
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Plain text — the buffer is already UTF-8 encoded content.
  return buffer.toString('utf-8');
}
