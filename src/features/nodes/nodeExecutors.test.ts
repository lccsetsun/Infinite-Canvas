import { afterEach, describe, expect, it, vi } from "vitest";
import { assertApiKey, getExecutor, normalizeApiKey } from "./nodeExecutors";

describe("normalizeApiKey", () => {
  it("trims copied API keys before sending request headers", () => {
    expect(normalizeApiKey("  sk-valid-key\r\n")).toBe("sk-valid-key");
  });

  it("rejects empty API keys before any request is sent", () => {
    expect(() => assertApiKey("   ", "DeepSeek")).toThrow("DeepSeek API key 未填写");
  });
});

describe("image_node MiniMax executor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends MiniMax-native text-to-image parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ imageUrls: ["https://example.com/minimax.png"], id: "req_1" }),
    } as Response);

    const executor = getExecutor("image_node");
    const result = await executor?.({
      inputs: { prompt: "雨夜街道", aspect_ratio: "9:16" },
      properties: {
        model: "image-01",
        quantity: "3张",
        n: 3,
        prompt_optimizer: true,
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        minimaxApiKey: "mini-test-key",
        minimaxBaseUrl: "https://api.minimaxi.com/v1",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/minimax/image-generation",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-MiniMax-Api-Key": "mini-test-key",
        }),
        body: JSON.stringify({
          model: "image-01",
          prompt: "雨夜街道",
          aspect_ratio: "9:16",
          response_format: "url",
          n: 3,
          prompt_optimizer: true,
          base_url: "https://api.minimaxi.com/v1",
        }),
      })
    );
    expect(result?.outputs[0]).toBe("https://example.com/minimax.png");
    expect(result?.patch?.imageUrls).toEqual(["https://example.com/minimax.png"]);
  });
});

describe("text_node executor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the node model selected by properties instead of a hard-coded model", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    } as Response);

    const executor = getExecutor("text_node");
    await executor?.({
      inputs: { user_prompt: "hello" },
      properties: { model: "deepseek-chat" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
        model: "deepseek-v4-flash",
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      model: "deepseek-chat",
    });
  });
});
