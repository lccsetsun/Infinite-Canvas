import type { CaptchaResponse } from "./authApi";

const DEFAULT_TENANT_ID = "000000";

export type LoginBootstrapState = {
  tenantId: string;
  captchaEnabled: boolean;
  captchaUuid: string;
  captchaImage: string;
  warningMessage: string;
};

function toWarningMessage(error: unknown) {
  return error instanceof Error ? error.message : "登录配置初始化失败";
}

function toCaptchaState(captcha: CaptchaResponse) {
  return {
    captchaEnabled: captcha.captchaEnabled !== false,
    captchaUuid: captcha.uuid || "",
    captchaImage: captcha.img ? `data:image/gif;base64,${captcha.img}` : "",
  };
}

export async function resolveLoginBootstrapState(
  loadCaptcha: () => Promise<CaptchaResponse>
): Promise<LoginBootstrapState> {
  try {
    const captcha = await loadCaptcha();
    return {
      tenantId: DEFAULT_TENANT_ID,
      ...toCaptchaState(captcha),
      warningMessage: "",
    };
  } catch (error) {
    return {
      tenantId: DEFAULT_TENANT_ID,
      captchaEnabled: false,
      captchaUuid: "",
      captchaImage: "",
      warningMessage: toWarningMessage(error),
    };
  }
}

export async function resolveCaptchaState(loadCaptcha: () => Promise<CaptchaResponse>) {
  return toCaptchaState(await loadCaptcha());
}
