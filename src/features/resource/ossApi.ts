import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";

type OssUploadPayload =
  | string
  | {
      fileName?: string;
      name?: string;
      ossId?: string | number;
      id?: string | number;
      url?: string;
      fileUrl?: string;
      fullUrl?: string;
      downloadUrl?: string;
      src?: string;
      ossUrl?: string;
    };

function normalizeOssId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "bigint") return String(value);
  return undefined;
}

function extractOssUrl(payload: OssUploadPayload): string {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (payload && typeof payload === "object") {
    const candidates = [
      payload.url,
      payload.fileUrl,
      payload.fullUrl,
      payload.downloadUrl,
      payload.src,
      payload.ossUrl,
    ];
    const resolved = candidates.find((value) => typeof value === "string" && value.trim());
    if (resolved) return resolved.trim();
  }
  throw new Error("OSS 上传成功，但响应中没有返回文件地址");
}

function extractOssFileName(payload: OssUploadPayload): string | undefined {
  if (payload && typeof payload === "object") {
    const value = payload.fileName || payload.name;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function extractOssId(payload: OssUploadPayload): string | undefined {
  if (payload && typeof payload === "object") {
    return normalizeOssId(payload.ossId ?? payload.id);
  }
  return undefined;
}

export async function uploadFileToOss(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await devApiFetch("/resource/oss/upload", {
    method: "POST",
    body: formData,
  });
  const parsed = await parseDevApiEnvelope<OssUploadPayload>(response);

  return {
    url: extractOssUrl(parsed.data),
    ossId: extractOssId(parsed.data),
    fileName: extractOssFileName(parsed.data),
    raw: parsed.data,
  };
}
