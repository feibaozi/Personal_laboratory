const PYTHON_PORT = 8765;

export function getApiBaseUrl(): string {
  return `http://localhost:${PYTHON_PORT}`;
}

export async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }

  return res.json();
}

export async function checkPythonHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
