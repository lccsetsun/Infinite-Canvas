import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";

export async function reviewAsset(ossId: string): Promise<string> {
  const response = await devApiFetch(`/system/ai/asset/${encodeURIComponent(ossId)}`, {
    method: "GET",
  });
  const parsed = await parseDevApiEnvelope<unknown>(response);
  if (typeof parsed.data !== "string") {
    throw new Error("送审接口没有返回结果");
  }
  return parsed.data;
}
