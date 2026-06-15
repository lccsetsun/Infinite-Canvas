import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CanvasNodeLayer detached titles", () => {
  it("keeps detached node titles draggable above node cards", () => {
    const source = readFileSync(new URL("./CanvasNodeLayer.tsx", import.meta.url), "utf8");

    expect(source).toContain('className="absolute inset-0 z-20 origin-top-left"');
    expect(source).toContain('className="pointer-events-none absolute inset-0 z-[21]"');
    expect(source).toContain("cursor-grab");
    expect(source).toContain("pointer-events-auto");
    expect(source).toContain("onDragStart(event, node)");
    expect(source).toContain("onSelect(node.id, event)");
    expect(source).toContain("DetachedMediaNodeTitle");
  });
});
