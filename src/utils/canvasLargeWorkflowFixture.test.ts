import { describe, expect, it } from "vitest";
import { createLargeCanvasFixture } from "./canvasLargeWorkflowFixture";

describe("createLargeCanvasFixture", () => {
  it("creates deterministic nodes and links for performance tests", () => {
    const fixture = createLargeCanvasFixture({ imageNodes: 12, videoNodes: 8, textNodes: 4 });

    expect(fixture.nodes).toHaveLength(24);
    expect(fixture.links.length).toBeGreaterThan(0);
    expect(fixture.nodes[0]).toMatchObject({
      id: "fixture_text_0",
      type: "text_node",
      x: 0,
      y: 0,
    });
    expect(fixture.nodes.some((node) => node.type === "video_node")).toBe(true);
  });

  it("stores lightweight media URLs instead of embedded data URLs", () => {
    const fixture = createLargeCanvasFixture({ imageNodes: 2, videoNodes: 2, textNodes: 1 });
    const serialized = JSON.stringify(fixture);

    expect(serialized).not.toContain("data:image/");
    expect(serialized).not.toContain("data:video/");
    expect(
      fixture.nodes
        .filter((node) => node.type === "image_node")
        .every((node) => typeof node.data?.imageUrl === "string" && node.data.imageUrl.startsWith("https://"))
    ).toBe(true);
    expect(
      fixture.nodes
        .filter((node) => node.type === "video_node")
        .every((node) => typeof node.data?.videoUrl === "string" && node.data.videoUrl.startsWith("https://"))
    ).toBe(true);
  });
});
