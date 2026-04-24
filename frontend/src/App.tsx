import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Briefcase, UserPlus, Trash2, FileText, Play, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { evaluateCandidates } from './services/apiClient';
import FileUpload from './components/FileUpload';

// ── Types ────────────────────────────────────────────────────────────────────

// Extends the original Candidate shape to support file-based CV input.
// `cvFile` is mutually exclusive with `cv` from the UI perspective, but both
// coexist in state so switching modes doesn't destroy already-typed text.
interface Candidate {
  id: string;
  name: string;
  cv: string;
  cvFile: File | null;
  // Which input mode the candidate card is currently showing
  cvInputMode: 'text' | 'file';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const [jobDescription, setJobDescription] = useState('');
  // Track the uploaded JD file separately from the text; the active mode
  // determines which one gets sent to the API.
  const [jobDescriptionFile, setJobDescriptionFile] = useState<File | null>(null);
  const [jobInputMode, setJobInputMode] = useState<'text' | 'file'>('text');

  const [candidates, setCandidates] = useState<Candidate[]>([
    { id: '1', name: '', cv: '', cvFile: null, cvInputMode: 'text' },
  ]);
  const [evaluationResult, setEvaluationResult] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState('');

  // ── Candidate helpers ──────────────────────────────────────────────────────

  const addCandidate = () => {
    setCandidates([
      ...candidates,
      { id: Date.now().toString(), name: '', cv: '', cvFile: null, cvInputMode: 'text' },
    ]);
  };

  const removeCandidate = (id: string) => {
    // Minimum of 1 candidate enforced — the UI hides the button when count === 1
    if (candidates.length === 1) return;
    setCandidates(candidates.filter((c) => c.id !== id));
  };

  // Generic field updater — works for any scalar field on a Candidate
  const updateCandidate = <K extends keyof Candidate>(
    id: string,
    field: K,
    value: Candidate[K]
  ) => {
    setCandidates(candidates.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  // ── Validation ────────────────────────────────────────────────────────────

  // JD is valid if the user has provided text OR chosen a file — not both required
  const isJobDescriptionValid =
    jobInputMode === 'text' ? jobDescription.trim().length > 0 : jobDescriptionFile !== null;

  // A candidate is ready to submit when it has a name AND either text CV or a CV file
  const isCandidateValid = (c: Candidate): boolean => {
    if (!c.name.trim()) return false;
    return c.cvInputMode === 'text' ? c.cv.trim().length > 0 : c.cvFile !== null;
  };

  // ── Submit handler ────────────────────────────────────────────────────────

  const handleEvaluate = async () => {
    if (!isJobDescriptionValid) {
      setError('Por favor, ingresa o sube la descripción del cargo.');
      return;
    }

    const validCandidates = candidates.filter(isCandidateValid);
    if (validCandidates.length === 0) {
      setError('Por favor, agrega al menos un candidato con nombre y CV (texto o archivo).');
      return;
    }

    setError('');
    setIsEvaluating(true);

    try {
      const result = await evaluateCandidates(
        // Pass whichever job description source is active
        jobInputMode === 'text' ? jobDescription : null,
        jobInputMode === 'file' ? jobDescriptionFile : null,
        // Only send candidates that passed validation
        validCandidates.map((c) => ({
          name: c.name,
          cv: c.cvInputMode === 'text' ? c.cv : '',
          cvFile: c.cvInputMode === 'file' ? c.cvFile : null,
        }))
      );
      setEvaluationResult(result || '');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocurrió un error al evaluar los candidatos.';
      setError(message);
    } finally {
      setIsEvaluating(false);
    }
  };

  // ── Toggle helpers ────────────────────────────────────────────────────────

  // Shared style for the mode-toggle pill buttons so they stay consistent
  // between the JD section and each candidate card.
  const toggleBtnClass = (active: boolean) =>
    `px-3 py-1 text-xs font-bold rounded-full transition-colors border ${
      active
        ? 'bg-[var(--color-natural-olive)] text-white border-[var(--color-natural-olive)]'
        : 'bg-transparent text-[var(--color-natural-sub)] border-[var(--color-natural-line)] hover:border-[var(--color-natural-sage)]'
    }`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-full font-sans text-natural-text bg-natural-bg overflow-hidden p-5 gap-5">

      {/* Left Panel: Inputs */}
      <div className="w-[40%] flex flex-col bg-natural-card border border-natural-line rounded-2xl shadow-sm overflow-hidden z-10 shrink-0">
        <div className="p-6 border-b-[2px] border-natural-olive bg-natural-card flex justify-between items-center z-20">
          <div>
            <h1 className="text-2xl font-serif italic flex items-center text-natural-olive">
              <Briefcase className="mr-3 w-6 h-6" />
              AI Recruiter Evaluator
            </h1>
            <p className="text-sm text-natural-sub mt-2">
              Evalúa CVs de forma objetiva contra criterios específicos de una vacante.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* ── Section 1: Job Description ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase text-natural-sage tracking-[1px] font-extrabold flex items-center">
                <span className="w-5 h-5 rounded-full bg-natural-olive text-white flex items-center justify-center font-bold mr-2 text-[10px]">
                  1
                </span>
                Descripción del Cargo (Job Description)
              </h2>

              {/* Mode toggle — text vs file upload */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setJobInputMode('text')}
                  className={toggleBtnClass(jobInputMode === 'text')}
                  aria-pressed={jobInputMode === 'text'}
                >
                  Escribir texto
                </button>
                <button
                  type="button"
                  onClick={() => setJobInputMode('file')}
                  className={toggleBtnClass(jobInputMode === 'file')}
                  aria-pressed={jobInputMode === 'file'}
                >
                  Subir archivo
                </button>
              </div>
            </div>

            <p className="text-sm text-natural-sub mb-3 pl-7">
              Incluye título, criterios obligatorios (knockout), experiencia, educación, e idiomas.
            </p>

            <div className="pl-7">
              {jobInputMode === 'text' ? (
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Ej. Desarrollador Frontend Senior. 5 años de experiencia en React. Inglés B2. Experiencia en Tailwind deseable..."
                  className="w-full min-h-[160px] p-4 bg-[#fafaf8] border-l-4 border-l-natural-sage border-y border-r border-natural-line rounded-lg focus:ring-1 focus:ring-natural-olive outline-none transition-all resize-y text-sm font-sans text-natural-text"
                />
              ) : (
                <FileUpload
                  label="Descripción del cargo"
                  accept=".pdf,.txt,.docx"
                  currentFile={jobDescriptionFile}
                  onFileChange={setJobDescriptionFile}
                />
              )}
            </div>
          </section>

          {/* ── Section 2: Candidates ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <h2 className="text-xs uppercase text-natural-sage tracking-[1px] font-extrabold flex items-center">
                  <span className="w-5 h-5 rounded-full bg-natural-olive text-white flex items-center justify-center font-bold mr-2 text-[10px]">
                    2
                  </span>
                  Hojas de Vida (CVs)
                </h2>
              </div>
              <button
                onClick={addCandidate}
                className="flex items-center text-[11px] font-bold uppercase tracking-wider text-natural-olive hover:bg-natural-line transition-colors bg-[#f0f0eb] px-3 py-1.5 rounded-full border border-natural-line"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                Añadir Candidato
              </button>
            </div>

            <div className="pl-7 space-y-6">
              {candidates.map((candidate, index) => (
                <div
                  key={candidate.id}
                  className="p-5 bg-[#fafaf8] border border-natural-line rounded-xl relative group transition-all"
                >
                  {/* Candidate index badge */}
                  <div className="absolute -left-3 -top-3 w-6 h-6 bg-natural-olive text-white rounded-full flex items-center justify-center text-xs font-serif italic shadow-md">
                    {index + 1}
                  </div>

                  {candidates.length > 1 && (
                    <button
                      onClick={() => removeCandidate(candidate.id)}
                      className="absolute top-4 right-4 text-natural-sub hover:text-natural-descartar transition-colors"
                      title="Eliminar candidato"
                      aria-label={`Eliminar candidato ${index + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Name field */}
                  <div className="mb-4 pr-8">
                    <label className="block text-xs font-bold text-natural-text mb-1.5 uppercase tracking-wide">
                      Nombre del Candidato
                    </label>
                    <input
                      type="text"
                      value={candidate.name}
                      onChange={(e) => updateCandidate(candidate.id, 'name', e.target.value)}
                      placeholder="Ej. Ana Pérez"
                      className="w-full p-2.5 bg-white border border-natural-line rounded-lg focus:ring-1 focus:ring-natural-olive outline-none transition-all text-sm font-medium text-natural-text"
                    />
                  </div>

                  {/* CV field with mode toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-natural-text uppercase tracking-wide">
                        {candidate.cvInputMode === 'text' ? 'Contenido del CV (Texto)' : 'Archivo del CV'}
                      </label>

                      {/* Per-candidate CV mode toggle */}
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateCandidate(candidate.id, 'cvInputMode', 'text')}
                          className={toggleBtnClass(candidate.cvInputMode === 'text')}
                          aria-pressed={candidate.cvInputMode === 'text'}
                        >
                          Escribir CV
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCandidate(candidate.id, 'cvInputMode', 'file')}
                          className={toggleBtnClass(candidate.cvInputMode === 'file')}
                          aria-pressed={candidate.cvInputMode === 'file'}
                        >
                          Subir CV
                        </button>
                      </div>
                    </div>

                    {candidate.cvInputMode === 'text' ? (
                      <textarea
                        value={candidate.cv}
                        onChange={(e) => updateCandidate(candidate.id, 'cv', e.target.value)}
                        placeholder="Pega el contenido del CV aquí..."
                        className="w-full min-h-[120px] p-3 bg-white border border-natural-line rounded-lg focus:ring-1 focus:ring-natural-olive outline-none transition-all resize-y text-sm font-sans text-natural-text"
                      />
                    ) : (
                      <FileUpload
                        label={`CV del candidato ${index + 1}`}
                        accept=".pdf,.txt,.docx"
                        currentFile={candidate.cvFile}
                        onFileChange={(file) => updateCandidate(candidate.id, 'cvFile', file)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Action Bottom Bar */}
        <div className="p-6 border-t border-natural-line bg-natural-card">
          {error && (
            <div className="mb-4 flex items-start p-3 bg-red-50 text-natural-descartar border border-red-200 rounded-lg text-sm font-medium">
              <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleEvaluate}
            disabled={isEvaluating}
            className={`w-full flex items-center justify-center py-3.5 px-6 rounded-xl text-white font-medium shadow-sm transition-all ${
              isEvaluating
                ? 'bg-natural-sage cursor-not-allowed'
                : 'bg-natural-olive hover:opacity-90 active:translate-y-[1px]'
            }`}
          >
            {isEvaluating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Evaluando con Gemini...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2 fill-current" />
                Ejecutar Evaluación
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Panel: Results */}
      <div className="w-[60%] flex flex-col overflow-hidden relative gap-4">
        <div className="p-5 border border-natural-line bg-natural-card rounded-2xl flex justify-between items-center shadow-sm shrink-0">
          <h2 className="text-xl font-serif italic text-natural-olive flex items-center">
            <FileText className="mr-3 w-5 h-5" />
            Resultados de la Evaluación
          </h2>
          {evaluationResult && !isEvaluating && (
            <span className="flex items-center text-[11px] font-bold uppercase tracking-wider text-white bg-natural-apto px-3 py-1.5 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Completada
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-natural-card border border-natural-line rounded-2xl shadow-sm p-8">
          {isEvaluating ? (
            <div className="h-full flex flex-col items-center justify-center text-natural-sub space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-natural-olive" />
              <p className="text-sm font-bold uppercase tracking-wide text-natural-olive animate-pulse">
                Analizando perfiles...
              </p>
            </div>
          ) : evaluationResult ? (
            <div className="markdown-body">
              <ReactMarkdown>{evaluationResult}</ReactMarkdown>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-natural-sub max-w-sm mx-auto text-center opacity-70">
              <div className="w-20 h-20 bg-[#f0f0eb] rounded-full flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-natural-sage" />
              </div>
              <h3 className="text-lg font-serif italic text-natural-olive mb-2">Listo para evaluar</h3>
              <p className="text-sm">
                Completa la descripción del cargo y agrega al menos un CV a la izquierda. Luego, haz
                clic en "Ejecutar Evaluación".
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
