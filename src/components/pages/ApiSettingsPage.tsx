import { ArrowLeft } from "lucide-react";

interface ApiSettingsPageProps {
  apiBaseUrl: string;
  apiKey: string;
  apiModel: string;
  setApiBaseUrl: (value: string) => void;
  setApiKey: (value: string) => void;
  setApiModel: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
}

export default function ApiSettingsPage({
  apiBaseUrl,
  apiKey,
  apiModel,
  setApiBaseUrl,
  setApiKey,
  setApiModel,
  onBack,
  onSave,
}: ApiSettingsPageProps) {
  return (
    <section className="absolute inset-0 z-50 bg-[#0f1218]/97 backdrop-blur-sm pl-28 pr-8 py-8" onPointerDown={(e) => e.stopPropagation()}>
      <div className="max-w-[760px] mx-auto mt-8 rounded-2xl border border-[#2b3142] bg-[#121723]/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="text-xl font-semibold text-white">API 设置</div>
          <button onClick={onBack} className="px-3 py-1.5 rounded-lg border border-[#2f3a54] bg-[#1a2235] text-sm inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> 返回画布
          </button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <div className="text-xs text-gray-300 mb-1">Base URL</div>
            <input value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} className="w-full bg-[#111215] border border-[#303443] rounded px-3 py-2 text-sm" placeholder="https://api.openai.com/v1" />
          </label>
          <label className="block">
            <div className="text-xs text-gray-300 mb-1">API Key</div>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" className="w-full bg-[#111215] border border-[#303443] rounded px-3 py-2 text-sm" placeholder="sk-..." />
          </label>
          <label className="block">
            <div className="text-xs text-gray-300 mb-1">Model</div>
            <input value={apiModel} onChange={(e) => setApiModel(e.target.value)} className="w-full bg-[#111215] border border-[#303443] rounded px-3 py-2 text-sm" placeholder="gpt-4.1-mini" />
          </label>
          <button onClick={onSave} className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold">
            保存设置
          </button>
        </div>
      </div>
    </section>
  );
}
