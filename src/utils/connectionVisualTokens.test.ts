import { describe, expect, it } from "vitest";
import {
  CONNECTION_DRAFT_STYLE,
  CONNECTION_LINK_STYLE,
  PORT_HANDLE_CLASSES,
  getDraftLinkVisualState,
} from "./connectionVisualTokens";

describe("connection visual tokens", () => {
  it("defines a layered signal-flow link treatment", () => {
    expect(CONNECTION_LINK_STYLE.base.strokeWidth).toBeLessThan(CONNECTION_LINK_STYLE.glow.strokeWidth);
    expect(CONNECTION_LINK_STYLE.core.strokeWidth).toBeGreaterThan(CONNECTION_LINK_STYLE.base.strokeWidth);
    expect(CONNECTION_LINK_STYLE.flow.dashPattern.length).toBe(2);
    expect(CONNECTION_LINK_STYLE.base.opacity).toBeLessThan(0.5);
    expect(CONNECTION_LINK_STYLE.core.opacity).toBeLessThan(0.65);
    expect(CONNECTION_LINK_STYLE.flow.strokeWidth).toBeGreaterThan(CONNECTION_LINK_STYLE.core.strokeWidth);
    expect(CONNECTION_LINK_STYLE.flow.duration).toBeLessThan(1);
  });

  it("defines premium handle classes for input and output states", () => {
    expect(PORT_HANDLE_CLASSES.base).toContain("canvas-port-handle");
    expect(PORT_HANDLE_CLASSES.inputIdle).toContain("canvas-port-input");
    expect(PORT_HANDLE_CLASSES.outputIdle).toContain("canvas-port-output");
    expect(PORT_HANDLE_CLASSES.inputHot).toContain("canvas-port-hot");
  });

  it("keeps blank draft links neutral instead of warning colored", () => {
    expect(
      getDraftLinkVisualState({
        draftIssue: "请选择起点节点和终点节点。",
        hasTargetNode: false,
      }),
    ).toBe("neutral");
  });

  it("uses a rose invalid draft treatment only after hitting an invalid target", () => {
    expect(
      getDraftLinkVisualState({
        draftIssue: "端口类型不兼容：IMAGE -> AUDIO",
        hasTargetNode: true,
      }),
    ).toBe("invalid");
    expect(CONNECTION_DRAFT_STYLE.flow.invalidStroke).toBe("#fb7185");
    expect(CONNECTION_DRAFT_STYLE.glow.invalidStroke).toContain("244, 63, 94");
  });
});
