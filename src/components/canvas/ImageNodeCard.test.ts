import { describe, expect, it } from "vitest";
import {
  getImagePreviewFrameClassName,
  getImageNodePortTopStyle,
  getResultImageBounds,
  resolveResultImageSize,
  shouldShowImageUploadButton,
} from "./ImageNodeCard";

describe("getResultImageBounds", () => {
  it("uses compact bounds for image prompt starter placeholders", () => {
    expect(getResultImageBounds("16:9", true)).toEqual({
      maxWidth: 520,
      maxHeight: 390,
    });
  });

  it("keeps large bounds for regular non-square image nodes", () => {
    expect(getResultImageBounds("16:9")).toEqual({
      maxWidth: 780,
      maxHeight: 585,
    });
  });

  it("reuses saved display dimensions when natural size is missing", () => {
    expect(
      resolveResultImageSize(
        {
          imageDisplayWidth: 260,
          imageDisplayHeight: 469,
        },
        "16:9",
      ),
    ).toEqual({
      width: 260,
      height: 469,
    });
  });
});

describe("getImagePreviewFrameClassName", () => {
  it("uses a dark loading surface instead of a white frame before images load", () => {
    const className = getImagePreviewFrameClassName({
      isImageLoaded: false,
      isSelected: false,
      isStarterPlaceholder: false,
    });

    expect(className).toContain("bg-[#111827]");
    expect(className).not.toContain("bg-white");
  });
});

describe("getImageNodePortTopStyle", () => {
  it("centers ports on the main image card while the image node has no generated image", () => {
    expect(getImageNodePortTopStyle({ hasImageUrl: false })).toBe(145);
  });

  it("uses the measured image media center after an image is loaded", () => {
    expect(getImageNodePortTopStyle({ hasImageUrl: true, imagePortCenterY: 220 })).toBe(220);
  });
});

describe("shouldShowImageUploadButton", () => {
  it("hides the upload button while the image is still loading", () => {
    expect(
      shouldShowImageUploadButton({
        hasImageUrl: true,
        isImageLoaded: false,
        isImageLoadFailed: false,
      }),
    ).toBe(false);
  });

  it("shows the upload button after the image settles", () => {
    expect(
      shouldShowImageUploadButton({
        hasImageUrl: true,
        isImageLoaded: true,
        isImageLoadFailed: false,
      }),
    ).toBe(true);
    expect(
      shouldShowImageUploadButton({
        hasImageUrl: true,
        isImageLoaded: false,
        isImageLoadFailed: true,
      }),
    ).toBe(true);
  });
});
