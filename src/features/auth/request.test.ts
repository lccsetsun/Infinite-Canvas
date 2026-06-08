import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_STORAGE_KEY } from "./authConfig";
import { API_NOTICE_EVENT, type ApiNoticeDetail } from "./apiNotice";
import { devApiFetch } from "./request";

describe("devApiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => (key === AUTH_STORAGE_KEY ? "token-123" : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it("adds bearer token and clientid for authenticated dev-api requests", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await devApiFetch("/resource/profile", { method: "GET" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/dev-api/resource/profile");
    expect(init.headers).toBeInstanceOf(Headers);
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("clientid")).toBeTruthy();
  });

  it("does not attach bearer token when auth is disabled", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await devApiFetch("/auth/code", { method: "GET", auth: false });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("clientid")).toBeTruthy();
  });

  it("deduplicates concurrent GET requests in development mode", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      devApiFetch("/system/canvas/list?pageNum=1&pageSize=7", { method: "GET" }),
      devApiFetch("/system/canvas/list?pageNum=1&pageSize=7", { method: "GET" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(first.json()).resolves.toEqual({ ok: true });
    await expect(second.json()).resolves.toEqual({ ok: true });
  });

  it("aborts requests after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = devApiFetch("/auth/code", {
      method: "GET",
      auth: false,
      timeoutMs: 50,
    });
    const result = request.then(
      () => "resolved",
      (error: unknown) => (error instanceof Error ? error.message : String(error))
    );

    await vi.advanceTimersByTimeAsync(50);

    await expect(result).resolves.toBe("接口请求超时，请稍后重试");
    vi.useRealTimers();
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

  it("emits a global notice and clears the session on http 401", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const events = stubNoticeDispatch();

    await devApiFetch("/system/canvas/list", { method: "GET" });

    expect(localStorage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(events).toContainEqual({
      type: API_NOTICE_EVENT,
      detail: { message: "登录已失效，请重新登录", kind: "warning" },
    });
  });
});
