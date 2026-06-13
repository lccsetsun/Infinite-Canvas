import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("RootApp logout wiring", () => {
  it("passes the remote logout flow to home and project headers", () => {
    const source = readFileSync(new URL("./RootApp.tsx", import.meta.url), "utf8");

    expect(source).toContain('import { logout } from "./features/auth/authApi"');
    expect(source).toContain("performOptimisticLogout");
    expect(source).toContain("requestLogout: logout");
    expect(source).toContain("onLogout={handleLogout}");
    expect(source).not.toContain("onLogout={handleLoggedOut}");
  });
});
