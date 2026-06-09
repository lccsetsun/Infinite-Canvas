import { NodeClass } from "../../types";
import { IMAGE_ASPECT_RATIO_OPTIONS, IMAGE_RESOLUTION_OPTIONS } from "./imageResolutionPresets";

export type PropertyEditorKind = "text" | "number" | "boolean" | "select" | "nullish";

export interface PropertySchemaItem {
  kind: PropertyEditorKind;
  label?: string;
  integer?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
  description?: string;
}

const GLOBAL_SCHEMA: Record<string, PropertySchemaItem> = {
  sampler: {
    kind: "select",
    options: ["euler_ancestral", "euler", "ddim", "dpmpp_2m"],
  },
  filterType: {
    kind: "select",
    options: ["grayscale", "invert", "sepia", "contrast"],
  },
  interpolation: {
    kind: "select",
    options: ["rife_flow", "linear", "nearest"],
  },
};

const NODE_PROPERTY_SCHEMA: Partial<Record<NodeClass, Record<string, PropertySchemaItem>>> = {
  slider_input: {
    value: { kind: "number", description: "当前滑块值" },
    min: { kind: "number", integer: true, description: "滑块最小值" },
    max: { kind: "number", integer: true, description: "滑块最大值" },
    step: { kind: "number", min: 0, description: "滑块步进" },
  },
  ksampler: {
    seed: { kind: "number", integer: true, min: 0, description: "随机种子" },
    steps: { kind: "number", integer: true, min: 1, max: 200, description: "采样步数" },
    cfg: { kind: "number", min: 1, max: 30, description: "提示词引导强度" },
    sampler: GLOBAL_SCHEMA.sampler,
  },
  text_to_video: {
    motion_scale: { kind: "number", min: 0, max: 20, description: "运动强度" },
    fps: { kind: "number", integer: true, min: 1, max: 120, description: "帧率" },
    duration: { kind: "number", integer: true, min: 1, max: 120, description: "时长（秒）" },
    interpolation: GLOBAL_SCHEMA.interpolation,
  },
  image_filter: {
    filterType: GLOBAL_SCHEMA.filterType,
    intensity: { kind: "number", integer: true, min: 0, max: 100, description: "滤镜强度百分比" },
  },
  string_input: {
    value: { kind: "text", placeholder: "请输入文本..." },
  },
  clip_text: {
    text: { kind: "text", placeholder: "请输入提示词..." },
  },
  gemini_assistant: {
    systemInstruction: { kind: "text", placeholder: "给模型的系统指令" },
  },
  text_node: {
    resolution: { kind: "select", options: IMAGE_RESOLUTION_OPTIONS, description: "目标图片分辨率" },
    aspect_ratio: {
      kind: "select",
      options: IMAGE_ASPECT_RATIO_OPTIONS,
      description: "目标图片比例",
    },
  },
  image_node: {
    resolution: { kind: "select", options: IMAGE_RESOLUTION_OPTIONS, description: "图片生成分辨率" },
    aspect_ratio: {
      kind: "select",
      options: IMAGE_ASPECT_RATIO_OPTIONS,
      description: "图片生成比例",
    },
  },
  video_node: {
    resolution: { kind: "select", options: IMAGE_RESOLUTION_OPTIONS, description: "视频生成分辨率" },
    aspect_ratio: {
      kind: "select",
      options: IMAGE_ASPECT_RATIO_OPTIONS,
      description: "视频生成比例",
    },
  },
};

export function getPropertySchema(
  nodeType: NodeClass,
  key: string
): PropertySchemaItem | undefined {
  return NODE_PROPERTY_SCHEMA[nodeType]?.[key] ?? GLOBAL_SCHEMA[key];
}
