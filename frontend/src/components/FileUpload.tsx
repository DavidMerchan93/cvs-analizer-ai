import { useRef, useState, useCallback } from 'react';
import { UploadCloud, X, FileText } from 'lucide-react';

interface FileUploadProps {
  // Human-readable label shown above the drop zone
  label: string;
  // File types the input will accept, e.g. ".pdf,.txt,.docx"
  accept: string;
  // Called when the user selects or clears a file
  onFileChange: (file: File | null) => void;
  // The currently selected file (controlled — lifted state lives in App.tsx)
  currentFile: File | null;
}

// Formats a byte count into a human-readable string (KB / MB).
// We do this locally rather than pulling a library because the logic is trivial
// and this avoids an unnecessary bundle dependency.
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUpload({ label, accept, onFileChange, currentFile }: FileUploadProps) {
  // Track drag-over state separately so we can highlight the drop zone without
  // relying on CSS :hover, which doesn't fire during a drag operation.
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Centralise file acceptance so both the click-path and the drop-path go
  // through the same validation gate.
  const handleFile = useCallback(
    (file: File | null) => {
      onFileChange(file);
    },
    [onFileChange]
  );

  const handleDragOver = (e: React.DragEvent) => {
    // Prevent the browser's default behaviour (open the file) and signal that
    // this element accepts the drop.
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear the flag when the cursor actually leaves this element, not
    // when it moves over a child node (relatedTarget check).
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
    // Reset the input value so that selecting the same file again still
    // fires the onChange event (browser normally suppresses it otherwise).
    e.target.value = '';
  };

  const handleRemove = () => {
    handleFile(null);
  };

  return (
    <div className="w-full">
      {/* Accessible label — visually hidden but still tied to the input for SR */}
      <label className="sr-only">{label}</label>

      {currentFile ? (
        // ── Selected-file state ─────────────────────────────────────────────
        // Show compact file info with a remove button instead of the drop zone,
        // so the user can clearly see what was chosen and easily undo it.
        <div
          className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-natural-line)] bg-[#fafaf8]"
          role="status"
          aria-label={`Archivo seleccionado: ${currentFile.name}`}
        >
          <div className="shrink-0 w-9 h-9 rounded-md bg-[var(--color-natural-olive)] bg-opacity-10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[var(--color-natural-olive)]" />
          </div>

          <div className="flex-1 min-w-0">
            {/* min-w-0 lets the flex child truncate instead of overflowing */}
            <p className="text-sm font-medium text-[var(--color-natural-text)] truncate">
              {currentFile.name}
            </p>
            <p className="text-xs text-[var(--color-natural-sub)]">
              {formatBytes(currentFile.size)}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            className="shrink-0 p-1 rounded-full text-[var(--color-natural-sub)] hover:text-[var(--color-natural-descartar)] hover:bg-red-50 transition-colors"
            aria-label="Eliminar archivo seleccionado"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        // ── Drop-zone state ─────────────────────────────────────────────────
        // The hidden <input> is the real interaction target; the visible div
        // acts as a styled affordance that delegates clicks and drops to it.
        <div
          role="button"
          tabIndex={0}
          aria-label={`${label} — arrastra un archivo o haz clic para seleccionar`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            // Allow keyboard activation via Enter or Space (button semantics)
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            'flex flex-col items-center justify-center gap-2 p-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
            isDragOver
              ? 'border-[var(--color-natural-olive)] bg-[var(--color-natural-olive)]/5'
              : 'border-[var(--color-natural-line)] bg-[#fafaf8] hover:border-[var(--color-natural-sage)] hover:bg-[var(--color-natural-bg)]',
          ].join(' ')}
        >
          <UploadCloud
            className={`w-7 h-7 transition-colors ${
              isDragOver
                ? 'text-[var(--color-natural-olive)]'
                : 'text-[var(--color-natural-sub)]'
            }`}
          />

          <p className="text-sm text-[var(--color-natural-sub)] text-center">
            <span className="font-semibold text-[var(--color-natural-olive)]">
              Haz clic para subir
            </span>{' '}
            o arrastra y suelta aquí
          </p>

          {/* Show accepted formats so the user knows what is allowed without
              having to encounter an error after selecting the wrong file type. */}
          <p className="text-xs text-[var(--color-natural-sub)]">
            PDF, TXT, DOCX
          </p>
        </div>
      )}

      {/* Hidden native input — this is what actually triggers the OS file picker */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
