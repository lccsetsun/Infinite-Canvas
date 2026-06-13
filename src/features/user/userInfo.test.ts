import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/request", () => ({
  devApiFetch: vi.fn(),
}));

import { devApiFetch } from "../auth/request";
import { fetchCurrentUserInfo, formatUserCredits, mapUserInfoPayload } from "./userInfo";

const mockedDevApiFetch = vi.mocked(devApiFetch);

function makeResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("userInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the current user from /system/user/getInfo", async () => {
    mockedDevApiFetch.mockResolvedValueOnce(
      makeResponse({
        code: 200,
        msg: "success",
        data: {
          user: {
            userName: "lccsetsun",
            nickName: "lccsetsun",
            avatar: "https://example.com/avatar.png",
          },
          credits: 76198,
        },
      })
    );

    await expect(fetchCurrentUserInfo()).resolves.toEqual({
      avatarUrl: "https://example.com/avatar.png",
      credits: 76198,
      displayName: "lccsetsun",
      username: "lccsetsun",
    });

    expect(mockedDevApiFetch).toHaveBeenCalledWith("/system/user/getInfo", { method: "GET" });
  });

  it("maps nested user fields and tolerates missing credit fields", () => {
    expect(
      mapUserInfoPayload({
        user: {
          userName: "sys_user",
          nickName: "Studio User",
          avatar: null,
        },
      })
    ).toEqual({
      avatarUrl: "",
      credits: 0,
      displayName: "Studio User",
      username: "sys_user",
    });
  });

  it("maps account available assets from the getInfo payload", () => {
    expect(
      mapUserInfoPayload({
        account: {
          assetType: "RMB",
          availableAssets: "999.9",
          frozenAssets: "9.9",
        },
        user: {
          userName: "lccsetsun",
          nickName: "lccsetsun",
        },
      })
    ).toEqual({
      avatarUrl: "",
      credits: 999.9,
      displayName: "lccsetsun",
      username: "lccsetsun",
    });
  });

  it("formats credits for the compact account badge", () => {
    expect(formatUserCredits(76198)).toBe("76,198");
    expect(formatUserCredits(999.9)).toBe("999.9");
    expect(formatUserCredits(undefined)).toBe("0");
  });
});
