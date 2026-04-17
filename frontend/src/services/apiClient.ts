interface Candidate {
  name: string;
  cv: string;
}

interface EvaluateResponse {
  result: string;
  error?: string;
}

export async function evaluateCandidates(
  jobDescription: string,
  candidates: Candidate[]
): Promise<string | undefined> {
  const response = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobDescription, candidates }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as EvaluateResponse).error || `Server error: ${response.status}`);
  }

  const data: EvaluateResponse = await response.json();
  return data.result;
}
