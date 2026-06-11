import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_MODEL_TYPES, makeEmptyAiModelsByType } from "../api/aiModelCatalog";
import { devApiFetch } from "../auth/request";
import { uploadFileToOss } from "../resource/ossApi";
import { assertApiKey, getExecutor, normalizeApiKey } from "./nodeExecutors";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(),
}));

vi.mock("../resource/ossApi", () => ({
  uploadFileToOss: vi.fn(),
}));

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
    vi.mocked(devApiFetch).mockReset();
  });

  it("sends remote image models to the generator images API with upstream oss ids", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "ok",
          data: {
            imageUrls: ["https://example.com/remote-image.png"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const remoteModelsByType = makeEmptyAiModelsByType();
    remoteModelsByType[AI_MODEL_TYPES[1]] = [
      {
        id: "image-remote-1",
        apiId: "2062435940867551234",
        modelId: "wan2.7-image-pro",
        modelType: AI_MODEL_TYPES[1],
      },
    ];

    const executor = getExecutor("image_node");
    const result = await executor?.({
      inputs: {
        prompt: "Generate a poster",
        reference_oss_ids: ["2064712536372035585"],
      },
      properties: {
        model: "wan2.7-image-pro",
        aspect_ratio: "16:9",
        resolution: "1K",
        n: 2,
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        remoteModelsByType,
      },
    });

    expect(devApiFetch).toHaveBeenCalledWith(
      "/system/generator/images",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt: "Generate a poster",
          n: 2,
          customSize: "1408x792",
          ossId: ["2064712536372035585"],
          model: {
            apiId: "2062435940867551234",
            modelId: "wan2.7-image-pro",
          },
        }),
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result?.outputs[0]).toBe("https://example.com/remote-image.png");
    expect(result?.patch?.imageUrl).toBe("https://example.com/remote-image.png");
    expect(result?.patch?.imageUrls).toEqual(["https://example.com/remote-image.png"]);
    expect(result?.patch?.remoteModelId).toBe("wan2.7-image-pro");
  });

  it("keeps remote image oss ids on generated image nodes for downstream references", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "ok",
          data: {
            imageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
            ossIds: ["oss-a", "oss-b"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const remoteModelsByType = makeEmptyAiModelsByType();
    remoteModelsByType[AI_MODEL_TYPES[1]] = [
      {
        id: "image-remote-1",
        apiId: "2062435940867551234",
        modelId: "wan2.7-image-pro",
        modelType: AI_MODEL_TYPES[1],
      },
    ];

    const executor = getExecutor("image_node");
    const result = await executor?.({
      inputs: { prompt: "Generate references" },
      properties: { model: "wan2.7-image-pro", aspect_ratio: "1:1", resolution: "1K", n: 2 },
      apiConfig: { baseUrl: "", apiKey: "", remoteModelsByType },
    });

    expect(result?.patch?.imageUrls).toEqual([
      "https://example.com/a.png",
      "https://example.com/b.png",
    ]);
    expect(result?.patch?.ossIds).toEqual(["oss-a", "oss-b"]);
    expect(result?.patch?.ossId).toBe("oss-a");
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
        resolution: "2K",
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
          resolution: "2K",
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

  it("combines editable node text with upstream prompt input", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ imageUrls: ["https://example.com/minimax-composed.png"] }),
    } as Response);

    const executor = getExecutor("image_node");
    await executor?.({
      inputs: { prompt: "Upstream text reference" },
      properties: {
        text: "Local image direction",
        model: "image-01",
        resolution: "1K",
        aspect_ratio: "1:1",
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        minimaxApiKey: "mini-test-key",
        minimaxBaseUrl: "https://api.minimaxi.com/v1",
      },
    });

    const request = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(request.prompt).toBe(
      "Local image direction\n\nUpstream input content:\nUpstream text reference"
    );
  });
});

describe("video_node MiniMax executor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(devApiFetch).mockReset();
  });

  it("sends remote video models to the generator video API and returns a pending task id", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "ok",
          data: {
            id: "remote-video-task-1",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const remoteModelsByType = makeEmptyAiModelsByType();
    remoteModelsByType[AI_MODEL_TYPES[2]] = [
      {
        id: "video-remote-1",
        apiId: "2062435940867551234",
        modelId: "wan2.7-video-pro",
        modelType: AI_MODEL_TYPES[2],
      },
    ];

    const executor = getExecutor("video_node");
    const result = await executor?.({
      inputs: {
        prompt: "Generate a short cinematic clip",
        reference_oss_ids: ["2064712536372035585"],
      },
      properties: {
        model: "wan2.7-video-pro",
        duration: "6s",
        audio: true,
        aspect_ratio: "16:9",
        resolution: "P720",
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        remoteModelsByType,
      },
    });

    expect(devApiFetch).toHaveBeenCalledWith(
      "/system/generator/video",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt: "Generate a short cinematic clip",
          duration: 6,
          generateAudio: true,
          ratio: "16:9",
          resolution: "720p",
          ossId: ["2064712536372035585"],
          resrouceId: [],
          model: {
            apiId: "2062435940867551234",
            modelId: "wan2.7-video-pro",
          },
        }),
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result?.outputs).toEqual({});
    expect(result?.pending).toEqual({ type: "remote-video", taskId: "remote-video-task-1" });
    expect(result?.patch).toMatchObject({
      remoteVideoTaskId: "remote-video-task-1",
      remoteModelId: "wan2.7-video-pro",
      status: "loading",
      loading: true,
    });
  });

  it("requests MiniMax video generation with node video settings", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        videoUrl: "https://example.com/minimax-video.mp4",
        taskId: "task_1",
        fileId: "file_1",
        metadata: { duration: 6, resolution: "2K" },
      }),
    } as Response);

    const executor = getExecutor("video_node");
    const result = await executor?.({
      inputs: { prompt: "小狗在草地上奔跑", image: "https://example.com/first-frame.png" },
      properties: {
        model: "MiniMax-Hailuo-2.3",
        duration: "6s",
        resolution: "2K",
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
          resolution: "2K",
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

  it("combines editable node text with upstream prompt input", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        videoUrl: "https://example.com/minimax-composed-video.mp4",
        taskId: "task_composed",
      }),
    } as Response);

    const executor = getExecutor("video_node");
    await executor?.({
      inputs: { prompt: "Upstream text reference" },
      properties: {
        text: "Local video direction",
        model: "MiniMax-Hailuo-2.3",
        duration: "6s",
        resolution: "1K",
        aspect_ratio: "16:9",
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        minimaxApiKey: "mini-test-key",
        minimaxBaseUrl: "https://api.minimaxi.com/v1",
      },
    });

    const request = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(request.prompt).toBe(
      "Local video direction\n\nUpstream input content:\nUpstream text reference"
    );
  });

  it("sends freeform video duration in the supported 1-15 second range", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        videoUrl: "https://example.com/minimax-12s-video.mp4",
      }),
    } as Response);

    const executor = getExecutor("video_node");
    await executor?.({
      inputs: { prompt: "城市夜景延时摄影" },
      properties: {
        model: "MiniMax-Hailuo-2.3",
        duration: "12s",
        resolution: "1K",
        aspect_ratio: "16:9",
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        minimaxApiKey: "mini-test-key",
        minimaxBaseUrl: "https://api.minimaxi.com/v1",
      },
    });

    const request = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(request.duration).toBe(12);
  });

  it("defaults video duration to five seconds when unset", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        videoUrl: "https://example.com/minimax-default-duration-video.mp4",
      }),
    } as Response);

    const executor = getExecutor("video_node");
    await executor?.({
      inputs: { prompt: "清晨森林薄雾" },
      properties: {
        model: "MiniMax-Hailuo-2.3",
        resolution: "1K",
        aspect_ratio: "16:9",
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        minimaxApiKey: "mini-test-key",
        minimaxBaseUrl: "https://api.minimaxi.com/v1",
      },
    });

    const request = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(request.duration).toBe(5);
  });
});

describe("audio_node MiniMax executor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(uploadFileToOss).mockReset();
  });

  it("uploads MiniMax hex audio to OSS when the proxy does not return a direct URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        audioHex: "494433",
        contentType: "audio/mpeg",
        fileName: "speech.mp3",
        metadata: { format: "mp3" },
      }),
    } as Response);
    vi.mocked(uploadFileToOss).mockResolvedValue({
      url: "https://oss.example.com/generated-audio.mp3",
      ossId: "generated-audio-oss-id",
      fileName: "generated-audio.mp3",
      raw: { url: "https://oss.example.com/generated-audio.mp3" },
    });

    const executor = getExecutor("audio_node");
    const result = await executor?.({
      inputs: { prompt: "生成一段黄鹂鸟的音频" },
      properties: {
        model: "speech-2.8-hd",
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        minimaxApiKey: "mini-test-key",
        minimaxBaseUrl: "https://api.minimaxi.com/v1",
      },
    });

    expect(uploadFileToOss).toHaveBeenCalledTimes(1);
    const uploadedFile = vi.mocked(uploadFileToOss).mock.calls[0]?.[0];
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile?.name).toBe("speech.mp3");
    expect(result?.outputs[0]).toBe("https://oss.example.com/generated-audio.mp3");
    expect(result?.patch).toMatchObject({
      audioUrl: "https://oss.example.com/generated-audio.mp3",
      status: "success",
    });
  });

  it("combines editable node text with upstream prompt input", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        audioUrl: "https://oss.example.com/composed-audio.mp3",
      }),
    } as Response);

    const executor = getExecutor("audio_node");
    await executor?.({
      inputs: { prompt: "Upstream text reference" },
      properties: {
        text: "Local audio direction",
        model: "speech-2.8-hd",
      },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        minimaxApiKey: "mini-test-key",
        minimaxBaseUrl: "https://api.minimaxi.com/v1",
      },
    });

    const request = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(request.text).toBe(
      "Local audio direction\n\nUpstream input content:\nUpstream text reference"
    );
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

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/deepseek/chat-completions");
    expect((init as RequestInit).headers).toMatchObject({
      "X-DeepSeek-Api-Key": "sk-test",
      "X-DeepSeek-Base-Url": "https://api.deepseek.com",
    });
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      model: "deepseek-chat",
    });
  });

  it("sends remote text models to the media-to-text API with upstream oss ids", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "ok",
          data: { content: "remote analysis" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const remoteModelsByType = makeEmptyAiModelsByType();
    remoteModelsByType[AI_MODEL_TYPES[0]] = [
      {
        id: "1",
        apiId: "2062435940867551234",
        modelId: "qwen3.7-plus",
        modelType: AI_MODEL_TYPES[0],
      },
    ];

    const executor = getExecutor("text_node");
    const result = await executor?.({
      inputs: {
        user_prompt: "Analyze these images",
        reference_oss_ids: ["2064712536372035585", "2064712536372035586"],
      },
      properties: { model: "qwen3.7-plus" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
        model: "deepseek-chat",
        remoteModelsByType,
      },
    });

    expect(devApiFetch).toHaveBeenCalledWith(
      "/system/videoTotext",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          prompt: "Analyze these images",
          ossId: ["2064712536372035585", "2064712536372035586"],
          model: {
            apiId: "2062435940867551234",
            modelId: "qwen3.7-plus",
          },
        }),
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result?.outputs[0]).toBe("remote analysis");
    expect(result?.patch?.response).toBe("remote analysis");
  });

  it("does not use qwen3.7-plus envelope msg as response text when data is empty", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "操作成功",
          data: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const remoteModelsByType = makeEmptyAiModelsByType();
    remoteModelsByType[AI_MODEL_TYPES[0]] = [
      {
        id: "1",
        apiId: "2062435940867551234",
        modelId: "qwen3.7-plus",
        modelType: AI_MODEL_TYPES[0],
      },
    ];

    const executor = getExecutor("text_node");
    const result = await executor?.({
      inputs: {
        user_prompt: "Analyze this image",
        reference_oss_ids: ["2064712536372035585"],
      },
      properties: { model: "qwen3.7-plus" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
        model: "deepseek-chat",
        remoteModelsByType,
      },
    });

    expect(result?.outputs[0]).toBe("");
    expect(result?.patch?.response).toBe("");
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
    expect(url).toBe("/api/deepseek/chat-completions");
    expect((init as RequestInit).headers).toMatchObject({
      "X-DeepSeek-Api-Key": "sk-deepseek",
      "X-DeepSeek-Base-Url": "https://api.deepseek.com",
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

  it("combines the node instruction with upstream text input", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    } as Response);

    const executor = getExecutor("text_node");
    await executor?.({
      inputs: { user_prompt: "Cats, dogs, and pigs" },
      properties: { text: "Answer based on text one", model: "deepseek-chat" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
        model: "deepseek-chat",
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      messages: [
        {
          role: "user",
          content: "Answer based on text one\n\nUpstream input content:\nCats, dogs, and pigs",
        },
      ],
    });
  });

  it("outputs plain text nodes directly without calling a model", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const executor = getExecutor("text_node");

    const result = await executor?.({
      inputs: {},
      properties: { textMode: "plain", text: "Plain source text", model: "deepseek-chat" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
        model: "deepseek-chat",
      },
    });

    expect(result?.outputs[0]).toBe("Plain source text");
    expect(result?.patch?.response).toBe("Plain source text");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes multimodal text requests to MiniMax with ordered reference images", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "multimodal ok" } }] }),
    } as Response);

    const executor = getExecutor("text_node");
    await executor?.({
      inputs: {
        user_prompt: "请比较图一和图二的主体差异",
        reference_images: ["https://example.com/a.png", "https://example.com/b.png"],
      },
      properties: { model: "MiniMax-M3" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
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
          minimax: "MiniMax-M3",
        },
      },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.minimaxi.com/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer mini-key",
    });

    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.model).toBe("MiniMax-M3");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toEqual([
      { type: "text", text: "请比较图一和图二的主体差异" },
      { type: "text", text: "下面按顺序提供 2 张参考图，请在回答中用图一、图二等编号区分。" },
      { type: "image_url", image_url: { url: "https://example.com/a.png", detail: "default" } },
      { type: "image_url", image_url: { url: "https://example.com/b.png", detail: "default" } },
    ]);
  });

  it("does not treat grouped image reference arrays as prompt text", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "multimodal ok" } }] }),
    } as Response);
    const frameImages = Array.from(
      { length: 7 },
      (_, index) => `https://example.com/frame-${index + 1}.png`
    );

    const executor = getExecutor("text_node");
    await executor?.({
      inputs: {
        user_prompt: frameImages,
        reference_images: frameImages,
      },
      properties: { text: "分析这些逐帧画面", model: "MiniMax-M3" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
        providerApiKeys: {
          deepseek: "sk-deepseek",
          minimax: "mini-key",
        },
        providerBaseUrls: {
          deepseek: "https://api.deepseek.com",
          minimax: "https://api.minimaxi.com/v1",
        },
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.messages[1].content[0]).toEqual({
      type: "text",
      text: "分析这些逐帧画面",
    });
    expect(body.messages[1].content).toHaveLength(9);
  });

  it("rejects non-OSS blob references instead of converting them to base64", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const executor = getExecutor("text_node");

    await expect(
      executor?.({
        inputs: {
          user_prompt: "分析这张上传图片",
          reference_images: ["blob:http://127.0.0.1/demo"],
        },
        properties: { model: "MiniMax-M3" },
        apiConfig: {
          baseUrl: "https://api.deepseek.com",
          apiKey: "sk-test",
          providerApiKeys: {
            deepseek: "sk-deepseek",
            minimax: "mini-key",
          },
          providerBaseUrls: {
            deepseek: "https://api.deepseek.com",
            minimax: "https://api.minimaxi.com/v1",
          },
        },
      })
    ).rejects.toThrow("请先上传到 OSS");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects placeholder SVG references before calling MiniMax", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const executor = getExecutor("text_node");

    await expect(
      executor?.({
        inputs: {
          user_prompt: "分析这张图片",
          reference_images: ["data:image/svg+xml,%3Csvg%3Eplaceholder%3C/svg%3E"],
        },
        properties: { model: "MiniMax-M3" },
        apiConfig: {
          baseUrl: "https://api.deepseek.com",
          apiKey: "sk-test",
          providerApiKeys: {
            deepseek: "sk-deepseek",
            minimax: "mini-key",
          },
          providerBaseUrls: {
            deepseek: "https://api.deepseek.com",
            minimax: "https://api.minimaxi.com/v1",
          },
        },
      })
    ).rejects.toThrow("请先上传真实参考图或参考视频，默认占位图不能直接发送给模型");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the multimodal text model instead of MiniMax image-01 when reference images exist", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "multimodal ok" } }] }),
    } as Response);

    const executor = getExecutor("text_node");
    await executor?.({
      inputs: {
        user_prompt: "分析一下图片",
        reference_images: ["https://example.com/a.png"],
      },
      properties: { model: "image-01" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
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

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.model).toBe("MiniMax-M3");
  });

  it("strips model reasoning blocks before storing text responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "<think>\nI should inspect the image privately.\n</think>\n# 图一分析\n\n这是一张卡通角色图。",
            },
          },
        ],
      }),
    } as Response);

    const executor = getExecutor("text_node");
    const result = await executor?.({
      inputs: {
        user_prompt: "分析一下图片",
        reference_images: ["https://example.com/a.png"],
      },
      properties: { model: "MiniMax-M3" },
      apiConfig: {
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-test",
        providerApiKeys: {
          deepseek: "sk-deepseek",
          minimax: "mini-key",
        },
        providerBaseUrls: {
          deepseek: "https://api.deepseek.com",
          minimax: "https://api.minimaxi.com/v1",
        },
      },
    });

    expect(result?.outputs[0]).toBe("# 图一分析\n\n这是一张卡通角色图。");
    expect(result?.patch?.response).toBe("# 图一分析\n\n这是一张卡通角色图。");
  });
});
