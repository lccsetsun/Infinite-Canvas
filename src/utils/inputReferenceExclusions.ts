import type { GraphLink } from "../types";

export function getLinkExcludedInputValueSet(link: GraphLink): Set<string> {
  return new Set(
    Array.isArray(link.excludedInputValues)
      ? link.excludedInputValues.filter((value) => typeof value === "string" && value.trim())
      : []
  );
}

export function isLinkInputValueExcluded(link: GraphLink, value: unknown): boolean {
  return typeof value === "string" && getLinkExcludedInputValueSet(link).has(value);
}

export function filterLinkInputValue(link: GraphLink, value: unknown): unknown {
  if (Array.isArray(value)) {
    const excludedValues = getLinkExcludedInputValueSet(link);
    const filtered = value.filter(
      (item) => typeof item !== "string" || !excludedValues.has(item)
    );
    return filtered.length > 0 ? filtered : undefined;
  }

  return isLinkInputValueExcluded(link, value) ? undefined : value;
}
