import { AUTH_BASE_API, AUTH_CLIENT_ID } from "./authConfig";
import { clearAuthSession, getAccessToken } from "./authStorage";

export interface DevApiRequestOptions extends RequestInit {
  auth?: boolean;
  includeClientId?: boolean;
  token?: string;
}

const inFlightGetRequests = new Map<string, Promise<Response>>();

function resolveDevApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith(AUTH_BASE_API)) return path;
  return `${AUTH_BASE_API}${path.startsWith("/") ? path : `/${path}`}`;
}

function serializeRequestBody(body: BodyInit | null | undefined) {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    return JSON.stringify(Array.from(body.entries()));
  }
  return String(body);
}

function buildDedupKey(method: string, url: string, headers: Headers, body: BodyInit | null | undefined) {
  const headerPairs = Array.from(headers.entries()).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify({
    method,
    url,
    headers: headerPairs,
    body: serializeRequestBody(body),
  });
}

export async function devApiFetch(path: string, options: DevApiRequestOptions = {}) {
  const {
    auth = true,
    includeClientId = true,
    token,
    headers,
    ...init
  } = options;
  const method = (init.method || "GET").toUpperCase();
  const url = resolveDevApiUrl(path);

  const finalHeaders = new Headers(headers);

  if (includeClientId && !finalHeaders.has("clientid")) {
    finalHeaders.set("clientid", AUTH_CLIENT_ID);
  }

  if (auth && !finalHeaders.has("Authorization")) {
    const accessToken = token ?? getAccessToken();
    if (accessToken) {
      finalHeaders.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const requestInit: RequestInit = {
    ...init,
    method,
    headers: finalHeaders,
  };

  const shouldDedup = import.meta.env.DEV && method === "GET";
  const dedupKey = shouldDedup ? buildDedupKey(method, url, finalHeaders, requestInit.body) : "";

  const fetchPromise =
    shouldDedup && inFlightGetRequests.has(dedupKey)
      ? inFlightGetRequests.get(dedupKey)!
      : fetch(url, requestInit).finally(() => {
          if (shouldDedup) {
            inFlightGetRequests.delete(dedupKey);
          }
        });

  if (shouldDedup && !inFlightGetRequests.has(dedupKey)) {
    inFlightGetRequests.set(dedupKey, fetchPromise);
  }

  const response = await fetchPromise;

  if (response.status === 401) {
    clearAuthSession();
  }

  return shouldDedup ? response.clone() : response;
}
