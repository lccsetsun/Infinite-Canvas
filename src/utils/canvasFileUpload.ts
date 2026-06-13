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
const MEDIA_NODE_FOOTPRINT_WIDTH = 540;
const MEDIA_NODE_FOOTPRINT_HEIGHT = 540;

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

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function fitMediaSize(naturalSize: { width: number; height: number }) {
  const scale = Math.min(
    MEDIA_NODE_FOOTPRINT_WIDTH / naturalSize.width,
    MEDIA_NODE_FOOTPRINT_HEIGHT / naturalSize.height
  );
  return {
    width: Math.round(naturalSize.width * scale),
    height: Math.round(naturalSize.height * scale),
  };
}

function assertLocalMediaDimensions(assetKind: UploadedAssetKind, metadata: LocalMediaMetadata) {
  if (
    assetKind === "image" &&
    (!isFinitePositiveNumber(metadata.imageNaturalWidth) ||
      !isFinitePositiveNumber(metadata.imageNaturalHeight))
  ) {
    throw new Error("无法读取图片尺寸，未创建节点");
  }

  if (
    assetKind === "video" &&
    (!isFinitePositiveNumber(metadata.videoNaturalWidth) ||
      !isFinitePositiveNumber(metadata.videoNaturalHeight))
  ) {
    throw new Error("无法读取视频尺寸，未创建节点");
  }
}

export function buildInitialCanvasFileNodeData(
  assetKind: UploadedAssetKind,
  propKey: string,
  _localUrl: string,
  fileName: string,
  metadata: LocalMediaMetadata
): Partial<GraphNode["data"]> {
  const data: Partial<GraphNode["data"]> = {
    isSourceNode: true,
    ...metadata,
    uploadingAsset: true,
    uploadedAssetName: fileName,
  };

  if (assetKind === "image") {
    data.activeImageIndex = 0;
    if (
      isFinitePositiveNumber(metadata.imageNaturalWidth) &&
      isFinitePositiveNumber(metadata.imageNaturalHeight)
    ) {
      const displaySize = fitMediaSize({
        width: metadata.imageNaturalWidth,
        height: metadata.imageNaturalHeight,
      });
      data.imageDisplayWidth = displaySize.width;
      data.imageDisplayHeight = displaySize.height;
    }
  }

  if (
    assetKind === "video" &&
    isFinitePositiveNumber(metadata.videoNaturalWidth) &&
    isFinitePositiveNumber(metadata.videoNaturalHeight)
  ) {
    const displaySize = fitMediaSize({
      width: metadata.videoNaturalWidth,
      height: metadata.videoNaturalHeight,
    });
    data.videoDisplayWidth = displaySize.width;
    data.videoDisplayHeight = displaySize.height;
    data.videoNodeWidth = displaySize.width;
    data.videoNodeHeight = displaySize.height;
    data.videoPortCenterY = Math.round(displaySize.height / 2);
  }

  return data;
}

function buildUploadedNodeData(
  assetKind: UploadedAssetKind,
  propKey: string,
  assetUrl: string,
  ossId?: string
): Partial<GraphNode["data"]> {
  const data: Partial<GraphNode["data"]> = {
    isSourceNode: true,
    uploadingAsset: false,
    status: "success",
    error: undefined,
  };

  (data as Record<string, unknown>)[propKey] = assetUrl;
  if (ossId) data.ossId = ossId;

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
    assertLocalMediaDimensions(expectedNode.assetKind, metadata);
    const nodeId = addNode(expectedNode.nodeType, position.clientX, position.clientY, {
      __uploadedAssetKind: expectedNode.assetKind,
      __uploadedAssetName: file.name,
      __nodeData: buildInitialCanvasFileNodeData(
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
        if (asset.ossId) onUpdateNodeProperty?.(nodeId, "ossId", asset.ossId);
        onUpdateNodeData?.(
          nodeId,
          buildUploadedNodeData(
            expectedNode.assetKind,
            expectedNode.propKey,
            asset.url,
            asset.ossId
          )
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
