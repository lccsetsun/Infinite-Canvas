import { describe, expect, it } from "vitest";
import { sanitizeWorkspaceForStorage } from "./workspaceStorage";

describe("sanitizeWorkspaceForStorage", () => {
  it("removes ephemeral uploaded media urls before localStorage persistence", () => {
    const workspace = {
      version: 2,
      currentId: "wf_1",
      workflows: {
        wf_1: {
          summary: { id: "wf_1", name: "test", tags: [], sortIndex: 1, createdAt: 1, updatedAt: 1 },
          data: {
            nodes: [
              {
                id: "node_1",
                type: "image_node",
                title: "图片节点 1",
                x: 0,
                y: 0,
                inputs: [],
                outputs: [],
                properties: {
                  imageUrl: "blob:http://127.0.0.1/demo",
                },
                data: {
                  imageUrl: "data:image/png;base64,AAAA",
                  imageUrls: ["data:image/png;base64,AAAA", "https://example.com/kept.png"],
                  videoUrl: "blob:http://127.0.0.1/video",
                },
              },
            ],
            links: [],
            nodeOutputs: [["node_1", [[0, "data:image/png;base64,AAAA"]]]],
          },
        },
      },
      trash: [],
    } as any;

    const sanitized = sanitizeWorkspaceForStorage(workspace);
    const node = sanitized.workflows.wf_1.data.nodes[0];

    expect(node.properties.imageUrl).toBe("");
    expect(node.data.imageUrl).toBe("");
    expect(node.data.imageUrls).toEqual(["https://example.com/kept.png"]);
    expect(node.data.videoUrl).toBe("");
    expect(sanitized.workflows.wf_1.data.nodeOutputs).toEqual([["node_1", [[0, ""]]]]);
  });

  it("keeps compact svg starter placeholders", () => {
    const workspace = {
      version: 2,
      currentId: "wf_1",
      workflows: {
        wf_1: {
          summary: { id: "wf_1", name: "test", tags: [], sortIndex: 1, createdAt: 1, updatedAt: 1 },
          data: {
            nodes: [
              {
                id: "node_1",
                type: "image_node",
                title: "图片节点 1",
                x: 0,
                y: 0,
                inputs: [],
                outputs: [],
                properties: {
                  imageUrl: "data:image/svg+xml,%3Csvg%3Eplaceholder%3C/svg%3E",
                },
                data: {
                  imageUrl: "data:image/svg+xml,%3Csvg%3Eplaceholder%3C/svg%3E",
                  imageUrls: ["data:image/svg+xml,%3Csvg%3Eplaceholder%3C/svg%3E"],
                },
              },
            ],
            links: [],
            nodeOutputs: [["node_1", [[0, "data:image/svg+xml,%3Csvg%3Eplaceholder%3C/svg%3E"]]]],
          },
        },
      },
      trash: [],
    } as any;

    const sanitized = sanitizeWorkspaceForStorage(workspace);
    const node = sanitized.workflows.wf_1.data.nodes[0];

    expect(node.properties.imageUrl).toContain("data:image/svg+xml");
    expect(node.data.imageUrl).toContain("data:image/svg+xml");
    expect(node.data.imageUrls).toHaveLength(1);
    expect(sanitized.workflows.wf_1.data.nodeOutputs[0][1][0][1]).toContain("data:image/svg+xml");
  });
});
