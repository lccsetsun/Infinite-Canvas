import { describe, expect, it } from "vitest";
import { fitVideoSize } from "./VideoNodeCard";

describe("fitVideoSize", () => {
  it("keeps portrait videos wide enough for the playback controls", () => {
    expect(fitVideoSize({ width: 690, height: 1136 }, "9:16", 520, 390)).toEqual({
      width: 520,
      height: 856,
    });
  });
});
