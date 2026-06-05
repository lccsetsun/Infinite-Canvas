import { AUTH_LOGIN_FLAG_KEY, AUTH_STORAGE_KEY } from "./authConfig";

function getStorage() {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function getAccessToken() {
  return getStorage()?.getItem(AUTH_STORAGE_KEY)?.trim() || "";
}

export function setAccessToken(accessToken: string) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(AUTH_STORAGE_KEY, accessToken);
  storage.setItem(AUTH_LOGIN_FLAG_KEY, "true");
}

export function clearAuthSession() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(AUTH_STORAGE_KEY);
  storage.removeItem(AUTH_LOGIN_FLAG_KEY);
}

export function hasAuthSession() {
  const storage = getStorage();
  if (!storage) return false;
  return storage.getItem(AUTH_LOGIN_FLAG_KEY) === "true" && Boolean(getAccessToken());
}
