import { describe, expect, it, vi } from "vitest";
import { resolveLoginBootstrapState } from "./loginBootstrap";

describe("resolveLoginBootstrapState", () => {
  it("falls back to manual login when tenant bootstrap fails", async () => {
    const loadTenantList = vi.fn(async () => {
      throw new Error("tenant service unavailable");
    });
    const loadCaptcha = vi.fn();

    await expect(resolveLoginBootstrapState(loadTenantList, loadCaptcha)).resolves.toEqual({
      tenantId: "",
      captchaEnabled: false,
      captchaUuid: "",
      captchaImage: "",
      warningMessage: "tenant service unavailable",
    });

    expect(loadCaptcha).not.toHaveBeenCalled();
  });
});
