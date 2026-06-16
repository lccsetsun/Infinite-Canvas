import { describe, expect, it } from "vitest";
import {
  getMediaNodeFloatingToolbarGap,
  mediaNodeFloatingToolbarRaisedClass,
} from "./mediaNodeToolbarStyles";

describe("media node floating toolbar spacing", () => {
  it("keeps the default toolbar gap at normal zoom and increases it below 80 percent", () => {
    expect(getMediaNodeFloatingToolbarGap(1)).toBe(30);
    expect(getMediaNodeFloatingToolbarGap(0.8)).toBe(30);
    expect(getMediaNodeFloatingToolbarGap(0.7)).toBeGreaterThan(30);
    expect(getMediaNodeFloatingToolbarGap(0.55)).toBeGreaterThan(
      getMediaNodeFloatingToolbarGap(0.7)
    );
  });

  it("lets image node toolbars consume the dynamic toolbar gap variable", () => {
    expect(mediaNodeFloatingToolbarRaisedClass).toContain("var(--media-node-toolbar-gap,30px)");
  });
});
