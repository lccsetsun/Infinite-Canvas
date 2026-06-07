export type DataType = "STRING" | "NUMBER" | "IMAGE" | "VIDEO" | "AUDIO" | "MODEL" | "ANY";

export interface NodeTerminal {
  name: string;
  type: DataType;
}

export type NodeClass =
  | "load_image"
  | "clip_text"
  | "prompt_enhancer"
  | "string_concat"
  | "ksampler"
  | "gemini_assistant"
  | "vae_decode"
  | "slider_input"
  | "string_input"
  | "math_node"
  | "image_filter"
  | "text_to_video"
  | "video_viewer"
  | "ai_text_node"
  | "ai_image_node"
  | "ai_video_node"
  | "text_node"
  | "image_node"
  | "video_node"
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
    imageUrl?: string;
    imageUrls?: string[];
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
    imageNaturalWidth?: number;
    imageNaturalHeight?: number;
    videoDisplayWidth?: number;
    videoDisplayHeight?: number;
    videoNodeWidth?: number;
    videoNodeHeight?: number;
    videoPortCenterY?: number;
    videoNaturalWidth?: number;
    videoNaturalHeight?: number;
    videoFrameUrl?: string;
    audioUrl?: string;
    audioDuration?: number;
    loading?: boolean;
    progress?: number;
    status?: string;
    error?: string;
  };
}

export interface GraphLink {
  id: string;
  fromNodeId: string;
  fromOutputIndex: number;
  toNodeId: string;
  toInputIndex: number;
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

export interface VideoSegmentTextAnalysis {
  title: string;
  start: number;
  end: number;
  text: string;
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
