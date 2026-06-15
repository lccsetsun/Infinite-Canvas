import { afterEach, describe, expect, it, vi } from "vitest";
import {
  batchEditImages,
  parseBatchEditImagesTaskResult,
  queryBatchEditImagesTask,
} from "./videoBatchReplacement";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(),
}));

const { devApiFetch } = await import("../auth/request");

describe("batchEditImages", () => {
  afterEach(() => {
    vi.mocked(devApiFetch).mockReset();
  });

  it("posts batch replacement payload to the remote batch edit API", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 200, msg: "ok", data: [] }))
    );

    const result = await batchEditImages({
      prompt: "replace product",
      productOssId: ["product-1"],
      customSize: "1280x720",
      ossId: ["source-1"],
      model: {
        apiId: "api-1",
        modelId: "image-model",
      },
    });

    expect(devApiFetch).toHaveBeenCalledWith("/system/generator/batchEditImgaes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "replace product",
        productOssId: ["product-1"],
        customSize: "1280x720",
        ossId: ["source-1"],
        model: {
          apiId: "api-1",
          modelId: "image-model",
        },
      }),
    });
    expect(result).toEqual({ taskId: "", items: [] });
  });

  it("treats a string response data payload as a pending batch edit task id", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 200, msg: "OK", data: "bg_2066519705937645568" }))
    );

    const result = await batchEditImages({
      prompt: "replace product",
      productOssId: ["product-1"],
      customSize: "1080x1080",
      ossId: ["source-1"],
      model: {
        apiId: "api-1",
        modelId: "image-model",
      },
    });

    expect(result).toEqual({ taskId: "bg_2066519705937645568", items: [] });
  });

  it("queries the batch edit task endpoint by id", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "OK",
          data: {
            status: "SUCCESS",
            resultList: [
              {
                index: 0,
                video: "https://example.com/result.mp4",
                frame_images: [{ url: "https://example.com/frame.png", ossId: "oss-1" }],
              },
            ],
          },
        })
      )
    );

    const result = await queryBatchEditImagesTask("bg_2066519705937645568");

    expect(devApiFetch).toHaveBeenCalledWith(
      "/system/generator/batchEditImgaes/bg_2066519705937645568",
      { method: "GET" }
    );
    expect(result).toEqual({
      status: "success",
      items: [
        {
          index: 0,
          video: "https://example.com/result.mp4",
          frame_images: [{ url: "https://example.com/frame.png", ossId: "oss-1" }],
        },
      ],
      error: "",
      rawStatus: "success",
    });
  });

  it("keeps unknown non-terminal batch edit task statuses pending", () => {
    expect(parseBatchEditImagesTaskResult({ status: "running" })).toEqual({
      status: "pending",
      items: [],
      error: "",
      rawStatus: "running",
    });
  });

  it("keeps partial resultList payloads pending until SUCCESS", () => {
    const items = [{ url: "https://example.com/partial.png", ossId: "oss-partial" }];

    expect(parseBatchEditImagesTaskResult({ status: "RUNNING", resultList: items })).toEqual({
      status: "pending",
      items,
      error: "",
      rawStatus: "running",
    });
  });

  it("marks resultList payloads successful only when the task status is SUCCESS", () => {
    const items = [{ url: "https://example.com/final.png", ossId: "oss-final" }];

    expect(parseBatchEditImagesTaskResult({ status: "SUCCESS", resultList: items })).toEqual({
      status: "success",
      items,
      error: "",
      rawStatus: "success",
    });
  });

  it("returns an error state for failed batch edit tasks", () => {
    expect(parseBatchEditImagesTaskResult({ status: "failed", msg: "render failed" })).toEqual({
      status: "error",
      items: [],
      error: "render failed",
      rawStatus: "failed",
    });
  });
});
