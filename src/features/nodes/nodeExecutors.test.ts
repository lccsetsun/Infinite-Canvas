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
        quantity: "1张",
        n: 1,
        prompt_optimizer: false,
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
          n: 1,
          prompt_optimizer: false,
          base_url: "https://api.minimaxi.com/v1",
        }),
      })
    );
    expect(result?.outputs[0]).toBe("https://example.com/minimax.png");
    expect(result?.patch?.imageUrl).toBe("https://example.com/minimax.png");
    expect(result?.patch?.imageUrls).toEqual(["https://example.com/minimax.png"]);
    expect(result?.patch?.activeImageIndex).toBe(0);
  });

  it("uses node aspect ratio property when no aspect input is connected", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ imageUrls: ["https://example.com/minimax-4-3.png"] }),
    } as Response);

    const executor = getExecutor("image_node");
    await executor?.({
      inputs: { prompt: "五只小鸭子" },
      properties: {
        model: "image-01",
        aspect_ratio: "4:3",
        quantity: "1张",
        n: 1,
        prompt_optimizer: false,
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        minimaxApiKey: "mini-test-key",
        minimaxBaseUrl: "https://api.minimaxi.com/v1",
      },
    });

    const request = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(request.aspect_ratio).toBe("4:3");
  });
});

describe("video_node MiniMax executor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests MiniMax video generation with node video settings", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        videoUrl: "https://example.com/minimax-video.mp4",
        taskId: "task_1",
        fileId: "file_1",
        metadata: { duration: 6, resolution: "768P" },
      }),
    } as Response);

    const executor = getExecutor("video_node");
    const result = await executor?.({
      inputs: { prompt: "小狗在草地上奔跑", image: "https://example.com/first-frame.png" },
      properties: {
        model: "MiniMax-Hailuo-2.3",
        duration: "6s",
        resolution: "768P",
        aspect_ratio: "16:9",
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
      "/api/minimax/video-generation",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-MiniMax-Api-Key": "mini-test-key",
        }),
        body: JSON.stringify({
          model: "MiniMax-Hailuo-2.3",
          prompt: "小狗在草地上奔跑",
          first_frame_image: "https://example.com/first-frame.png",
          duration: 6,
          resolution: "768P",
          aspect_ratio: "16:9",
          prompt_optimizer: true,
          base_url: "https://api.minimaxi.com/v1",
        }),
      })
    );
    expect(result?.outputs[0]).toBe("https://example.com/minimax-video.mp4");
    expect(result?.patch).toMatchObject({
      videoUrl: "https://example.com/minimax-video.mp4",
      minimaxVideoTaskId: "task_1",
      minimaxVideoFileId: "file_1",
      status: "success",
    });
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
        model: "deepseek-chat",
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      model: "deepseek-chat",
    });
  });

  it("maps the legacy deepseek-v4-flash model to deepseek-chat before request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    } as Response);

    const executor = getExecutor("text_node");
    await executor?.({
      inputs: { user_prompt: "hello" },
      properties: { model: "deepseek-v4-flash" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
        model: "deepseek-chat",
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      model: "deepseek-chat",
    });
  });

  it("uses DeepSeek provider config even when the active api config points to MiniMax", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    } as Response);

    const executor = getExecutor("text_node");
    await executor?.({
      inputs: { user_prompt: "hello" },
      properties: { model: "deepseek-chat" },
      apiConfig: {
        baseUrl: "https://api.minimaxi.com/v1",
        apiKey: "mini-key",
        model: "image-01",
        providerApiKeys: {
          deepseek: "sk-deepseek",
          minimax: "mini-key",
        },
        providerBaseUrls: {
          deepseek: "https://api.deepseek.com",
          minimax: "https://api.minimaxi.com/v1",
        },
        providerModels: {
          deepseek: "deepseek-chat",
          minimax: "image-01",
        },
      },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer sk-deepseek",
    });
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      model: "deepseek-chat",
    });
  });

  it("coerces non-string upstream inputs into the user prompt", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    } as Response);

    const executor = getExecutor("text_node");
    await executor?.({
      inputs: { user_prompt: 42 },
      properties: { model: "deepseek-chat" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
        model: "deepseek-chat",
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      messages: [{ role: "user", content: "42" }],
    });
  });
});
