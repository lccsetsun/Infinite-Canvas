import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("LandingPage inline login", () => {
  it("opens an embedded landing login panel instead of delegating navigation", () => {
    const source = readFileSync(new URL("./LandingPage.tsx", import.meta.url), "utf8");

    expect(source).toContain("onLogin: (accessToken: string) => void;");
    expect(source).toContain("initialLoginOpen?: boolean;");
    expect(source).toContain("const [isLoginOpen, setIsLoginOpen] = React.useState(() => initialLoginOpen);");
    expect(source).toContain('variant="landing"');
    expect(source).toContain("setIsLoginOpen(true)");
    expect(source).not.toContain("onOpenLogin");
  });

  it("keeps only the login entry wired to open the landing login panel", () => {
    const source = readFileSync(new URL("./LandingPage.tsx", import.meta.url), "utf8");

    expect(source.match(/onClick=\{openLogin\}/g)).toHaveLength(1);
    expect(source).toContain("免费使用</span>");
    expect(source).toContain("开始创作");
    expect(source).toContain("体验演示");
  });
});
