import { ArrowLeft } from "lucide-react";

interface WorkflowSettingsPageProps {
  workflowName: string;
  autoSaveWorkflow: boolean;
  setWorkflowName: (value: string) => void;
  setAutoSaveWorkflow: (value: boolean) => void;
  onBack: () => void;
  onSave: () => void;
}

export default function WorkflowSettingsPage({
  workflowName,
  autoSaveWorkflow,
  setWorkflowName,
  setAutoSaveWorkflow,
  onBack,
  onSave,
}: WorkflowSettingsPageProps) {
  return (
    <section className="absolute inset-0 z-50 bg-[#0f1218]/97 backdrop-blur-sm pl-28 pr-8 py-8" onPointerDown={(e) => e.stopPropagation()}>
      <div className="max-w-[760px] mx-auto mt-8 rounded-2xl border border-[#2b3142] bg-[#121723]/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="text-xl font-semibold text-white">工作流设置</div>
          <button onClick={onBack} className="px-3 py-1.5 rounded-lg border border-[#2f3a54] bg-[#1a2235] text-sm inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> 返回画布
          </button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <div className="text-xs text-gray-300 mb-1">工作流名称</div>
            <input value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} className="w-full bg-[#111215] border border-[#303443] rounded px-3 py-2 text-sm" placeholder="请输入工作流名称" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input type="checkbox" checked={autoSaveWorkflow} onChange={(e) => setAutoSaveWorkflow(e.target.checked)} className="accent-indigo-500" />
            自动保存工作流
          </label>
          <div className="flex items-center gap-2">
            <button onClick={onSave} className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-semibold">
              保存设置
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
