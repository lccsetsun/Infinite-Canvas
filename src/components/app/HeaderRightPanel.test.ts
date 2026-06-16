import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HeaderRightPanel", () => {
  it("does not render the membership center label in the account trigger", () => {
    const source = readFileSync(new URL("./HeaderRightPanel.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("会员中心");
    expect(source).not.toContain("ShieldCheck");
  });

  it("uses a default user avatar instead of the document icon when the api has no avatar", () => {
    const source = readFileSync(new URL("./HeaderRightPanel.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("FileText");
    expect(source).not.toContain("User,");
    expect(source).not.toContain("<User");
    expect(source).toContain("function DefaultAvatar()");
    expect(source).toContain("<DefaultAvatar />");
    expect(source).toContain("userInfo?.avatarUrl");
    expect(source).toContain("<img src={userInfo.avatarUrl}");
    expect(source).toContain("bg-violet-300/[0.105]");
    expect(source).toContain("border-violet-200/15");
    expect(source).toContain("bg-[#151d2b]/88");
    expect(source).toContain("bg-[#141c2a]/96");
    expect(source).toContain("bg-violet-300/[0.065]");
    expect(source).not.toContain("bg-cyan-100/[0.105]");
    expect(source).not.toContain("text-cyan-200");
    expect(source).not.toContain("from-indigo-500 via-blue-500");
  });

  it("keeps the account panel clickable inside a non-interactive canvas header", () => {
    const source = readFileSync(new URL("./HeaderRightPanel.tsx", import.meta.url), "utf8");

    expect(source).toContain("pointer-events-auto flex items-center gap-2.5");
  });
});
