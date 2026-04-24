// Shape of a single candidate as accepted by the submit handler in App.tsx.
// cvFile and cv are mutually exclusive — whichever is non-empty/non-null wins.
export interface CandidatePayload {
  name: string;
  cv: string;          // empty string when cvFile is provided
  cvFile: File | null; // null when cv text is provided
}

interface EvaluateResponse {
  result: string;
  error?: string;
}

// Builds and POSTs a multipart/form-data request to the evaluate endpoint.
// We use FormData instead of JSON so the browser can attach binary File objects
// directly — the backend receives them as named file fields via multer (or
// equivalent). We deliberately omit the Content-Type header so the browser
// sets it automatically with the correct multipart boundary.
export async function evaluateCandidates(
  jobDescription: string | null,
  jobDescriptionFile: File | null,
  candidates: CandidatePayload[]
): Promise<string | undefined> {
  const form = new FormData();

  // Append whichever job-description source the user chose.
  // Exactly one of these two will be non-null/non-empty at call time
  // (enforced by App.tsx validation before this function is called).
  if (jobDescriptionFile) {
    form.append('jobDescriptionFile', jobDescriptionFile);
  } else {
    form.append('jobDescription', jobDescription ?? '');
  }

  // Append each candidate using indexed bracket notation so the backend can
  // reconstruct an ordered array: candidates[0][name], candidates[0][cv], etc.
  candidates.forEach((candidate, i) => {
    form.append(`candidates[${i}][name]`, candidate.name);

    if (candidate.cvFile) {
      // File path — backend reads the uploaded file instead of inline text
      form.append(`candidates[${i}][cvFile]`, candidate.cvFile);
    } else {
      // Text path — unchanged from the original JSON behaviour
      form.append(`candidates[${i}][cv]`, candidate.cv);
    }
  });

  const response = await fetch('/api/evaluate', {
    method: 'POST',
    // No Content-Type header — the browser fills it in with the correct
    // multipart/form-data boundary string automatically when body is FormData.
    body: form,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as EvaluateResponse).error || `Server error: ${response.status}`);
  }

  const data: EvaluateResponse = await response.json();
  return data.result;
}
