import { describe, expect, it } from "vitest";
import { isPreviewableAsset } from "./mediaAssets";

describe("isPreviewableAsset", () => {
  it("accepts root-relative media asset urls used by the app", () => {
    expect(isPreviewableAsset("/api/assets/example.png")).toBe(true);
  });
});
