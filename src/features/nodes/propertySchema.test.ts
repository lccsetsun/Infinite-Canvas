import { describe, expect, it } from "vitest";
import { getPropertySchema } from "./propertySchema";

describe("getPropertySchema", () => {
  it("returns node-specific schema when configured", () => {
    const schema = getPropertySchema("slider_input", "step");
    expect(schema?.kind).toBe("number");
    expect(schema?.min).toBe(0);
  });

  it("returns undefined for unknown keys", () => {
    const schema = getPropertySchema("string_input", "not_exists");
    expect(schema).toBeUndefined();
  });
});
