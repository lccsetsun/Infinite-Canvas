import type { CaptchaResponse, TenantListResponse } from "./authApi";

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
  loadTenantList: () => Promise<TenantListResponse>,
  loadCaptcha: () => Promise<CaptchaResponse>
): Promise<LoginBootstrapState> {
  try {
    const tenantInfo = await loadTenantList();
    const tenantId = tenantInfo.voList?.[0]?.tenantId || "";

    if (!tenantInfo.tenantEnabled) {
      return {
        tenantId,
        captchaEnabled: false,
        captchaUuid: "",
        captchaImage: "",
        warningMessage: "",
      };
    }

    const captcha = await loadCaptcha();
    return {
      tenantId,
      ...toCaptchaState(captcha),
      warningMessage: "",
    };
  } catch (error) {
    return {
      tenantId: "",
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
