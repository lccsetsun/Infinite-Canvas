import { describe, expect, it } from "vitest";
import { shouldRefreshOnVisibilityState } from "./useRefreshOnPageVisible";

describe("shouldRefreshOnVisibilityState", () => {
  it("refreshes when the browser tab becomes visible", () => {
    expect(shouldRefreshOnVisibilityState("visible")).toBe(true);
  });

  it("does not refresh when the browser tab becomes hidden", () => {
    expect(shouldRefreshOnVisibilityState("hidden")).toBe(false);
  });
});
