import { describe, expect, it } from "vitest";
import { assertApiKey, normalizeApiKey } from "./nodeExecutors";

describe("normalizeApiKey", () => {
  it("trims copied API keys before sending request headers", () => {
    expect(normalizeApiKey("  sk-valid-key\r\n")).toBe("sk-valid-key");
  });

  it("rejects empty API keys before any request is sent", () => {
    expect(() => assertApiKey("   ", "DeepSeek")).toThrow("DeepSeek API key 未填写");
  });
});
