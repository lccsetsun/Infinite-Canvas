import { describe, expect, it } from "vitest";
import { getTextNodeViewState } from "./textNodeViewState";

describe("getTextNodeViewState", () => {
  it("returns idle before any prompt is available", () => {
    expect(getTextNodeViewState({ errorText: "", isRunning: false, promptText: "", responseText: "" }).kind).toBe("idle");
  });

  it("returns ready when prompt input exists", () => {
    expect(getTextNodeViewState({ errorText: "", isRunning: false, promptText: "1122", responseText: "" }).kind).toBe("ready");
  });

  it("prioritizes running, error, and success states", () => {
    expect(getTextNodeViewState({ errorText: "", isRunning: true, promptText: "p", responseText: "" }).kind).toBe("running");
    expect(getTextNodeViewState({ errorText: "failed", isRunning: false, promptText: "p", responseText: "" }).kind).toBe("error");
    expect(getTextNodeViewState({ errorText: "", isRunning: false, promptText: "p", responseText: "ok" }).kind).toBe("success");
  });

  it("shows interrupted state before ready or idle state", () => {
    const state = getTextNodeViewState({
      errorText: "",
      isInterrupted: true,
      isRunning: false,
      promptText: "prompt",
      responseText: "",
    });

    expect(state.kind).toBe("interrupted");
    expect(state.label).toBe("已中断");
  });
});
