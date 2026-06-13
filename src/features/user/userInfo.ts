import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";

export interface CurrentUserInfo {
  avatarUrl: string;
  credits: number;
  displayName: string;
  username: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const normalized = Number(value.replace(/,/g, ""));
      if (Number.isFinite(normalized)) return normalized;
    }
  }
  return 0;
}

export function mapUserInfoPayload(payload: unknown): CurrentUserInfo {
  const root = isRecord(payload) ? payload : {};
  const user = isRecord(root.user) ? root.user : root;
  const account = isRecord(root.account) ? root.account : {};
  const username = firstString(user.userName, user.username, user.loginName, root.userName, root.username);
  const displayName = firstString(
    user.nickName,
    user.nickname,
    user.name,
    root.nickName,
    root.nickname,
    username,
    "用户"
  );
  const avatarUrl = firstString(user.avatar, user.avatarUrl, root.avatar, root.avatarUrl);
  const credits = firstNumber(
    root.credits,
    root.credit,
    root.points,
    root.point,
    root.balance,
    root.quota,
    root.tokens,
    account.availableAssets,
    account.balance,
    account.credits,
    account.points,
    account.quota,
    user.credits,
    user.credit,
    user.points,
    user.point,
    user.balance,
    user.quota,
    user.tokens
  );

  return {
    avatarUrl,
    credits,
    displayName,
    username,
  };
}

export function formatUserCredits(value: number | undefined) {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(safeValue);
}

export async function fetchCurrentUserInfo() {
  const response = await devApiFetch("/system/user/getInfo", { method: "GET" });
  const parsed = await parseDevApiEnvelope<unknown>(response);
  return mapUserInfoPayload(parsed.data);
}
