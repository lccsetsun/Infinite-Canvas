import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./authStorage", () => ({
  clearAuthSession: vi.fn(),
}));

import { clearAuthSession } from "./authStorage";
import { parseDevApiEnvelope } from "./apiEnvelope";

describe("parseDevApiEnvelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the auth session when the dev-api envelope reports code 401", async () => {
    const response = new Response(
      JSON.stringify({
        code: 401,
        msg: "认证失败，无法访问系统资源",
        data: null,
      }),
      { status: 200 }
    );

    await expect(parseDevApiEnvelope(response)).rejects.toThrow("认证失败，无法访问系统资源");
    expect(clearAuthSession).toHaveBeenCalledTimes(1);
  });
});
