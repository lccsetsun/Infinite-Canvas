import { describe, expect, it } from "vitest";
import { consumeSingleImageUploadSelection } from "./consumeSingleImageUploadSelection";

describe("consumeSingleImageUploadSelection", () => {
  it("reads the selected file before resetting the input value", () => {
    const file = new File(["image"], "cover.png", { type: "image/png" });

    const input = {
      _value: "C:\\fakepath\\cover.png",
      get value() {
        return this._value;
      },
      set value(next: string) {
        this._value = next;
      },
      get files() {
        return this._value ? ([file] as ArrayLike<File>) : null;
      },
    };

    expect(consumeSingleImageUploadSelection(input)).toBe(file);
    expect(input.value).toBe("");
  });

  it("returns null and still clears the input when nothing is selected", () => {
    const input = {
      value: "C:\\fakepath\\empty.png",
      files: null as ArrayLike<File> | null,
    };

    expect(consumeSingleImageUploadSelection(input)).toBeNull();
    expect(input.value).toBe("");
  });
});
