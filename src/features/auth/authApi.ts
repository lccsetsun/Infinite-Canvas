import { AUTH_CLIENT_ID } from "./authConfig";
import { parseDevApiEnvelope } from "./apiEnvelope";
import { encryptBase64, encryptWithAes, encryptWithRsa, generateAesKey } from "./crypto";
import { devApiFetch } from "./request";

export type CaptchaResponse = {
  captchaEnabled: boolean;
  uuid?: string;
  img?: string;
};

export type LoginPayload = {
  tenantId?: string;
  username: string;
  password: string;
  code?: string;
  uuid?: string;
  clientId?: string;
  grantType?: string;
};

export type LoginResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

function buildEncryptedRequestBody(payload: Record<string, unknown>) {
  const aesKey = generateAesKey();
  const encryptedHeader = encryptWithRsa(encryptBase64(aesKey));
  const encryptedBody = encryptWithAes(JSON.stringify(payload), aesKey);
  return {
    encryptedHeader,
    encryptedBody: JSON.stringify(encryptedBody),
  };
}

export async function fetchCaptcha() {
  const response = await devApiFetch("/auth/code", {
    method: "GET",
    auth: false,
    timeoutMs: 10000,
  });
  const parsed = await parseDevApiEnvelope<CaptchaResponse>(response);
  return parsed.data;
}

export async function loginWithPassword(payload: LoginPayload) {
  const requestPayload = {
    ...payload,
    clientId: payload.clientId || AUTH_CLIENT_ID,
    grantType: payload.grantType || "password",
  };
  const { encryptedHeader, encryptedBody } = buildEncryptedRequestBody(requestPayload);

  const response = await devApiFetch("/auth/login", {
    method: "POST",
    auth: false,
    headers: {
      "Content-Type": "application/json",
      clientid: AUTH_CLIENT_ID,
      "encrypt-key": encryptedHeader,
    },
    body: encryptedBody,
  });

  const parsed = await parseDevApiEnvelope<LoginResponse>(response);
  return parsed.data;
}

export async function logout() {
  const response = await devApiFetch("/auth/logout", {
    method: "POST",
  });
  await parseDevApiEnvelope<unknown>(response);
}
