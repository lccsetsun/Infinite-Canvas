import { afterEach, describe, expect, it, vi } from "vitest";
import { reviewAsset } from "./assetReview";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(),
}));

const { devApiFetch } = await import("../auth/request");

describe("reviewAsset", () => {
  afterEach(() => {
    vi.mocked(devApiFetch).mockReset();
  });

  it("gets the review result string for an OSS asset id", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 200, msg: "ok", data: "审核通过" }))
    );

    await expect(reviewAsset("oss 123")).resolves.toBe("审核通过");
    expect(devApiFetch).toHaveBeenCalledWith("/system/ai/asset/oss%20123", {
      method: "GET",
    });
  });

  it("throws when the review API does not return a string", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(JSON.stringify({ code: 200, msg: "ok", data: { status: "ok" } }))
    );

    await expect(reviewAsset("oss-123")).rejects.toThrow("送审接口没有返回结果");
  });
});
