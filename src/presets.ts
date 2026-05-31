import { WorkflowPreset } from "./types";

export const GET_PRESET_IMAGES = (prompt: string) => {
  const p = prompt.toLowerCase();
  if (p.includes("robot") || p.includes("cyborg") || p.includes("机器人") || p.includes("科技")) {
    return "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80";
  }
  if (p.includes("cat") || p.includes("feline") || p.includes("猫")) {
    return "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80";
  }
  if (
    p.includes("cyberpunk") ||
    p.includes("neon") ||
    p.includes("赛博朋克") ||
    p.includes("霓虹") ||
    p.includes("城市")
  ) {
    return "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=80";
  }
  if (p.includes("nature") || p.includes("mountain") || p.includes("自然") || p.includes("森林")) {
    return "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80";
  }
  if (
    p.includes("space") ||
    p.includes("galaxy") ||
    p.includes("太空") ||
    p.includes("宇宙") ||
    p.includes("星空")
  ) {
    return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80";
  }
  if (p.includes("car") || p.includes("vehicle") || p.includes("汽车") || p.includes("跑车")) {
    return "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=600&q=80";
  }
  return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80";
};

export const GET_PRESET_VIDEOS = (prompt: string) => {
  const p = prompt.toLowerCase();

  if (
    p.includes("space") ||
    p.includes("galaxy") ||
    p.includes("star") ||
    p.includes("太空") ||
    p.includes("宇宙") ||
    p.includes("星空")
  ) {
    return "https://assets.mixkit.co/videos/preview/mixkit-space-odyssey-with-rotating-planets-and-stars-41484-large.mp4";
  }
  if (
    p.includes("city") ||
    p.includes("cyberpunk") ||
    p.includes("traffic") ||
    p.includes("城市") ||
    p.includes("赛博朋克")
  ) {
    return "https://assets.mixkit.co/videos/preview/mixkit-night-traffic-of-a-futuristic-modern-city-43142-large.mp4";
  }
  if (
    p.includes("ocean") ||
    p.includes("sea") ||
    p.includes("water") ||
    p.includes("wave") ||
    p.includes("海洋") ||
    p.includes("海浪")
  ) {
    return "https://assets.mixkit.co/videos/preview/mixkit-waves-crashing-on-rocky-shore-from-above-41595-large.mp4";
  }
  if (
    p.includes("robot") ||
    p.includes("tech") ||
    p.includes("cyborg") ||
    p.includes("机器人") ||
    p.includes("机械")
  ) {
    return "https://assets.mixkit.co/videos/preview/mixkit-robot-with-glowing-blue-eyes-43034-large.mp4";
  }
  if (
    p.includes("fire") ||
    p.includes("flame") ||
    p.includes("fireworks") ||
    p.includes("烟花") ||
    p.includes("火焰")
  ) {
    return "https://assets.mixkit.co/videos/preview/mixkit-bright-fireworks-light-up-the-night-sky-41584-large.mp4";
  }
  return "https://assets.mixkit.co/videos/preview/mixkit-glowing-neon-lines-on-black-background-40762-large.mp4";
};

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "txt2img",
    name: "文生图（扩散工作流）",
    description: "经典 AIGC 文生图流程，使用正负提示词和采样参数生成高质量图像。",
    nodes: [
      {
        id: "img_prompt_pos",
        type: "clip_text",
        title: "正向提示词 (Positive)",
        x: 80,
        y: 80,
        inputs: [],
        outputs: [{ name: "提示词", type: "STRING" }],
        properties: {
          text: "一只穿着发光宇航服的赛博猫漂浮在太空中，背景是绚烂星云，电影级光效，超细节，8K",
        },
      },
      {
        id: "img_prompt_neg",
        type: "clip_text",
        title: "反向提示词 (Negative)",
        x: 80,
        y: 280,
        inputs: [],
        outputs: [{ name: "提示词", type: "STRING" }],
        properties: { text: "模糊，低清晰度，肢体畸形，水印，文字，噪点，塑料感" },
      },
      {
        id: "img_steps",
        type: "slider_input",
        title: "采样步数 (Steps)",
        x: 80,
        y: 480,
        inputs: [],
        outputs: [{ name: "数值", type: "NUMBER" }],
        properties: { value: 30, min: 10, max: 150, step: 1 },
      },
      {
        id: "img_ksampler",
        type: "ksampler",
        title: "核心采样器 (KSampler)",
        x: 440,
        y: 160,
        inputs: [
          { name: "正向提示词", type: "STRING" },
          { name: "反向提示词", type: "STRING" },
          { name: "采样步数", type: "NUMBER" },
        ],
        outputs: [{ name: "图像结果", type: "IMAGE" }],
        properties: { seed: 884712401, steps: 30, cfg: 7.5, sampler: "euler_ancestral" },
      },
      {
        id: "img_viewer",
        type: "vae_decode",
        title: "VAE 解码预览",
        x: 800,
        y: 160,
        inputs: [{ name: "核心图像", type: "IMAGE" }],
        outputs: [],
        properties: {},
      },
    ],
    links: [
      {
        id: "img_l1",
        fromNodeId: "img_prompt_pos",
        fromOutputIndex: 0,
        toNodeId: "img_ksampler",
        toInputIndex: 0,
      },
      {
        id: "img_l2",
        fromNodeId: "img_prompt_neg",
        fromOutputIndex: 0,
        toNodeId: "img_ksampler",
        toInputIndex: 1,
      },
      {
        id: "img_l3",
        fromNodeId: "img_steps",
        fromOutputIndex: 0,
        toNodeId: "img_ksampler",
        toInputIndex: 2,
      },
    ],
  },
  {
    id: "txt2txt",
    name: "文生文（Gemini 推理）",
    description: "利用 Gemini 将简短主题扩展为完整、有风格的文本内容。",
    nodes: [
      {
        id: "txt_input",
        type: "string_input",
        title: "输入主题 (Concept)",
        x: 80,
        y: 140,
        inputs: [],
        outputs: [{ name: "主题文本", type: "STRING" }],
        properties: { value: "写一首关于宇宙守护猫的科技感短诗" },
      },
      {
        id: "txt_prompt_template",
        type: "string_input",
        title: "创意模板 (Template)",
        x: 80,
        y: 350,
        inputs: [],
        outputs: [{ name: "模板", type: "STRING" }],
        properties: { value: "请围绕 {input} 创作一段兼具科幻感与诗意的中文短文。" },
      },
      {
        id: "txt_gemini",
        type: "gemini_assistant",
        title: "Gemini 文本推理",
        x: 440,
        y: 120,
        inputs: [
          { name: "用户提示词", type: "STRING" },
          { name: "上下文参数", type: "NUMBER" },
        ],
        outputs: [{ name: "模型结果", type: "STRING" }],
        properties: { systemInstruction: "你是一名擅长诗意表达与科幻叙事的中文创作助手。" },
      },
      {
        id: "txt_preview",
        type: "clip_text",
        title: "文本结果预览",
        x: 800,
        y: 120,
        inputs: [{ name: "输出文本", type: "STRING" }],
        outputs: [],
        properties: { text: "点击顶部“运行”后，Gemini 输出会显示在这里。" },
      },
    ],
    links: [
      {
        id: "txt_l1",
        fromNodeId: "txt_input",
        fromOutputIndex: 0,
        toNodeId: "txt_gemini",
        toInputIndex: 0,
      },
      {
        id: "txt_l2",
        fromNodeId: "txt_gemini",
        fromOutputIndex: 0,
        toNodeId: "txt_preview",
        toInputIndex: 0,
      },
    ],
  },
  {
    id: "txt2vid",
    name: "文生视频（时序合成）",
    description: "通过提示词、帧率和时长生成可预览的 AI 视频内容。",
    nodes: [
      {
        id: "vid_prompt",
        type: "clip_text",
        title: "视频提示词 (Prompt)",
        x: 80,
        y: 100,
        inputs: [],
        outputs: [{ name: "视频描述", type: "STRING" }],
        properties: { text: "一颗蓝色行星在宇宙中缓慢旋转，周围漂浮发光粒子，镜头平滑推进。" },
      },
      {
        id: "vid_fps",
        type: "slider_input",
        title: "目标帧率 (FPS)",
        x: 80,
        y: 320,
        inputs: [],
        outputs: [{ name: "帧率", type: "NUMBER" }],
        properties: { value: 24, min: 12, max: 60, step: 1 },
      },
      {
        id: "vid_duration",
        type: "slider_input",
        title: "视频时长（秒）",
        x: 80,
        y: 520,
        inputs: [],
        outputs: [{ name: "时长", type: "NUMBER" }],
        properties: { value: 6, min: 2, max: 20, step: 1 },
      },
      {
        id: "vid_ksampler",
        type: "text_to_video",
        title: "视频合成器 (T2V)",
        x: 440,
        y: 160,
        inputs: [
          { name: "视频提示词", type: "STRING" },
          { name: "视频帧率", type: "NUMBER" },
          { name: "视频时长", type: "NUMBER" },
        ],
        outputs: [{ name: "视频流", type: "VIDEO" }],
        properties: { motion_scale: 8.5, fps: 24, duration: 6, interpolation: "rife_flow" },
      },
      {
        id: "vid_viewer",
        type: "video_viewer",
        title: "视频预览播放器",
        x: 800,
        y: 160,
        inputs: [{ name: "视频输入", type: "VIDEO" }],
        outputs: [],
        properties: {},
      },
    ],
    links: [
      {
        id: "vid_l1",
        fromNodeId: "vid_prompt",
        fromOutputIndex: 0,
        toNodeId: "vid_ksampler",
        toInputIndex: 0,
      },
      {
        id: "vid_l2",
        fromNodeId: "vid_fps",
        fromOutputIndex: 0,
        toNodeId: "vid_ksampler",
        toInputIndex: 1,
      },
      {
        id: "vid_l3",
        fromNodeId: "vid_duration",
        fromOutputIndex: 0,
        toNodeId: "vid_ksampler",
        toInputIndex: 2,
      },
    ],
  },
  {
    id: "img_effects",
    name: "图像特效处理",
    description: "演示图像滤镜处理链路，可并行输出多路效果预览。",
    nodes: [
      {
        id: "loader_img",
        type: "load_image",
        title: "图像输入源",
        x: 100,
        y: 150,
        inputs: [],
        outputs: [{ name: "图像输出", type: "IMAGE" }],
        properties: {
          imageUrl:
            "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=512&q=80",
        },
      },
      {
        id: "filter_invert",
        type: "image_filter",
        title: "颜色反相 (Invert)",
        x: 480,
        y: 100,
        inputs: [{ name: "图像输入", type: "IMAGE" }],
        outputs: [{ name: "图像输出", type: "IMAGE" }],
        properties: { filterType: "invert", intensity: 100 },
      },
      {
        id: "filter_grayscale",
        type: "image_filter",
        title: "灰度滤镜 (Grayscale)",
        x: 480,
        y: 350,
        inputs: [{ name: "图像输入", type: "IMAGE" }],
        outputs: [{ name: "图像输出", type: "IMAGE" }],
        properties: { filterType: "grayscale", intensity: 100 },
      },
      {
        id: "viewer_filtered_1",
        type: "vae_decode",
        title: "效果预览 A",
        x: 840,
        y: 80,
        inputs: [{ name: "核心图像", type: "IMAGE" }],
        outputs: [],
        properties: {},
      },
      {
        id: "viewer_filtered_2",
        type: "vae_decode",
        title: "效果预览 B",
        x: 840,
        y: 350,
        inputs: [{ name: "核心图像", type: "IMAGE" }],
        outputs: [],
        properties: {},
      },
    ],
    links: [
      {
        id: "img_l1_ef",
        fromNodeId: "loader_img",
        fromOutputIndex: 0,
        toNodeId: "filter_invert",
        toInputIndex: 0,
      },
      {
        id: "img_l2_ef",
        fromNodeId: "loader_img",
        fromOutputIndex: 0,
        toNodeId: "filter_grayscale",
        toInputIndex: 0,
      },
      {
        id: "img_viewer1",
        fromNodeId: "filter_invert",
        fromOutputIndex: 0,
        toNodeId: "viewer_filtered_1",
        toInputIndex: 0,
      },
      {
        id: "img_viewer2",
        fromNodeId: "filter_grayscale",
        fromOutputIndex: 0,
        toNodeId: "viewer_filtered_2",
        toInputIndex: 0,
      },
    ],
  },
];
