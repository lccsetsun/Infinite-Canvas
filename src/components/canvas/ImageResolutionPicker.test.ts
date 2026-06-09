import { describe, expect, it } from "vitest";
import { getResolutionPickerPanelTitle } from "./ImageResolutionPicker";

describe("getResolutionPickerPanelTitle", () => {
  it("uses Image Size by default", () => {
    expect(getResolutionPickerPanelTitle()).toBe("Image Size");
  });

  it("allows media-specific panel titles", () => {
    expect(getResolutionPickerPanelTitle("Video Size")).toBe("Video Size");
  });
});
