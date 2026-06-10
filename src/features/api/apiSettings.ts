export type ApiProvider =
  | "deepseek"
  | "minimax";

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
  deepseek: {
    label: "DeepSeek",
    description: "深度求索,高性价比中文模型",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    keyHint: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  minimax: {
    label: "MiniMax",
    description: "MiniMax 图像、视频与音频生成能力",
    baseUrl: "https://api.minimaxi.com/v1",
    models: ["image-01", "MiniMax-M3", "MiniMax-Hailuo-2.3", "speech-2.8-hd"],
    defaultModel: "image-01",
    keyHint: "MiniMax API Key",
    docsUrl: "https://platform.minimax.io/docs/api-reference/speech-t2a-http",
  },
};

export const PROVIDER_ORDER: ApiProvider[] = [
  "deepseek",
  "minimax",
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

function makeProviderProfile(provider: ApiProvider): ApiProfile {
  const preset = PROVIDER_PRESETS[provider];
  const now = Date.now();
  return {
    ...makeDefaultProfile(),
    id: makeId("api"),
    name: preset.label,
    provider,
    baseUrl: preset.baseUrl,
    apiKey: "",
    model: preset.defaultModel,
    createdAt: now,
    updatedAt: now,
  };
}

export function makeDefaultSettings(): ApiSettings {
  const profile = makeDefaultProfile();
  const minimaxProfile = makeProviderProfile("minimax");
  return {
    profiles: [profile, minimaxProfile],
    activeProfileId: profile.id,
    autoTestOnSave: false,
  };
}

export const API_SETTINGS_STORAGE_KEY = "aicanvas_api_settings_v2";
const API_SETTINGS_LEGACY_KEYS = ["aicanvas_api_settings"];

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
  const profiles = s.profiles
    .filter((p) => p.provider === "deepseek" || p.provider === "minimax")
    .map((p) => {
      const preset = PROVIDER_PRESETS[p.provider];
      const shouldUsePresetBaseUrl = p.provider === "minimax" && (!p.baseUrl || p.baseUrl.includes("api.minimax.io"));
      const shouldMigrateDeepSeekModel = p.provider === "deepseek" && (!p.model || p.model === "deepseek-v4-flash");
      return {
        ...makeDefaultProfile(),
        ...p,
        provider: p.provider,
        baseUrl: shouldUsePresetBaseUrl ? preset.baseUrl : p.baseUrl,
        model: shouldMigrateDeepSeekModel ? preset.defaultModel : p.model || preset.defaultModel,
        id: p.id || makeId("api"),
      };
    });
  if (!profiles.some((p) => p.provider === "deepseek")) profiles.push(makeProviderProfile("deepseek"));
  if (!profiles.some((p) => p.provider === "minimax")) profiles.push(makeProviderProfile("minimax"));
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

export function getProviderProfile(s: ApiSettings, provider: ApiProvider): ApiProfile | undefined {
  return s.profiles.find((p) => p.provider === provider && p.apiKey.trim()) ?? s.profiles.find((p) => p.provider === provider);
}

export function selectProviderProfile(s: ApiSettings, provider: ApiProvider): ApiSettings {
  const existing = s.profiles.find((profile) => profile.provider === provider);
  if (existing) return { ...s, activeProfileId: existing.id };
  const profile = makeProviderProfile(provider);
  return {
    ...s,
    profiles: [...s.profiles, profile],
    activeProfileId: profile.id,
  };
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
    if (profile.provider === "minimax") {
      if (!profile.apiKey.trim()) {
        return { ok: false, message: "请先填写 MiniMax API Key" };
      }
      return {
        ok: true,
        message: "MiniMax 配置已保存，图片/视频节点运行时会通过本地代理验证密钥",
        latencyMs: Math.round(performance.now() - start),
        models: PROVIDER_PRESETS.minimax.models,
      };
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
