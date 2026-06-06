import { AUTH_ENCRYPT_RESPONSE_HEADER } from "./authConfig";
import { clearAuthSession } from "./authStorage";
import { decryptBase64, decryptWithAes, decryptWithRsa } from "./crypto";

type ApiEnvelope<T> = {
  code: number;
  msg: string;
  data: T;
};

export async function parseDevApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const rawText = await response.text();
  const encryptKey = response.headers.get(AUTH_ENCRYPT_RESPONSE_HEADER);

  let decodedText = rawText;
  if (encryptKey) {
    const encryptedPayload =
      rawText.startsWith("\"") && rawText.endsWith("\"") ? (JSON.parse(rawText) as string) : rawText;
    const decryptedKey = decryptWithRsa(encryptKey);
    const aesKey = decryptBase64(decryptedKey);
    decodedText = decryptWithAes(encryptedPayload, aesKey);
  }

  let parsed: ApiEnvelope<T>;
  try {
    parsed = JSON.parse(decodedText) as ApiEnvelope<T>;
  } catch {
    throw new Error(decodedText || "响应解析失败");
  }

  if (!response.ok) {
    throw new Error(parsed?.msg || `请求失败 (${response.status})`);
  }
  if (parsed.code !== 200) {
    if (parsed.code === 401) {
      clearAuthSession();
    }
    throw new Error(parsed.msg || "请求失败");
  }
  return parsed;
}
