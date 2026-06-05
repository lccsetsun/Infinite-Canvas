import { describe, expect, it } from "vitest";
import { IMAGE_PROMPT_STARTER_GAP_X, getImagePromptStarterTextNodeX } from "./imagePromptStarterLayout";

describe("getImagePromptStarterTextNodeX", () => {
  it("keeps the original starter gap between image and text nodes", () => {
    expect(getImagePromptStarterTextNodeX(100, 780)).toBe(100 + 780 + IMAGE_PROMPT_STARTER_GAP_X);
  });
});
