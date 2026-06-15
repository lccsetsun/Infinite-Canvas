import { describe, expect, it, vi } from "vitest";
import { batchEditImages } from "./videoBatchReplacement";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(async () => new Response(JSON.stringify({ code: 200, msg: "ok", data: [] }))),
}));

const { devApiFetch } = await import("../auth/request");

describe("batchEditImages", () => {
  it("posts batch replacement payload to the remote batch edit API", async () => {
    await batchEditImages({
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
  });
});
