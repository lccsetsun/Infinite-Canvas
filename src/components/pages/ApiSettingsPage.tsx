import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Segmented,
  Slider,
  Space,
  Switch,
  Tabs,
  Tooltip,
  Modal,
} from "antd";
import type { TabsProps } from "antd";
import {
  AlertCircle,
  BookOpen,
  Bot,
  Boxes,
  Brain,
  Check,
  CheckCircle2,
  Cpu,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  Globe,
  HelpCircle,
  Key,
  Lightbulb,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Server,
  Settings2,
  Shield,
  Sliders,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";
import {
  ApiProvider,
  ApiProfile,
  ApiSettings,
  PROVIDER_ORDER,
  PROVIDER_PRESETS,
  ProviderPreset,
  cloneProfile,
  makeDefaultProfile,
  makeDefaultSettings,
  testConnection,
  validateProfile,
} from "../../features/api/apiSettings";

interface ApiSettingsPageProps {
  initial: ApiSettings;
  onSave: (settings: ApiSettings) => void;
  showNotice: (message: string, kind?: "info" | "success" | "warning" | "error") => void;
}

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }>;

const PROVIDER_ICON: Record<ApiProvider, IconComponent> = {
  openai: Sparkles,
  deepseek: Cpu,
  gemini: Brain,
  anthropic: Bot,
  moonshot: Lightbulb,
  zhipu: Zap,
  custom: Server,
};

const PROVIDER_ACCENT: Record<ApiProvider, string> = {
  openai: "from-emerald-500/20 to-teal-500/10 border-emerald-400/40 text-emerald-200",
  deepseek: "from-indigo-500/20 to-violet-500/10 border-indigo-400/40 text-indigo-200",
  gemini: "from-sky-500/20 to-blue-500/10 border-sky-400/40 text-sky-200",
  anthropic: "from-orange-500/20 to-amber-500/10 border-orange-400/40 text-orange-200",
  moonshot: "from-rose-500/20 to-pink-500/10 border-rose-400/40 text-rose-200",
  zhipu: "from-cyan-500/20 to-sky-500/10 border-cyan-400/40 text-cyan-200",
  custom: "from-slate-500/20 to-zinc-500/10 border-slate-400/40 text-slate-200",
};

const TEMPERATURE_PRESETS: { label: string; value: number; description: string }[] = [
  { label: "精确", value: 0.2, description: "代码、事实问答" },
  { label: "平衡", value: 0.7, description: "通用对话" },
  { label: "创意", value: 1.3, description: "故事、头脑风暴" },
];

function genId() {
  return `api_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function maskKey(key: string): string {
  if (!key) return "未设置";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

function detectKeyStrength(key: string, provider: ApiProvider): { level: "empty" | "weak" | "medium" | "strong"; label: string; color: string } {
  if (!key) return { level: "empty", label: "未设置", color: "text-gray-500" };
  if (provider === "gemini") {
    return key.startsWith("AIza") && key.length >= 30
      ? { level: "strong", label: "格式正确", color: "text-emerald-300" }
      : { level: "medium", label: "建议以 AIza 开头", color: "text-amber-300" };
  }
  if (provider === "anthropic") {
    return key.startsWith("sk-ant-")
      ? { level: "strong", label: "格式正确", color: "text-emerald-300" }
      : { level: "medium", label: "建议以 sk-ant- 开头", color: "text-amber-300" };
  }
  if (key.length < 20) return { level: "weak", label: "长度过短", color: "text-rose-300" };
  if (key.length < 40) return { level: "medium", label: "可用", color: "text-amber-300" };
  return { level: "strong", label: "长度充足", color: "text-emerald-300" };
}

export default function ApiSettingsPage({ initial, onSave, showNotice }: ApiSettingsPageProps) {
  const [settings, setSettings] = useState<ApiSettings>(() => initial ?? makeDefaultSettings());
  const [dirty, setDirty] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number; models?: string[] } | null>(null);
  const [validation, setValidation] = useState<{ ok: boolean; issues: string[] }>({ ok: true, issues: [] });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<string>("connection");

  const active = useMemo(
    () => settings.profiles.find((p) => p.id === settings.activeProfileId) ?? settings.profiles[0],
    [settings]
  );
  const preset = active ? PROVIDER_PRESETS[active.provider] : null;

  useEffect(() => {
    if (!active) return;
    setValidation(validateProfile(active));
  }, [active]);

  const updateActive = (patch: Partial<ApiProfile>) => {
    if (!active) return;
    setSettings((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) => (p.id === active.id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    }));
    setDirty(true);
    setTestResult(null);
  };

  const switchProvider = (provider: ApiProvider) => {
    if (!active) return;
    const next = PROVIDER_PRESETS[provider];
    const patch: Partial<ApiProfile> = { provider };
    if (provider !== "custom" && (!active.baseUrl || Object.values(PROVIDER_PRESETS).some((pp) => pp.baseUrl === active.baseUrl))) {
      patch.baseUrl = next.baseUrl;
    }
    if (
      provider !== "custom" &&
      (!active.model || ["deepseek-chat", "gemini-2.0-flash", "gpt-4o-mini", "claude-3-5-sonnet-latest", "moonshot-v1-8k", "glm-4-flash"].includes(active.model))
    ) {
      patch.model = next.defaultModel;
    }
    updateActive(patch);
  };

  const handleNew = () => {
    const profile = makeDefaultProfile();
    profile.name = `配置 ${settings.profiles.length + 1}`;
    setSettings((prev) => ({ ...prev, profiles: [...prev.profiles, profile], activeProfileId: profile.id }));
    setDirty(true);
    setTestResult(null);
  };

  const handleDuplicate = () => {
    if (!active) return;
    const copy = cloneProfile(active, { name: `${active.name} 副本` });
    setSettings((prev) => ({ ...prev, profiles: [...prev.profiles, copy], activeProfileId: copy.id }));
    setDirty(true);
    setTestResult(null);
  };

  const handleDelete = () => {
    if (settings.profiles.length <= 1) {
      showNotice("至少需要保留一个配置", "warning");
      return;
    }
    if (!active) return;
    Modal.confirm({
      title: `删除配置「${active.name}」?`,
      content: "此操作不可撤销。如需保留请先导出。",
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        setSettings((prev) => {
          const remaining = prev.profiles.filter((p) => p.id !== active.id);
          return { ...prev, profiles: remaining, activeProfileId: remaining[0]?.id ?? "" };
        });
        setDirty(true);
        setTestResult(null);
        showNotice(`已删除「${active.name}」`, "info");
      },
    });
  };

  const handleReset = () => {
    Modal.confirm({
      title: "恢复默认设置?",
      content: "所有自定义配置将被清空,无法恢复。建议先导出当前配置。",
      okText: "恢复",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        const fresh = makeDefaultSettings();
        setSettings(fresh);
        setDirty(true);
        setTestResult(null);
        showNotice("已恢复为默认配置(尚未保存,请点击保存)", "info");
      },
    });
  };

  const handleSave = () => {
    if (!validation.ok) {
      showNotice(`配置有误:${validation.issues.join("; ")}`, "error");
      return;
    }
    onSave(settings);
    setDirty(false);
    showNotice("API 设置已保存", "success");
  };

  const handleTest = async () => {
    if (!active) return;
    if (!active.baseUrl || !active.model) {
      showNotice("请先填写 Base URL 和模型", "warning");
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await testConnection(active);
    setTesting(false);
    setTestResult(result);
    if (result.ok) {
      showNotice(`${result.message}${result.latencyMs ? ` · ${result.latencyMs}ms` : ""}`, "success");
    } else {
      showNotice(result.message, "error");
    }
  };

  const handleExport = () => {
    const json = JSON.stringify(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        settings: { ...settings, profiles: settings.profiles.map((p) => ({ ...p, apiKey: "" })) },
      },
      null,
      2
    );
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(json)
        .then(() => showNotice("配置(密钥已脱敏)已复制到剪贴板", "success"))
        .catch(() => fallbackDownload(json));
    } else {
      fallbackDownload(json);
    }
  };

  const fallbackDownload = (json: string) => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => fileInputRef.current?.click();

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming: ApiSettings | null =
        parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0
          ? (parsed as { settings?: ApiSettings }).settings ?? (parsed as ApiSettings)
          : null;
      if (!incoming) {
        showNotice("文件格式无效:缺少 profiles 字段", "error");
        return;
      }
      const profiles = incoming.profiles.map((p) => ({
        ...makeDefaultProfile(),
        ...p,
        id: p.id || genId(),
        apiKey: typeof p.apiKey === "string" ? p.apiKey : "",
      }));
      const next: ApiSettings = {
        profiles,
        activeProfileId: profiles.some((p) => p.id === incoming.activeProfileId)
          ? incoming.activeProfileId
          : profiles[0].id,
        autoTestOnSave: !!incoming.autoTestOnSave,
      };
      setSettings(next);
      setDirty(true);
      setTestResult(null);
      showNotice(`已导入 ${profiles.length} 个配置`, "success");
    } catch (err) {
      showNotice(`导入失败:${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  if (!active || !preset) {
    return (
      <PageShell>
        <EmptyState />
      </PageShell>
    );
  }

  const tabs: TabsProps["items"] = [
    {
      key: "connection",
      label: (
        <span className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" />
          连接
        </span>
      ),
      children: <ConnectionTab active={active} preset={preset} onChange={updateActive} showKey={showKey} setShowKey={setShowKey} onSwitchProvider={switchProvider} />,
    },
    {
      key: "parameters",
      label: (
        <span className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" />
          参数
        </span>
      ),
      children: <ParametersTab active={active} onChange={updateActive} />,
    },
    {
      key: "prompt",
      label: (
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          提示词
        </span>
      ),
      children: <PromptTab active={active} onChange={updateActive} />,
    },
    {
      key: "test",
      label: (
        <span className="flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5" />
          测试
          {testResult && (
            <span
              className={`ml-1 w-1.5 h-1.5 rounded-full ${
                testResult.ok ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
          )}
        </span>
      ),
      children: (
        <TestTab
          active={active}
          testing={testing}
          result={testResult}
          onTest={handleTest}
          settings={settings}
          onSwitchModel={(model) => updateActive({ model })}
          onChangeSettings={(patch) => {
            setSettings((prev) => ({ ...prev, ...patch }));
            setDirty(true);
          }}
        />
      ),
    },
  ];

  return (
    <PageShell>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onFileChange} />

      <Header
        active={active}
        dirty={dirty}
        onImport={handleImport}
        onExport={handleExport}
        onReset={handleReset}
      />

      <div className="flex-1 overflow-y-auto" data-canvas-passthrough="true">
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-6 space-y-5">
          <ProfileManager
            profiles={settings.profiles}
            activeId={settings.activeProfileId}
            onSwitch={(id) => {
              setSettings((prev) => ({ ...prev, activeProfileId: id }));
              setDirty(true);
              setTestResult(null);
            }}
            onNew={handleNew}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden"
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabs}
              className="api-settings-tabs"
              tabBarStyle={{
                margin: 0,
                padding: "0 8px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(255,255,255,0.015)",
              }}
            />
          </motion.div>

          <AnimatePresence>
            {!validation.ok && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                <Alert
                  type="error"
                  showIcon
                  icon={<AlertCircle className="w-4 h-4" />}
                  message="配置存在问题"
                  description={
                    <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
                      {validation.issues.map((iss) => (
                        <li key={iss}>{iss}</li>
                      ))}
                    </ul>
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-2" />
        </div>
      </div>

      <Footer
        profileCount={settings.profiles.length}
        activeName={active.name}
        testing={testing}
        valid={validation.ok}
        dirty={dirty}
        onTest={handleTest}
        onSave={handleSave}
      />
    </PageShell>
  );
}

/* ----------------------------- Page Shell ----------------------------- */

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-[#0f1218]"
      data-canvas-passthrough="true"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <style>{`
        .api-settings-tabs .ant-tabs-nav { 
          margin-bottom: 0 !important; 
          border-bottom: 1px solid rgba(255,255,255,0.06) !important;
          background: rgba(0,0,0,0.2);
        }
        .api-settings-tabs .ant-tabs-tab { 
          padding: 14px 20px !important; 
          margin: 0 !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .api-settings-tabs .ant-tabs-tab:hover {
          color: #818cf8 !important;
        }
        .api-settings-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #a5b4fc !important;
          font-weight: 600 !important;
        }
        .api-settings-tabs .ant-tabs-content-holder { 
          padding: 0; 
        }
        .api-settings-tabs .ant-tabs-ink-bar { 
          background: linear-gradient(90deg, #6366f1, #818cf8) !important; 
          height: 3px !important; 
          border-radius: 3px 3px 0 0;
        }
        .api-settings-scroll { 
          scrollbar-width: thin; 
          scrollbar-color: rgba(255,255,255,0.08) transparent; 
        }
        .api-settings-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .api-settings-scroll::-webkit-scrollbar-track { background: transparent; }
        .api-settings-scroll::-webkit-scrollbar-thumb { 
          background: rgba(255,255,255,0.08); 
          border-radius: 10px; 
        }
        .api-settings-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
      {children}
    </section>
  );
}

/* ----------------------------- Header ----------------------------- */

function Header({
  active,
  dirty,
  onImport,
  onExport,
  onReset,
}: {
  active: ApiProfile;
  dirty: boolean;
  onImport: () => void;
  onExport: () => void;
  onReset: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-400/20 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/5">
            <Key className="w-5 h-5 text-indigo-300" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-white tracking-tight leading-none truncate">API 设置</h1>
              <SaveBadge dirty={dirty} />
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5 font-medium tracking-wide uppercase leading-none truncate">
              管理 LLM 服务端点、密钥与调用参数 · <span className="text-indigo-300/80">{active.name}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip title="从 JSON 文件导入配置" placement="bottom">
            <Button 
              icon={<Upload className="w-3.5 h-3.5" />} 
              onClick={onImport} 
              className="bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
            >
              导入
            </Button>
          </Tooltip>
          <Tooltip title="导出当前配置(密钥自动脱敏)" placement="bottom">
            <Button 
              icon={<Download className="w-3.5 h-3.5" />} 
              onClick={onExport}
              className="bg-white/5 border-white/10 hover:bg-white/10 text-gray-300"
            >
              导出
            </Button>
          </Tooltip>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <Tooltip title="恢复为默认配置" placement="bottom">
            <Button 
              icon={<RotateCcw className="w-3.5 h-3.5" />} 
              onClick={onReset}
              className="bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10 text-rose-300"
            >
              恢复默认
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function SaveBadge({ dirty }: { dirty: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border font-semibold tracking-wider uppercase transition-all duration-300 ${
        dirty
          ? "border-amber-500/30 text-amber-300 bg-amber-500/10 shadow-sm shadow-amber-500/5"
          : "border-emerald-500/30 text-emerald-300 bg-emerald-500/10 shadow-sm shadow-emerald-500/5"
      }`}
    >
      {dirty ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          未保存
        </>
      ) : (
        <>
          <Check className="w-2.5 h-2.5" />
          已同步
        </>
      )}
    </span>
  );
}

/* ----------------------------- Footer ----------------------------- */

function Footer({
  profileCount,
  activeName,
  testing,
  valid,
  dirty,
  onTest,
  onSave,
}: {
  profileCount: number;
  activeName: string;
  testing: boolean;
  valid: boolean;
  dirty: boolean;
  onTest: () => void;
  onSave: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-white/5 bg-black/60 backdrop-blur-xl">
      <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-[11px] font-medium text-gray-500">
          <span className="inline-flex items-center gap-2 py-1 px-2 rounded-lg bg-white/5 border border-white/5">
            <Boxes className="w-3.5 h-3.5 text-indigo-400/80" />
            <span className="text-gray-300">{profileCount}</span> 套配置
          </span>
          <div className="w-px h-3 bg-white/10" />
          <span className="flex items-center gap-2">
            当前激活: <span className="text-indigo-300 font-semibold">{activeName}</span>
          </span>
          {dirty && (
            <span className="inline-flex items-center gap-1.5 text-amber-400 animate-in fade-in slide-in-from-left-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              更改待保存
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={<FlaskConical className="w-3.5 h-3.5" />}
            onClick={onTest}
            loading={testing}
            disabled={!valid}
            className="h-9 px-4 border-white/10 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors"
          >
            测试连接
          </Button>
          <Button
            type="primary"
            icon={<Check className="w-3.5 h-3.5" />}
            onClick={onSave}
            disabled={!valid}
            className="h-9 px-5 bg-indigo-600 hover:bg-indigo-500 border-none shadow-lg shadow-indigo-600/20"
          >
            保存设置
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Empty State ----------------------------- */

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Empty
        image={
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
            <Key className="w-7 h-7 text-gray-500" strokeWidth={1.5} />
          </div>
        }
        description={
          <span className="text-gray-400 text-sm">没有可用的 API 配置。请新建一个开始使用。</span>
        }
      />
    </div>
  );
}

/* ----------------------------- Profile Manager ----------------------------- */

function ProfileManager({
  profiles,
  activeId,
  onSwitch,
  onNew,
  onDuplicate,
  onDelete,
}: {
  profiles: ApiProfile[];
  activeId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <Boxes className="w-3.5 h-3.5 text-indigo-400" />
          配置方案
          <span className="text-[10px] text-gray-600 font-normal">({profiles.length})</span>
        </span>
        <Tooltip title="点击新建配置方案" placement="top">
          <Button
            type="text"
            size="small"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={onNew}
            className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
          >
            新建方案
          </Button>
        </Tooltip>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {profiles.map((p) => {
          const isActive = p.id === activeId;
          const Icon = PROVIDER_ICON[p.provider] || Server;
          return (
            <div
              key={p.id}
              onClick={() => onSwitch(p.id)}
              className={`group relative flex flex-col p-4 rounded-2xl cursor-pointer transition-all duration-300 border ${
                isActive
                  ? "bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20"
                  : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? "bg-indigo-500/20 text-indigo-300 scale-105"
                      : "bg-white/5 text-gray-500 group-hover:text-gray-300"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <div className={`flex items-center gap-1 transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0"}`}>
                  <Tooltip title="复制">
                    <Button
                      type="text"
                      size="small"
                      icon={<Copy className="w-3.5 h-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate();
                      }}
                      className="text-gray-500 hover:text-indigo-300 hover:bg-indigo-500/10"
                    />
                  </Tooltip>
                  {profiles.length > 1 && (
                    <Tooltip title="删除">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                        }}
                        className="text-gray-500 hover:text-rose-400 hover:bg-rose-500/10"
                      />
                    </Tooltip>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-bold truncate ${isActive ? "text-white" : "text-gray-300 group-hover:text-white"}`}>
                  {p.name}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    isActive ? "bg-indigo-500/20 text-indigo-300" : "bg-white/5 text-gray-500"
                  }`}>
                    {PROVIDER_PRESETS[p.provider].label}
                  </span>
                  <span className="text-[10px] text-gray-600 truncate">{p.model}</span>
                </div>
              </div>
              {isActive && (
                <div className="absolute top-2 right-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ title, extra, children, className = "" }: { title: React.ReactNode; extra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04] bg-white/[0.01]">
        <div className="text-sm font-bold text-gray-200 tracking-wide uppercase">{title}</div>
        {extra && <div className="flex items-center">{extra}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ----------------------------- Connection Tab ----------------------------- */

function ConnectionTab({
  active,
  preset,
  onChange,
  showKey,
  setShowKey,
  onSwitchProvider,
}: {
  active: ApiProfile;
  preset: ProviderPreset;
  onChange: (patch: Partial<ApiProfile>) => void;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  onSwitchProvider: (provider: ApiProvider) => void;
}) {
  const strength = detectKeyStrength(active.apiKey, active.provider);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">服务提供商</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {(Object.entries(PROVIDER_PRESETS) as [ApiProvider, ProviderPreset][]).map(
            ([key, p]) => {
              const Icon = PROVIDER_ICON[key] || Server;
              const isSelected = active.provider === key;
              return (
                <button
                  key={key}
                  onClick={() => onSwitchProvider(key)}
                  className={`flex flex-col items-center gap-2.5 p-3 rounded-2xl transition-all duration-300 border ${
                    isSelected
                      ? "bg-indigo-500/15 border-indigo-500/40 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20"
                      : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04] text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isSelected ? "text-indigo-300" : ""}`} strokeWidth={isSelected ? 2.5 : 2} />
                  <span className={`text-[10px] font-bold tracking-tight ${isSelected ? "text-white" : ""}`}>
                    {p.label}
                  </span>
                </button>
              );
            }
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Field
            label={
              <span className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                API 接口地址
                <span className="text-rose-500">*</span>
              </span>
            }
            hint={
              preset.docsUrl ? (
                <a
                  href={preset.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-indigo-300/80 hover:text-indigo-300 transition-colors font-medium"
                >
                  {PROVIDER_PRESETS[active.provider].label} 官方文档
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <span className="text-gray-500">{preset.description}</span>
              )
            }
          >
            <Input
              value={active.baseUrl}
              onChange={(e) => onChange({ baseUrl: e.target.value })}
              placeholder={preset.baseUrl || "https://api.example.com/v1"}
              className="h-10 bg-white/[0.03] border-white/10 hover:border-indigo-500/40 focus:border-indigo-500/60 font-mono text-sm rounded-xl"
            />
          </Field>

          <Field
            label={
              <span className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                API 访问密钥
                <span className="text-rose-500">*</span>
              </span>
            }
            hint={
              <span className="flex items-center gap-1.5 text-gray-500">
                <Shield className="w-3.5 h-3.5" />
                本地加密存储 · 
                {active.apiKey && (
                  <span className={`font-bold ${strength.color} uppercase tracking-tighter ml-1`}>
                    {strength.label}
                  </span>
                )}
              </span>
            }
          >
            <Input.Password
              value={active.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              visibilityToggle={{ visible: showKey, onVisibleChange: setShowKey }}
              placeholder={preset.keyHint || "sk-..."}
              className="h-10 bg-white/[0.03] border-white/10 hover:border-indigo-500/40 focus:border-indigo-500/60 font-mono text-sm rounded-xl"
            />
          </Field>
        </div>

        <div className="space-y-6">
          <Field
            label={
              <span className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                模型名称
                <span className="text-rose-500">*</span>
              </span>
            }
            hint="指定调用的具体模型 ID"
          >
            <Input
              value={active.model}
              onChange={(e) => onChange({ model: e.target.value })}
              placeholder={preset.defaultModel || "gpt-4"}
              className="h-10 bg-white/[0.03] border-white/10 hover:border-indigo-500/40 focus:border-indigo-500/60 font-mono text-sm rounded-xl"
              list={`models-${active.id}`}
            />
            <datalist id={`models-${active.id}`}>
              {preset.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {preset.models.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {preset.models.map((m) => (
                  <button
                    key={m}
                    onClick={() => onChange({ model: m })}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all duration-200 uppercase tracking-wider ${
                      active.model === m
                        ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-200 shadow-sm shadow-indigo-500/10"
                        : "border-white/5 bg-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field
            label={
              <span className="flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                配置名称
              </span>
            }
            hint="为这套配置起个好记的名字"
          >
            <Input
              value={active.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="例如: 生产环境 / 个人测试"
              className="h-10 bg-white/[0.03] border-white/10 hover:border-indigo-500/40 focus:border-indigo-500/60 text-sm rounded-xl"
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

function ProviderGrid({ value, onChange }: { value: ApiProvider; onChange: (p: ApiProvider) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {PROVIDER_ORDER.map((p) => {
        const preset = PROVIDER_PRESETS[p];
        const Icon = PROVIDER_ICON[p];
        const active = value === p;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`group relative text-left p-3 rounded-xl border transition ${
              active
                ? `bg-gradient-to-br ${PROVIDER_ACCENT[p]} border-current/40`
                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Icon className={`w-4 h-4 ${active ? "" : "text-gray-400 group-hover:text-gray-200"}`} />
              {active && <Check className="w-3.5 h-3.5 text-current" />}
            </div>
            <div className={`text-sm font-medium ${active ? "text-white" : "text-gray-200"}`}>
              {preset.label}
            </div>
            <div className={`text-[10px] mt-0.5 line-clamp-1 ${active ? "text-current/80" : "text-gray-500"}`}>
              {preset.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------- Parameters Tab ----------------------------- */

function ParametersTab({ active, onChange }: { active: ApiProfile; onChange: (patch: Partial<ApiProfile>) => void }) {
  return (
    <div className="space-y-10 animate-in fade-in duration-500 p-2">
      <section className="space-y-6">
        <Field
          label={
            <span className="flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-indigo-400" />
              生成随机度 (Temperature)
              <span className="text-indigo-300 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md text-xs">
                {active.temperature.toFixed(2)}
              </span>
            </span>
          }
          hint="控制响应内容的随机性。值越高内容越发散、有创意；越低内容越严谨、确定性强。"
        >
          <div className="px-2 pt-2 pb-8">
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={active.temperature}
              onChange={(v) => onChange({ temperature: v as number })}
              tooltip={{ formatter: (v) => `Temp: ${v}` }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TEMPERATURE_PRESETS.map((p) => {
              const isSelected = Math.abs(active.temperature - p.value) < 0.025;
              return (
                <button
                  key={p.label}
                  onClick={() => onChange({ temperature: p.value })}
                  className={`flex flex-col p-3 rounded-xl border transition-all duration-300 text-left ${
                    isSelected
                      ? "border-indigo-500/40 bg-indigo-500/10 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isSelected ? "text-indigo-200" : "text-gray-300"}`}>
                      {p.label}
                    </span>
                    <span className={`text-[10px] font-mono ${isSelected ? "text-indigo-400" : "text-gray-500"}`}>
                      {p.value.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 leading-relaxed">{p.description}</span>
                </button>
              );
            })}
          </div>
        </Field>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Field
          label={
            <span className="flex items-center gap-2.5">
              <Settings2 className="w-4 h-4 text-indigo-400" />
              最大长度 (Max Tokens)
            </span>
          }
          hint="单次响应允许生成的最大 token 数量。1k tokens 约等于 750 个英文单词。"
        >
          <div className="relative group">
            <InputNumber
              value={active.maxTokens}
              onChange={(v) => onChange({ maxTokens: Math.max(1, Math.min(32768, Number(v) || 0)) })}
              min={1}
              max={32768}
              step={64}
              className="w-full h-10 bg-white/[0.03] border-white/10 hover:border-indigo-500/40 focus:border-indigo-500/60 font-mono text-sm rounded-xl overflow-hidden"
              controls={false}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none group-hover:text-indigo-400 transition-colors">
              Tokens
            </div>
          </div>
        </Field>

        <Field
          label={
            <span className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-indigo-400" />
              采样阈值 (Top-P)
            </span>
          }
          hint="核采样 (Nucleus Sampling) 阈值。通常建议与 Temperature 二选一调节。"
        >
          <div className="relative group">
            <InputNumber
              value={active.topP}
              onChange={(v) => onChange({ topP: Math.max(0, Math.min(1, Number(v) || 0)) })}
              min={0}
              max={1}
              step={0.05}
              className="w-full h-10 bg-white/[0.03] border-white/10 hover:border-indigo-500/40 focus:border-indigo-500/60 font-mono text-sm rounded-xl overflow-hidden"
              controls={false}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none group-hover:text-indigo-400 transition-colors">
              P-Value
            </div>
          </div>
        </Field>

        <Field
          label={
            <span className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              超时设置 (Timeout)
            </span>
          }
          hint="网络请求的最大等待时间(秒)。"
        >
          <div className="relative group">
            <InputNumber
              value={active.timeout}
              onChange={(v) => onChange({ timeout: Math.max(1, Number(v) || 0) })}
              min={1}
              className="w-full h-10 bg-white/[0.03] border-white/10 hover:border-indigo-500/40 focus:border-indigo-500/60 font-mono text-sm rounded-xl overflow-hidden"
              controls={false}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 uppercase tracking-widest pointer-events-none group-hover:text-indigo-400 transition-colors">
              Seconds
            </div>
          </div>
        </Field>

        <Field
          label={
            <span className="flex items-center gap-2.5">
              <Wifi className="w-4 h-4 text-indigo-400" />
              网络增强 (System Proxy)
            </span>
          }
          hint="启用系统代理加速 API 访问 (需部署环境支持)。"
        >
          <div className="flex items-center justify-between h-10 px-4 bg-white/[0.02] border border-white/5 rounded-xl transition-colors hover:border-white/10">
            <span className={`text-xs font-bold uppercase tracking-wider ${active.useSystemProxy ? "text-indigo-300" : "text-gray-500"}`}>
              {active.useSystemProxy ? "已启用" : "已禁用"}
            </span>
            <Switch 
              checked={active.useSystemProxy} 
              onChange={(v) => onChange({ useSystemProxy: v })} 
              className={active.useSystemProxy ? "bg-indigo-600" : "bg-white/10"}
            />
          </div>
        </Field>
      </section>

      <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <HelpCircle className="w-4 h-4 text-indigo-300" />
        </div>
        <div className="space-y-1">
          <h5 className="text-xs font-bold text-indigo-200 uppercase tracking-tight">调优小贴士</h5>
          <ul className="text-[11px] leading-relaxed text-gray-400 space-y-1 list-disc list-inside">
            <li>Temperature 与 Top-P 通常只调节其中一个即可，建议保持默认或小幅微调。</li>
            <li>Max Tokens 设置过小可能导致回复被强行截断，设置过大则可能导致 Token 消耗过快。</li>
            <li>部分服务商(如 Gemini)在特定模式下可能会忽略这些参数。</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Prompt Tab ----------------------------- */

function PromptTab({ active, onChange }: { active: ApiProfile; onChange: (patch: Partial<ApiProfile>) => void }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 p-2">
      <Field
        label={
          <span className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            全局系统提示词 (System Prompt)
          </span>
        }
        hint="这些指令将作为 System 角色发送给 AI。留空则使用默认预设。单节点可以单独覆盖此设置。"
      >
        <div className="relative group">
          <Input.TextArea
            value={active.systemPrompt}
            onChange={(e) => onChange({ systemPrompt: e.target.value })}
            placeholder="例如: 你是一个专业的助手,回答应简洁、准确..."
            autoSize={{ minRows: 8, maxRows: 16 }}
            maxLength={4000}
            showCount
            className="bg-white/[0.03] border-white/10 hover:border-indigo-500/40 focus:border-indigo-500/60 text-sm rounded-2xl p-4 transition-all"
          />
        </div>
      </Field>

      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">快速加载预设</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "专业助手", icon: Sparkles, value: "你是一个专业的助手,回答应简洁、准确、有条理。" },
            { label: "代码专家", icon: Cpu, value: "你是一名资深工程师。回答代码问题时,请给出可运行的示例并解释关键点。" },
            { label: "翻译官", icon: Globe, value: "你是一位中英文互译专家。保持原意、语气与专业术语一致,输出地道自然。" },
            { label: "创意写手", icon: Lightbulb, value: "你是一位富有想象力的作家。用生动的语言、新颖的视角完成创意任务。" },
          ].map((tpl) => {
            const Icon = tpl.icon;
            return (
              <button
                key={tpl.label}
                onClick={() => onChange({ systemPrompt: tpl.value })}
                className="group flex flex-col p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all duration-300 text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center mb-3 transition-colors">
                  <Icon className="w-4 h-4 text-gray-500 group-hover:text-indigo-300" />
                </div>
                <div className="text-xs font-bold text-gray-200 group-hover:text-white mb-1.5 transition-colors">{tpl.label}</div>
                <div className="text-[10px] text-gray-500 group-hover:text-gray-400 leading-relaxed line-clamp-3 transition-colors">{tpl.value}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Test Tab ----------------------------- */

function TestTab({
  active,
  testing,
  result,
  onTest,
  settings,
  onSwitchModel,
  onChangeSettings,
}: {
  active: ApiProfile;
  testing: boolean;
  result: { ok: boolean; message: string; latencyMs?: number; models?: string[] } | null;
  onTest: () => void;
  settings: ApiSettings;
  onSwitchModel: (model: string) => void;
  onChangeSettings: (patch: Partial<ApiSettings>) => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-2">
      <div className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-white/[0.02] shadow-inner shadow-black/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-200">连通性测试</div>
            <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-tight font-medium">
              验证 Base URL 与 API Key 是否可用
            </div>
          </div>
        </div>
        <Button
          type="primary"
          icon={<RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />}
          onClick={onTest}
          loading={testing}
          className="h-10 px-6 bg-cyan-600 hover:bg-cyan-500 border-none shadow-lg shadow-cyan-600/20 font-bold"
        >
          {testing ? "测试中..." : "开始测试"}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {testing ? (
          <motion.div
            key="testing"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="p-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 text-center"
          >
            <div className="relative w-12 h-12 mx-auto mb-4">
              <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin opacity-20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-cyan-400/20 animate-pulse" />
              </div>
            </div>
            <div className="text-sm font-bold text-cyan-100">正在发送请求...</div>
            <div className="text-[11px] text-cyan-300/60 mt-2 font-mono truncate max-w-md mx-auto">
              POST {active.baseUrl}
            </div>
          </motion.div>
        ) : result ? (
          <motion.div
            key={result.ok ? "ok" : "fail"}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-6 rounded-2xl border transition-all duration-500 ${
              result.ok
                ? "border-emerald-500/30 bg-emerald-500/5 shadow-lg shadow-emerald-500/5"
                : "border-rose-500/30 bg-rose-500/5 shadow-lg shadow-rose-500/5"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                result.ok ? "bg-emerald-500/20" : "bg-rose-500/20"
              }`}>
                {result.ok ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className={`text-base font-bold ${result.ok ? "text-emerald-100" : "text-rose-100"}`}>
                    {result.ok ? "验证成功" : "验证失败"}
                  </div>
                  {result.latencyMs !== undefined && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/20 border border-white/5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <Timer className="w-3 h-3 text-indigo-400" />
                      延迟: <span className="text-emerald-300 font-mono">{result.latencyMs}ms</span>
                    </div>
                  )}
                </div>
                <div className={`text-xs mt-2 leading-relaxed ${result.ok ? "text-emerald-200/70" : "text-rose-200/70"}`}>
                  {result.message}
                </div>
                
                {result.models && result.models.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-white/5">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        可用模型清单 ({result.models.length})
                      </div>
                      <div className="text-[10px] text-gray-600 italic">点击标签可快速切换</div>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto api-settings-scroll pr-2">
                      {result.models.slice(0, 100).map((m) => {
                        const isCurrent = active.model === m;
                        return (
                          <button
                            key={m}
                            onClick={() => onSwitchModel(m)}
                            className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all duration-200 font-mono ${
                              isCurrent
                                ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-100 shadow-sm shadow-indigo-500/10 ring-1 ring-indigo-500/20"
                                : "border-white/5 bg-white/5 text-gray-400 hover:text-gray-200 hover:border-white/10 hover:bg-white/10"
                            }`}
                          >
                            {m}
                          </button>
                        );
                      })}
                      {result.models.length > 100 && (
                        <div className="text-[10px] text-gray-500 font-medium py-1.5 px-2">
                          + 更多 {result.models.length - 100} 个模型...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-10 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-center"
          >
            <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
              <FlaskConical className="w-8 h-8 text-gray-600" />
            </div>
            <div className="text-sm font-bold text-gray-400">准备就绪</div>
            <div className="text-[11px] text-gray-600 mt-2 max-w-[200px] mx-auto leading-relaxed">
              点击上方按钮开始测试配置的连通性。测试过程不会保存任何敏感信息。
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-black/20 hover:bg-black/30 transition-colors duration-300">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Power className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-200">保存时自动校验</div>
            <div className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-tighter font-medium">
              每次保存设置时自动执行一次连通性测试
            </div>
          </div>
        </div>
        <Switch
          checked={settings.autoTestOnSave}
          onChange={(v) => onChangeSettings({ autoTestOnSave: v })}
          className={settings.autoTestOnSave ? "bg-amber-600" : "bg-white/10"}
        />
      </div>
    </div>
  );
}

/* ----------------------------- Field ----------------------------- */

function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-1 px-1">
        <div className="text-[11px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
          {label}
        </div>
        {hint && <div className="text-[10px] text-gray-500 font-medium leading-relaxed">{hint}</div>}
      </div>
      <div className="relative">
        {children}
      </div>
    </div>
  );
}
