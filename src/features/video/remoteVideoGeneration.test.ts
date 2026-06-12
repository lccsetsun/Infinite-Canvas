import { afterEach, describe, expect, it, vi } from "vitest";
import { devApiFetch } from "../auth/request";
import {
  createRemoteVideoGenerationTask,
  parseRemoteVideoTaskResult,
  queryRemoteVideoGenerationTask,
} from "./remoteVideoGeneration";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(),
}));

describe("remote video generation task parsing", () => {
  afterEach(() => {
    vi.mocked(devApiFetch).mockReset();
  });

  it("starts a remote video task and keeps it pending when only an id is returned", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "ok",
          data: { id: "video-task-1" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await createRemoteVideoGenerationTask({
      prompt: "Generate a city shot",
      duration: 6,
      generateAudio: true,
      ratio: "16:9",
      resolution: "720p",
      ossIds: ["oss-1"],
      resourceIds: [],
      model: { apiId: "api-1", modelId: "video-model" },
    });

    expect(devApiFetch).toHaveBeenCalledWith(
      "/system/generator/video",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
    expect(result).toEqual({ taskId: "video-task-1", videoUrl: "" });
  });

  it("treats a string data payload from the create endpoint as the task id", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "ok",
          data: "cgt-20260611222907-rz555",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await createRemoteVideoGenerationTask({
      prompt: "Generate a clip",
      duration: 6,
      generateAudio: true,
      ratio: "16:9",
      resolution: "720p",
      ossIds: [],
      resourceIds: [],
      model: { apiId: "api-1", modelId: "video-model" },
    });

    expect(result).toEqual({ taskId: "cgt-20260611222907-rz555", videoUrl: "" });
  });

  it("queries the remote video task endpoint by id", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "ok",
          data: { status: "success", videoUrl: "https://example.com/video.mp4" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await queryRemoteVideoGenerationTask("video-task-1");

    expect(devApiFetch).toHaveBeenCalledWith("/system/generator/video/video-task-1", {
      method: "GET",
    });
    expect(result).toEqual({
      status: "success",
      videoUrl: "https://example.com/video.mp4",
      error: "",
      rawStatus: "success",
    });
  });

  it("treats the generator poll response data url as a successful video result", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "OK",
          data: {
            url: "https://kwyai1.oss-cn-beijing.aliyuncs.com/pic/2026/06/12/result.mp4",
            ossId: "2065349696657846273",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await queryRemoteVideoGenerationTask("cgt-20260612162242-psz6j");

    expect(result).toEqual({
      status: "success",
      videoUrl: "https://kwyai1.oss-cn-beijing.aliyuncs.com/pic/2026/06/12/result.mp4",
      error: "",
      rawStatus: "",
    });
  });

  it("treats the backend running 500 response as a pending video task", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 500,
          msg: "未知任务状态：running",
          data: null,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await queryRemoteVideoGenerationTask("cgt-20260612102951-jm5b5");

    expect(result).toEqual({
      status: "pending",
      videoUrl: "",
      error: "",
      rawStatus: "running",
    });
  });

  it("treats the backend generating 500 response as a pending video task", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 500,
          msg: "视频生成中，请稍后...",
          data: null,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await queryRemoteVideoGenerationTask("cgt-20260612164251-2cwlt");

    expect(result).toEqual({
      status: "pending",
      videoUrl: "",
      error: "",
      rawStatus: "running",
    });
  });

  it("treats nested result urls as successful query results", () => {
    expect(
      parseRemoteVideoTaskResult({
        status: "completed",
        result: { url: "https://example.com/result.mp4" },
      })
    ).toEqual({
      status: "success",
      videoUrl: "https://example.com/result.mp4",
      error: "",
      rawStatus: "completed",
    });
  });

  it("keeps unknown non-terminal statuses pending", () => {
    expect(parseRemoteVideoTaskResult({ status: "running" })).toEqual({
      status: "pending",
      videoUrl: "",
      error: "",
      rawStatus: "running",
    });
  });

  it("returns an error state for failed tasks", () => {
    expect(parseRemoteVideoTaskResult({ status: "failed", msg: "render failed" })).toEqual({
      status: "error",
      videoUrl: "",
      error: "render failed",
      rawStatus: "failed",
    });
  });
});
