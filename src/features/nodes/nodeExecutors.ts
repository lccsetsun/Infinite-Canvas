import { NodeClass } from "../../types";
import type { AiModel, AiModelsByType } from "../api/aiModelCatalog";
import { AI_MODEL_TYPES } from "../api/aiModelCatalog";
import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";
import { uploadFileToOss } from "../resource/ossApi";
import { getImageResolutionPreset } from "./imageResolutionPresets";

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
    remoteModelsByType?: AiModelsByType;
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
const MINIMAX_IMAGE_MODEL = "image-01";
const MINIMAX_VIDEO_MODEL = "MiniMax-Hailuo-2.3";
const MINIMAX_AUDIO_MODEL = "speech-2.8-hd";

const MINIMAX_ASPECT_RATIOS = new Set(["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"]);
const MINIMAX_IMAGE_RESOLUTIONS = new Set(["1K", "2K", "3K", "4K"]);
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

function hexToUint8Array(hex: string): Uint8Array {
  const normalized = hex.trim();
  if (!normalized || normalized.length % 2 !== 0 || !/^(?:[0-9a-f]{2})+$/i.test(normalized)) {
    throw new Error("音频数据格式异常，无法解析为可播放文件");
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }
  return bytes;
}

function guessAudioExtension(contentType: string, fallback = "mp3"): string {
  const normalized = contentType.trim().toLowerCase();
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("flac")) return "flac";
  if (normalized.includes("aac")) return "aac";
  if (normalized.includes("pcm")) return "pcm";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  return fallback;
}

async function resolveMiniMaxAudioUrlFromResponse(data: any): Promise<string> {
  const directUrl = typeof data?.audioUrl === "string" ? data.audioUrl.trim() : "";
  if (directUrl) return directUrl;

  const audioHex = typeof data?.audioHex === "string" ? data.audioHex.trim() : "";
  if (!audioHex) return "";

  const contentType =
    typeof data?.contentType === "string" && data.contentType.trim()
      ? data.contentType.trim()
      : "audio/mpeg";
  const fallbackExtension =
    typeof data?.metadata?.format === "string" && data.metadata.format.trim()
      ? data.metadata.format.trim().toLowerCase()
      : "mp3";
  const fileName =
    typeof data?.fileName === "string" && data.fileName.trim()
      ? data.fileName.trim()
      : `minimax-audio-${Date.now()}.${guessAudioExtension(contentType, fallbackExtension)}`;
  const audioFile = new File([hexToUint8Array(audioHex)], fileName, { type: contentType });
  const uploaded = await uploadFileToOss(audioFile);
  return uploaded.url;
}

export function assertApiKey(apiKey: string, providerLabel: string): string {
  const normalizedApiKey = normalizeApiKey(apiKey);
  if (!normalizedApiKey) {
    throw new Error(`${providerLabel} API key 未填写，请先到 API 设置里保存访问密钥`);
  }
  return normalizedApiKey;
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
  const usesDeepSeekProxy = (cfg.providerLabel || "DeepSeek") === "DeepSeek";
  const url = usesDeepSeekProxy ? "/api/deepseek/chat-completions" : `${base}/chat/completions`;
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
  const timer = cfg.timeout
    ? window.setTimeout(() => controller.abort(), cfg.timeout * 1000)
    : null;
  try {
    const resp = await fetch(url, {
      method: "POST",
      credentials: usesDeepSeekProxy ? "include" : undefined,
      headers: {
        "Content-Type": "application/json",
        ...(usesDeepSeekProxy
          ? {
              "X-DeepSeek-Api-Key": normalizedApiKey,
              "X-DeepSeek-Base-Url": base,
            }
          : normalizedApiKey
            ? { Authorization: `Bearer ${normalizedApiKey}` }
            : {}),
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

function pickString(
  inputs: Record<string, unknown>,
  properties: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const k of keys) {
    const inputValue = firstStringValue(inputs[k]);
    if (inputValue.trim()) return inputValue;
    const propertyValue = firstStringValue(properties[k]);
    if (propertyValue.trim()) return propertyValue;
  }
  return firstStringValue(properties.text);
}

function pickOptionalString(
  inputs: Record<string, unknown>,
  properties: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const inputValue = firstStringValue(inputs[key]);
    if (inputValue.trim()) return inputValue;
    const propertyValue = firstStringValue(properties[key]);
    if (propertyValue.trim()) return propertyValue;
  }
  return "";
}

function firstStringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nextValue = firstStringValue(item);
      if (nextValue.trim()) return nextValue;
    }
  }
  return "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  value.forEach((item) => {
    const normalized =
      typeof item === "string" && item.trim()
        ? item.trim()
        : typeof item === "number" && Number.isFinite(item)
          ? String(Math.trunc(item))
          : typeof item === "bigint"
            ? String(item)
            : "";
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function isHttpMediaUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function isSvgDataUrl(value: string) {
  return /^data:image\/svg\+xml/i.test(value.trim());
}

async function normalizeVisionReferenceUrl(url: string): Promise<string> {
  const normalized = url.trim();
  if (!normalized) return "";
  if (isSvgDataUrl(normalized)) {
    return "";
  }
  if (isHttpMediaUrl(normalized)) return normalized;

  throw new Error("请先上传到 OSS 后再用于节点生成或分析");
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

function pickInputPromptLike(inputs: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const inputValue = stringifyPromptValue(inputs[key]);
    if (inputValue.trim() && !looksLikeImagePromptValue(inputValue)) return inputValue;
  }
  return "";
}

function pickPropertyPromptLike(properties: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const propertyValue = stringifyPromptValue(properties[key]);
    if (propertyValue.trim()) return propertyValue;
  }
  return stringifyPromptValue(properties.text);
}

function composePromptLike(
  inputs: Record<string, unknown>,
  properties: Record<string, unknown>,
  ...keys: string[]
): string {
  const inputPrompt = pickInputPromptLike(inputs, ...keys).trim();
  const propertyPrompt = pickPropertyPromptLike(properties, ...keys).trim();

  if (inputPrompt && propertyPrompt && inputPrompt !== propertyPrompt) {
    return `${propertyPrompt}\n\nUpstream input content:\n${inputPrompt}`;
  }
  return inputPrompt || propertyPrompt;
}

function pickNumber(
  inputs: Record<string, unknown>,
  properties: Record<string, unknown>,
  key: string
): number | undefined {
  if (typeof inputs[key] === "number" && Number.isFinite(inputs[key] as number))
    return inputs[key] as number;
  const raw = (properties as any)[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return undefined;
}

function normalizeTextModel(model: unknown): string {
  const value = typeof model === "string" ? model.trim() : "";
  return DEEPSEEK_MODEL_ALIASES[value] || value || TEXT_NODE_MODEL;
}

function findRemoteTextModel(
  remoteModelsByType: AiModelsByType | undefined,
  selectedModel: unknown
): AiModel | undefined {
  return findRemoteModelByType(remoteModelsByType, AI_MODEL_TYPES[0], selectedModel);
}

function findRemoteImageModel(
  remoteModelsByType: AiModelsByType | undefined,
  selectedModel: unknown
): AiModel | undefined {
  return findRemoteModelByType(remoteModelsByType, AI_MODEL_TYPES[1], selectedModel);
}

function findRemoteVideoModel(
  remoteModelsByType: AiModelsByType | undefined,
  selectedModel: unknown
): AiModel | undefined {
  return findRemoteModelByType(remoteModelsByType, AI_MODEL_TYPES[2], selectedModel);
}

function findRemoteModelByType(
  remoteModelsByType: AiModelsByType | undefined,
  modelType: (typeof AI_MODEL_TYPES)[number],
  selectedModel: unknown
): AiModel | undefined {
  const modelId = typeof selectedModel === "string" ? selectedModel.trim() : "";
  if (!modelId || !remoteModelsByType) return undefined;
  return remoteModelsByType[modelType]?.find((model) => model.modelId === modelId);
}

function extractRemoteTextResponse(data: unknown): string {
  if (typeof data === "string") return stripReasoningBlocks(data);
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const textKeys = ["content", "text", "result", "answer", "message", "response", "output"];
    for (const key of textKeys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return stripReasoningBlocks(value);
    }
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return "";
    }
  }
  return "";
}

async function callRemoteVideoToText({
  prompt,
  ossIds,
  model,
  timeout,
  signal,
}: {
  prompt: string;
  ossIds: string[];
  model: AiModel;
  timeout?: number;
  signal?: AbortSignal;
}): Promise<string> {
  const response = await devApiFetch("/system/videoTotext", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    timeoutMs: timeout ? timeout * 1000 : undefined,
    signal,
    body: JSON.stringify({
      prompt,
      ossId: ossIds,
      model: {
        apiId: model.apiId,
        modelId: model.modelId,
      },
    }),
  });
  const parsed = await parseDevApiEnvelope<unknown>(response);
  return extractRemoteTextResponse(parsed.data);
}

function extractRemoteImageUrls(data: unknown): string[] {
  const urls: string[] = [];
  const addUrl = (value: unknown) => {
    if (typeof value !== "string") return;
    const normalized = value.trim();
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  };

  const visit = (value: unknown) => {
    if (!value) return;
    if (typeof value === "string") {
      addUrl(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    [
      "imageUrl",
      "image_url",
      "url",
      "src",
      "ossUrl",
      "fileUrl",
      "result",
      "output",
    ].forEach((key) => addUrl(record[key]));
    ["imageUrls", "image_urls", "urls", "images", "data", "list", "results", "outputs"].forEach(
      (key) => visit(record[key])
    );
  };

  visit(data);
  return urls;
}

function getImageCustomSize(properties: Record<string, unknown>, aspectRatio: string): string {
  if (typeof properties.customSize === "string" && properties.customSize.trim()) {
    return properties.customSize.trim();
  }
  const resolution = typeof properties.resolution === "string" ? properties.resolution : "1K";
  const preset = getImageResolutionPreset(resolution, aspectRatio);
  if (preset) return `${preset.width}x${preset.height}`;
  return `${resolution} ${aspectRatio}`.trim();
}

async function callRemoteImageGeneration({
  prompt,
  properties,
  aspectRatio,
  ossIds,
  model,
  timeout,
  signal,
}: {
  prompt: string;
  properties: Record<string, unknown>;
  aspectRatio: string;
  ossIds: string[];
  model: AiModel;
  timeout?: number;
  signal?: AbortSignal;
}): Promise<{ imageUrls: string[] }> {
  const response = await devApiFetch("/system/generator/images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    timeoutMs: timeout ? timeout * 1000 : undefined,
    signal,
    body: JSON.stringify({
      prompt,
      n: parseImageCount(properties.n ?? properties.quantity ?? 1),
      customSize: getImageCustomSize(properties, aspectRatio),
      ossId: ossIds,
      model: {
        apiId: model.apiId,
        modelId: model.modelId,
      },
    }),
  });
  const parsed = await parseDevApiEnvelope<unknown>(response);
  const imageUrls = extractRemoteImageUrls(parsed.data);
  if (imageUrls.length === 0) {
    throw new Error("远程图片模型未返回图片链接");
  }
  return { imageUrls };
}

function normalizeRemoteVideoResolution(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (["P480", "P720", "P1080"].includes(normalized)) return normalized;
  if (normalized === "480P") return "P480";
  if (normalized === "720P") return "P720";
  if (normalized === "1080P") return "P1080";
  if (normalized === "2K") return "P720";
  if (normalized === "3K" || normalized === "4K") return "P1080";
  return "P480";
}

function normalizeRemoteVideoRatio(properties: Record<string, unknown>): string {
  const ratio =
    typeof properties.ratio === "string" && properties.ratio.trim()
      ? properties.ratio.trim()
      : typeof properties.aspect_ratio === "string" && properties.aspect_ratio.trim()
        ? properties.aspect_ratio.trim()
        : "";
  return ratio || "AUTO";
}

function normalizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const result: number[] = [];
  value.forEach((item) => {
    const numberValue =
      typeof item === "number" && Number.isFinite(item)
        ? Math.trunc(item)
        : typeof item === "string" && item.trim()
          ? Number.parseInt(item, 10)
          : Number.NaN;
    if (!Number.isFinite(numberValue) || seen.has(numberValue)) return;
    seen.add(numberValue);
    result.push(numberValue);
  });
  return result;
}

function extractRemoteVideoUrl(data: unknown): string {
  if (typeof data === "string") return data.trim();
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  const keys = ["videoUrl", "video_url", "url", "src", "fileUrl", "result", "output"];
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const arrays = ["videos", "videoUrls", "urls", "data", "list", "results", "outputs"];
  for (const key of arrays) {
    const value = record[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const url = extractRemoteVideoUrl(item);
        if (url) return url;
      }
    } else {
      const url = extractRemoteVideoUrl(value);
      if (url) return url;
    }
  }
  return "";
}

async function callRemoteVideoGeneration({
  prompt,
  properties,
  ossIds,
  resourceIds,
  model,
  timeout,
  signal,
}: {
  prompt: string;
  properties: Record<string, unknown>;
  ossIds: string[];
  resourceIds: number[];
  model: AiModel;
  timeout?: number;
  signal?: AbortSignal;
}): Promise<{ videoUrl: string }> {
  const response = await devApiFetch("/system/generator/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    timeoutMs: timeout ? timeout * 1000 : undefined,
    signal,
    body: JSON.stringify({
      prompt,
      duration: parseDurationSeconds(properties.duration),
      generateAudio: properties.audio !== false,
      ratio: normalizeRemoteVideoRatio(properties),
      resolution: normalizeRemoteVideoResolution(properties.resolution),
      ossId: ossIds,
      resrouceId: resourceIds,
      model: {
        apiId: model.apiId,
        modelId: model.modelId,
      },
    }),
  });
  const parsed = await parseDevApiEnvelope<unknown>(response);
  const videoUrl = extractRemoteVideoUrl(parsed.data);
  if (!videoUrl) {
    throw new Error("远程视频模型未返回视频链接");
  }
  return { videoUrl };
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
    "21:9": "landscape_16_9",
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
  if (!Number.isFinite(raw)) return 5;
  return Math.min(15, Math.max(1, Math.trunc(raw)));
}

function normalizeMiniMaxVideoModel(model: unknown): string {
  const value = typeof model === "string" ? model.trim() : "";
  return value === "minimax-video" || !value ? MINIMAX_VIDEO_MODEL : value;
}

function normalizeMiniMaxVideoResolution(value: unknown): string {
  const resolution = typeof value === "string" ? value.trim().toUpperCase() : "";
  return ["1K", "2K", "3K", "4K", "768P", "1080P"].includes(resolution) ? resolution : "1K";
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
  const resolution = String(properties.resolution || "1K");
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
      resolution: MINIMAX_IMAGE_RESOLUTIONS.has(resolution) ? resolution : "1K",
      aspect_ratio: MINIMAX_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : "16:9",
      response_format: "url",
      n,
      prompt_optimizer: properties.prompt_optimizer === true,
      base_url: minimaxBaseUrl,
      seed:
        typeof properties.seed === "number" && Number.isFinite(properties.seed)
          ? properties.seed
          : undefined,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `MiniMax 生图失败 (${response.status})`);
  }

  const imageUrls = Array.isArray(data?.imageUrls)
    ? data.imageUrls.filter((url: unknown) => typeof url === "string" && url)
    : [];
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
      voice_id:
        typeof properties.voice_id === "string"
          ? properties.voice_id
          : properties.voice || "male-qn-qingse",
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

  const audioUrl = await resolveMiniMaxAudioUrlFromResponse(data);
  if (!audioUrl) {
    throw new Error("MiniMax 未返回音频链接");
  }

  return {
    audioUrl,
    metadata: typeof data?.metadata === "object" && data.metadata ? data.metadata : undefined,
  };
}

const executors: Partial<Record<NodeClass, NodeExecutor>> = {
  text_node: async ({ inputs, properties, apiConfig, signal }) => {
    if (properties.textMode === "plain") {
      const text = stringifyPromptValue(properties.text);
      return { outputs: { 0: text }, patch: { response: text, status: "success" } };
    }

    const userPrompt = composePromptLike(inputs, properties, "user_prompt", "prompt");
    const remoteTextModel = findRemoteTextModel(apiConfig.remoteModelsByType, properties.model);
    if (remoteTextModel) {
      const text = await callRemoteVideoToText({
        prompt: userPrompt,
        ossIds: normalizeIdArray(inputs.reference_oss_ids),
        model: remoteTextModel,
        timeout: apiConfig.timeout,
        signal,
      });
      return {
        outputs: { 0: text },
        patch: {
          response: text,
          status: "success",
          remoteModelApiId: remoteTextModel.apiId,
          remoteModelId: remoteTextModel.modelId,
        },
      };
    }

    const nodeSystemPrompt = pickOptionalString(inputs, properties, "system_prompt");
    const deepseekBaseUrl =
      apiConfig.providerBaseUrls?.deepseek || apiConfig.deepseekBaseUrl || apiConfig.baseUrl;
    const deepseekApiKey =
      apiConfig.providerApiKeys?.deepseek || apiConfig.deepseekApiKey || apiConfig.apiKey;
    const deepseekModel =
      apiConfig.providerModels?.deepseek || apiConfig.deepseekModel || apiConfig.model;
    const minimaxBaseUrl =
      apiConfig.providerBaseUrls?.minimax || apiConfig.minimaxBaseUrl || apiConfig.baseUrl;
    const minimaxApiKey =
      apiConfig.providerApiKeys?.minimax || apiConfig.minimaxApiKey || apiConfig.apiKey;
    const model = normalizeTextModel(properties.model || deepseekModel);
    const referenceImages = normalizeStringArray(inputs.reference_images);
    const referenceVideos = normalizeStringArray(inputs.reference_videos);
    const hasVisualReferences = referenceImages.length > 0 || referenceVideos.length > 0;

    let text = "";
    if (hasVisualReferences) {
      const rawMultimodalModel =
        typeof properties.model === "string" && properties.model.trim()
          ? properties.model.trim()
          : "";
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

      const normalizedReferenceImages = await Promise.all(
        referenceImages.map((url) => normalizeVisionReferenceUrl(url))
      );
      const normalizedReferenceVideos = await Promise.all(
        referenceVideos.map((url) => normalizeVisionReferenceUrl(url))
      );
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

  image_node: async ({ inputs, properties, apiConfig, signal }) => {
    const prompt = composePromptLike(inputs, properties, "prompt");
    const model = String(properties.model || MINIMAX_IMAGE_MODEL);
    const aspect = pickString(inputs, properties, "aspect_ratio") || "16:9";
    const remoteImageModel = findRemoteImageModel(apiConfig.remoteModelsByType, properties.model);
    if (remoteImageModel) {
      const result = await callRemoteImageGeneration({
        prompt,
        properties,
        aspectRatio: aspect,
        ossIds: normalizeIdArray(inputs.reference_oss_ids),
        model: remoteImageModel,
        timeout: apiConfig.timeout,
        signal,
      });
      return {
        outputs: { 0: result.imageUrls[0] },
        patch: {
          imageUrl: result.imageUrls[0],
          imageUrls: result.imageUrls,
          activeImageIndex: 0,
          status: "success",
          remoteModelApiId: remoteImageModel.apiId,
          remoteModelId: remoteImageModel.modelId,
        },
      };
    }
    if (MINIMAX_IMAGE_MODELS.has(model)) {
      const minimaxApiKey = apiConfig.providerApiKeys?.minimax || apiConfig.minimaxApiKey;
      const minimaxBaseUrl = apiConfig.providerBaseUrls?.minimax || apiConfig.minimaxBaseUrl;
      const result = await callMiniMaxTextToImage(
        properties,
        prompt,
        model,
        minimaxApiKey,
        minimaxBaseUrl,
        aspect
      );
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

    const fallbackAspect = aspect || "1:1";
    const imageUrl = buildTextToImageUrl(prompt, fallbackAspect);
    return { outputs: { 0: imageUrl }, patch: { imageUrl, status: "success" } };
  },

  video_node: async ({ inputs, properties, apiConfig, signal }) => {
    const prompt = composePromptLike(inputs, properties, "prompt");
    const imageUrl = pickOptionalString(inputs, properties, "image", "首帧");
    const remoteVideoModel = findRemoteVideoModel(apiConfig.remoteModelsByType, properties.model);
    if (remoteVideoModel) {
      const result = await callRemoteVideoGeneration({
        prompt,
        properties,
        ossIds: normalizeIdArray(inputs.reference_oss_ids),
        resourceIds: normalizeNumberArray(inputs.reference_resource_ids),
        model: remoteVideoModel,
        timeout: apiConfig.timeout,
        signal,
      });
      return {
        outputs: { 0: result.videoUrl },
        patch: {
          videoUrl: result.videoUrl,
          status: "success",
          remoteModelApiId: remoteVideoModel.apiId,
          remoteModelId: remoteVideoModel.modelId,
        },
      };
    }

    const model = normalizeMiniMaxVideoModel(properties.model);
    if (MINIMAX_VIDEO_MODELS.has(model)) {
      const minimaxApiKey = apiConfig.providerApiKeys?.minimax || apiConfig.minimaxApiKey;
      const minimaxBaseUrl = apiConfig.providerBaseUrls?.minimax || apiConfig.minimaxBaseUrl;
      const result = await callMiniMaxTextToVideo(
        properties,
        prompt,
        model,
        minimaxApiKey,
        minimaxBaseUrl,
        imageUrl
      );
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
    const result =
      op === "+"
        ? a + b
        : op === "-"
          ? a - b
          : op === "*"
            ? a * b
            : op === "/"
              ? b === 0
                ? 0
                : a / b
              : 0;
    return { outputs: { 0: result } };
  },

  video_viewer: async ({ inputs }) => {
    const url = pickOptionalString(inputs, {}, "视频输入", "video");
    return { outputs: { 0: url, 1: url } };
  },

  audio_node: async ({ inputs, properties, apiConfig }) => {
    const prompt = composePromptLike(inputs, properties, "prompt", "提示词");
    const minimaxApiKey =
      apiConfig.providerApiKeys?.minimax || apiConfig.minimaxApiKey || apiConfig.apiKey;
    const minimaxBaseUrl = apiConfig.providerBaseUrls?.minimax || apiConfig.minimaxBaseUrl;
    const model = normalizeMiniMaxAudioModel(properties.model || apiConfig.providerModels?.minimax);
    const result = await callMiniMaxTextToAudio(
      properties,
      prompt,
      model,
      minimaxApiKey,
      minimaxBaseUrl
    );
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
