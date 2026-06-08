import { describe, expect, it } from "vitest";
import {
  resolveCaptchaVisualState,
  resolveLoginSubmitState,
  shouldShowCaptchaRefreshBadge,
} from "./loginUiState";

describe("login UI state", () => {
  it("keeps captcha loading separate from the login submit spinner", () => {
    expect(
      resolveLoginSubmitState({
        isLoginLoading: false,
        captchaEnabled: true,
        isCaptchaLoading: true,
      })
    ).toEqual({
      disabled: true,
      showSpinner: false,
    });
  });

  it("shows the submit spinner only while the login request is running", () => {
    expect(
      resolveLoginSubmitState({
        isLoginLoading: true,
        captchaEnabled: true,
        isCaptchaLoading: false,
      })
    ).toEqual({
      disabled: true,
      showSpinner: true,
    });
  });

  it("uses one captcha visual state and only overlays refresh on a loaded image", () => {
    expect(resolveCaptchaVisualState({ isCaptchaLoading: true, captchaImage: "", captchaError: "" })).toBe("loading");
    expect(resolveCaptchaVisualState({ isCaptchaLoading: false, captchaImage: "", captchaError: "timeout" })).toBe(
      "error"
    );
    expect(shouldShowCaptchaRefreshBadge("loading")).toBe(false);
    expect(shouldShowCaptchaRefreshBadge("error")).toBe(false);
    expect(shouldShowCaptchaRefreshBadge("image")).toBe(true);
  });
});
