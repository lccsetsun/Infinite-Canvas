import { describe, expect, it, vi } from "vitest";
import { resolveLoginBootstrapState } from "./loginBootstrap";

describe("resolveLoginBootstrapState", () => {
  it("uses the default tenant and always loads captcha", async () => {
    const loadCaptcha = vi.fn(async () => ({
      captchaEnabled: true,
      uuid: "captcha-uuid",
      img: "base64-image",
    }));

    await expect(resolveLoginBootstrapState(loadCaptcha)).resolves.toEqual({
      tenantId: "000000",
      captchaEnabled: true,
      captchaUuid: "captcha-uuid",
      captchaImage: "data:image/gif;base64,base64-image",
      warningMessage: "",
    });

    expect(loadCaptcha).toHaveBeenCalledTimes(1);
  });

  it("falls back to a disabled captcha state when captcha bootstrap fails", async () => {
    const loadCaptcha = vi.fn(async () => {
      throw new Error("captcha service unavailable");
    });

    await expect(resolveLoginBootstrapState(loadCaptcha)).resolves.toEqual({
      tenantId: "000000",
      captchaEnabled: false,
      captchaUuid: "",
      captchaImage: "",
      warningMessage: "captcha service unavailable",
    });
  });
});
