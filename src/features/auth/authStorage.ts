import { AUTH_LOGIN_FLAG_KEY, AUTH_STORAGE_KEY } from "./authConfig";

export const AUTH_SESSION_CHANGED_EVENT = "auth-session-changed";

function getStorage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function notifyAuthSessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

export function getAccessToken() {
  return getStorage()?.getItem(AUTH_STORAGE_KEY)?.trim() || "";
}

export function setAccessToken(accessToken: string) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(AUTH_STORAGE_KEY, accessToken);
  storage.setItem(AUTH_LOGIN_FLAG_KEY, "true");
  notifyAuthSessionChanged();
}

export function clearAuthSession() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(AUTH_STORAGE_KEY);
  storage.removeItem(AUTH_LOGIN_FLAG_KEY);
  notifyAuthSessionChanged();
}

export function hasAuthSession() {
  const storage = getStorage();
  if (!storage) return false;
  return storage.getItem(AUTH_LOGIN_FLAG_KEY) === "true" && Boolean(getAccessToken());
}
