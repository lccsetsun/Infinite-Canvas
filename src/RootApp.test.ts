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

describe("RootApp login surfaces", () => {
  it("keeps /login on the standalone login page while / uses the landing login panel", () => {
    const source = readFileSync(new URL("./RootApp.tsx", import.meta.url), "utf8");

    expect(source).toContain("pathname === LOGIN_PATH ? <LoginPage onLogin={handleLogin} />");
    expect(source).toContain("<LandingPage onLogin={handleLogin} initialLoginOpen={shouldOpenLandingLogin} />");
    expect(source).not.toContain("LandingPage onOpenLogin");
  });

  it("returns logout flows to the landing page with the inline login panel open", () => {
    const source = readFileSync(new URL("./RootApp.tsx", import.meta.url), "utf8");

    expect(source).toContain("setShouldOpenLandingLogin(true);");
    expect(source).toContain("navigate(DEFAULT_PATH, true);");
    expect(source).not.toContain("navigate(LOGIN_PATH, true);");
  });
});
