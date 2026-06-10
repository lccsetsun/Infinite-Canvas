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

const NODE_PROPERTY_SCHEMA: Partial<Record<NodeClass, Record<string, PropertySchemaItem>>> = {
  slider_input: {
    value: { kind: "number", description: "当前滑块值" },
    min: { kind: "number", integer: true, description: "滑块最小值" },
    max: { kind: "number", integer: true, description: "滑块最大值" },
    step: { kind: "number", min: 0, description: "滑块步进" },
  },
  string_input: {
    value: { kind: "text", placeholder: "请输入文本..." },
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
  return NODE_PROPERTY_SCHEMA[nodeType]?.[key];
}
