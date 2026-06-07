import { uploadFileToOss } from "../features/resource/ossApi";
import { GraphNode, NodeClass } from "../types";
import { resolveUploadedFileNode } from "./uploadedFileNode";

type UploadedAssetKind = "image" | "video" | "audio";
type LocalMediaMetadata = Partial<NonNullable<GraphNode["data"]>>;

interface CanvasClientPosition {
  clientX: number;
  clientY: number;
}

interface UploadCanvasFileOptions {
  file: File;
  position: CanvasClientPosition;
  addNode: (
    type: NodeClass,
    clientX: number,
    clientY: number,
    initialProps?: Record<string, unknown>
  ) => string | undefined;
  onUpdateNodeData?: (nodeId: string, data: Partial<GraphNode["data"]>) => void;
  onUpdateNodeProperty?: (nodeId: string, key: string, value: unknown) => void;
  onNotice?: (message: string) => void;
}

const LOCAL_METADATA_TIMEOUT_MS = 2500;

function withMetadataTimeout<T>(read: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(fallback), LOCAL_METADATA_TIMEOUT_MS);
    read
      .then((result) => resolve(result))
      .catch(() => resolve(fallback))
      .finally(() => window.clearTimeout(timeout));
  });
}

async function readLocalMediaMetadata(
  file: File,
  localUrl: string,
  assetKind: UploadedAssetKind
): Promise<LocalMediaMetadata> {
  if (assetKind === "image") {
    return withMetadataTimeout(
      createImageBitmap(file).then((bitmap) => {
        const metadata = {
          imageNaturalWidth: bitmap.width,
          imageNaturalHeight: bitmap.height,
        };
        bitmap.close();
        return metadata;
      }),
      {}
    );
  }

  if (assetKind === "video") {
    return withMetadataTimeout(
      new Promise<LocalMediaMetadata>((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          resolve({
            videoNaturalWidth: video.videoWidth,
            videoNaturalHeight: video.videoHeight,
            videoDuration: Number.isFinite(video.duration) ? video.duration : undefined,
          });
        };
        video.onerror = () => resolve({});
        video.src = localUrl;
      }),
      {}
    );
  }

  if (assetKind === "audio") {
    return withMetadataTimeout(
      new Promise<LocalMediaMetadata>((resolve) => {
        const audio = document.createElement("audio");
        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
          resolve(Number.isFinite(audio.duration) ? { audioDuration: audio.duration } : {});
        };
        audio.onerror = () => resolve({});
        audio.src = localUrl;
      }),
      {}
    );
  }

  return {};
}

function buildInitialNodeData(
  assetKind: UploadedAssetKind,
  propKey: string,
  localUrl: string,
  fileName: string,
  metadata: LocalMediaMetadata
): Partial<GraphNode["data"]> {
  const data: Partial<GraphNode["data"]> = {
    ...metadata,
    uploadingAsset: true,
    uploadedAssetName: fileName,
  };

  (data as Record<string, unknown>)[propKey] = localUrl;

  if (assetKind === "image") {
    data.imageUrls = [localUrl];
    data.activeImageIndex = 0;
  }

  return data;
}

function buildUploadedNodeData(
  assetKind: UploadedAssetKind,
  propKey: string,
  assetUrl: string
): Partial<GraphNode["data"]> {
  const data: Partial<GraphNode["data"]> = {
    uploadingAsset: false,
    status: "success",
    error: undefined,
  };

  (data as Record<string, unknown>)[propKey] = assetUrl;

  if (assetKind === "image") {
    data.imageUrls = [assetUrl];
    data.activeImageIndex = 0;
  }

  return data;
}

export function getFilesFromTransfer(dataTransfer: DataTransfer | null | undefined): File[] {
  if (!dataTransfer) return [];

  const itemFiles = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  if (itemFiles.length > 0) return itemFiles;
  return Array.from(dataTransfer.files ?? []);
}

export function transferHasFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false;
  if (dataTransfer.files?.length > 0) return true;
  return Array.from(dataTransfer.items ?? []).some((item) => item.kind === "file");
}

export async function uploadCanvasFileAsNode({
  file,
  position,
  addNode,
  onUpdateNodeData,
  onUpdateNodeProperty,
  onNotice,
}: UploadCanvasFileOptions): Promise<string | undefined> {
  let localUrl = "";

  try {
    const expectedNode = resolveUploadedFileNode(file, "");
    localUrl = URL.createObjectURL(file);
    const metadata = await readLocalMediaMetadata(file, localUrl, expectedNode.assetKind);
    const nodeId = addNode(expectedNode.nodeType, position.clientX, position.clientY, {
      [expectedNode.propKey]: localUrl,
      __uploadedAssetKind: expectedNode.assetKind,
      __uploadedAssetName: file.name,
      __uploadedAssetUrl: localUrl,
      __nodeData: buildInitialNodeData(
        expectedNode.assetKind,
        expectedNode.propKey,
        localUrl,
        file.name,
        metadata
      ),
    });

    if (!nodeId) {
      URL.revokeObjectURL(localUrl);
      onNotice?.("文件节点创建失败");
      return undefined;
    }

    void uploadFileToOss(file)
      .then((asset) => {
        onUpdateNodeProperty?.(nodeId, expectedNode.propKey, asset.url);
        onUpdateNodeData?.(
          nodeId,
          buildUploadedNodeData(expectedNode.assetKind, expectedNode.propKey, asset.url)
        );
        window.setTimeout(() => URL.revokeObjectURL(localUrl), 0);
        onNotice?.("文件已上传到 OSS");
      })
      .catch((error) => {
        onUpdateNodeData?.(nodeId, {
          uploadingAsset: false,
          status: "error",
          error: error instanceof Error ? error.message : "文件上传失败",
        });
        onNotice?.(error instanceof Error ? error.message : "文件上传失败");
      });

    return nodeId;
  } catch (error) {
    if (localUrl) URL.revokeObjectURL(localUrl);
    onNotice?.(error instanceof Error ? error.message : "只支持上传图片、视频、音频文件");
    return undefined;
  }
}
