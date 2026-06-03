import { NodeClass } from "../../types";

export interface WorkflowTemplateNodeSpec {
  type: NodeClass;
  x: number;
  y: number;
  defaultProperties?: Record<string, unknown>;
}

export interface WorkflowTemplateLinkSpec {
  fromNodeIndex: number;
  fromOutputIndex: number;
  toNodeIndex: number;
  toInputIndex: number;
}

export type TemplateDefaultOutput = { nodeIdx: number; outputIdx: number; value: unknown };
export type TemplateDefaultOutputs = TemplateDefaultOutput[];

export interface WorkflowTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  isDemo?: boolean;
  nodes: WorkflowTemplateNodeSpec[];
  links: WorkflowTemplateLinkSpec[];
  defaultOutputs?: TemplateDefaultOutputs;
}

const PLACEHOLDER_IMAGE = "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=A%20cup%20of%20coffee%20with%20steaming%20milk%2C%20cyberpunk%20neon%20light%2C%20studio%20lighting%2C%20ultra%20detailed&image_size=square_hd";

const PLACEHOLDER_STORY = "凌晨三点,自动咖啡机的指示灯亮着。我按下经典美式按钮,五秒后,一杯苦得刚刚好的液体滑进纸杯。窗外没人在等,但咖啡的香气替我醒了过来。\n\n这就是 AI 时代的小确幸:不必等谁,自己就是被服务的人。";

const PLACEHOLDER_COPY =
  "☕ 全新 CoffeeAI X1 智能咖啡机\n5 秒出杯,AI 调配 12 种风味,懂你比伴侣还细。\n\n不止是一杯咖啡,是清晨的第一个微笑。\n「CoffeeAI」";

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "tpl-demo-copy-generator",
    name: "智能文案生成器",
    emoji: "✍️",
    description: "输入产品卖点 → AI 扩写为广告语 → 自动追加品牌后缀。",
    category: "示例",
    isDemo: true,
    nodes: [
      { type: "string_input", x: 80, y: 140, defaultProperties: { value: "全新自动咖啡机 5 秒出杯,AI 调配 12 种风味" } },
      { type: "text_node", x: 380, y: 140, defaultProperties: { system_prompt: "你是一位资深营销文案,擅长将产品卖点扩展为吸引人的 80 字广告语,语言有温度。", model: "deepseek-v4-flash" } },
      { type: "string_concat", x: 680, y: 140, defaultProperties: { separator: "\n\n" } },
    ],
    links: [
      { fromNodeIndex: 0, fromOutputIndex: 0, toNodeIndex: 1, toInputIndex: 1 },
      { fromNodeIndex: 1, fromOutputIndex: 0, toNodeIndex: 2, toInputIndex: 0 },
    ],
    defaultOutputs: [
      { nodeIdx: 1, outputIdx: 0, value: PLACEHOLDER_COPY },
      { nodeIdx: 2, outputIdx: 0, value: PLACEHOLDER_COPY },
    ],
  },
  {
    id: "tpl-demo-story-writer",
    name: "故事生成",
    emoji: "📖",
    description: "输入主题与风格,AI 撰写一段微型故事。",
    category: "示例",
    isDemo: true,
    nodes: [
      { type: "string_input", x: 80, y: 100, defaultProperties: { value: "凌晨三点的自动咖啡机" } },
      { type: "string_input", x: 80, y: 240, defaultProperties: { value: "温暖、生活感、略带幽默" } },
      { type: "text_node", x: 380, y: 170, defaultProperties: { system_prompt: "你是一位作家。根据用户提供的主题和风格,写一段 100 字的微型故事,文笔细腻,留有余味。", model: "deepseek-v4-flash" } },
    ],
    links: [
      { fromNodeIndex: 0, fromOutputIndex: 0, toNodeIndex: 2, toInputIndex: 0 },
      { fromNodeIndex: 1, fromOutputIndex: 0, toNodeIndex: 2, toInputIndex: 1 },
    ],
    defaultOutputs: [{ nodeIdx: 2, outputIdx: 0, value: PLACEHOLDER_STORY }],
  },
  {
    id: "tpl-demo-image-gen",
    name: "图像生成",
    emoji: "🎨",
    description: "输入文字场景,生成 1:1 图像。",
    category: "示例",
    isDemo: true,
    nodes: [
      { type: "string_input", x: 80, y: 140, defaultProperties: { value: "赛博朋克少女在霓虹灯下喝咖啡" } },
      { type: "image_node", x: 380, y: 140, defaultProperties: { model: "image-01", aspect_ratio: "1:1", quantity: "1张", n: 1, prompt_optimizer: false } },
    ],
    links: [
      { fromNodeIndex: 0, fromOutputIndex: 0, toNodeIndex: 1, toInputIndex: 0 },
    ],
    defaultOutputs: [{ nodeIdx: 1, outputIdx: 0, value: PLACEHOLDER_IMAGE }],
  },
  {
    id: "tpl-demo-math-to-text",
    name: "数值计算 + 文本融合",
    emoji: "🧮",
    description: "两个滑块求和,结果自动拼接到促销文本。",
    category: "示例",
    isDemo: true,
    nodes: [
      { type: "slider_input", x: 80, y: 80, defaultProperties: { value: 18, min: 0, max: 100 } },
      { type: "slider_input", x: 80, y: 240, defaultProperties: { value: 12, min: 0, max: 100 } },
      { type: "math_node", x: 380, y: 160, defaultProperties: { op: "+" } },
      { type: "string_input", x: 380, y: 320, defaultProperties: { value: "今日特调,仅需 " } },
      { type: "string_concat", x: 680, y: 220, defaultProperties: { separator: "" } },
    ],
    links: [
      { fromNodeIndex: 0, fromOutputIndex: 0, toNodeIndex: 2, toInputIndex: 0 },
      { fromNodeIndex: 1, fromOutputIndex: 0, toNodeIndex: 2, toInputIndex: 1 },
      { fromNodeIndex: 2, fromOutputIndex: 0, toNodeIndex: 4, toInputIndex: 0 },
      { fromNodeIndex: 3, fromOutputIndex: 0, toNodeIndex: 4, toInputIndex: 1 },
    ],
    defaultOutputs: [
      { nodeIdx: 2, outputIdx: 0, value: 30 },
      { nodeIdx: 4, outputIdx: 0, value: "今日特调,仅需 30" },
    ],
  },

  {
    id: "tpl-image-from-prompt",
    name: "图像生成(简版)",
    emoji: "🖼️",
    description: "输入文字描述,AI 立即生成图像。",
    category: "图像",
    nodes: [
      { type: "string_input", x: 80, y: 120, defaultProperties: { value: "赛博朋克少女,霓虹灯" } },
      { type: "image_node", x: 380, y: 120, defaultProperties: { model: "image-01", aspect_ratio: "1:1", quantity: "1张", n: 1, prompt_optimizer: false } },
    ],
    links: [
      { fromNodeIndex: 0, fromOutputIndex: 0, toNodeIndex: 1, toInputIndex: 0 },
    ],
  },
  {
    id: "tpl-text-story",
    name: "故事生成(简版)",
    emoji: "📚",
    description: "输入主题,AI 撰写短篇故事。",
    category: "文本",
    nodes: [
      { type: "string_input", x: 80, y: 120, defaultProperties: { value: "月亮与六便士" } },
      { type: "text_node", x: 380, y: 120, defaultProperties: { model: "deepseek-v4-flash" } },
    ],
    links: [
      { fromNodeIndex: 0, fromOutputIndex: 0, toNodeIndex: 1, toInputIndex: 1 },
    ],
  },
  {
    id: "tpl-video-from-prompt",
    name: "视频生成(简版)",
    emoji: "🎬",
    description: "输入文字描述,生成短视频。",
    category: "视频",
    nodes: [
      { type: "string_input", x: 80, y: 120, defaultProperties: { value: "海浪拍打礁石" } },
      { type: "video_node", x: 380, y: 120, defaultProperties: { duration: 8 } },
    ],
    links: [
      { fromNodeIndex: 0, fromOutputIndex: 0, toNodeIndex: 1, toInputIndex: 0 },
    ],
  },
  {
    id: "tpl-math-add",
    name: "数值求和",
    emoji: "➕",
    description: "两个滑块相加得到总和。",
    category: "数学",
    nodes: [
      { type: "slider_input", x: 80, y: 80, defaultProperties: { value: 10 } },
      { type: "slider_input", x: 80, y: 220, defaultProperties: { value: 20 } },
      { type: "math_node", x: 380, y: 150, defaultProperties: { op: "+" } },
    ],
    links: [
      { fromNodeIndex: 0, fromOutputIndex: 0, toNodeIndex: 2, toInputIndex: 0 },
      { fromNodeIndex: 1, fromOutputIndex: 0, toNodeIndex: 2, toInputIndex: 1 },
    ],
  },
  {
    id: "tpl-text-concat",
    name: "文本拼接",
    emoji: "🔗",
    description: "两段文本拼成一段。",
    category: "文本",
    nodes: [
      { type: "string_input", x: 80, y: 80, defaultProperties: { value: "你好," } },
      { type: "string_input", x: 80, y: 220, defaultProperties: { value: "世界!" } },
      { type: "string_concat", x: 380, y: 150, defaultProperties: { separator: " " } },
    ],
    links: [
      { fromNodeIndex: 0, fromOutputIndex: 0, toNodeIndex: 2, toInputIndex: 0 },
      { fromNodeIndex: 1, fromOutputIndex: 0, toNodeIndex: 2, toInputIndex: 1 },
    ],
  },
  {
    id: "tpl-demo-storyboard",
    name: "产品 TVC 分镜",
    emoji: "🎬",
    description: "用脚本节点拆解 6 段分镜,一键批量生图,再批量生视频。",
    category: "分镜",
    isDemo: true,
    nodes: [
      { type: "string_input", x: 80, y: 140, defaultProperties: { value: "智能咖啡机 30 秒 TVC" } },
      {
        type: "script_node",
        x: 460,
        y: 80,
        defaultProperties: {
          aspectRatio: "16:9",
          imageModel: "flux-1",
          videoModel: "sora",
          defaultDuration: 5,
          rows: [
            { id: "row_tpl_1", title: "分镜 1", prompt: "清晨阳光洒进极简厨房,白色台面上静置一台极简设计的智能咖啡机,自然光质感,产品摄影风格,4K", duration: 5 },
            { id: "row_tpl_2", title: "分镜 2", prompt: "咖啡机特写镜头,触控屏亮起,蒸汽缓缓升起,微距摄影,慢动作,暖色调,质感细腻", duration: 5 },
            { id: "row_tpl_3", title: "分镜 3", prompt: "新鲜咖啡豆倒入研磨仓的瞬间,慢动作特写,光泽饱满,深棕色咖啡豆,商业广告风格", duration: 5 },
            { id: "row_tpl_4", title: "分镜 4", prompt: "咖啡液缓缓流出注入白色陶瓷杯,流动的丝滑质感,黄金时分光,广告级画面", duration: 5 },
            { id: "row_tpl_5", title: "分镜 5", prompt: "一只手端起咖啡杯特写,背景虚化的舒适客厅,清晨氛围,生活感,胶片色调", duration: 5 },
            { id: "row_tpl_6", title: "分镜 6", prompt: "咖啡机全景与产品 Logo 同时浮现,渐变光晕,品牌级摄影,极简白色背景", duration: 5 },
          ],
        },
      },
    ],
    links: [],
  },
];
