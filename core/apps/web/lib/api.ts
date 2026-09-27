const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

// Thin fetch wrapper: always sends the auth cookie, speaks JSON, and throws ApiError on non-2xx
export async function api<T>(path: string, { method = "GET", body }: ApiOptions = {}): Promise<T> {
  return request<T>(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Sends files as multipart form data (the browser sets the Content-Type boundary itself). */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: "POST", body: form });
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the API running?");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? `Request failed (${res.status})`);
  }

  return data as T;
}
