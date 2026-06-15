import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("LeaferCanvas media-style node decorators", () => {
  it("does not draw generic circular port decorators for video batch replacement nodes", () => {
    const source = readFileSync(new URL("./LeaferCanvas.tsx", import.meta.url), "utf8");
    const inlinePortBlock = source.slice(
      source.indexOf("function hasInlinePortHandles"),
      source.indexOf("function buildNodeDecorators")
    );

    expect(inlinePortBlock).toContain("video_batch_replacement_node");
  });
});
