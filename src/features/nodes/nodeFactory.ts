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
  clip_text: {
    title: "CLIP 文本节点",
    inputs: [],
    outputs: [{ name: "提示词", type: "STRING" }],
    properties: { text: "输入提示词..." },
  },
  gemini_assistant: {
    title: "Gemini 文本推理 (T2T)",
    inputs: [
      { name: "用户提示词", type: "STRING" },
      { name: "上下文参数", type: "NUMBER" },
    ],
    outputs: [{ name: "模型结果", type: "STRING" }],
    properties: { systemInstruction: "请提供简洁且准确的回答。" },
  },
  prompt_enhancer: {
    title: "Prompt 增强器",
    inputs: [{ name: "原始提示词", type: "STRING" }],
    outputs: [{ name: "增强提示词", type: "STRING" }],
    properties: {},
  },
  ksampler: {
    title: "核心采样器 (KSampler)",
    inputs: [
      { name: "正向提示词", type: "STRING" },
      { name: "反向提示词", type: "STRING" },
      { name: "采样步数", type: "NUMBER" },
    ],
    outputs: [{ name: "图像结果", type: "IMAGE" }],
    properties: { seed: 0, steps: 30, cfg: 7.5, sampler: "euler_ancestral" },
  },
  text_to_video: {
    title: "视频合成器 (T2V)",
    inputs: [
      { name: "视频提示词", type: "STRING" },
      { name: "视频帧率", type: "NUMBER" },
      { name: "视频时长", type: "NUMBER" },
    ],
    outputs: [{ name: "视频流", type: "VIDEO" }],
    properties: { motion_scale: 8.5, fps: 24, duration: 6, interpolation: "rife_flow" },
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
  image_filter: {
    title: "图像滤镜节点",
    inputs: [{ name: "输入图像", type: "IMAGE" }],
    outputs: [{ name: "输出图像", type: "IMAGE" }],
    properties: { filterType: "grayscale", intensity: 100 },
  },
  vae_decode: {
    title: "VAE 解码预览",
    inputs: [{ name: "核心图像", type: "IMAGE" }],
    outputs: [],
    properties: {},
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
      { name: "user_prompt", type: "STRING" },
    ],
    outputs: [{ name: "文本", type: "STRING" }],
    properties: {
      text: "",
      model: "deepseek-chat",
      status: "idle",
      response: ""
    },
  },
  image_node: {
    title: "图片节点",
    inputs: [
      { name: "prompt", type: "STRING" },
      { name: "negative_prompt", type: "STRING" },
      { name: "aspect_ratio", type: "STRING" },
    ],
    outputs: [{ name: "图片", type: "IMAGE" }],
    properties: {
      imageUrl: "",
      text: "",
      model: "image-01",
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
      { name: "duration", type: "NUMBER" },
      { name: "aspect_ratio", type: "STRING" },
    ],
    outputs: [{ name: "视频", type: "VIDEO" }],
    properties: {
      videoUrl: "",
      text: "",
      model: "MiniMax-Hailuo-2.3",
      aspect_ratio: "16:9",
      resolution: "768P",
      duration: "6s",
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
    ],
    outputs: [{ name: "音频", type: "AUDIO" }],
    properties: {
      audioUrl: "",
      text: "",
      model: "minimax-speech-2.8-hd",
      duration: 8,
      voice: "alloy",
      energy: 1,
    },
  },
  group: {
    title: "工作流组",
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

  const properties =
    type === "ksampler"
      ? { ...blueprint.properties, seed: Math.floor(Math.random() * 100000) }
      : { ...blueprint.properties };

  return {
    id,
    type,
    title: blueprint.title,
    x: Math.round(x),
    y: Math.round(y),
    inputs: blueprint.inputs.map((i) => ({ ...i })),
    outputs: blueprint.outputs.map((o) => ({ ...o })),
    properties,
    data: {},
  };
}
