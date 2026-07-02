import { afterEach, describe, expect, it, vi } from "vitest";
import { listOssResourceAssets } from "./ossResourceAssets";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(),
}));

const { devApiFetch } = await import("../auth/request");

describe("listOssResourceAssets", () => {
  afterEach(() => {
    vi.mocked(devApiFetch).mockReset();
  });

  it("loads OSS history assets by fileName and tabType", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "ok",
          data: {
            rows: [
              {
                createTime: "2026-06-02 10:20:30",
                fileName: "dress.png",
                ossId: "oss-1",
                url: "https://oss.example.com/dress.png",
              },
            ],
          },
        })
      )
    );

    await expect(
      listOssResourceAssets({ fileName: "dress", kind: "image", tabType: "img_his" })
    ).resolves.toMatchObject([
      {
        id: "oss:oss-1",
        kind: "image",
        nodeTitle: "dress.png",
        source: "img_his",
        url: "https://oss.example.com/dress.png",
      },
    ]);
    expect(devApiFetch).toHaveBeenCalledWith(
      "/ai/resource/oss/list?fileName=dress&tabType=img_his",
      { method: "GET", timeoutMs: 10000 }
    );
  });
});
