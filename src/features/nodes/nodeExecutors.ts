import { NodeClass } from "../../types";

export interface ExecutorContext {
  inputs: Record<string, unknown>;
  properties: Record<string, unknown>;
  apiConfig: {
    baseUrl: string;
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    timeout?: number;
    systemPrompt?: string;
    useSystemProxy?: boolean;
    deepseekBaseUrl?: string;
    deepseekApiKey?: string;
    deepseekModel?: string;
    minimaxApiKey?: string;
    minimaxBaseUrl?: string;
    providerApiKeys?: Partial<Record<string, string>>;
    providerBaseUrls?: Partial<Record<string, string>>;
    providerModels?: Partial<Record<string, string>>;
  };
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export interface ExecutorResult {
  outputs: Record<number, unknown>;
  patch?: Record<string, unknown>;
}

export type NodeExecutor = (ctx: ExecutorContext) => Promise<ExecutorResult>;

export const TEXT_NODE_MODEL = "deepseek-chat";
export const MINIMAX_IMAGE_MODEL = "image-01";
export const MINIMAX_VIDEO_MODEL = "MiniMax-Hailuo-2.3";
export const MINIMAX_AUDIO_MODEL = "speech-2.8-hd";

const MINIMAX_ASPECT_RATIOS = new Set(["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"]);
const MINIMAX_IMAGE_MODELS = new Set([MINIMAX_IMAGE_MODEL]);
const MINIMAX_VIDEO_MODELS = new Set([MINIMAX_VIDEO_MODEL, "minimax-video"]);
const MINIMAX_AUDIO_MODELS = new Set([MINIMAX_AUDIO_MODEL, "speech-02-hd", "speech-02-turbo"]);
const MINIMAX_MULTIMODAL_MODEL = "MiniMax-M3";
const MINIMAX_MULTIMODAL_MODELS = new Set([MINIMAX_MULTIMODAL_MODEL]);
const DEEPSEEK_MODEL_ALIASES: Record<string, string> = {
  "": TEXT_NODE_MODEL,
  "deepseek-v4-flash": TEXT_NODE_MODEL,
};

function stripReasoningBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export function normalizeApiKey(apiKey: string): string {
  return apiKey.trim();
}

export function assertApiKey(apiKey: string, providerLabel: string): string {
  const normalizedApiKey = normalizeApiKey(apiKey);
  if (!normalizedApiKey) {
    throw new Error(`${providerLabel} API key 未填写，请先到 API 设置里保存访问密钥`);
  }
  return normalizedApiKey;
}

async function callGeminiProxy(
  body: { model?: string; contents: string; config?: Record<string, unknown> },
  apiKey: string
): Promise<{ text: string }> {
  const normalizedApiKey = assertApiKey(apiKey, "DeepSeek");
  const r = await fetch("/api/gemini/proxy", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(normalizedApiKey ? { "X-Api-Key": normalizedApiKey } : {})
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    throw new Error(`AI 调用失败 (${r.status}): ${errText || r.statusText}`);
  }
  return r.json();
}

async function callOpenAICompatible(
  cfg: {
    baseUrl: string;
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    timeout?: number;
    systemPrompt?: string;
    providerLabel?: string;
  },
  contents:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
        | { type: "video_url"; video_url: { url: string } }
      >
): Promise<{ text: string }> {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const url = `${base}/chat/completions`;
  const normalizedApiKey = assertApiKey(cfg.apiKey, cfg.providerLabel || "DeepSeek");
  const messages: {
    role: "system" | "user";
    content:
      | string
      | Array<
          | { type: "text"; text: string }
          | { type: "image_url"; image_url: { url: string } }
          | { type: "video_url"; video_url: { url: string } }
        >;
  }[] = [];
  if (cfg.systemPrompt && cfg.systemPrompt.trim()) {
    messages.push({ role: "system", content: cfg.systemPrompt });
  }
  messages.push({ role: "user", content: contents });
  const controller = new AbortController();
  const timer = cfg.timeout ? window.setTimeout(() => controller.abort(), cfg.timeout * 1000) : null;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(normalizedApiKey ? { Authorization: `Bearer ${normalizedApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        top_p: cfg.topP,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`AI 调用失败 (${resp.status}): ${errText || resp.statusText}`);
    }
    const data = await resp.json();
    const choice = data?.choices?.[0];
    const text = choice?.message?.content ?? choice?.text ?? "";
    return { text: typeof text === "string" ? stripReasoningBlocks(text) : "" };
  } finally {
    if (timer !== null) window.clearTimeout(timer);
  }
}

function pickString(inputs: Record<string, unknown>, properties: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (typeof inputs[k] === "string" && (inputs[k] as string).trim()) return inputs[k] as string;
    if (typeof properties[k] === "string" && (properties[k] as string).trim()) return properties[k] as string;
  }
  const fallback = (properties.text as string) ?? "";
  return fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function isHttpMediaUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function isBase64DataUrl(value: string) {
  return /^data:[^;,]+;base64,/i.test(value.trim());
}

function isSvgDataUrl(value: string) {
  return /^data:image\/svg\+xml/i.test(value.trim());
}

function encodeBase64(binary: string): string {
  if (typeof btoa === "function") return btoa(binary);
  if (typeof Buffer !== "undefined") return Buffer.from(binary, "binary").toString("base64");
  throw new Error("Base64 encoding is not supported in this environment");
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const mime = blob.type || "application/octet-stream";
  return `data:${mime};base64,${encodeBase64(binary)}`;
}

async function normalizeVisionReferenceUrl(url: string): Promise<string> {
  const normalized = url.trim();
  if (!normalized) return "";
  if (isSvgDataUrl(normalized)) {
    return "";
  }
  if (isHttpMediaUrl(normalized) || isBase64DataUrl(normalized)) return normalized;
  if (!normalized.startsWith("blob:") && !normalized.startsWith("data:")) return normalized;

  const response = await fetch(normalized);
  if (!response.ok) {
    throw new Error(`Failed to prepare reference media (${response.status})`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function stringifyPromptValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => stringifyPromptValue(item)).filter((item) => item.trim());
    return items.join("\n");
  }
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }
  return "";
}

function looksLikeImagePromptValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.startsWith("data:image/") ||
    normalized.startsWith("blob:") ||
    /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/.test(normalized)
  );
}

function pickPromptLike(inputs: Record<string, unknown>, properties: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const inputValue = stringifyPromptValue(inputs[k]);
    if (inputValue.trim() && !looksLikeImagePromptValue(inputValue)) return inputValue;

    const propertyValue = stringifyPromptValue(properties[k]);
    if (propertyValue.trim()) return propertyValue;
  }

  return stringifyPromptValue(properties.text);
}

function pickNumber(inputs: Record<string, unknown>, properties: Record<string, unknown>, key: string): number | undefined {
  if (typeof inputs[key] === "number" && Number.isFinite(inputs[key] as number)) return inputs[key] as number;
  const raw = (properties as any)[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return undefined;
}

function normalizeTextModel(model: unknown): string {
  const value = typeof model === "string" ? model.trim() : "";
  return DEEPSEEK_MODEL_ALIASES[value] || value || TEXT_NODE_MODEL;
}

function buildTextToImageUrl(prompt: string, aspect: string): string {
  const map: Record<string, string> = {
    "1:1": "square_hd",
    "9:16": "portrait_16_9",
    "3:4": "portrait_4_3",
    "4:5": "portrait_4_3",
    "2:3": "portrait_4_3",
    "16:9": "landscape_16_9",
    "4:3": "landscape_4_3",
    "3:2": "landscape_4_3",
    "5:4": "landscape_4_3",
    "21:9": "landscape_16_9"
  };
  const size = map[aspect] || "square_hd";
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}`;
}

function parseImageCount(value: unknown): number {
  const raw = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(9, Math.max(1, Math.trunc(raw)));
}

function parseDurationSeconds(value: unknown): number {
  const raw = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(raw)) return 6;
  return raw <= 6 ? 6 : 10;
}

function normalizeMiniMaxVideoModel(model: unknown): string {
  const value = typeof model === "string" ? model.trim() : "";
  return value === "minimax-video" || !value ? MINIMAX_VIDEO_MODEL : value;
}

function normalizeMiniMaxVideoResolution(value: unknown): string {
  const resolution = typeof value === "string" ? value.trim().toUpperCase() : "";
  return resolution === "1080P" ? "1080P" : "768P";
}

function normalizeMiniMaxAudioModel(model: unknown): string {
  const value = typeof model === "string" ? model.trim() : "";
  if (!value || value === "minimax-speech-2.8-hd") return MINIMAX_AUDIO_MODEL;
  return MINIMAX_AUDIO_MODELS.has(value) ? value : MINIMAX_AUDIO_MODEL;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const raw = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

async function callMiniMaxTextToImage(
  properties: Record<string, unknown>,
  prompt: string,
  model: string,
  minimaxApiKey?: string,
  minimaxBaseUrl?: string,
  aspectRatioInput?: string
): Promise<{
  imageUrls: string[];
  requestId?: string;
  metadata?: Record<string, unknown>;
}> {
  if (!prompt.trim()) {
    throw new Error("请输入图片生成提示词");
  }
  if (prompt.length > 1500) {
    throw new Error("MiniMax 图片提示词最长 1500 字符，请精简后重试");
  }

  const aspectRatio = String(aspectRatioInput || properties.aspect_ratio || "16:9");
  const n = parseImageCount(properties.n ?? properties.quantity ?? 1);
  const response = await fetch("/api/minimax/image-generation", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(minimaxApiKey?.trim() ? { "X-MiniMax-Api-Key": minimaxApiKey.trim() } : {}),
    },
    body: JSON.stringify({
      model,
      prompt,
      aspect_ratio: MINIMAX_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : "16:9",
      response_format: "url",
      n,
      prompt_optimizer: properties.prompt_optimizer === true,
      base_url: minimaxBaseUrl,
      seed: typeof properties.seed === "number" && Number.isFinite(properties.seed) ? properties.seed : undefined,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `MiniMax 生图失败 (${response.status})`);
  }

  const imageUrls = Array.isArray(data?.imageUrls) ? data.imageUrls.filter((url: unknown) => typeof url === "string" && url) : [];
  if (imageUrls.length === 0) {
    throw new Error("MiniMax 未返回图片链接");
  }

  return {
    imageUrls,
    requestId: typeof data?.id === "string" ? data.id : undefined,
    metadata: typeof data?.metadata === "object" && data.metadata ? data.metadata : undefined,
  };
}

async function callMiniMaxTextToVideo(
  properties: Record<string, unknown>,
  prompt: string,
  model: string,
  minimaxApiKey?: string,
  minimaxBaseUrl?: string,
  imageUrl?: string
): Promise<{
  videoUrl: string;
  taskId?: string;
  fileId?: string;
  metadata?: Record<string, unknown>;
}> {
  if (!prompt.trim()) {
    throw new Error("请输入视频生成提示词");
  }
  if (prompt.length > 2000) {
    throw new Error("MiniMax 视频提示词最长 2000 字符，请精简后重试");
  }

  const duration = parseDurationSeconds(properties.duration);
  const resolution = normalizeMiniMaxVideoResolution(properties.resolution);
  const aspectRatio = String(properties.aspect_ratio || "16:9");
  const response = await fetch("/api/minimax/video-generation", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(minimaxApiKey?.trim() ? { "X-MiniMax-Api-Key": minimaxApiKey.trim() } : {}),
    },
    body: JSON.stringify({
      model,
      prompt,
      first_frame_image: imageUrl || undefined,
      duration,
      resolution,
      aspect_ratio: MINIMAX_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : "16:9",
      prompt_optimizer: properties.prompt_optimizer === true,
      base_url: minimaxBaseUrl,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `MiniMax 视频生成失败 (${response.status})`);
  }

  const videoUrl = typeof data?.videoUrl === "string" ? data.videoUrl : "";
  if (!videoUrl) {
    throw new Error("MiniMax 未返回视频链接");
  }

  return {
    videoUrl,
    taskId: typeof data?.taskId === "string" ? data.taskId : undefined,
    fileId: typeof data?.fileId === "string" ? data.fileId : undefined,
    metadata: typeof data?.metadata === "object" && data.metadata ? data.metadata : undefined,
  };
}

async function callMiniMaxTextToAudio(
  properties: Record<string, unknown>,
  text: string,
  model: string,
  minimaxApiKey?: string,
  minimaxBaseUrl?: string
): Promise<{
  audioUrl: string;
  metadata?: Record<string, unknown>;
}> {
  if (!text.trim()) {
    throw new Error("请输入音频生成文本");
  }
  if (text.length > 10000) {
    throw new Error("MiniMax 音频文本最长 10000 字符，请精简后重试");
  }

  const response = await fetch("/api/minimax/audio-generation", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(minimaxApiKey?.trim() ? { "X-MiniMax-Api-Key": minimaxApiKey.trim() } : {}),
    },
    body: JSON.stringify({
      model,
      text,
      voice_id: typeof properties.voice_id === "string" ? properties.voice_id : properties.voice || "male-qn-qingse",
      speed: clampNumber(properties.speed, 1, 0.5, 2),
      vol: clampNumber(properties.vol, 1, 0.1, 10),
      pitch: clampNumber(properties.pitch, 0, -12, 12),
      emotion: typeof properties.emotion === "string" ? properties.emotion : "auto",
      audio_sample_rate: clampNumber(properties.audio_sample_rate, 32000, 8000, 44100),
      bitrate: clampNumber(properties.bitrate, 128000, 32000, 320000),
      format: typeof properties.format === "string" ? properties.format : "mp3",
      base_url: minimaxBaseUrl,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `MiniMax 音频生成失败 (${response.status})`);
  }

  const audioUrl = typeof data?.audioUrl === "string" ? data.audioUrl : "";
  if (!audioUrl) {
    throw new Error("MiniMax 未返回音频链接");
  }

  return {
    audioUrl,
    metadata: typeof data?.metadata === "object" && data.metadata ? data.metadata : undefined,
  };
}

export const executors: Partial<Record<NodeClass, NodeExecutor>> = {
  text_node: async ({ inputs, properties, apiConfig }) => {
    const userPrompt = pickPromptLike(inputs, properties, "user_prompt", "prompt");
    const nodeSystemPrompt = pickString(inputs, properties, "system_prompt");
    const deepseekBaseUrl = apiConfig.providerBaseUrls?.deepseek || apiConfig.deepseekBaseUrl || apiConfig.baseUrl;
    const deepseekApiKey = apiConfig.providerApiKeys?.deepseek || apiConfig.deepseekApiKey || apiConfig.apiKey;
    const deepseekModel = apiConfig.providerModels?.deepseek || apiConfig.deepseekModel || apiConfig.model;
    const minimaxBaseUrl = apiConfig.providerBaseUrls?.minimax || apiConfig.minimaxBaseUrl || apiConfig.baseUrl;
    const minimaxApiKey = apiConfig.providerApiKeys?.minimax || apiConfig.minimaxApiKey || apiConfig.apiKey;
    const model = normalizeTextModel(properties.model || deepseekModel);
    const referenceImages = normalizeStringArray(inputs.reference_images);
    const referenceVideos = normalizeStringArray(inputs.reference_videos);
    const hasVisualReferences = referenceImages.length > 0 || referenceVideos.length > 0;
    const isGemini = (deepseekBaseUrl || "").includes("generativelanguage.googleapis.com");

    let text = "";
    if (hasVisualReferences) {
      const rawMultimodalModel = typeof properties.model === "string" && properties.model.trim() ? properties.model.trim() : "";
      const multimodalModel = MINIMAX_MULTIMODAL_MODELS.has(rawMultimodalModel)
        ? rawMultimodalModel
        : MINIMAX_MULTIMODAL_MODEL;
      const multimodalContent: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail: "default" } }
        | { type: "video_url"; video_url: { url: string; detail: "default" } }
      > = [];

      multimodalContent.push({
        type: "text",
        text:
          userPrompt.trim() ||
          "请根据这些参考内容输出中文结构化分析，明确区分图一、图二等对象，并总结主体、场景、风格、光影和镜头语言。",
      });
      if (referenceImages.length > 0) {
        multimodalContent.push({
          type: "text",
          text: `下面按顺序提供 ${referenceImages.length} 张参考图，请在回答中用图一、图二等编号区分。`,
        });
      }
      if (referenceVideos.length > 0) {
        multimodalContent.push({
          type: "text",
          text: `下面按顺序提供 ${referenceVideos.length} 个参考视频，请在回答中用视频一、视频二等编号区分。`,
        });
      }

      const normalizedReferenceImages = await Promise.all(referenceImages.map((url) => normalizeVisionReferenceUrl(url)));
      const normalizedReferenceVideos = await Promise.all(referenceVideos.map((url) => normalizeVisionReferenceUrl(url)));
      const usableReferenceImages = normalizedReferenceImages.filter(Boolean);
      const usableReferenceVideos = normalizedReferenceVideos.filter(Boolean);

      if (usableReferenceImages.length === 0 && usableReferenceVideos.length === 0) {
        throw new Error("请先上传真实参考图或参考视频，默认占位图不能直接发送给模型");
      }

      usableReferenceImages.forEach((url) => {
        if (!url) return;
        multimodalContent.push({ type: "image_url", image_url: { url, detail: "default" } });
      });

      usableReferenceVideos.forEach((url) => {
        if (!url) return;
        multimodalContent.push({ type: "video_url", video_url: { url, detail: "default" } });
      });

      text = (
        await callOpenAICompatible(
          {
            baseUrl: minimaxBaseUrl,
            apiKey: minimaxApiKey,
            model: multimodalModel,
            providerLabel: "MiniMax",
            temperature: apiConfig.temperature,
            maxTokens: apiConfig.maxTokens,
            topP: apiConfig.topP,
            timeout: apiConfig.timeout,
            systemPrompt:
              nodeSystemPrompt ||
              apiConfig.systemPrompt ||
              "你是多模态中文创作助手。你会收到多张参考图或视频，请严格按输入顺序理解它们，并在回答里明确区分图一、图二等引用。",
          },
          multimodalContent
        )
      ).text;
    } else if (isGemini) {
      const result = await callGeminiProxy(
        { model, contents: userPrompt, config: { systemInstruction: nodeSystemPrompt } },
        deepseekApiKey
      );
      text = result.text;
    } else {
      text = (
        await callOpenAICompatible(
          {
            baseUrl: deepseekBaseUrl,
            apiKey: deepseekApiKey,
            model,
            providerLabel: "DeepSeek",
            temperature: apiConfig.temperature,
            maxTokens: apiConfig.maxTokens,
            topP: apiConfig.topP,
            timeout: apiConfig.timeout,
            systemPrompt: nodeSystemPrompt || apiConfig.systemPrompt,
          },
          userPrompt
        )
      ).text;
    }
    return { outputs: { 0: text }, patch: { response: text, status: "success" } };
  },

  image_node: async ({ inputs, properties, apiConfig }) => {
    const prompt = pickString(inputs, properties, "prompt");
    const model = String(properties.model || MINIMAX_IMAGE_MODEL);
    if (MINIMAX_IMAGE_MODELS.has(model)) {
      const aspect = pickString(inputs, properties, "aspect_ratio") || "16:9";
      const minimaxApiKey = apiConfig.providerApiKeys?.minimax || apiConfig.minimaxApiKey;
      const minimaxBaseUrl = apiConfig.providerBaseUrls?.minimax || apiConfig.minimaxBaseUrl;
      const result = await callMiniMaxTextToImage(properties, prompt, model, minimaxApiKey, minimaxBaseUrl, aspect);
      return {
        outputs: { 0: result.imageUrls[0] },
        patch: {
          imageUrl: result.imageUrls[0],
          imageUrls: result.imageUrls,
          activeImageIndex: 0,
          minimaxRequestId: result.requestId,
          minimaxMetadata: result.metadata,
          status: "success",
        },
      };
    }

    const aspect = pickString(inputs, properties, "aspect_ratio") || "1:1";
    const imageUrl = buildTextToImageUrl(prompt, aspect);
    return { outputs: { 0: imageUrl }, patch: { imageUrl, status: "success" } };
  },

  video_node: async ({ inputs, properties, apiConfig }) => {
    const prompt = pickString(inputs, properties, "prompt");
    const imageUrl = (inputs.image as string) || (inputs["首帧"] as string) || "";
    const model = normalizeMiniMaxVideoModel(properties.model);
    if (MINIMAX_VIDEO_MODELS.has(model)) {
      const minimaxApiKey = apiConfig.providerApiKeys?.minimax || apiConfig.minimaxApiKey;
      const minimaxBaseUrl = apiConfig.providerBaseUrls?.minimax || apiConfig.minimaxBaseUrl;
      const result = await callMiniMaxTextToVideo(properties, prompt, model, minimaxApiKey, minimaxBaseUrl, imageUrl);
      return {
        outputs: { 0: result.videoUrl },
        patch: {
          videoUrl: result.videoUrl,
          referenceImage: imageUrl || undefined,
          minimaxVideoTaskId: result.taskId,
          minimaxVideoFileId: result.fileId,
          minimaxVideoMetadata: result.metadata,
          status: "success",
        },
      };
    }

    throw new Error(`不支持的视频模型: ${model}`);
  },

  string_input: async ({ properties }) => {
    return { outputs: { 0: (properties.value as string) ?? "" } };
  },

  slider_input: async ({ properties }) => {
    return { outputs: { 0: Number(properties.value ?? 0) } };
  },

  load_image: async ({ properties }) => {
    return { outputs: { 0: (properties.imageUrl as string) ?? "" } };
  },

  string_concat: async ({ inputs, properties }) => {
    const sep = (properties.separator as string) ?? " ";
    const a = pickString(inputs, properties, "文本 A", "text_a");
    const b = pickString(inputs, properties, "文本 B", "text_b");
    return { outputs: { 0: `${a}${sep}${b}` } };
  },

  math_node: async ({ inputs, properties }) => {
    const a = pickNumber(inputs, properties, "数值 A") ?? 0;
    const b = pickNumber(inputs, properties, "数值 B") ?? 0;
    const op = (properties.op as string) || "+";
    const result = op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : op === "/" ? (b === 0 ? 0 : a / b) : 0;
    return { outputs: { 0: result } };
  },

  prompt_enhancer: async ({ inputs }) => {
    const text = (inputs["原始提示词"] as string) || (inputs.prompt as string) || "";
    return { outputs: { 0: text } };
  },

  image_filter: async ({ inputs }) => {
    const url = (inputs["输入图像"] as string) || (inputs.image as string) || "";
    return { outputs: { 0: url } };
  },

  vae_decode: async ({ inputs }) => {
    const url = (inputs["核心图像"] as string) || (inputs.image as string) || "";
    return { outputs: { 0: url } };
  },

  video_viewer: async ({ inputs }) => {
    const url = (inputs["视频输入"] as string) || (inputs.video as string) || "";
    return { outputs: { 0: url, 1: url } };
  },

  gemini_assistant: async ({ inputs }) => {
    const prompt = (inputs["用户提示词"] as string) || (inputs.prompt as string) || "";
    return { outputs: { 0: prompt } };
  },

  clip_text: async ({ properties }) => {
    return { outputs: { 0: (properties.text as string) ?? "" } };
  },

  ksampler: async ({ inputs }) => {
    const prompt = (inputs["正向提示词"] as string) || (inputs.prompt as string) || "";
    return { outputs: { 0: prompt } };
  },

  text_to_video: async ({ inputs }) => {
    const prompt = (inputs["视频提示词"] as string) || (inputs.prompt as string) || "";
    return { outputs: { 0: prompt } };
  },

  ai_text_node: async ({ inputs, properties }) => {
    const prompt = pickString(inputs, properties, "text", "prompt");
    return { outputs: { 0: prompt } };
  },

  ai_image_node: async ({ inputs, properties }) => {
    const prompt = pickString(inputs, properties, "text", "prompt");
    return { outputs: { 0: prompt } };
  },

  ai_video_node: async ({ inputs, properties }) => {
    const prompt = pickString(inputs, properties, "text", "prompt");
    return { outputs: { 0: prompt } };
  },

  audio_node: async ({ inputs, properties, apiConfig }) => {
    const prompt = pickString(inputs, properties, "prompt", "提示词");
    const minimaxApiKey = apiConfig.providerApiKeys?.minimax || apiConfig.minimaxApiKey || apiConfig.apiKey;
    const minimaxBaseUrl = apiConfig.providerBaseUrls?.minimax || apiConfig.minimaxBaseUrl;
    const model = normalizeMiniMaxAudioModel(properties.model || apiConfig.providerModels?.minimax);
    const result = await callMiniMaxTextToAudio(properties, prompt, model, minimaxApiKey, minimaxBaseUrl);
    return {
      outputs: { 0: result.audioUrl },
      patch: {
        audioUrl: result.audioUrl,
        minimaxMetadata: result.metadata,
        model,
        status: "success",
      },
    };
  },
};

export function getExecutor(type: NodeClass): NodeExecutor | undefined {
  return executors[type];
}
