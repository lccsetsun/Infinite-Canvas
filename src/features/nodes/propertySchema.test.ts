import { describe, expect, it } from "vitest";
import { getPropertySchema } from "./propertySchema";

describe("getPropertySchema", () => {
  it("returns node-specific schema when configured", () => {
    const schema = getPropertySchema("ksampler", "steps");
    expect(schema?.kind).toBe("number");
    expect(schema?.integer).toBe(true);
    expect(schema?.min).toBe(1);
  });

  it("falls back to global schema for shared keys", () => {
    const schema = getPropertySchema("clip_text", "sampler");
    expect(schema?.kind).toBe("select");
    expect(schema?.options?.includes("euler")).toBe(true);
  });

  it("returns undefined for unknown keys", () => {
    const schema = getPropertySchema("clip_text", "not_exists");
    expect(schema).toBeUndefined();
  });
});
