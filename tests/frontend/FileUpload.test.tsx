/**
 * Component tests for frontend/src/components/FileUpload.tsx
 *
 * Testing philosophy here:
 *   We test USER-VISIBLE BEHAVIOUR, not implementation details like state vars
 *   or refs. Each test answers "what does the user see / what callback fires?"
 *
 * Why @testing-library/user-event instead of fireEvent:
 *   userEvent simulates real browser interaction sequences (pointerdown →
 *   pointerup → click, or keydown → keypress → keyup). fireEvent only triggers
 *   a single synthetic event, so it would miss bugs in the multi-event handlers
 *   (e.g., the onKeyDown guard that checks for Enter vs other keys).
 *
 * lucide-react mock note:
 *   lucide-react exports SVG components that reference browser APIs not present
 *   in jsdom. We mock the three icons used by FileUpload.tsx to avoid test
 *   noise from SVG rendering failures. The mocks render plain <svg> stubs with
 *   data-testid attributes so we can still assert their presence if needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from '../../frontend/src/components/FileUpload.js';

// ---------------------------------------------------------------------------
// Mock lucide-react icons
// ---------------------------------------------------------------------------
// jsdom does not implement SVG layout APIs that some lucide-react versions use.
// Replacing the icons with simple SVG stubs prevents unrelated console errors
// and keeps the test output focused on FileUpload behaviour.
vi.mock('lucide-react', () => ({
  UploadCloud: () => <svg data-testid="icon-upload-cloud" />,
  X: () => <svg data-testid="icon-x" />,
  FileText: () => <svg data-testid="icon-file-text" />,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal File object suitable for passing as `currentFile`.
 * We avoid File constructor where possible in unit tests because jsdom's
 * implementation can be partial — here it's fine since we're only checking
 * .name and .size, both of which jsdom supports.
 */
function makeFile(name: string, content = 'file content'): File {
  return new File([content], name, { type: 'text/plain' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileUpload component', () => {
  const defaultProps = {
    label: 'Upload CV',
    accept: '.pdf,.txt,.docx',
    onFileChange: vi.fn(),
    currentFile: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Drop-zone state (currentFile === null) ──────────────────────────────

  it('renders the drop-zone when currentFile is null', () => {
    render(<FileUpload {...defaultProps} />);

    // The drop zone uses role="button" to be keyboard-accessible
    expect(
      screen.getByRole('button', { name: /arrastra un archivo/i }),
    ).toBeInTheDocument();
  });

  it('shows accepted file formats hint in the drop zone', () => {
    render(<FileUpload {...defaultProps} />);

    expect(screen.getByText(/PDF.*TXT.*DOCX/i)).toBeInTheDocument();
  });

  it('renders the sr-only label for accessibility', () => {
    render(<FileUpload {...defaultProps} label="Descripción del cargo" />);

    // The label has class="sr-only" — it must be in the DOM even if not visible
    expect(screen.getByText('Descripción del cargo')).toBeInTheDocument();
  });

  // ── Selected-file state (currentFile !== null) ──────────────────────────

  it('renders file name and size when currentFile is provided', () => {
    // Content is 12 bytes — formatBytes should display "12 B"
    const file = makeFile('alice-cv.pdf', '123456789012');
    render(<FileUpload {...defaultProps} currentFile={file} />);

    expect(screen.getByText('alice-cv.pdf')).toBeInTheDocument();
    expect(screen.getByText(/12 B/)).toBeInTheDocument();
  });

  it('does not render the drop-zone when a file is selected', () => {
    const file = makeFile('resume.docx');
    render(<FileUpload {...defaultProps} currentFile={file} />);

    expect(
      screen.queryByRole('button', { name: /arrastra un archivo/i }),
    ).not.toBeInTheDocument();
  });

  it('renders a remove button with the correct aria-label when file is selected', () => {
    const file = makeFile('cv.pdf');
    render(<FileUpload {...defaultProps} currentFile={file} />);

    expect(
      screen.getByRole('button', { name: /eliminar archivo/i }),
    ).toBeInTheDocument();
  });

  // ── Callbacks ────────────────────────────────────────────────────────────

  it('calls onFileChange with the selected file when input changes', async () => {
    const onFileChange = vi.fn();
    render(<FileUpload {...defaultProps} onFileChange={onFileChange} />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    // userEvent.upload dispatches a realistic change event with a FileList
    const file = makeFile('candidate.pdf');
    await userEvent.upload(input, file);

    expect(onFileChange).toHaveBeenCalledOnce();
    expect(onFileChange).toHaveBeenCalledWith(file);
  });

  it('calls onFileChange(null) when the remove button is clicked', async () => {
    const onFileChange = vi.fn();
    const file = makeFile('cv.pdf');
    render(
      <FileUpload {...defaultProps} onFileChange={onFileChange} currentFile={file} />,
    );

    const removeBtn = screen.getByRole('button', { name: /eliminar archivo/i });
    await userEvent.click(removeBtn);

    expect(onFileChange).toHaveBeenCalledOnce();
    expect(onFileChange).toHaveBeenCalledWith(null);
  });

  // ── Keyboard accessibility ────────────────────────────────────────────────

  it('triggers the file input click when Enter is pressed on the drop zone', async () => {
    render(<FileUpload {...defaultProps} />);

    // Spy on the hidden input's click method to verify the drop zone delegates to it
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});

    const dropZone = screen.getByRole('button', { name: /arrastra un archivo/i });

    // Tab to the element first to focus it, then press Enter
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');

    // The onKeyDown handler checks for e.key === 'Enter' and calls inputRef.current?.click()
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('triggers the file input click when Space is pressed on the drop zone', async () => {
    render(<FileUpload {...defaultProps} />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});

    await userEvent.tab();
    await userEvent.keyboard(' ');

    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('does NOT trigger the file input click for arbitrary keys', async () => {
    render(<FileUpload {...defaultProps} />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});

    await userEvent.tab();
    // Pressing an arbitrary key should not open the file picker
    await userEvent.keyboard('{ArrowDown}');

    expect(clickSpy).not.toHaveBeenCalled();
  });

  // ── File info formatting ─────────────────────────────────────────────────

  it('displays size in KB for files between 1 KB and 1 MB', () => {
    // 1536 bytes = 1.5 KB — the formatBytes function should return "1.5 KB"
    const content = 'a'.repeat(1536);
    const file = makeFile('medium.pdf', content);
    render(<FileUpload {...defaultProps} currentFile={file} />);

    expect(screen.getByText('1.5 KB')).toBeInTheDocument();
  });

  it('displays size in MB for files >= 1 MB', () => {
    // 1.5 MB = 1048576 * 1.5 = 1572864 bytes
    const content = 'a'.repeat(1_572_864);
    const file = makeFile('large.pdf', content);
    render(<FileUpload {...defaultProps} currentFile={file} />);

    expect(screen.getByText('1.5 MB')).toBeInTheDocument();
  });
});
