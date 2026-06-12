import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";

type RawVideoPromptResponse =
  | string
  | {
      prompt?: unknown;
      prompts?: unknown;
      text?: unknown;
      content?: unknown;
      result?: unknown;
    };

function normalizeVideoPrompt(data: RawVideoPromptResponse): string {
  if (typeof data === "string") return data.trim();

  const candidates = [data.prompt, data.text, data.content, data.result];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  if (Array.isArray(data.prompts)) {
    return data.prompts
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      .join("\n")
      .trim();
  }

  return "";
}

export async function fetchVideoPrompt(videoUrl: string) {
  const response = await devApiFetch(`/system/videoPrompts?url=${encodeURIComponent(videoUrl)}`, {
    method: "POST",
    timeoutMs: 120000,
  });
  const parsed = await parseDevApiEnvelope<RawVideoPromptResponse>(response);
  return normalizeVideoPrompt(parsed.data);
}
