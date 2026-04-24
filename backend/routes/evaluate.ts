import { Router, Request, Response, NextFunction } from 'express';
import { GoogleGenAI } from '@google/genai';
import multer, { MulterError } from 'multer';
import { extractTextFromFile } from '../utils/fileParser.js';

export const evaluateRouter = Router();

// Improved system prompt — 5 structured enhancements over the original:
// 1. Layered role definition  2. Explicit edge-case rules  3. Volume-aware detail
// 4. Fixed output template    5. Self-audit section at the end
const SYSTEM_INSTRUCTION = `
# CAPA 1 — IDENTIDAD BASE

Eres un evaluador de talento humano. Tu única función es comparar CVs contra una descripción de cargo y producir un reporte estructurado, objetivo y reproducible.

# CAPA 2 — ESTÁNDARES DE PRECISIÓN

- Objetivo: solo usas datos explícitos del CV. Nunca inferes, asumes ni extrapolas.
- Consistente: el mismo CV evaluado contra el mismo cargo siempre produce el mismo resultado.
- Justificado: cada score va acompañado de evidencia textual concreta (empresa, cargo, fechas, cifras, tecnologías).
- Neutral: no evalúas nombre, género, edad, nacionalidad ni ninguna característica personal.

El reclutador humano siempre toma la decisión final. Tu rol es priorizar y justificar, nunca decidir.

# CAPA 3 — REGLAS DE COMPORTAMIENTO ANTE SITUACIONES ESPECIALES

Antes de iniciar cualquier evaluación, aplica estas reglas:

REGLA A — CV INCOMPLETO
Si el CV tiene menos de 100 palabras, o le faltan más de 3 de estos campos (experiencia laboral, educación, habilidades, nombre completo):
→ No evalúes. Emite esta advertencia al inicio de la ficha del candidato:
⚠️ CV INSUFICIENTE: El documento no contiene información suficiente para una evaluación confiable. Campos faltantes: [lista los que faltan]. Se recomienda solicitar al candidato un CV completo antes de continuar.

REGLA B — CANDIDATO SIN EXPERIENCIA MÍNIMA
Si el cargo exige experiencia mínima y el candidato no la alcanza:
→ Aplica knockout inmediato. Indica el criterio fallido y la evidencia (o ausencia) que lo justifica.
→ No calcules score global ni evalúes criterios deseables.

REGLA C — MÁS DE 10 CANDIDATOS
Si recibes más de 10 CVs:
→ Genera primero un resumen ejecutivo con el ranking completo (tabla).
→ Luego desarrolla la ficha individual solo de los 5 candidatos con mayor score potencial.
→ Para los demás, incluye únicamente nombre, veredicto knockout y razón de descarte (si aplica).

---
# PROCESO DE EVALUACIÓN

Para cada candidato, ejecuta estos pasos en orden estricto:

PASO 1 — DIAGNÓSTICO PREVIO
Aplica las Reglas A, B y C antes de cualquier otra cosa.

PASO 2 — EXTRACCIÓN
Identifica y estructura la información presente en el CV:
- Nombre completo
- Años de experiencia total
- Experiencias laborales (empresa, cargo, duración)
- Habilidades técnicas declaradas explícitamente
- Nivel educativo y título
- Certificaciones y cursos relevantes
- Idiomas y nivel declarado
- Logros cuantificables mencionados

Si un dato no está en el CV: escribe "no especificado". Nunca inventes ni asumas.

PASO 3 — VERIFICACIÓN DE KNOCKOUT
Evalúa cada criterio obligatorio del cargo de forma binaria (cumple / no cumple).

Si algún criterio obligatorio falla:
→ Estado final: NO APTO
→ Indica el criterio que falló y con qué evidencia del CV
→ No evalúes criterios deseables ni calcules score global

PASO 4 — EVALUACIÓN DE CRITERIOS DESEABLES (solo si pasó knockout)
Para cada criterio deseable:
1. Razona internamente antes de asignar el score
2. Busca evidencia concreta en el CV
3. Asigna score de 0 a 10 usando la escala de calibración
4. Escribe la justificación en máximo 2 oraciones con datos específicos

PASO 5 — CÁLCULO DEL SCORE GLOBAL
score_global = suma(score × peso) / suma(pesos)
Redondea a un decimal. Escala: 1.0 a 10.0

Clasifica:
- 8.0 a 10.0 → APTO    → Acción: Avanzar
- 5.5 a 7.9  → REVISAR → Acción: Considerar
- 0.0 a 5.4  → NO APTO → Acción: Descartar

---
# ESCALA DE CALIBRACIÓN

Score 9–10 | Supera el requisito con evidencia clara
Score 7–8  | Cumple el requisito con evidencia directa
Score 5–6  | Cumple parcialmente — evidencia incompleta o indirecta
Score 3–4  | Cumple marginalmente — evidencia débil
Score 1–2  | No cumple — sin evidencia relevante
Score 0    | Knockout fallido

---
# PLANTILLA DE RESPUESTA FIJA

Usa EXACTAMENTE esta estructura para cada candidato. No omitas ninguna sección.

---
## 👤 CANDIDATO: [Nombre]

### DATOS EXTRAÍDOS
| Campo | Valor |
|---|---|
| Experiencia total | |
| Último cargo | |
| Educación | |
| Habilidades clave | |
| Idiomas | |
| Logros destacados | |

### KNOCKOUT — CRITERIOS OBLIGATORIOS
| Criterio | ¿Cumple? | Evidencia |
|---|---|---|
| [criterio 1] | ✅ / ❌ | |

> Si algún criterio falla → Estado: **NO APTO** y pasa al Resumen Ejecutivo.

### CRITERIOS DESEABLES
| Criterio | Peso | Score | Justificación |
|---|---|---|---|
| [criterio 1] | | | |

### SCORE GLOBAL
**[X.X / 10.0]** → **[APTO / REVISAR / NO APTO]**

### RESUMEN EJECUTIVO
[2–4 oraciones. Qué hace destacar al candidato o por qué no aplica. Lenguaje directo, sin jerga.]

---

Al finalizar todos los candidatos, genera obligatoriamente:

## 📊 TABLA COMPARATIVA FINAL
| # | Candidato | Score | Veredicto | Fortaleza principal | Riesgo principal |
|---|---|---|---|---|---|

## 🏆 RECOMENDACIÓN DE ORDEN DE ENTREVISTA
Lista ordenada de mayor a menor score, solo para candidatos APTO y REVISAR.

---
# AUTOEVALUACIÓN FINAL

Después de generar todo el reporte, incluye obligatoriamente esta sección:

## 🔍 AUTOEVALUACIÓN DEL ANÁLISIS

Responde estas tres preguntas en viñetas cortas:

- **¿Hubo criterios que no pude evaluar con certeza?** (menciona cuáles y por qué)
- **¿Algún CV tenía información insuficiente que pudo afectar el resultado?** (menciona el candidato y el dato faltante)
- **¿Qué información adicional le recomendarías pedir al reclutador para mejorar la precisión?**

Si todo estuvo completo, escribe: ✅ Evaluación completa. No se identificaron vacíos de información relevantes.

---
# REGLAS DE CALIDAD

- Cita evidencia textual del CV en cada justificación
- Usa siempre la escala de calibración fija
- Escribe en español colombiano, tono profesional, sin jerga técnica de IA
- Nunca omitas secciones de la plantilla, aunque estén vacías
- Nunca decidas la contratación — solo prioriza y justifica

# RESTRICCIONES ABSOLUTAS

NUNCA: Evaluar nombre, género, edad, nacionalidad. Inferir datos ausentes. Emitir score sin justificación. Omitir la autoevaluación final.
SIEMPRE: Aplicar diagnóstico previo. Seguir la plantilla fija. Generar tabla comparativa. Incluir autoevaluación.
`;

// Maximum candidates enforced at the route level, matching REGLA C in the system prompt.
const MAX_CANDIDATES = 10;

// Maximum number of files multer will accept in a single request.
// Formula: 1 jobDescriptionFile + MAX_CANDIDATES cvFiles = 11.
// Without this cap, multer.any() would accept an unlimited number of files
// from a single request, allowing an attacker to exhaust Node.js heap memory
// by sending thousands of 10 MB files (e.g., 1000 files × 10 MB = 10 GB).
// We add 1 as a small safety margin in case a future field is introduced.
const MAX_FILES = MAX_CANDIDATES + 2; // 12 — 1 job desc + 10 CVs + 1 margin

// In-memory storage: we never write uploaded files to disk. This keeps the
// server stateless and avoids needing a temp-file cleanup strategy.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // 10 MB per file is generous for CVs (a typical DOCX/PDF is under 1 MB),
    // but the hard cap prevents accidental or malicious large uploads.
    fileSize: 10 * 1024 * 1024,
    // Hard cap on total files per request. multer.any() with no files limit is
    // a DoS vector: an attacker could send hundreds of max-size files and force
    // Node.js to buffer all of them in RAM before we can reject the request.
    files: MAX_FILES,
  },
});

// multer.any() captures every file field regardless of name. We need this
// because candidate file fields are dynamically named (candidates[0][cvFile],
// candidates[1][cvFile], …) and multer.fields() requires a static list.
const uploadMiddleware = upload.any();

/**
 * Wraps multer's callback-based middleware in a promise so the route handler
 * can use async/await without a nested callback pyramid.
 *
 * We catch MulterError specifically to return a 400 instead of letting it
 * bubble to Express's default error handler as a 500.
 */
function runMulter(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err: unknown) => {
      if (err instanceof MulterError) {
        // LIMIT_FILE_SIZE is the most common multer error here; surface it as
        // a client error (400) with a readable message rather than a server error.
        reject(
          Object.assign(new Error(`File upload error: ${err.message}`), { statusCode: 400 }),
        );
      } else if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Builds an index of uploaded files keyed by their FormData field name.
 *
 * multer populates req.files as an array when using .any(). We convert it to a
 * Map for O(1) lookup instead of scanning the array on every candidate field.
 */
function buildFileMap(req: Request): Map<string, Express.Multer.File> {
  const map = new Map<string, Express.Multer.File>();
  if (Array.isArray(req.files)) {
    for (const file of req.files) {
      map.set(file.fieldname, file);
    }
  }
  return map;
}

/**
 * POST /api/evaluate
 *
 * Accepts multipart/form-data with the following fields:
 *   - jobDescription          (text)  — raw text of the job description
 *   - jobDescriptionFile      (file)  — PDF / DOCX / TXT alternative to jobDescription
 *   - candidates[N][name]     (text)  — candidate name, for each index N
 *   - candidates[N][cv]       (text)  — raw CV text (optional if cvFile provided)
 *   - candidates[N][cvFile]   (file)  — CV file alternative to cv text
 *
 * Exactly one of jobDescription / jobDescriptionFile must be supplied.
 * Each candidate must supply name and exactly one of cv / cvFile.
 */
evaluateRouter.post(
  '/evaluate',
  async (req: Request, res: Response, next: NextFunction) => {
    // Parse the multipart body first; errors here are upload-layer problems,
    // not application logic problems.
    try {
      await runMulter(req, res);
    } catch (uploadErr: unknown) {
      const code = (uploadErr as { statusCode?: number }).statusCode ?? 500;
      const message =
        uploadErr instanceof Error ? uploadErr.message : 'Upload error';
      res.status(code).json({ error: message });
      return;
    }

    const fileMap = buildFileMap(req);
    const body = req.body as Record<string, string>;

    // --- Resolve job description ---

    const jobDescriptionText = body['jobDescription']?.trim() ?? '';
    const jobDescriptionFile = fileMap.get('jobDescriptionFile');

    if (!jobDescriptionText && !jobDescriptionFile) {
      res.status(400).json({
        error: 'Provide either jobDescription (text) or jobDescriptionFile (file).',
      });
      return;
    }

    let jobDescription: string;
    try {
      jobDescription = jobDescriptionFile
        ? await extractTextFromFile(jobDescriptionFile)
        : jobDescriptionText;
    } catch (parseErr: unknown) {
      const message =
        parseErr instanceof Error ? parseErr.message : 'Failed to parse job description file';
      // 422 signals that the request was well-formed but the file content
      // could not be processed — distinct from a missing-field 400.
      res.status(422).json({ error: message });
      return;
    }

    // --- Resolve candidates ---

    // Multer v2 (via busboy) parses bracket-notation FormData fields into
    // nested objects. A client sending:
    //   candidates[0][name]=Alice, candidates[0][cv]=...
    // results in: body.candidates = [{ name: 'Alice', cv: '...' }]
    //
    // Flat bracket-string keys (candidates[0][name]) no longer survive in
    // req.body with multer v2 — they are always merged into a nested array.
    // We also handle the fallback flat-key format for direct API clients that
    // might POST JSON-encoded candidate arrays.

    // Normalise: coerce the parsed value to a raw object array so the rest of
    // the validation logic stays uniform regardless of the client's encoding.
    type RawCandidate = Record<string, string>;
    let rawCandidates: RawCandidate[] = [];

    if (Array.isArray(body['candidates'])) {
      // Multer v2 bracket-notation path — most common case from the browser
      rawCandidates = body['candidates'] as RawCandidate[];
    } else {
      // Fallback: scan for flat bracket-string keys that were NOT parsed by
      // multer (e.g., direct API clients using application/x-www-form-urlencoded
      // without bracket expansion). We also check file field names because
      // candidates that only supply a cvFile may appear only in the file map.
      const indexSet = new Set<number>();
      for (const key of Object.keys(body)) {
        const match = key.match(/^candidates\[(\d+)\]/);
        if (match) indexSet.add(parseInt(match[1], 10));
      }
      for (const key of fileMap.keys()) {
        const match = key.match(/^candidates\[(\d+)\]/);
        if (match) indexSet.add(parseInt(match[1], 10));
      }
      // Reconstruct a plain array from the flat keys so downstream code is
      // identical to the multer v2 path.
      for (const idx of [...indexSet].sort((a, b) => a - b)) {
        rawCandidates[idx] = {
          name: (body[`candidates[${idx}][name]`] as string) ?? '',
          cv: (body[`candidates[${idx}][cv]`] as string) ?? '',
        };
      }
    }

    if (rawCandidates.length === 0) {
      res.status(400).json({ error: 'At least one candidate is required.' });
      return;
    }

    if (rawCandidates.length > MAX_CANDIDATES) {
      res.status(400).json({
        error: `Too many candidates. Maximum allowed is ${MAX_CANDIDATES}.`,
      });
      return;
    }

    interface ResolvedCandidate {
      name: string;
      cv: string;
    }
    const candidates: ResolvedCandidate[] = [];

    for (let idx = 0; idx < rawCandidates.length; idx++) {
      const raw = rawCandidates[idx];
      const name = (raw['name'] ?? '').trim();
      if (!name) {
        res.status(400).json({
          error: `Candidate at index ${idx} is missing a name.`,
        });
        return;
      }

      const cvText = (raw['cv'] ?? '').trim();
      // File fields keep the bracket-string key regardless of multer version
      // because multer stores uploaded files by their original fieldname.
      const cvFile = fileMap.get(`candidates[${idx}][cvFile]`);

      if (!cvText && !cvFile) {
        res.status(400).json({
          error: `Candidate "${name}" (index ${idx}) must provide either cv text or a cvFile.`,
        });
        return;
      }

      let cv: string;
      try {
        cv = cvFile ? await extractTextFromFile(cvFile) : cvText;
      } catch (parseErr: unknown) {
        const message =
          parseErr instanceof Error
            ? parseErr.message
            : `Failed to parse CV file for candidate "${name}"`;
        res.status(422).json({ error: message });
        return;
      }

      candidates.push({ name, cv });
    }

    // --- Per-field length validation ---
    //
    // The multer fileSize limit only protects binary uploads. Extracted text
    // (from files) and raw text fields are unbounded after that point, so a
    // 10 MB PDF could decompress into hundreds of thousands of characters,
    // burning Gemini's context window and generating unexpectedly large (and
    // expensive) API calls. We enforce character-level caps here, after
    // extraction but before the prompt is assembled.
    //
    // Thresholds chosen to be realistic for the use case:
    //   - Job descriptions: 20,000 chars ≈ ~4,000 words — far beyond any real JD
    //   - CVs: 30,000 chars ≈ ~6,000 words — covers even verbose senior profiles
    const MAX_JOB_DESCRIPTION_CHARS = 20_000;
    const MAX_CV_CHARS = 30_000;

    if (jobDescription.length > MAX_JOB_DESCRIPTION_CHARS) {
      res.status(400).json({
        error: `Job description is too long. Maximum allowed is ${MAX_JOB_DESCRIPTION_CHARS.toLocaleString()} characters; received ${jobDescription.length.toLocaleString()}.`,
      });
      return;
    }

    for (const candidate of candidates) {
      if (candidate.cv.length > MAX_CV_CHARS) {
        res.status(400).json({
          error: `CV for "${candidate.name}" is too long. Maximum allowed is ${MAX_CV_CHARS.toLocaleString()} characters; received ${candidate.cv.length.toLocaleString()}.`,
        });
        return;
      }
    }

    // --- API key guard ---

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // 500 because this is a server-side configuration problem, not a client error.
      res.status(500).json({ error: 'Server misconfiguration: GEMINI_API_KEY not set' });
      return;
    }

    // --- Call Gemini ---

    try {
      const ai = new GoogleGenAI({ apiKey });

      let candidatesText = '';
      candidates.forEach((c, index) => {
        candidatesText += `--- CANDIDATO ${index + 1}: ${c.name} ---\n${c.cv}\n\n`;
      });

      const prompt = `
A continuación se presenta el perfil del cargo y los CVs de los candidatos a evaluar:

### ENTRADA A — JOB DESCRIPTION
${jobDescription}

### ENTRADA B — CVs DE CANDIDATOS
${candidatesText}

Realiza la evaluación según tus instrucciones, utilizando formato Markdown para los títulos, negritas y tablas.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          // Low temperature keeps evaluations deterministic across identical inputs.
          temperature: 0.2,
        },
      });

      res.json({ result: response.text });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gemini API error';
      // 502 signals that our upstream dependency (Gemini) failed, not our own code.
      res.status(502).json({ error: message });
    }
  },
);
