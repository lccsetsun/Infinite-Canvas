export type ApiProvider =
  | "openai"
  | "deepseek"
  | "gemini"
  | "anthropic"
  | "moonshot"
  | "zhipu"
  | "custom";

export interface ProviderPreset {
  label: string;
  description: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  keyHint: string;
  docsUrl?: string;
}

export const PROVIDER_PRESETS: Record<ApiProvider, ProviderPreset> = {
  openai: {
    label: "OpenAI",
    description: "OpenAI 官方接口 (gpt-4o, gpt-4o-mini 等)",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    defaultModel: "gpt-4o-mini",
    keyHint: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  deepseek: {
    label: "DeepSeek",
    description: "深度求索,高性价比中文模型",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-v4-flash", "deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    keyHint: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  gemini: {
    label: "Google Gemini",
    description: "Google 多模态大模型 (通过本项目 /api/gemini/proxy 代理)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b"],
    defaultModel: "gemini-2.0-flash",
    keyHint: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  anthropic: {
    label: "Anthropic Claude",
    description: "Anthropic Claude 系列模型 (OpenAI 兼容代理)",
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
    defaultModel: "claude-3-5-sonnet-latest",
    keyHint: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  moonshot: {
    label: "Moonshot (月之暗面)",
    description: "Moonshot Kimi 系列,擅长长上下文",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "moonshot-v1-auto"],
    defaultModel: "moonshot-v1-8k",
    keyHint: "sk-...",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
  },
  zhipu: {
    label: "智谱 AI (GLM)",
    description: "智谱 BigModel 开放平台 (OpenAI 兼容)",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4-plus", "glm-4-air", "glm-4-airx", "glm-4-flash"],
    defaultModel: "glm-4-flash",
    keyHint: "your-api-key",
    docsUrl: "https://bigmodel.cn/usercenter/projkey",
  },
  custom: {
    label: "自定义 (OpenAI 兼容)",
    description: "任何兼容 /v1/chat/completions 的第三方或自建网关",
    baseUrl: "",
    models: [],
    defaultModel: "",
    keyHint: "your-api-key",
  },
};

export const PROVIDER_ORDER: ApiProvider[] = [
  "openai",
  "deepseek",
  "gemini",
  "anthropic",
  "moonshot",
  "zhipu",
  "custom",
];

export interface ApiProfile {
  id: string;
  name: string;
  provider: ApiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  timeout: number;
  systemPrompt: string;
  useSystemProxy: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ApiSettings {
  profiles: ApiProfile[];
  activeProfileId: string;
  autoTestOnSave: boolean;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function makeDefaultProfile(): ApiProfile {
  const now = Date.now();
  return {
    id: makeId("api"),
    name: "DeepSeek",
    provider: "deepseek",
    baseUrl: PROVIDER_PRESETS.deepseek.baseUrl,
    apiKey: "",
    model: PROVIDER_PRESETS.deepseek.defaultModel,
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1,
    timeout: 60,
    systemPrompt: "",
    useSystemProxy: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function makeDefaultSettings(): ApiSettings {
  const profile = makeDefaultProfile();
  return {
    profiles: [profile],
    activeProfileId: profile.id,
    autoTestOnSave: false,
  };
}

export function cloneProfile(p: ApiProfile, overrides: Partial<ApiProfile> = {}): ApiProfile {
  const now = Date.now();
  return {
    ...p,
    ...overrides,
    id: makeId("api"),
    name: overrides.name ?? `${p.name} 副本`,
    createdAt: now,
    updatedAt: now,
  };
}

export const API_SETTINGS_STORAGE_KEY = "aicanvas_api_settings_v2";
export const API_SETTINGS_LEGACY_KEYS = ["aicanvas_api_settings"];

export function loadApiSettings(): ApiSettings {
  try {
    const raw = localStorage.getItem(API_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ApiSettings;
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0 && parsed.activeProfileId) {
        return migrateProfileFields(parsed);
      }
    }
    for (const key of API_SETTINGS_LEGACY_KEYS) {
      const rawLegacy = localStorage.getItem(key);
      if (!rawLegacy) continue;
      const parsedLegacy = JSON.parse(rawLegacy) as { baseUrl?: string; apiKey?: string; model?: string };
      if (parsedLegacy && (parsedLegacy.baseUrl || parsedLegacy.apiKey || parsedLegacy.model)) {
        const profile = makeDefaultProfile();
        if (parsedLegacy.baseUrl) profile.baseUrl = parsedLegacy.baseUrl;
        if (parsedLegacy.apiKey) profile.apiKey = parsedLegacy.apiKey;
        if (parsedLegacy.model) profile.model = parsedLegacy.model;
        profile.name = "导入的配置";
        return {
          profiles: [profile],
          activeProfileId: profile.id,
          autoTestOnSave: false,
        };
      }
    }
  } catch {
    // fall through
  }
  return makeDefaultSettings();
}

function migrateProfileFields(s: ApiSettings): ApiSettings {
  const profiles = s.profiles.map((p) => ({
    ...makeDefaultProfile(),
    ...p,
    id: p.id || makeId("api"),
  }));
  const stillActive = profiles.some((p) => p.id === s.activeProfileId);
  return {
    profiles,
    activeProfileId: stillActive ? s.activeProfileId : profiles[0].id,
    autoTestOnSave: !!s.autoTestOnSave,
  };
}

export function saveApiSettings(s: ApiSettings) {
  localStorage.setItem(API_SETTINGS_STORAGE_KEY, JSON.stringify(s));
}

export function getActiveProfile(s: ApiSettings): ApiProfile {
  return s.profiles.find((p) => p.id === s.activeProfileId) ?? s.profiles[0];
}

export function validateProfile(p: ApiProfile): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!p.name.trim()) issues.push("配置名称不能为空");
  if (!p.baseUrl.trim()) issues.push("Base URL 不能为空");
  try {
    const u = new URL(p.baseUrl);
    if (!/^https?:$/.test(u.protocol)) issues.push("Base URL 必须以 http/https 开头");
  } catch {
    issues.push("Base URL 格式无效");
  }
  if (!p.model.trim()) issues.push("模型名称不能为空");
  if (p.temperature < 0 || p.temperature > 2) issues.push("Temperature 应在 0 - 2 之间");
  if (p.maxTokens < 1 || p.maxTokens > 32768) issues.push("Max Tokens 应在 1 - 32768 之间");
  if (p.topP < 0 || p.topP > 1) issues.push("Top-P 应在 0 - 1 之间");
  if (p.timeout < 5 || p.timeout > 600) issues.push("超时应在 5 - 600 秒之间");
  return { ok: issues.length === 0, issues };
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
  models?: string[];
}

export async function testConnection(profile: ApiProfile, signal?: AbortSignal): Promise<TestConnectionResult> {
  if (!profile.baseUrl || !profile.model) {
    return { ok: false, message: "请先填写 Base URL 和模型" };
  }
  const start = performance.now();
  try {
    let url: string;
    const headers: Record<string, string> = {};
    if (profile.provider === "gemini") {
      url = `/api/gemini/proxy?action=models${profile.apiKey ? `&key=${encodeURIComponent(profile.apiKey)}` : ""}`;
    } else {
      const base = profile.baseUrl.replace(/\/+$/, "");
      url = `${base}/models`;
      if (profile.apiKey) headers["Authorization"] = `Bearer ${profile.apiKey}`;
    }
    const resp = await fetch(url, { method: "GET", headers, signal });
    const latencyMs = Math.round(performance.now() - start);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return { ok: false, message: `HTTP ${resp.status}: ${text || resp.statusText}`, latencyMs };
    }
    const data = await resp.json().catch(() => null);
    let models: string[] = [];
    if (data && Array.isArray((data as { data?: unknown[] }).data)) {
      models = ((data as { data: { id?: string }[] }).data)
        .map((m) => m.id)
        .filter((id): id is string => typeof id === "string");
    } else if (data && Array.isArray((data as { models?: unknown[] }).models)) {
      models = ((data as { models: { name?: string }[] }).models)
        .map((m) => m.name)
        .filter((id): id is string => typeof id === "string");
    }
    return {
      ok: true,
      message: models.length > 0 ? `连接成功,可用模型 ${models.length} 个` : "连接成功",
      latencyMs,
      models,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `请求失败:${message}` };
  }
}
