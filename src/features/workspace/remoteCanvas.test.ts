import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(),
}));

import { devApiFetch } from "../auth/request";
import {
  buildRemoteProjectPayloadHash,
  copyRemoteProject,
  createRemoteProject,
  deleteRemoteProject,
  getRemoteProjectDetail,
  listRemoteProjects,
  renameRemoteProject,
  updateRemoteProject,
} from "./remoteCanvas";

const mockedDevApiFetch = vi.mocked(devApiFetch);

function makeResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("remote canvas api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists remote projects and maps top-level rows into cards", async () => {
    mockedDevApiFetch.mockResolvedValueOnce(
      makeResponse({
        code: 200,
        msg: "success",
        total: 1,
        rows: [
          {
            id: "canvas-1",
            canvasName: "Project 1",
            previewImage: "https://example.com/1.png",
            previewImageUrl: "",
            updateTime: "2026-06-06 12:00:00",
            nodeCount: 6,
          },
        ],
      })
    );

    await expect(listRemoteProjects({ pageNum: 1, pageSize: 7 })).resolves.toEqual({
      total: 1,
      projects: [
        {
          id: "canvas-1",
          name: "Project 1",
          updatedAt: new Date("2026-06-06T12:00:00").getTime(),
          tagLabel: "创作项目",
          previewUrl: "https://example.com/1.png",
          nodeCount: 6,
        },
      ],
    });

    expect(mockedDevApiFetch).toHaveBeenCalledWith("/system/canvas/list?pageNum=1&pageSize=7", {
      method: "GET",
    });
  });

  it("loads remote project detail and extracts workflow data", async () => {
    mockedDevApiFetch.mockResolvedValueOnce(
      makeResponse({
        code: 200,
        msg: "success",
        data: {
          id: "canvas-1",
          canvasName: "Project 1",
          previewImage: "https://example.com/1.png",
          tags: ["视频项目"],
          createTime: "2026-06-01 10:00:00",
          updateTime: "2026-06-06 12:00:00",
          data: {
            nodes: [{ id: "node-1", type: "text_node", title: "文本节点", x: 0, y: 0, inputs: [], outputs: [], properties: {} }],
            links: [],
            nodeOutputs: [],
            groups: [],
          },
        },
      })
    );

    const detail = await getRemoteProjectDetail("canvas-1");

    expect(detail.id).toBe("canvas-1");
    expect(detail.name).toBe("Project 1");
    expect(detail.workflow.nodes).toHaveLength(1);
    expect(mockedDevApiFetch).toHaveBeenCalledWith("/system/canvas/canvas-1", {
      method: "GET",
    });
  });

  it("deduplicates concurrent remote project detail requests for the same project", async () => {
    mockedDevApiFetch.mockResolvedValueOnce(
      makeResponse({
        code: 200,
        msg: "success",
        data: {
          id: "canvas-1",
          canvasName: "Project 1",
          data: {
            nodes: [],
            links: [],
            nodeOutputs: [],
            groups: [],
          },
        },
      })
    );

    const [first, second] = await Promise.all([
      getRemoteProjectDetail("canvas-1"),
      getRemoteProjectDetail("canvas-1"),
    ]);

    expect(first).toEqual(second);
    expect(mockedDevApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedDevApiFetch).toHaveBeenCalledWith("/system/canvas/canvas-1", {
      method: "GET",
    });
  });

  it("loads remote project detail from metadata when present", async () => {
    mockedDevApiFetch.mockResolvedValueOnce(
      makeResponse({
        code: 200,
        msg: "success",
        data: {
          id: "canvas-1",
          canvasName: "Project 1",
          metadata: JSON.stringify({
            nodes: [{ id: "node-1", type: "text_node", title: "文本节点", x: 0, y: 0, inputs: [], outputs: [], properties: {} }],
            links: [],
            nodeOutputs: [],
            groups: [],
          }),
        },
      })
    );

    const detail = await getRemoteProjectDetail("canvas-1");

    expect(detail.workflow.nodes).toHaveLength(1);
    expect(detail.workflow.nodes[0]?.id).toBe("node-1");
  });

  it("renames remote projects using canvasName-compatible payload", async () => {
    mockedDevApiFetch
      .mockResolvedValueOnce(
        makeResponse({
          code: 200,
          msg: "success",
          data: {
            id: "canvas-1",
            canvasName: "Old Name",
            previewImage: "https://example.com/1.png",
            createTime: "2026-06-01 10:00:00",
            updateTime: "2026-06-06 12:00:00",
            data: {
              nodes: [],
              links: [],
              nodeOutputs: [],
              groups: [],
            },
          },
        })
      )
      .mockResolvedValueOnce(makeResponse({ code: 200, msg: "success", data: null }));

    await expect(renameRemoteProject("canvas-1", "New Name")).resolves.toBeUndefined();

    expect(mockedDevApiFetch).toHaveBeenNthCalledWith(1, "/system/canvas/canvas-1", {
      method: "GET",
    });
    const [, updateInit] = mockedDevApiFetch.mock.calls[1] as unknown as [string, RequestInit];
    const body = JSON.parse(String(updateInit.body));
    expect(body).toEqual({
      id: "canvas-1",
      canvasName: "New Name",
      previewImage: "https://example.com/1.png",
      metadata: JSON.stringify({ nodes: [], links: [], nodeOutputs: [], groups: [] }),
    });
  });

  it("uses the expected methods for create update delete and copy", async () => {
    mockedDevApiFetch
      .mockResolvedValueOnce(makeResponse({ code: 200, msg: "success", data: { id: "new-id" } }))
      .mockResolvedValueOnce(makeResponse({ code: 200, msg: "success", data: null }))
      .mockResolvedValueOnce(makeResponse({ code: 200, msg: "success", data: null }))
      .mockResolvedValueOnce(makeResponse({ code: 200, msg: "success", data: { id: "copied-id" } }));

    await expect(
      createRemoteProject({
        name: "New Project",
      })
    ).resolves.toBe("new-id");

    await expect(
      updateRemoteProject({
        id: "canvas-1",
        name: "Project 1",
        workflow: { nodes: [], links: [], nodeOutputs: [], groups: [] },
      })
    ).resolves.toBeUndefined();

    await expect(deleteRemoteProject("canvas-1")).resolves.toBeUndefined();
    await expect(copyRemoteProject("canvas-1")).resolves.toBe("copied-id");

    expect(mockedDevApiFetch).toHaveBeenNthCalledWith(
      3,
      "/system/canvas/canvas-1",
      { method: "DELETE" }
    );
    expect(mockedDevApiFetch).toHaveBeenNthCalledWith(
      4,
      "/system/canvas/copy/canvas-1",
      { method: "GET" }
    );

    const [, updateInit] = mockedDevApiFetch.mock.calls[1] as unknown as [string, RequestInit];
    const updateBody = JSON.parse(String(updateInit.body));
    expect(updateBody.metadata).toBe(JSON.stringify({ nodes: [], links: [], nodeOutputs: [], groups: [] }));
  });

  it("omits previewImage when includeCover is false on the canvas page", async () => {
    mockedDevApiFetch.mockResolvedValueOnce(makeResponse({ code: 200, msg: "success", data: null }));

    await expect(
      updateRemoteProject({
        id: "canvas-1",
        name: "Project 1",
        coverUrl: "https://example.com/cover.png",
        workflow: { nodes: [], links: [], nodeOutputs: [], groups: [] },
        includeCover: false,
      })
    ).resolves.toBeUndefined();

    const [, updateInit] = mockedDevApiFetch.mock.calls[0] as unknown as [string, RequestInit];
    const updateBody = JSON.parse(String(updateInit.body));
    expect(updateBody).toEqual({
      id: "canvas-1",
      canvasName: "Project 1",
      metadata: JSON.stringify({ nodes: [], links: [], nodeOutputs: [], groups: [] }),
    });
    expect(updateBody).not.toHaveProperty("previewImage");
  });

  it("hashes the final update payload and ignores fields that are not sent", () => {
    const first = buildRemoteProjectPayloadHash({
      id: "canvas-1",
      name: "Project 1",
      category: "创作项目",
      tags: ["tag-a"],
      coverUrl: "https://example.com/cover.png",
      workflow: { nodes: [], links: [], nodeOutputs: [], groups: [] },
      includeCover: false,
    });

    const second = buildRemoteProjectPayloadHash({
      id: "canvas-1",
      name: "Project 1",
      category: "另一个分类",
      tags: ["tag-b"],
      coverUrl: "https://example.com/different-cover.png",
      workflow: { nodes: [], links: [], nodeOutputs: [], groups: [] },
      includeCover: false,
    });

    const third = buildRemoteProjectPayloadHash({
      id: "canvas-1",
      name: "Project 1",
      category: "创作项目",
      tags: ["tag-a"],
      coverUrl: "https://example.com/cover.png",
      workflow: {
        nodes: [
          {
            id: "node-1",
            type: "text_node",
            title: "文本节点",
            x: 10,
            y: 20,
            inputs: [],
            outputs: [],
            properties: {},
          },
        ],
        links: [],
        nodeOutputs: [],
        groups: [],
      },
      includeCover: false,
    });

    expect(second).toBe(first);
    expect(third).not.toBe(first);
  });
});
