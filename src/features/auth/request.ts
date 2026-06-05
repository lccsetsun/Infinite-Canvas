import { AUTH_BASE_API, AUTH_CLIENT_ID } from "./authConfig";
import { clearAuthSession, getAccessToken } from "./authStorage";

export interface DevApiRequestOptions extends RequestInit {
  auth?: boolean;
  includeClientId?: boolean;
  token?: string;
}

function resolveDevApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith(AUTH_BASE_API)) return path;
  return `${AUTH_BASE_API}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function devApiFetch(path: string, options: DevApiRequestOptions = {}) {
  const {
    auth = true,
    includeClientId = true,
    token,
    headers,
    ...init
  } = options;

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

  const response = await fetch(resolveDevApiUrl(path), {
    ...init,
    headers: finalHeaders,
  });

  if (response.status === 401) {
    clearAuthSession();
  }

  return response;
}
