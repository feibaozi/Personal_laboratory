const BASE_URL = process.env.CODEBASE_AGENT_URL || 'http://127.0.0.1:3456';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function analyzeProject(
  projectPath: string
): Promise<{ projectId: string }> {
  return request('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ projectPath }),
  });
}

export async function getGraph(projectId: string): Promise<any> {
  return request(`/api/projects/${projectId}/graph`);
}

export async function getLineage(
  projectId: string,
  symbol: string,
  depth: number = 5
): Promise<any> {
  return request(
    `/api/projects/${projectId}/lineage?symbol=${encodeURIComponent(
      symbol
    )}&depth=${depth}`
  );
}

export async function getDebt(projectId: string): Promise<any> {
  return request(`/api/projects/${projectId}/debt`);
}

export async function getRefactorSuggestions(
  projectId: string
): Promise<any> {
  return request(`/api/projects/${projectId}/refactor-suggestions`);
}

export async function getDuplications(projectId: string): Promise<any> {
  return request(`/api/projects/${projectId}/duplications`);
}

export async function getStatus(projectId: string): Promise<any> {
  return request(`/api/status/${projectId}`);
}

export async function generateDocs(
  projectId: string
): Promise<{ content: string }> {
  return request(`/api/projects/${projectId}/docs/generate`, {
    method: 'POST',
  });
}