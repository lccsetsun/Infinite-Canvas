import { describe, expect, it, vi } from "vitest";
import { fetchVideoFrameCapture } from "./frameCapture";

describe("fetchVideoFrameCapture", () => {
  it("normalizes backend frame capture data", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "token-123"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 200,
            msg: "操作成功",
            data: [
              {
                index: 0,
                video: "https://oss.example.com/segment.mp4",
                frame_images: ["https://oss.example.com/1.png", "https://oss.example.com/2.png"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchVideoFrameCapture("https://oss.example.com/source.mp4")).resolves.toEqual([
      {
        index: 0,
        videoUrl: "https://oss.example.com/segment.mp4",
        frameImages: ["https://oss.example.com/1.png", "https://oss.example.com/2.png"],
        frameImageOssIds: ["", ""],
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(
      "/dev-api/video/frameCapture?url=https%3A%2F%2Foss.example.com%2Fsource.mp4"
    );
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-123");
  });

  it("normalizes frame image objects returned by the backend", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "token-123"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 200,
              msg: "操作成功",
              data: [
                {
                  index: 0,
                  video: "https://oss.example.com/segment.mp4",
                  frame_images: [
                    { url: "https://oss.example.com/1.png", ossId: "frame-1" },
                    { url: "https://oss.example.com/2.png", ossId: "frame-2" },
                  ],
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      )
    );

    await expect(fetchVideoFrameCapture("https://oss.example.com/source.mp4")).resolves.toEqual([
      {
        index: 0,
        videoUrl: "https://oss.example.com/segment.mp4",
        frameImages: ["https://oss.example.com/1.png", "https://oss.example.com/2.png"],
        frameImageOssIds: ["frame-1", "frame-2"],
      },
    ]);
  });
});
