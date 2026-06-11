import { DataType, GraphNode, NodeClass } from "../../types";

type NodeBlueprint = {
  title: string;
  inputs: { name: string; type: DataType }[];
  outputs: { name: string; type: DataType }[];
  properties: Record<string, unknown>;
};

const DEFAULT_IMAGE_URL =
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=512&q=80";

const NODE_BLUEPRINTS: Partial<Record<NodeClass, NodeBlueprint>> = {
  string_input: {
    title: "文本常量 (Text Const)",
    inputs: [],
    outputs: [{ name: "文本", type: "STRING" }],
    properties: { value: "请输入文本..." },
  },
  slider_input: {
    title: "数值滑块 (Number)",
    inputs: [],
    outputs: [{ name: "数值", type: "NUMBER" }],
    properties: { value: 10, min: 1, max: 100, step: 1 },
  },
  load_image: {
    title: "图像输入 (Image)",
    inputs: [],
    outputs: [{ name: "图像", type: "IMAGE" }],
    properties: { imageUrl: DEFAULT_IMAGE_URL },
  },
  math_node: {
    title: "数学运算节点",
    inputs: [
      { name: "数值 A", type: "NUMBER" },
      { name: "数值 B", type: "NUMBER" },
    ],
    outputs: [{ name: "结果", type: "NUMBER" }],
    properties: { op: "+" },
  },
  string_concat: {
    title: "字符串拼接",
    inputs: [
      { name: "文本 A", type: "STRING" },
      { name: "文本 B", type: "STRING" },
    ],
    outputs: [{ name: "拼接文本", type: "STRING" }],
    properties: { separator: " " },
  },
  video_viewer: {
    title: "视频预览播放器",
    inputs: [{ name: "视频输入", type: "VIDEO" }],
    outputs: [
      { name: "逐帧图像", type: "IMAGE" },
      { name: "时序视频流", type: "VIDEO" },
    ],
    properties: {},
  },
  text_node: {
    title: "文本",
    inputs: [
      { name: "system_prompt", type: "STRING" },
      { name: "user_prompt", type: "ANY" },
      { name: "source_image", type: "IMAGE" },
      { name: "source_video", type: "VIDEO" },
      { name: "source_audio", type: "AUDIO" },
    ],
    outputs: [{ name: "文本", type: "STRING" }],
    properties: {
      text: "",
      model: "deepseek-chat",
      resolution: "1K",
      aspect_ratio: "16:9",
      quantity: "1张",
      n: 1,
      status: "idle",
      response: "",
    },
  },
  image_node: {
    title: "图片节点",
    inputs: [
      { name: "source_image", type: "IMAGE" },
      { name: "prompt", type: "STRING" },
      { name: "negative_prompt", type: "STRING" },
      { name: "aspect_ratio", type: "STRING" },
      { name: "source_audio", type: "AUDIO" },
      { name: "source_video", type: "VIDEO" },
    ],
    outputs: [{ name: "图片", type: "IMAGE" }],
    properties: {
      imageUrl: "",
      text: "",
      model: "image-01",
      resolution: "1K",
      aspect_ratio: "16:9",
      quantity: "1张",
      n: 1,
      prompt_optimizer: false,
    },
  },
  video_node: {
    title: "视频",
    inputs: [
      { name: "prompt", type: "STRING" },
      { name: "image", type: "IMAGE" },
      { name: "source_video", type: "VIDEO" },
      { name: "source_audio", type: "AUDIO" },
      { name: "duration", type: "NUMBER" },
      { name: "aspect_ratio", type: "STRING" },
    ],
    outputs: [{ name: "视频", type: "VIDEO" }],
    properties: {
      videoUrl: "",
      text: "",
      model: "MiniMax-Hailuo-2.3",
      aspect_ratio: "9:16",
      resolution: "1K",
      duration: "5s",
      audio: true,
      quantity: "1个",
      videoTool: "text-to-video",
    },
  },
  audio_node: {
    title: "音频",
    inputs: [
      { name: "提示词", type: "STRING" },
      { name: "时长", type: "NUMBER" },
      { name: "source_image", type: "IMAGE" },
      { name: "source_video", type: "VIDEO" },
      { name: "source_audio", type: "AUDIO" },
    ],
    outputs: [{ name: "音频", type: "AUDIO" }],
    properties: {
      audioUrl: "",
      text: "",
      model: "speech-2.8-hd",
      voice_id: "male-qn-qingse",
      speed: 1,
      vol: 1,
      pitch: 0,
      emotion: "auto",
      format: "mp3",
      audio_sample_rate: 32000,
      bitrate: 128000,
    },
  },
  group: {
    title: "节点分组",
    inputs: [],
    outputs: [],
    properties: { color: "#6366f1" },
  },
};

export function createNodeFromType(type: NodeClass, id: string, x: number, y: number): GraphNode {
  const blueprint = NODE_BLUEPRINTS[type] ?? {
    title: "自定义节点",
    inputs: [],
    outputs: [],
    properties: {},
  };

  return {
    id,
    type,
    title: blueprint.title,
    x: Math.round(x),
    y: Math.round(y),
    inputs: blueprint.inputs.map((i) => ({ ...i })),
    outputs: blueprint.outputs.map((o) => ({ ...o })),
    properties: { ...blueprint.properties },
    data: {},
  };
}
