import { NodeClass } from "../../types";

export interface ExecutorContext {
  inputs: Record<string, unknown>;
  properties: Record<string, unknown>;
  apiConfig: { baseUrl: string; apiKey: string };
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export interface ExecutorResult {
  outputs: Record<number, unknown>;
  patch?: Record<string, unknown>;
}

export type NodeExecutor = (ctx: ExecutorContext) => Promise<ExecutorResult>;

async function callGeminiProxy(
  body: { model?: string; contents: string; config?: Record<string, unknown> },
  apiKey: string
): Promise<{ text: string }> {
  const r = await fetch("/api/gemini/proxy", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-Api-Key": apiKey } : {})
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    throw new Error(`AI 调用失败 (${r.status}): ${errText || r.statusText}`);
  }
  return r.json();
}

function pickString(inputs: Record<string, unknown>, properties: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (typeof inputs[k] === "string" && (inputs[k] as string).trim()) return inputs[k] as string;
  }
  const fallback = (properties.text as string) ?? "";
  return fallback;
}

function pickNumber(inputs: Record<string, unknown>, properties: Record<string, unknown>, key: string): number | undefined {
  if (typeof inputs[key] === "number" && Number.isFinite(inputs[key] as number)) return inputs[key] as number;
  const raw = (properties as any)[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return undefined;
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

export const executors: Partial<Record<NodeClass, NodeExecutor>> = {
  text_node: async ({ inputs, properties, apiConfig }) => {
    const userPrompt = pickString(inputs, properties, "user_prompt", "prompt");
    const systemPrompt = pickString(inputs, properties, "system_prompt");
    const model = (properties.model as string) || "gemini-2.0-flash";
    const { text } = await callGeminiProxy(
      { model, contents: userPrompt, config: { systemInstruction: systemPrompt } },
      apiConfig.apiKey
    );
    return { outputs: { 0: text }, patch: { response: text, status: "success" } };
  },

  image_node: async ({ inputs, properties }) => {
    const prompt = pickString(inputs, properties, "prompt");
    const aspect = pickString(inputs, properties, "aspect_ratio") || "1:1";
    const imageUrl = buildTextToImageUrl(prompt, aspect);
    return { outputs: { 0: imageUrl }, patch: { imageUrl } };
  },

  video_node: async ({ inputs, properties }) => {
    const prompt = pickString(inputs, properties, "prompt");
    const _duration = pickNumber(inputs, properties, "duration");
    const videoUrl = `https://assets.mixkit.co/videos/preview/mixkit-abstract-flowing-teal-and-blue-gradient-background-40030-large.mp4?seed=${encodeURIComponent(prompt)}`;
    return { outputs: { 0: videoUrl }, patch: { videoUrl } };
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

  upload_image: async ({ properties }) => {
    return { outputs: { 0: (properties.imageUrl as string) ?? "" } };
  },

  upload_video: async ({ properties }) => {
    return { outputs: { 0: (properties.videoUrl as string) ?? "" } };
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
  }
};

export function getExecutor(type: NodeClass): NodeExecutor | undefined {
  return executors[type];
}
