const RESOURCE_VALUE_KEYS = [
  "audio",
  "audioUrl",
  "audioUrls",
  "image",
  "imageUrl",
  "imageUrls",
  "prompt",
  "response",
  "src",
  "text",
  "url",
  "value",
  "video",
  "videoUrl",
  "videoUrls",
] as const;

function stringifySingleInputReferenceValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

function collectInputReferenceValues(value: unknown, seen: Set<unknown>): string[] {
  const singleValue = stringifySingleInputReferenceValue(value);
  if (singleValue) return [singleValue];

  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectInputReferenceValues(item, seen));
  }

  return RESOURCE_VALUE_KEYS.flatMap((key) =>
    collectInputReferenceValues((value as Record<string, unknown>)[key], seen)
  );
}

export function stringifyInputReferenceValues(value: unknown): string[] {
  const values = collectInputReferenceValues(value, new Set()).filter(
    (item) => item.trim().length > 0
  );
  return Array.from(new Set(values));
}
