import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./authStorage", () => ({
  clearAuthSession: vi.fn(),
}));

import { clearAuthSession } from "./authStorage";
import { API_NOTICE_EVENT, type ApiNoticeDetail } from "./apiNotice";
import { parseDevApiEnvelope } from "./apiEnvelope";

describe("parseDevApiEnvelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function stubNoticeDispatch() {
    const events: Array<{ type: string; detail?: ApiNoticeDetail }> = [];
    vi.stubGlobal(
      "CustomEvent",
      class<T> extends Event {
        detail: T;
        constructor(type: string, init?: CustomEventInit<T>) {
          super(type);
          this.detail = init?.detail as T;
        }
      }
    );
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn((event: Event & { detail?: ApiNoticeDetail }) => {
        events.push({ type: event.type, detail: event.detail });
        return true;
      }),
    });
    return events;
  }

  it("clears the auth session when the dev-api envelope reports code 401", async () => {
    const events = stubNoticeDispatch();
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
    expect(events).toContainEqual({
      type: API_NOTICE_EVENT,
      detail: { message: "认证失败，无法访问系统资源", kind: "warning" },
    });
  });

  it("emits a global notice when the dev-api envelope reports a business error", async () => {
    const events = stubNoticeDispatch();
    const response = new Response(
      JSON.stringify({
        code: 500,
        msg: "项目保存失败",
        data: null,
      }),
      { status: 200 }
    );

    await expect(parseDevApiEnvelope(response)).rejects.toThrow("项目保存失败");
    expect(events).toContainEqual({
      type: API_NOTICE_EVENT,
      detail: { message: "项目保存失败", kind: "error" },
    });
  });
});
