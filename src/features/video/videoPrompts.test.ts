import { describe, expect, it, vi } from "vitest";
import { fetchVideoPrompt } from "./videoPrompts";

describe("fetchVideoPrompt", () => {
  it("posts the video url and returns normalized prompt text", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => "token-123"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 200,
          msg: "OK",
          data: {
            prompt: "A cinematic product shot with soft light.",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchVideoPrompt("https://oss.example.com/source.mp4")).resolves.toBe(
      "A cinematic product shot with soft light."
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/dev-api/system/videoPrompts?url=https%3A%2F%2Foss.example.com%2Fsource.mp4");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-123");
  });

  it("joins prompt arrays when the backend returns multiple prompt lines", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            code: 200,
            msg: "OK",
            data: {
              prompts: ["wide shot", "warm sunlight"],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await expect(fetchVideoPrompt("https://oss.example.com/source.mp4")).resolves.toBe(
      "wide shot\nwarm sunlight"
    );
  });
});
