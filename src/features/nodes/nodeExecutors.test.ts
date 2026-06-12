import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_MODEL_TYPES, makeEmptyAiModelsByType } from "../api/aiModelCatalog";
import { devApiFetch } from "../auth/request";
import { getExecutor } from "./nodeExecutors";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(),
}));

describe("image_node remote executor", () => {
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

  it("extracts image urls and oss ids from generator image item arrays", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "OK",
          data: [
            {
              url: "https://kwyai1.oss-cn-beijing.aliyuncs.com/pic/2026/06/12/ff496aeb95a9453bb861fdcb2e73324a.png",
              ossId: "2065257184861634561",
            },
          ],
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
      properties: { model: "wan2.7-image-pro", aspect_ratio: "1:1", resolution: "1K" },
      apiConfig: { baseUrl: "", apiKey: "", remoteModelsByType },
    });

    expect(result?.outputs[0]).toBe(
      "https://kwyai1.oss-cn-beijing.aliyuncs.com/pic/2026/06/12/ff496aeb95a9453bb861fdcb2e73324a.png"
    );
    expect(result?.patch?.imageUrl).toBe(
      "https://kwyai1.oss-cn-beijing.aliyuncs.com/pic/2026/06/12/ff496aeb95a9453bb861fdcb2e73324a.png"
    );
    expect(result?.patch?.ossId).toBe("2065257184861634561");
    expect(result?.patch?.ossIds).toEqual(["2065257184861634561"]);
  });

  it("rejects legacy MiniMax image models when they are not in the remote catalog", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const executor = getExecutor("image_node");

    await expect(
      executor?.({
        inputs: { prompt: "Generate a poster" },
        properties: { model: "image-01", aspect_ratio: "16:9" },
        apiConfig: { baseUrl: "", apiKey: "", remoteModelsByType: makeEmptyAiModelsByType() },
      })
    ).rejects.toThrow("Please select a remote image model");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("video_node remote executor", () => {
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

  it("rejects legacy MiniMax video models when they are not in the remote catalog", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const executor = getExecutor("video_node");

    await expect(
      executor?.({
        inputs: { prompt: "Generate a clip" },
        properties: { model: "MiniMax-Hailuo-2.3" },
        apiConfig: { baseUrl: "", apiKey: "", remoteModelsByType: makeEmptyAiModelsByType() },
      })
    ).rejects.toThrow("Please select a remote video model");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("audio_node executor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(devApiFetch).mockReset();
  });

  it("reports audio generation as under development", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const remoteModelsByType = makeEmptyAiModelsByType();
    remoteModelsByType[AI_MODEL_TYPES[3]] = [
      {
        id: "audio-remote-1",
        apiId: "2062435940867551234",
        modelId: "cosyvoice-remote",
        modelType: AI_MODEL_TYPES[3],
      },
    ];

    const executor = getExecutor("audio_node");
    await expect(
      executor?.({
        inputs: { prompt: "Generate narration" },
        properties: {
          model: "cosyvoice-remote",
          voice: "narrator",
        },
        apiConfig: { baseUrl: "", apiKey: "", remoteModelsByType },
      })
    ).rejects.toThrow("Audio generation is under development");

    expect(devApiFetch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call providers for legacy audio models", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const executor = getExecutor("audio_node");

    await expect(
      executor?.({
        inputs: { prompt: "Generate audio" },
        properties: { model: "speech-2.8-hd" },
        apiConfig: { baseUrl: "", apiKey: "", remoteModelsByType: makeEmptyAiModelsByType() },
      })
    ).rejects.toThrow("Audio generation is under development");

    expect(devApiFetch).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("text_node executor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(devApiFetch).mockReset();
  });

  it("rejects legacy DeepSeek text models when they are not in the remote catalog", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const executor = getExecutor("text_node");

    await expect(
      executor?.({
        inputs: { user_prompt: "hello" },
        properties: { model: "deepseek-chat" },
        apiConfig: { baseUrl: "", apiKey: "", remoteModelsByType: makeEmptyAiModelsByType() },
      })
    ).rejects.toThrow("Please select a remote text model");

    expect(fetchMock).not.toHaveBeenCalled();
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
        baseUrl: "",
        apiKey: "",
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

  it("does not use the remote envelope msg as response text when data is empty", async () => {
    vi.mocked(devApiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "operation succeeded",
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
        baseUrl: "",
        apiKey: "",
        remoteModelsByType,
      },
    });

    expect(result?.outputs[0]).toBe("");
    expect(result?.patch?.response).toBe("");
  });

  it("outputs plain text nodes directly without calling a model", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const executor = getExecutor("text_node");

    const result = await executor?.({
      inputs: {},
      properties: { textMode: "plain", text: "Plain source text", model: "deepseek-chat" },
      apiConfig: {
        baseUrl: "",
        apiKey: "",
        remoteModelsByType: makeEmptyAiModelsByType(),
      },
    });

    expect(result?.outputs[0]).toBe("Plain source text");
    expect(result?.patch?.response).toBe("Plain source text");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
