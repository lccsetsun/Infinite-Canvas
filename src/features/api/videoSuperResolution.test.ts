import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseVideoSuperResolutionTaskResult,
  queryVideoSuperResolutionTask,
  submitVideoSuperResolution,
} from "./videoSuperResolution";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(),
}));

const { devApiFetch } = await import("../auth/request");

describe("video super resolution API", () => {
  afterEach(() => {
    vi.mocked(devApiFetch).mockReset();
  });

  it("submits only the source video url", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 200, msg: "OK", data: "vsr-task-1" }))
    );

    const result = await submitVideoSuperResolution({
      videoUrl: "https://example.com/source.mp4",
    });

    expect(devApiFetch).toHaveBeenCalledWith("/system/ai/videoEnhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoUrl: "https://example.com/source.mp4",
      }),
    });
    expect(result).toEqual({ taskId: "vsr-task-1", videoUrl: "" });
  });

  it("treats a poll response data url as success", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "OK",
          data: {
            status: "running",
            url: "https://example.com/upscaled.mp4",
          },
        })
      )
    );

    const result = await queryVideoSuperResolutionTask("vsr-task-1");

    expect(devApiFetch).toHaveBeenCalledWith(
      "/system/ai/videoEnhance/vsr-task-1",
      { method: "GET" }
    );
    expect(result).toEqual({
      status: "success",
      videoUrl: "https://example.com/upscaled.mp4",
      error: "",
      rawStatus: "running",
    });
  });

  it("keeps running responses without urls pending", () => {
    expect(parseVideoSuperResolutionTaskResult({ status: "RUNNING" })).toEqual({
      status: "pending",
      videoUrl: "",
      error: "",
      rawStatus: "running",
    });
  });

  it("returns an error state for failed tasks", () => {
    expect(parseVideoSuperResolutionTaskResult({ status: "FAILED", msg: "bad input" })).toEqual({
      status: "error",
      videoUrl: "",
      error: "bad input",
      rawStatus: "failed",
    });
  });
});
