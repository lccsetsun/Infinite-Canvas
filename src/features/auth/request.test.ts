import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_STORAGE_KEY } from "./authConfig";
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
});
