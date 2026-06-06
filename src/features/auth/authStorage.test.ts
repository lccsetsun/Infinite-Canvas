import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_LOGIN_FLAG_KEY, AUTH_STORAGE_KEY } from "./authConfig";
import { clearAuthSession, setAccessToken } from "./authStorage";

describe("authStorage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
    });
  });

  it("broadcasts a session change after login state is written", () => {
    setAccessToken("token-123");

    expect(localStorage.setItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY, "token-123");
    expect(localStorage.setItem).toHaveBeenCalledWith(AUTH_LOGIN_FLAG_KEY, "true");
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("broadcasts a session change after the local session is cleared", () => {
    clearAuthSession();

    expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_LOGIN_FLAG_KEY);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });
});
