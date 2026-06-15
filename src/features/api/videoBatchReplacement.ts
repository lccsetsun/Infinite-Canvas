import type { AiModel } from "./aiModelCatalog";
import { parseDevApiEnvelope } from "../auth/apiEnvelope";
import { devApiFetch } from "../auth/request";

export interface BatchEditImagesRequest {
  prompt: string;
  productOssId: string[];
  customSize: string;
  ossId: string[];
  model: Pick<AiModel, "apiId" | "modelId">;
}

export interface BatchEditFrameImage {
  url: string;
  ossId: string | number;
}

export interface BatchEditImagesResultItem {
  index: number;
  video: string;
  frame_images: BatchEditFrameImage[];
}

export async function batchEditImages(
  payload: BatchEditImagesRequest
): Promise<BatchEditImagesResultItem[]> {
  const response = await devApiFetch("/system/generator/batchEditImgaes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const parsed = await parseDevApiEnvelope<BatchEditImagesResultItem[]>(response);
  return Array.isArray(parsed.data) ? parsed.data : [];
}
