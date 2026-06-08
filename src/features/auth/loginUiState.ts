export type CaptchaVisualState = "loading" | "image" | "error" | "empty";

export function resolveLoginSubmitState({
  isLoginLoading,
  captchaEnabled,
  isCaptchaLoading,
}: {
  isLoginLoading: boolean;
  captchaEnabled: boolean;
  isCaptchaLoading: boolean;
}) {
  return {
    disabled: isLoginLoading || (captchaEnabled && isCaptchaLoading),
    showSpinner: isLoginLoading,
  };
}

export function resolveCaptchaVisualState({
  isCaptchaLoading,
  captchaImage,
  captchaError,
}: {
  isCaptchaLoading: boolean;
  captchaImage: string;
  captchaError: string;
}): CaptchaVisualState {
  if (isCaptchaLoading) return "loading";
  if (captchaImage) return "image";
  if (captchaError) return "error";
  return "empty";
}

export function shouldShowCaptchaRefreshBadge(state: CaptchaVisualState) {
  return state === "image";
}
