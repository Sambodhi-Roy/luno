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
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
    throw new ApiError(0, OFFLINE_MESSAGE);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? `Request failed (${res.status})`);
  }

  return data as T;
}

const OFFLINE_MESSAGE = "Can't reach Luno right now. Check your connection and try again.";

/**
 * Text to show a user for a failed request. The API's own messages for validation (400) and conflicts (409)
 * are written for people, so they're kept; everything else gets a plain explanation instead of server wording.
 */
export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again.") {
  if (!(e instanceof ApiError)) return e instanceof Error && e.message ? e.message : fallback;
  switch (e.status) {
    case 0:
      return OFFLINE_MESSAGE;
    case 400:
    case 409:
      return e.message || fallback;
    case 401:
      return "Your session has ended. Log in again to continue.";
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return "We couldn't find that. It may have been deleted.";
    default:
      return e.status >= 500 ? "Luno hit a problem on its side. Please try again in a moment." : fallback;
  }
}
