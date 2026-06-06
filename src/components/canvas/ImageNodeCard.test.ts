import { describe, expect, it } from "vitest";
import { getResultImageBounds, resolveResultImageSize } from "./ImageNodeCard";

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
