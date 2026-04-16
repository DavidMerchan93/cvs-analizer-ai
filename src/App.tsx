import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Briefcase, UserPlus, Trash2, FileText, Play, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { evaluateCandidates } from './services/geminiService';

export default function App() {
  const [jobDescription, setJobDescription] = useState('');
  const [candidates, setCandidates] = useState([{ id: '1', name: '', cv: '' }]);
  const [evaluationResult, setEvaluationResult] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState('');

  const addCandidate = () => {
    setCandidates([
      ...candidates,
      { id: Date.now().toString(), name: '', cv: '' }
    ]);
  };

  const removeCandidate = (id: string) => {
    if (candidates.length === 1) return;
    setCandidates(candidates.filter(c => c.id !== id));
  };

  const updateCandidate = (id: string, field: 'name' | 'cv', value: string) => {
    setCandidates(candidates.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleEvaluate = async () => {
    if (!jobDescription.trim()) {
      setError('Por favor, ingresa el Job Description (Perfil del cargo).');
      return;
    }

    const validCandidates = candidates.filter(c => c.name.trim() && c.cv.trim());
    if (validCandidates.length === 0) {
      setError('Por favor, agrega al menos un candidato con nombre y CV.');
      return;
    }

    setError('');
    setIsEvaluating(true);

    try {
      const result = await evaluateCandidates(jobDescription, validCandidates);
      setEvaluationResult(result || '');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al evaluar los candidatos.');
    } finally {
      setIsEvaluating(false);
    }
  };

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
          
          {/* Job Description Section */}
          <section>
            <div className="flex items-center mb-3">
              <h2 className="text-xs uppercase text-natural-sage tracking-[1px] font-extrabold flex items-center">
                <span className="w-5 h-5 rounded-full bg-natural-olive text-white flex items-center justify-center font-bold mr-2 text-[10px]">1</span>
                Descripción del Cargo (Job Description)
              </h2>
            </div>
            <p className="text-sm text-natural-sub mb-3 pl-7">
              Incluye título, criterios obligatorios (knockout), experiencia, educación, e idiomas.
            </p>
            <div className="pl-7">
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Ej. Desarrollador Frontend Senior. 5 años de experiencia en React. Inglés B2. Experiencia en Tailwind deseable..."
                className="w-full min-h-[160px] p-4 bg-[#fafaf8] border-l-4 border-l-natural-sage border-y border-r border-natural-line rounded-lg focus:ring-1 focus:ring-natural-olive outline-none transition-all resize-y text-sm font-sans text-natural-text"
              />
            </div>
          </section>

          {/* Candidates Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
               <div className="flex items-center">
                <h2 className="text-xs uppercase text-natural-sage tracking-[1px] font-extrabold flex items-center">
                  <span className="w-5 h-5 rounded-full bg-natural-olive text-white flex items-center justify-center font-bold mr-2 text-[10px]">2</span>
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
                <div key={candidate.id} className="p-5 bg-[#fafaf8] border border-natural-line rounded-xl relative group transition-all">
                  <div className="absolute -left-3 -top-3 w-6 h-6 bg-natural-olive text-white rounded-full flex items-center justify-center text-xs font-serif italic shadow-md">
                    {index + 1}
                  </div>
                  {candidates.length > 1 && (
                    <button
                      onClick={() => removeCandidate(candidate.id)}
                      className="absolute top-4 right-4 text-natural-sub hover:text-natural-descartar transition-colors"
                      title="Eliminar candidato"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="mb-4 pr-8">
                    <label className="block text-xs font-bold text-natural-text mb-1.5 uppercase tracking-wide">Nombre del Candidato</label>
                    <input
                      type="text"
                      value={candidate.name}
                      onChange={(e) => updateCandidate(candidate.id, 'name', e.target.value)}
                      placeholder="Ej. Ana Pérez"
                      className="w-full p-2.5 bg-white border border-natural-line rounded-lg focus:ring-1 focus:ring-natural-olive outline-none transition-all text-sm font-medium text-natural-text"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-natural-text mb-1.5 uppercase tracking-wide">Contenido del CV (Texto)</label>
                    <textarea
                      value={candidate.cv}
                      onChange={(e) => updateCandidate(candidate.id, 'cv', e.target.value)}
                      placeholder="Pega el contenido del CV aquí..."
                      className="w-full min-h-[120px] p-3 bg-white border border-natural-line rounded-lg focus:ring-1 focus:ring-natural-olive outline-none transition-all resize-y text-sm font-sans text-natural-text"
                    />
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
              <p className="text-sm font-bold uppercase tracking-wide text-natural-olive animate-pulse">Analizando perfiles...</p>
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
                Completa la descripción del cargo y agrega al menos un CV a la izquierda. Luego, haz clic en "Ejecutar Evaluación".
              </p>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}

