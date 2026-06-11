import { describe, expect, it } from "vitest";
import { stringifyInputReferenceValues } from "./inputReferenceValues";

describe("stringifyInputReferenceValues", () => {
  it("recursively expands nested arrays from multiple connected media inputs", () => {
    expect(
      stringifyInputReferenceValues([
        ["https://oss.example.com/duck.png"],
        "https://oss.example.com/cat-dog.png",
      ])
    ).toEqual(["https://oss.example.com/duck.png", "https://oss.example.com/cat-dog.png"]);
  });

  it("extracts common media fields from object outputs", () => {
    expect(
      stringifyInputReferenceValues({
        imageUrls: ["https://oss.example.com/a.png", "https://oss.example.com/b.png"],
        width: 1280,
      })
    ).toEqual(["https://oss.example.com/a.png", "https://oss.example.com/b.png"]);
  });
});
