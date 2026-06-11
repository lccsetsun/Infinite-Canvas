import { NodeClass } from "../../types";
import type { AiModel, AiModelsByType } from "../api/aiModelCatalog";
import { AI_MODEL_TYPES } from "../api/aiModelCatalog";
import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";
import { createRemoteVideoGenerationTask } from "../video/remoteVideoGeneration";
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
    remoteModelsByType?: AiModelsByType;
  };
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export interface ExecutorResult {
  outputs: Record<number, unknown>;
  patch?: Record<string, unknown>;
  pending?: { type: "remote-video"; taskId: string };
}

export type NodeExecutor = (ctx: ExecutorContext) => Promise<ExecutorResult>;
function stripReasoningBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
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

function extractRemoteOssIds(data: unknown): string[] {
  const ids: string[] = [];
  const addId = (value: unknown) => {
    const normalized =
      typeof value === "string" && value.trim()
        ? value.trim()
        : typeof value === "number" && Number.isFinite(value)
          ? String(Math.trunc(value))
          : typeof value === "bigint"
            ? String(value)
            : "";
    if (normalized && !ids.includes(normalized)) ids.push(normalized);
  };

  const visit = (value: unknown) => {
    if (!value) return;
    addId(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    addId(record.ossId);
    visit(record.ossIds);
    visit(record.data);
    visit(record.result);
    visit(record.results);
    visit(record.outputs);
  };

  visit(data);
  return ids;
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
}): Promise<{ imageUrls: string[]; ossIds: string[] }> {
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
  return { imageUrls, ossIds: extractRemoteOssIds(parsed.data) };
}

function normalizeRemoteVideoResolution(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (normalized === "P480" || normalized === "480P") return "480p";
  if (normalized === "P720" || normalized === "720P" || normalized === "2K") return "720p";
  if (normalized === "P1080" || normalized === "1080P" || normalized === "3K" || normalized === "4K") {
    return "1080p";
  }
  return "480p";
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
}): Promise<{ taskId: string; videoUrl: string }> {
  const result = await createRemoteVideoGenerationTask({
    prompt,
    duration: parseDurationSeconds(properties.duration),
    generateAudio: properties.audio !== false,
    ratio: normalizeRemoteVideoRatio(properties),
    resolution: normalizeRemoteVideoResolution(properties.resolution),
    ossIds,
    resourceIds,
    model,
    timeoutMs: timeout ? timeout * 1000 : undefined,
    signal,
  });
  return result;
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



const executors: Partial<Record<NodeClass, NodeExecutor>> = {
  text_node: async ({ inputs, properties, apiConfig, signal }) => {
    if (properties.textMode === "plain") {
      const text = stringifyPromptValue(properties.text);
      return { outputs: { 0: text }, patch: { response: text, status: "success" } };
    }

    const userPrompt = composePromptLike(inputs, properties, "user_prompt", "prompt");
    const remoteTextModel = findRemoteTextModel(apiConfig.remoteModelsByType, properties.model);
    if (!remoteTextModel) {
      throw new Error("Please select a remote text model");
    }

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
  },

  image_node: async ({ inputs, properties, apiConfig, signal }) => {
    const prompt = composePromptLike(inputs, properties, "prompt");
    const aspect = pickString(inputs, properties, "aspect_ratio") || "16:9";
    const remoteImageModel = findRemoteImageModel(apiConfig.remoteModelsByType, properties.model);
    if (!remoteImageModel) {
      throw new Error("Please select a remote image model");
    }

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
        ossId: result.ossIds[0],
        ossIds: result.ossIds,
        activeImageIndex: 0,
        status: "success",
        remoteModelApiId: remoteImageModel.apiId,
        remoteModelId: remoteImageModel.modelId,
      },
    };
  },

  video_node: async ({ inputs, properties, apiConfig, signal }) => {
    const prompt = composePromptLike(inputs, properties, "prompt");
    const remoteVideoModel = findRemoteVideoModel(apiConfig.remoteModelsByType, properties.model);
    if (!remoteVideoModel) {
      throw new Error("Please select a remote video model");
    }

    const result = await callRemoteVideoGeneration({
      prompt,
      properties,
      ossIds: normalizeIdArray(inputs.reference_oss_ids),
      resourceIds: normalizeNumberArray(inputs.reference_resource_ids),
      model: remoteVideoModel,
      timeout: apiConfig.timeout,
      signal,
    });
    if (!result.videoUrl) {
      return {
        outputs: {},
        pending: { type: "remote-video", taskId: result.taskId },
        patch: {
          loading: true,
          loadingOperation: "generate",
          status: "loading",
          remoteVideoTaskId: result.taskId,
          remoteVideoTaskStatus: "pending",
          remoteModelApiId: remoteVideoModel.apiId,
          remoteModelId: remoteVideoModel.modelId,
        },
      };
    }
    return {
      outputs: { 0: result.videoUrl },
      patch: {
        videoUrl: result.videoUrl,
        status: "success",
        remoteModelApiId: remoteVideoModel.apiId,
        remoteModelId: remoteVideoModel.modelId,
      },
    };
  },

  audio_node: async () => {
    throw new Error("Audio generation is under development");
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
    const a = pickString(inputs, properties, "?? A", "text_a");
    const b = pickString(inputs, properties, "?? B", "text_b");
    return { outputs: { 0: `${a}${sep}${b}` } };
  },

  math_node: async ({ inputs, properties }) => {
    const a = pickNumber(inputs, properties, "?? A") ?? 0;
    const b = pickNumber(inputs, properties, "?? B") ?? 0;
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
    const url = pickOptionalString(inputs, {}, "????", "video");
    return { outputs: { 0: url, 1: url } };
  },
};
export function getExecutor(type: NodeClass): NodeExecutor | undefined {
  return executors[type];
}
