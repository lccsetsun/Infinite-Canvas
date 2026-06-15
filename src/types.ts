export type DataType = "STRING" | "NUMBER" | "IMAGE" | "VIDEO" | "AUDIO" | "MODEL" | "ANY";

export interface NodeTerminal {
  name: string;
  type: DataType;
}

export type NodeClass =
  | "load_image"
  | "string_concat"
  | "slider_input"
  | "string_input"
  | "math_node"
  | "video_viewer"
  | "text_node"
  | "image_node"
  | "video_node"
  | "video_batch_replacement_node"
  | "audio_node"
  | "group";

export interface GroupBox {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  collapsed?: boolean;
}

export interface GraphNode {
  id: string;
  type: NodeClass;
  title: string;
  x: number;
  y: number;
  inputs: NodeTerminal[];
  outputs: NodeTerminal[];
  properties: Record<string, any>;
  groupId?: string | null;
  data?: {
    image?: string;
    videoUrl?: string;
    text?: string;
    number?: number;
    response?: string;
    textNodeWidth?: number;
    textNodeHeight?: number;
    imageUrl?: string;
    imageUrls?: string[];
    ossId?: string;
    ossIds?: string[];
    frameImageOssIds?: string[];
    activeImageIndex?: number;
    imageNodeWidth?: number;
    imageNodeHeight?: number;
    imagePortCenterY?: number;
    imageDisplayWidth?: number;
    imageDisplayHeight?: number;
    uploadedImage?: boolean;
    isUploadPlaceholder?: boolean;
    isSourceNode?: boolean;
    imagePromptStarter?: boolean;
    starterTextNodeId?: string;
    starterGapX?: number;
    textStarterDismissed?: boolean;
    forceComposerOpen?: boolean;
    forceInlineEditing?: boolean;
    imageNaturalWidth?: number;
    imageNaturalHeight?: number;
    videoDisplayWidth?: number;
    videoDisplayHeight?: number;
    videoNodeWidth?: number;
    videoNodeHeight?: number;
    videoPortCenterY?: number;
    videoNaturalWidth?: number;
    videoNaturalHeight?: number;
    videoDuration?: number;
    videoFrameUrl?: string;
    isFrameStrip?: boolean;
    frameGridColumns?: number;
    frameGridRows?: number;
    frameTileWidth?: number;
    frameTileHeight?: number;
    frameAnalysisSourceNodeId?: string;
    frameCaptureSourceNodeId?: string;
    batchReplacementSlots?: Array<{
      key: "front" | "side" | "back";
      title: string;
      placeholder: string;
      imageUrl: string;
      ossId?: string;
      prompt: string;
    }>;
    batchReplacementMode?: "product" | "scene";
    batchReplacementModelId?: string;
    batchReplacementResolution?: string;
    batchReplacementAspectRatio?: string;
    batchReplacementResult?: unknown;
    batchReplacementTaskId?: string;
    batchReplacementTaskStatus?: string;
    batchReplacementTaskError?: string;
    batchReplacementStartedAt?: number;
    batchReplacementFinishedAt?: number;
    batchReplacementRunId?: string;
    batchReplacementSourceNodeId?: string;
    batchReplacementResultIndex?: number;
    batchReplacementResultCount?: number;
    extractedFrameSourceNodeId?: string;
    extractedFrameIndex?: number;
    videoFrameCaptureChild?: boolean;
    audioUrl?: string;
    audioDuration?: number;
    uploadingAsset?: boolean;
    uploadedAssetName?: string;
    externalUploadSource?: boolean;
    loading?: boolean;
    loadingOperation?: "generate" | "frame-analysis" | "video-prompt" | "batch-replacement";
    progress?: number;
    status?: string;
    error?: string;
    remoteVideoTaskId?: string;
    remoteVideoTaskStatus?: string;
    remoteVideoTaskError?: string;
    remoteModelApiId?: string;
    remoteModelId?: string;
  };
}

export interface GraphLink {
  id: string;
  fromNodeId: string;
  fromOutputIndex: number;
  toNodeId: string;
  toInputIndex: number;
  excludedInputValues?: string[];
  locked?: boolean;
}

export interface VideoFrameAnalysisSegment {
  title: string;
  start: number;
  end: number;
  imageUrl: string;
  width: number;
  height: number;
  frameCount: number;
}

export interface VideoFrameAnalysisOverview {
  imageUrl: string;
  width: number;
  height: number;
  frameCount: number;
}

export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  nodes: GraphNode[];
  links: GraphLink[];
  groups?: GroupBox[];
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  nodeId?: string;
  nodeTitle?: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
}
