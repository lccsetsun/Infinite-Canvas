import { describe, expect, it, vi } from "vitest";
import { performLocalLogout, performOptimisticLogout } from "./logoutFlow";

describe("performOptimisticLogout", () => {
  it("starts the remote logout request before clearing the local token", () => {
    const steps: string[] = [];
    const requestLogout = vi.fn(
      () =>
        new Promise<void>(() => {
          steps.push("request-started");
        })
    );
    const clearSession = vi.fn(() => {
      steps.push("session-cleared");
    });
    const onLoggedOut = vi.fn(() => {
      steps.push("navigated");
    });

    performOptimisticLogout({
      requestLogout,
      clearSession,
      onLoggedOut,
    });

    expect(steps).toEqual(["request-started", "session-cleared", "navigated"]);
  });
});

describe("performLocalLogout", () => {
  it("clears the local session before notifying the app shell", () => {
    const steps: string[] = [];
    const clearSession = vi.fn(() => {
      steps.push("session-cleared");
    });
    const onLoggedOut = vi.fn(() => {
      steps.push("shell-notified");
    });

    performLocalLogout({
      clearSession,
      onLoggedOut,
    });

    expect(steps).toEqual(["session-cleared", "shell-notified"]);
  });
});
