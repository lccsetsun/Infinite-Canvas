import { describe, expect, it } from "vitest";
import {
  getAspectRatioPreviewStyle,
  getResolutionPickerPanelTitle,
  getResolutionPickerPanelPosition,
} from "./ImageResolutionPicker";

describe("getResolutionPickerPanelTitle", () => {
  it("uses Image Size by default", () => {
    expect(getResolutionPickerPanelTitle()).toBe("Image Size");
  });

  it("allows media-specific panel titles", () => {
    expect(getResolutionPickerPanelTitle("Video Size")).toBe("Video Size");
  });
});

describe("getAspectRatioPreviewStyle", () => {
  it("renders wide ratios as wider than tall", () => {
    expect(getAspectRatioPreviewStyle("16:9")).toMatchObject({ width: 30, height: 17 });
  });

  it("renders portrait ratios as taller than wide", () => {
    expect(getAspectRatioPreviewStyle("9:16")).toMatchObject({ width: 12, height: 22 });
  });

  it("renders square ratios as a square", () => {
    expect(getAspectRatioPreviewStyle("1:1")).toMatchObject({ width: 30, height: 30 });
  });
});

describe("getResolutionPickerPanelPosition", () => {
  it("uses model-menu style bottom placement near the lower viewport edge", () => {
    expect(
      getResolutionPickerPanelPosition({
        align: "left",
        anchorRect: {
          bottom: 760,
          left: 320,
          right: 560,
          top: 720,
          width: 240,
        } as DOMRect,
        viewport: { width: 1200, height: 800 },
      })
    ).toMatchObject({
      bottom: 90,
      left: 320,
      placement: "top",
      width: 430,
    });
  });
});
