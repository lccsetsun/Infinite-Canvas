import { describe, expect, it } from "vitest";
import { getResultImageBounds } from "./ImageNodeCard";

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
});
