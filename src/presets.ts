import { WorkflowPreset, GraphNode, GraphLink } from "./types";

// Dynamic high-res image matching based on Chinese or English keywords
export const GET_PRESET_IMAGES = (prompt: string) => {
  const p = prompt.toLowerCase();
  if (p.includes("robot") || p.includes("cyborg") || p.includes("机器人") || p.includes("科技")) {
    return "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=600&q=80"; // sci fi robot
  }
  if (p.includes("cat") || p.includes("feline") || p.includes("猫") || p.includes("猫咪")) {
    return "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80"; // beautiful cute orange cat
  }
  if (p.includes("cyberpunk") || p.includes("neon") || p.includes("赛博朋克") || p.includes("霓虹") || p.includes("城市")) {
    return "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=80"; // neon twilight city
  }
  if (p.includes("nature") || p.includes("mountain") || p.includes("自然") || p.includes("山脉") || p.includes("森林")) {
    return "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80"; // pristine mountain landscape
  }
  if (p.includes("space") || p.includes("galaxy") || p.includes("太空") || p.includes("宇宙") || p.includes("星空")) {
    return "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80"; // deep cosmic space nebulae
  }
  if (p.includes("car") || p.includes("vehicle") || p.includes("汽车") || p.includes("跑车")) {
    return "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=600&q=80"; // sleek futuristic sports car
  }
  // Default abstract visual artwork
  return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80";
};

// Dynamic looping high-quality video matching for Text-to-Video feature
export const GET_PRESET_VIDEOS = (prompt: string) => {
  const p = prompt.toLowerCase();
  
  if (p.includes("space") || p.includes("galaxy") || p.includes("star") || p.includes("太空") || p.includes("宇宙") || p.includes("星空") || p.includes("行星")) {
    return "https://assets.mixkit.co/videos/preview/mixkit-space-odyssey-with-rotating-planets-and-stars-41484-large.mp4";
  }
  if (p.includes("city") || p.includes("cyberpunk") || p.includes("traffic") || p.includes("城市") || p.includes("赛博朋克") || p.includes("霓虹") || p.includes("街道")) {
    return "https://assets.mixkit.co/videos/preview/mixkit-night-traffic-of-a-futuristic-modern-city-43142-large.mp4";
  }
  if (p.includes("ocean") || p.includes("sea") || p.includes("water") || p.includes("wave") || p.includes("海洋") || p.includes("大海") || p.includes("海浪")) {
    return "https://assets.mixkit.co/videos/preview/mixkit-waves-crashing-on-rocky-shore-from-above-41595-large.mp4";
  }
  if (p.includes("robot") || p.includes("tech") || p.includes("cyborg") || p.includes("机器人") || p.includes("科技") || p.includes("机械")) {
    return "https://assets.mixkit.co/videos/preview/mixkit-robot-with-glowing-blue-eyes-43034-large.mp4";
  }
  if (p.includes("fire") || p.includes("flame") || p.includes("fireworks") || p.includes("烟花") || p.includes("火焰") || p.includes("爆炸")) {
    return "https://assets.mixkit.co/videos/preview/mixkit-bright-fireworks-light-up-the-night-sky-41584-large.mp4";
  }
  // Abstract glowing visual art
  return "https://assets.mixkit.co/videos/preview/mixkit-glowing-neon-lines-on-black-background-40762-large.mp4";
};

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "txt2img",
    name: "文生图 (潜空间扩散渲染)",
    description: "最为经典的 AIGC 图像扩散生成流水线。通过正面与负面提示词输入，调度采样步数最终还原高清艺术图像。",
    nodes: [
      {
        id: "img_prompt_pos",
        type: "clip_text",
        title: "正向文本提示词 (Positive)",
        x: 80,
        y: 80,
        inputs: [],
        outputs: [{ name: "文本字符串", type: "STRING" }],
        properties: { text: "一只身穿橙色发光宇航服的可爱赛博朋克猫咪漂浮在无重力的外太空里，背景是璀璨的星系和粉红星云，超逼真，电影级梦幻光效且富有细节，8K分辨率" }
      },
      {
        id: "img_prompt_neg",
        type: "clip_text",
        title: "反向排除提示词 (Negative)",
        x: 80,
        y: 280,
        inputs: [],
        outputs: [{ name: "文本字符串", type: "STRING" }],
        properties: { text: "模糊不清，塑料感，身体扭曲，多余肢体，抽象，水印，字样标志，低分辨率，劣质" }
      },
      {
        id: "img_steps",
        type: "slider_input",
        title: "步数调节器 (Steps)",
        x: 80,
        y: 480,
        inputs: [],
        outputs: [{ name: "数值", type: "NUMBER" }],
        properties: { value: 30, min: 10, max: 150, step: 1 }
      },
      {
        id: "img_ksampler",
        type: "ksampler",
        title: "核心数学采样器 (KSampler)",
        x: 440,
        y: 160,
        inputs: [
          { name: "正向提示词", type: "STRING" },
          { name: "负向提示词", type: "STRING" },
          { name: "去噪步数", type: "NUMBER" }
        ],
        outputs: [{ name: "图像结果", type: "IMAGE" }],
        properties: { seed: 884712401, steps: 30, cfg: 7.5, sampler: "euler_ancestral" }
      },
      {
        id: "img_viewer",
        type: "vae_decode",
        title: "VAE 图像解码/保存预览",
        x: 800,
        y: 160,
        inputs: [{ name: "核心图像", type: "IMAGE" }],
        outputs: [],
        properties: {}
      }
    ],
    links: [
      { id: "img_l1", fromNodeId: "img_prompt_pos", fromOutputIndex: 0, toNodeId: "img_ksampler", toInputIndex: 0 },
      { id: "img_l2", fromNodeId: "img_prompt_neg", fromOutputIndex: 0, toNodeId: "img_ksampler", toInputIndex: 1 },
      { id: "img_l3", fromNodeId: "img_steps", fromOutputIndex: 0, toNodeId: "img_ksampler", toInputIndex: 2 }
    ]
  },
  {
    id: "txt2txt",
    name: "文生文 (Gemini大语言模型推理)",
    description: "利用谷歌服务端 Gemini AI 将简单的点子进行扩推、翻译或微型文本内容小说创作，并实时返回高智能分析结果。",
    nodes: [
      {
        id: "txt_input",
        type: "string_input",
        title: "简易点子输入 (Concept String)",
        x: 80,
        y: 140,
        inputs: [],
        outputs: [{ name: "文本点子", type: "STRING" }],
        properties: { value: "写一首赞美宇宙深处那只永恒守护太空猫的充满科技感又优雅的中式绝句诗歌" }
      },
      {
        id: "txt_prompt_template",
        type: "string_input",
        title: "创意提示词模板 (Template)",
        x: 80,
        y: 350,
        inputs: [],
        outputs: [{ name: "模板格式", type: "STRING" }],
        properties: { value: "直接创作这首绝句：{input}，注意押韵和科技词汇的融入。" }
      },
      {
        id: "txt_gemini",
        type: "gemini_assistant",
        title: "Gemini 文本推理助理",
        x: 440,
        y: 120,
        inputs: [
          { name: "用户提示词", type: "STRING" },
          { name: "上下文参数", type: "NUMBER" }
        ],
        outputs: [{ name: "模型结果", type: "STRING" }],
        properties: { systemInstruction: "你是一个优雅、富有哲理、掌握极高太空科技文明的老练中国古代诗人学者。回答请使用古典而充满科幻张力的词语。" }
      },
      {
        id: "txt_preview",
        type: "clip_text",
        title: "生成文稿显示屏 (Decoder Preview)",
        x: 800,
        y: 120,
        inputs: [{ name: "渲染结果", type: "STRING" }],
        outputs: [],
        properties: { text: "点击顶部 【运行工作流 / QUEUE PROMPT】 后，Gemini 会在此处为您写出绝妙的篇章..." }
      }
    ],
    links: [
      { id: "txt_l1", fromNodeId: "txt_input", fromOutputIndex: 0, toNodeId: "txt_gemini", toInputIndex: 0 },
      { id: "txt_l2", fromNodeId: "txt_gemini", fromOutputIndex: 0, toNodeId: "txt_preview", toInputIndex: 0 }
    ]
  },
  {
    id: "txt2vid",
    name: "文生视频 (AI时序视频流合成)",
    description: "视频 AIGC 的多槽串联工作流。利用帧率控制与多模态合成技术，完成一段支持播放与控制的高逼真动画生成。",
    nodes: [
      {
        id: "vid_prompt",
        type: "clip_text",
        title: "视频核心分镜提示词 (Positive Video)",
        x: 80,
        y: 100,
        inputs: [],
        outputs: [{ name: "视频文本描述", type: "STRING" }],
        properties: { text: "在璀璨的宇宙星系中心，巨大的蓝色行星正在缓缓地自转，周围环绕着无数细密的银白色发光星尘粒子，科幻宇宙奇观" }
      },
      {
        id: "vid_fps",
        type: "slider_input",
        title: "目标输出帧率 (FPS)",
        x: 80,
        y: 320,
        inputs: [],
        outputs: [{ name: "帧率数值", type: "NUMBER" }],
        properties: { value: 24, min: 12, max: 60, step: 1 }
      },
      {
        id: "vid_duration",
        type: "slider_input",
        title: "生成时长(秒) (Duration)",
        x: 80,
        y: 520,
        inputs: [],
        outputs: [{ name: "秒数数值", type: "NUMBER" }],
        properties: { value: 6, min: 2, max: 20, step: 1 }
      },
      {
        id: "vid_ksampler",
        type: "text_to_video",
        title: "AI 视频合成扩散器 (Video Synthesizer)",
        x: 440,
        y: 160,
        inputs: [
          { name: "视频提示词", type: "STRING" },
          { name: "视频帧率", type: "NUMBER" },
          { name: "视频时长", type: "NUMBER" }
        ],
        outputs: [{ name: "视频内容流", type: "VIDEO" }],
        properties: { motion_scale: 8.5, fps: 24, duration: 6, interpolation: "rife_flow" }
      },
      {
        id: "vid_viewer",
        type: "video_viewer",
        title: "时序视频解码播放器 (Decoder Player)",
        x: 800,
        y: 160,
        inputs: [{ name: "视频插帧输入", type: "VIDEO" }],
        outputs: [],
        properties: {}
      }
    ],
    links: [
      { id: "vid_l1", fromNodeId: "vid_prompt", fromOutputIndex: 0, toNodeId: "vid_ksampler", toInputIndex: 0 },
      { id: "vid_l2", fromNodeId: "vid_fps", fromOutputIndex: 0, toNodeId: "vid_ksampler", toInputIndex: 1 },
      { id: "vid_l3", fromNodeId: "vid_duration", fromOutputIndex: 0, toNodeId: "vid_ksampler", toInputIndex: 2 }
    ]
  },
  {
    id: "img_effects",
    name: "多级算子图像滤镜工作流",
    description: "演示可插拔、可串行执行的纯级联图像数字信号处理，支持对上传的任意图片附加多重色彩反转、灰度处理等算子。",
    nodes: [
      {
        id: "loader_img",
        type: "load_image",
        title: "图像源加载/相机上传",
        x: 100,
        y: 150,
        inputs: [],
        outputs: [{ name: "图像输出", type: "IMAGE" }],
        properties: { imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=512&q=80" }
      },
      {
        id: "filter_invert",
        type: "image_filter",
        title: "颜色反相算子 (Invert)",
        x: 480,
        y: 100,
        inputs: [{ name: "图像输入", type: "IMAGE" }],
        outputs: [{ name: "图像输出", type: "IMAGE" }],
        properties: { filterType: "invert", intensity: 100 }
      },
      {
        id: "filter_grayscale",
        type: "image_filter",
        title: "经典灰度黑白算子 (Grayscale)",
        x: 480,
        y: 350,
        inputs: [{ name: "图像输入", type: "IMAGE" }],
        outputs: [{ name: "图像输出", type: "IMAGE" }],
        properties: { filterType: "grayscale", intensity: 100 }
      },
      {
        id: "viewer_filtered_1",
        type: "vae_decode",
        title: "图像预览终端 A",
        x: 840,
        y: 80,
        inputs: [{ name: "核心图像", type: "IMAGE" }],
        outputs: [],
        properties: {}
      },
      {
        id: "viewer_filtered_2",
        type: "vae_decode",
        title: "图像预览终端 B",
        x: 840,
        y: 350,
        inputs: [{ name: "核心图像", type: "IMAGE" }],
        outputs: [],
        properties: {}
      }
    ],
    links: [
      { id: "img_l1_ef", fromNodeId: "loader_img", fromOutputIndex: 0, toNodeId: "filter_invert", toInputIndex: 0 },
      { id: "img_l2_ef", fromNodeId: "loader_img", fromOutputIndex: 0, toNodeId: "filter_grayscale", toInputIndex: 0 },
      { id: "img_viewer1", fromNodeId: "filter_invert", fromOutputIndex: 0, toNodeId: "viewer_filtered_1", toInputIndex: 0 },
      { id: "img_viewer2", fromNodeId: "filter_grayscale", fromOutputIndex: 0, toNodeId: "viewer_filtered_2", toInputIndex: 0 }
    ]
  }
];
