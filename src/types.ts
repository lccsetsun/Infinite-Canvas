export type DataType = "STRING" | "NUMBER" | "IMAGE" | "VIDEO" | "MODEL" | "ANY";

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
  | "ai_video_node";

export interface GraphNode {
  id: string;
  type: NodeClass;
  title: string;
  x: number;
  y: number;
  inputs: NodeTerminal[];
  outputs: NodeTerminal[];
  properties: Record<string, any>;
  data?: {
    image?: string;
    videoUrl?: string;
    text?: string;
    number?: number;
    loading?: boolean;
    progress?: number; // 0 to 100 for step operations
    error?: string;
  };
}

export interface GraphLink {
  id: string;
  fromNodeId: string;
  fromOutputIndex: number;
  toNodeId: string;
  toInputIndex: number;
}

export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  nodeId?: string;
  nodeTitle?: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
}
