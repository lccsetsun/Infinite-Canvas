import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, FileText, Plus, Trash2, X, Pencil, FolderOpen, AlertTriangle, Search, SearchX, Archive, RotateCcw, Trash, Download, Upload, FolderTree, Hash, GripVertical, Clock, Library } from "lucide-react";
import { Tooltip } from "./common/Tooltip";
import { WorkflowSummary } from "../hooks/useWorkflowState";
import { WORKFLOW_TEMPLATES, WorkflowTemplate } from "../features/templates/workflowTemplates";

type Tab = "active" | "trash";
type View = "main" | "templates";

interface WorkflowManagerProps {
  open: boolean;
  list: WorkflowSummary[];
  trash: WorkflowSummary[];
  allCategories: string[];
  allTags: string[];
  currentId: string | null;
  workflowName: string;
  onClose: () => void;
  onSwitch: (id: string) => void;
  onCreate: (name?: string) => WorkflowSummary | null;
  onCreateFromTemplate: (templateId: string, customName?: string) => WorkflowSummary | null;
  onResetToDemo: (templateId: string) => boolean;
  onRename: (id: string, name: string) => boolean;
  onSetCategory: (id: string, category: string) => boolean;
  onAddTag: (id: string, tag: string) => boolean;
  onRemoveTag: (id: string, tag: string) => boolean;
  onMove: (sourceId: string, targetId: string, position: "before" | "after") => boolean;
  onDelete: (id: string) => boolean;
  onDuplicate: (id: string) => WorkflowSummary | null;
  onRestore: (id: string) => boolean;
  onPurge: (id: string) => boolean;
  onEmptyTrash: () => number;
  onPurgeExpired: () => number;
  onExportJson: () => string;
  onImportJson: (json: string) => { imported: number; skipped: number; renamed: number; errors: string[] };
  showNotice: (message: string) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return d.toLocaleDateString();
}

const TRASH_RETENTION_DAYS = 30;
function autoPurgeAt(deletedAt: number): string {
  const purgeAt = deletedAt + TRASH_RETENTION_DAYS * 86_400_000;
  const diff = purgeAt - Date.now();
  if (diff <= 0) return "已过期,即将清除";
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时后`;
  return `${Math.floor(diff / 86_400_000)} 天后`;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const lower = text.toLowerCase();
  const q = trimmed.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-indigo-500/30 text-indigo-100 rounded-sm px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function WorkflowManager({
  open,
  list,
  trash,
  allCategories,
  allTags,
  currentId,
  workflowName,
  onClose,
  onSwitch,
  onCreate,
  onCreateFromTemplate,
  onResetToDemo,
  onRename,
  onSetCategory,
  onAddTag,
  onRemoveTag,
  onMove,
  onDelete,
  onDuplicate,
  onRestore,
  onPurge,
  onEmptyTrash,
  onPurgeExpired,
  onExportJson,
  onImportJson,
  showNotice,
}: WorkflowManagerProps) {
  const [newName, setNewName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [pendingPurgeId, setPendingPurgeId] = React.useState<string | null>(null);
  const [pendingEmptyTrash, setPendingEmptyTrash] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchInputFocused, setSearchInputFocused] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<Tab>("active");
  const [view, setView] = React.useState<View>("main");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("");
  const [tagInputFor, setTagInputFor] = React.useState<string | null>(null);
  const [tagInputValue, setTagInputValue] = React.useState("");
  const [categoryEditFor, setCategoryEditFor] = React.useState<string | null>(null);
  const [categoryEditValue, setCategoryEditValue] = React.useState("");
  const [dragSourceId, setDragSourceId] = React.useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);
  const [dropPosition, setDropPosition] = React.useState<"before" | "after">("before");

  const inputRef = React.useRef<HTMLInputElement>(null);
  const editInputRef = React.useRef<HTMLInputElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const importFileRef = React.useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const json = onExportJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `aicanvas-workspace-${workflowName.replace(/[^\w\u4e00-\u9fa5-]+/g, "_")}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotice(`已导出 ${list.length + trash.length} 个工作流 (含 ${trash.length} 回收站)`);
    } catch (err) {
      showNotice(`导出失败:${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImportClick = () => importFileRef.current?.click();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showNotice("文件过大 (>10MB),已拒绝");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = String(reader.result ?? "");
        const result = onImportJson(json);
        if (result.errors.length > 0) {
          showNotice(`导入失败:${result.errors[0]}`);
        } else {
          const parts: string[] = [];
          if (result.imported > 0) parts.push(`导入 ${result.imported}`);
          if (result.renamed > 0) parts.push(`重命名 ${result.renamed}`);
          if (result.skipped > 0) parts.push(`跳过 ${result.skipped}`);
          showNotice(parts.length > 0 ? `导入完成:${parts.join(", ")}` : "无可导入的工作流");
        }
      } catch (err) {
        showNotice(`读取失败:${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.onerror = () => showNotice("文件读取失败");
    reader.readAsText(file);
  };

  const sourceList = activeTab === "active" ? list : trash;
  const filteredList = React.useMemo(() => {
    let arr = sourceList;
    if (categoryFilter) {
      arr = arr.filter((wf) => wf.category === categoryFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      arr = arr.filter((wf) => wf.name.toLowerCase().includes(q));
    }
    return arr;
  }, [sourceList, searchQuery, categoryFilter]);

  React.useEffect(() => {
    if (open) {
      setNewName("");
      setEditingId(null);
      setPendingDeleteId(null);
      setPendingPurgeId(null);
      setPendingEmptyTrash(false);
      setSearchQuery("");
      setCategoryFilter("");
      setTagInputFor(null);
      setTagInputValue("");
      setCategoryEditFor(null);
      setCategoryEditValue("");
      setDragSourceId(null);
      setDropTargetId(null);
      setActiveTab("active");
      setView("main");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  React.useEffect(() => {
    if (editingId) {
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 30);
    }
  }, [editingId]);

  const handleCreate = () => {
    const wf = onCreate(newName.trim() || undefined);
    setNewName("");
    if (wf) {
      onSwitch(wf.id);
      showNotice(`已创建并切换到 "${wf.name}"`);
    }
  };

  const startRename = (wf: WorkflowSummary) => {
    setEditingId(wf.id);
    setEditingValue(wf.name);
  };

  const commitRename = () => {
    if (!editingId) return;
    const ok = onRename(editingId, editingValue);
    if (ok) {
      showNotice("已重命名");
      setEditingId(null);
    } else {
      showNotice("重命名失败");
    }
  };

  const handleDelete = (id: string) => {
    if (pendingDeleteId === id) {
      const ok = onDelete(id);
      if (ok) {
        showNotice("已删除");
        setPendingDeleteId(null);
      }
    } else {
      setPendingDeleteId(id);
      setTimeout(() => {
        setPendingDeleteId((cur) => (cur === id ? null : cur));
      }, 3000);
    }
  };

  const handleDuplicate = (id: string) => {
    const wf = onDuplicate(id);
    if (wf) {
      onSwitch(wf.id);
      showNotice(`已复制为 "${wf.name}"`);
    }
  };

  const handleRestore = (id: string, name: string) => {
    const ok = onRestore(id);
    if (ok) showNotice(`已还原 "${name}"`);
  };

  const handlePurge = (id: string) => {
    if (pendingPurgeId === id) {
      const ok = onPurge(id);
      if (ok) {
        showNotice("已永久删除");
        setPendingPurgeId(null);
      }
    } else {
      setPendingPurgeId(id);
      setTimeout(() => {
        setPendingPurgeId((cur) => (cur === id ? null : cur));
      }, 3000);
    }
  };

  const handleEmptyTrash = () => {
    if (pendingEmptyTrash) {
      const n = onEmptyTrash();
      if (n > 0) showNotice(`回收站已清空 (${n} 个)`);
      setPendingEmptyTrash(false);
    } else {
      setPendingEmptyTrash(true);
      setTimeout(() => setPendingEmptyTrash(false), 3000);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    if (activeTab !== "active") {
      e.preventDefault();
      return;
    }
    setDragSourceId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    if (!dragSourceId || dragSourceId === id || activeTab !== "active") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position: "before" | "after" = e.clientY < midpoint ? "before" : "after";
    setDropTargetId(id);
    setDropPosition(position);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    if (dropTargetId === id) {
      const related = e.relatedTarget as Node | null;
      if (!related || !e.currentTarget.contains(related)) {
        setDropTargetId(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    if (!dragSourceId || dragSourceId === id) return;
    e.preventDefault();
    const sourceId = dragSourceId;
    const position = dropTargetId === id ? dropPosition : "before";
    setDragSourceId(null);
    setDropTargetId(null);
    if (onMove(sourceId, id, position)) {
      showNotice("已重新排序");
    }
  };

  const handleDragEnd = () => {
    setDragSourceId(null);
    setDropTargetId(null);
  };

  const handlePickTemplate = (tmpl: WorkflowTemplate) => {
    const wf = onCreateFromTemplate(tmpl.id);
    if (wf) {
      showNotice(`已从模板 "${tmpl.name}" 创建 (${tmpl.nodes.length} 节点, ${tmpl.links.length} 连线)`);
      onSwitch(wf.id);
      onClose();
    }
  };

  const handleResetToDemo = (tmpl: WorkflowTemplate) => {
    if (window.confirm(`确定要清空当前画布并载入 demo "${tmpl.name}" 吗?\n\n当前画布的所有节点和连线将被替换为该 demo 的内容,操作可通过 Ctrl+Z 撤销。`)) {
      if (onResetToDemo(tmpl.id)) {
        showNotice(`已重置为 demo "${tmpl.name}"`);
        onClose();
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#000000]/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[640px] max-h-[80vh] bg-[#121723] border border-[#2b3142] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
              aria-hidden="true"
            />
            <div className="h-14 px-6 border-b border-[#252c3a] flex items-center justify-between shrink-0 bg-[#161b29]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <FolderOpen className="w-4 h-4 text-indigo-300" />
                </div>
                <div>
                  <div className="text-[15px] font-bold text-white">工作流管理</div>
                  <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                    {list.length} 个工作流 · {trash.length} 回收站
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip content={view === "templates" ? "返回工作流列表" : "从预置模板新建工作流"}>
                  <button
                    onClick={() => setView(view === "templates" ? "main" : "templates")}
                    aria-label={view === "templates" ? "返回" : "模板"}
                    className={`p-2 rounded-lg transition-colors ${
                      view === "templates"
                        ? "bg-violet-500/20 text-violet-200"
                        : "text-gray-400 hover:text-violet-300 hover:bg-white/5"
                    }`}
                  >
                    {view === "templates" ? <X className="w-4 h-4" /> : <Library className="w-4 h-4" />}
                  </button>
                </Tooltip>
                <div className="w-px h-5 bg-white/10 mx-0.5" />
                <Tooltip content="导出工作流到 JSON 文件">
                  <button
                    onClick={handleExport}
                    aria-label="导出 JSON"
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-emerald-300 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </Tooltip>
                <Tooltip content="从 JSON 文件导入工作流">
                  <button
                    onClick={handleImportClick}
                    aria-label="导入 JSON"
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-cyan-300 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </Tooltip>
                <div className="w-px h-5 bg-white/10 mx-0.5" />
                <div
                  className="flex items-center gap-1 p-0.5 rounded-lg bg-[#0d1117] border border-[#2b3142]"
                  role="tablist"
                  aria-label="工作流标签切换"
                >
                  <button
                    role="tab"
                    aria-selected={activeTab === "active"}
                    onClick={() => setActiveTab("active")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                      activeTab === "active"
                        ? "bg-indigo-500/20 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <FolderOpen className="w-3 h-3" />
                    工作流
                    <span className={`text-[9px] font-mono ${activeTab === "active" ? "text-indigo-300" : "text-gray-600"}`}>
                      {list.length}
                    </span>
                  </button>
                  <button
                    role="tab"
                    aria-selected={activeTab === "trash"}
                    onClick={() => setActiveTab("trash")}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                      activeTab === "trash"
                        ? "bg-rose-500/20 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.25)]"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <Archive className="w-3 h-3" />
                    回收站
                    <span className={`text-[9px] font-mono ${activeTab === "trash" ? "text-rose-300" : "text-gray-600"}`}>
                      {trash.length}
                    </span>
                  </button>
                </div>
                <button
                  onClick={onClose}
                  aria-label="关闭"
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {activeTab === "active" && (
              <div className="px-6 py-4 border-b border-[#252c3a] bg-[#0d1117]/40">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") setNewName("");
                    }}
                    placeholder="新工作流名称 (留空将自动命名)"
                    className="flex-1 bg-[#0a0d14] border border-[#2b3142] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-600"
                  />
                  <button
                    onClick={handleCreate}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    新建
                  </button>
                </div>
              </div>
            )}

            {activeTab === "trash" && trash.length > 0 && (() => {
              const now = Date.now();
              const cutoff = now - 30 * 86_400_000;
              const expiredCount = trash.filter((wf) => (wf.deletedAt ?? 0) < cutoff).length;
              return (
                <div className="px-6 py-3 border-b border-[#252c3a] bg-rose-500/[0.04] flex items-center justify-between gap-3">
                  <div className="text-[11px] text-rose-300/80 flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5" />
                    回收站中共有 <span className="font-bold text-rose-200">{trash.length}</span> 个工作流
                    {expiredCount > 0 && (
                      <span className="text-rose-400/90">
                        · <span className="font-bold text-rose-200">{expiredCount}</span> 个已过期(30 天)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {expiredCount > 0 && (
                      <Tooltip content={`立即清理 ${expiredCount} 个超过 30 天的过期工作流 (系统每小时也会自动清理)`}>
                        <button
                          onClick={() => {
                            const n = onPurgeExpired();
                            if (n > 0) showNotice(`已清理 ${n} 个过期工作流`);
                          }}
                          className="px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          立即清理过期 ({expiredCount})
                        </button>
                      </Tooltip>
                    )}
                    <button
                      onClick={handleEmptyTrash}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                        pendingEmptyTrash
                          ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                          : "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30"
                      }`}
                      title={pendingEmptyTrash ? "再次点击确认清空" : "清空回收站 (永久删除全部)"}
                    >
                      {pendingEmptyTrash ? <AlertTriangle className="w-3.5 h-3.5" /> : <Trash className="w-3.5 h-3.5" />}
                      {pendingEmptyTrash ? "再次点击确认" : "清空回收站"}
                    </button>
                  </div>
                </div>
              );
            })()}

            {activeTab === "active" && allCategories.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <div className="flex items-center gap-2 mb-2">
                  <FolderTree className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">分类筛选</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setCategoryFilter("")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        !categoryFilter
                          ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                          : "bg-[#0d1117] text-gray-500 border border-[#2b3142] hover:text-gray-300"
                      }`}
                    >
                      全部 ({list.length})
                    </button>
                    {allCategories.map((cat) => {
                      const count = list.filter((wf) => wf.category === cat).length;
                      const active = categoryFilter === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(active ? "" : cat)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors inline-flex items-center gap-1 ${
                            active
                              ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                              : "bg-[#0d1117] text-gray-500 border border-[#2b3142] hover:text-gray-300"
                          }`}
                        >
                          {cat}
                          <span className="text-[9px] font-mono opacity-70">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {sourceList.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                    searchInputFocused
                      ? "bg-[#0a0d14] border-indigo-500/50 ring-1 ring-indigo-500/20"
                      : "bg-[#0a0d14]/60 border-[#2b3142]"
                  }`}
                >
                  <Search className={`w-3.5 h-3.5 shrink-0 ${searchInputFocused ? "text-indigo-300" : "text-gray-500"}`} />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchInputFocused(true)}
                    onBlur={() => setSearchInputFocused(false)}
                    placeholder="搜索工作流名称..."
                    className="flex-1 bg-transparent border-none text-[12px] text-gray-200 outline-none placeholder:text-gray-600"
                  />
                  {searchQuery ? (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        searchInputRef.current?.focus();
                      }}
                      aria-label="清除搜索"
                      className="text-gray-500 hover:text-rose-300 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <kbd className="text-[9px] font-mono text-gray-600 px-1.5 py-0.5 rounded border border-[#2b3142] bg-[#0d1117]">
                      ⌘F
                    </kbd>
                  )}
                </div>
                {searchQuery && (
                  <div className="mt-1.5 px-3 text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                    匹配 <span className="text-indigo-300 font-bold">{filteredList.length}</span> / {sourceList.length} 个{activeTab === "trash" ? "已删除" : ""}工作流
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
              {view === "templates" ? (
                <div className="space-y-3">
                  <div className="text-[11px] text-gray-500 px-1 flex items-center gap-1.5">
                    <Library className="w-3 h-3 text-violet-400" />
                    从预置模板快速创建工作流 ({WORKFLOW_TEMPLATES.length} 个,
                    <span className="text-amber-400 ml-1">⭐ = 开箱即用 demo,可一键替换当前画布</span>)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {WORKFLOW_TEMPLATES.map((tmpl) => (
                      <div
                        key={tmpl.id}
                        className={`group relative text-left p-3.5 rounded-xl border transition-all ${
                          tmpl.isDemo
                            ? "border-amber-500/30 bg-amber-500/[0.03] hover:border-amber-500/50 hover:bg-amber-500/[0.06]"
                            : "border-[#252c3a] bg-[#0d1117] hover:border-violet-500/40 hover:bg-violet-500/[0.04]"
                        }`}
                      >
                        {tmpl.isDemo && (
                          <div className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-md bg-amber-500 text-amber-950 text-[9px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/20">
                            ⭐ Demo
                          </div>
                        )}
                        <button
                          onClick={() => handlePickTemplate(tmpl)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[20px] shrink-0 group-hover:scale-105 transition-transform ${
                              tmpl.isDemo ? "bg-amber-500/15 border border-amber-500/30" : "bg-violet-500/15 border border-violet-500/30"
                            }`}>
                              {tmpl.emoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-bold text-gray-100">{tmpl.name}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{tmpl.description}</div>
                              <div className="flex items-center gap-2 mt-2 text-[9px] font-mono text-gray-600">
                                <span className={`px-1.5 py-0.5 rounded ${tmpl.isDemo ? "bg-amber-500/10 text-amber-300" : "bg-violet-500/10 text-violet-300"}`}>
                                  {tmpl.category}
                                </span>
                                <span>{tmpl.nodes.length} 节点</span>
                                <span>·</span>
                                <span>{tmpl.links.length} 连线</span>
                                {tmpl.defaultOutputs && (
                                  <>
                                    <span>·</span>
                                    <span className="text-emerald-400">已预填示例</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                        {tmpl.isDemo && (
                          <Tooltip content="清空当前画布,载入此 demo(可通过 Ctrl+Z 撤销)">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetToDemo(tmpl);
                              }}
                              className="mt-2 w-full px-2 py-1 rounded text-[10px] font-bold text-amber-300 hover:text-amber-100 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors flex items-center justify-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              重置当前画布为 demo
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : sourceList.length === 0 ? (
                activeTab === "trash" ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-600 gap-2">
                    <Archive className="w-10 h-10 opacity-30" />
                    <span className="text-sm">回收站是空的,没有已删除的工作流</span>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-600 gap-2">
                    <FileText className="w-10 h-10 opacity-30" />
                    <span className="text-sm">暂无工作流,在上方输入名称并点击"新建"</span>
                  </div>
                )
              ) : filteredList.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-500 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-[#0d1117] border border-[#2b3142] flex items-center justify-center">
                    <SearchX className="w-7 h-7 opacity-40" />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-sm font-semibold text-gray-300">
                      未找到匹配 "<span className="text-indigo-300">{searchQuery}</span>" 的工作流
                    </div>
                    <div className="text-[11px] text-gray-600">
                      尝试其他关键词,或
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          searchInputRef.current?.focus();
                        }}
                        className="ml-1 text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline"
                      >
                        清除搜索
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                filteredList.map((wf) => {
                  const isCurrent = wf.id === currentId;
                  const isEditing = editingId === wf.id;
                  const isPendingDelete = pendingDeleteId === wf.id;
                  const isDragging = dragSourceId === wf.id;
                  const isDropBefore = dropTargetId === wf.id && dropPosition === "before";
                  const isDropAfter = dropTargetId === wf.id && dropPosition === "after";
                  return (
                    <div key={wf.id} className="relative">
                      {isDropBefore && activeTab === "active" && (
                        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] pointer-events-none" />
                      )}
                      {isDropAfter && activeTab === "active" && (
                        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] pointer-events-none" />
                      )}
                      <div
                        draggable={activeTab === "active" && !isEditing}
                        onDragStart={(e) => handleDragStart(e, wf.id)}
                        onDragOver={(e) => handleDragOver(e, wf.id)}
                        onDragLeave={(e) => handleDragLeave(e, wf.id)}
                        onDrop={(e) => handleDrop(e, wf.id)}
                        onDragEnd={handleDragEnd}
                        className={`group rounded-xl border transition-all ${
                          isDragging
                            ? "opacity-40 scale-[0.98] cursor-grabbing"
                            : isCurrent
                              ? "bg-indigo-500/10 border-indigo-500/40 shadow-[0_0_0_1px_rgba(99,102,241,0.3),0_4px_12px_-2px_rgba(99,102,241,0.2)]"
                              : "bg-[#0d1117] border-[#252c3a] hover:border-[#3a4358] hover:bg-[#11151f]"
                          }
                          ${activeTab === "active" ? "cursor-grab active:cursor-grabbing" : ""}
                        `}
                      >
                        {activeTab === "active" && (
                          <div
                            className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-600 group-hover:text-gray-400 transition-colors cursor-grab"
                            aria-hidden="true"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="flex items-center gap-3 px-4 pl-9 py-3">
                          <div className="shrink-0">
                            {isCurrent ? (
                              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                                <Check className="w-4 h-4 text-indigo-300" />
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center group-hover:border-white/[0.12] transition-colors">
                                <FileText className="w-4 h-4 text-gray-500" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              onBlur={commitRename}
                              className="w-full bg-[#0a0d14] border border-indigo-500/40 rounded px-2 py-1 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-indigo-500/20"
                            />
                          ) : (
                            <div className="flex items-baseline gap-2">
                              <span className={`text-sm font-bold truncate ${isCurrent && activeTab === "active" ? "text-indigo-100" : "text-gray-200"}`}>
                                {highlightMatch(wf.name, searchQuery)}
                              </span>
                              {isCurrent && activeTab === "active" && (
                                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded">
                                  当前
                                </span>
                              )}
                              {activeTab === "trash" && wf.deletedAt && (
                                <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded">
                                  {formatTime(wf.deletedAt)} 删除
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                            {activeTab === "trash" && wf.deletedAt
                              ? `将于 ${autoPurgeAt(wf.deletedAt)} 永久清除`
                              : <>更新于 {formatTime(wf.updatedAt)} · 创建于 {new Date(wf.createdAt).toLocaleDateString()}</>}
                          </div>
                          {activeTab === "active" && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              {categoryEditFor === wf.id ? (
                                <input
                                  autoFocus
                                  value={categoryEditValue}
                                  onChange={(e) => setCategoryEditValue(e.target.value)}
                                  onBlur={() => {
                                    onSetCategory(wf.id, categoryEditValue);
                                    setCategoryEditFor(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      onSetCategory(wf.id, categoryEditValue);
                                      setCategoryEditFor(null);
                                    }
                                    if (e.key === "Escape") setCategoryEditFor(null);
                                  }}
                                  placeholder="分类..."
                                  list={`cats-${wf.id}`}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0a0d14] border border-amber-500/40 text-amber-200 outline-none focus:ring-1 focus:ring-amber-500/30 w-20"
                                />
                              ) : (
                                <button
                                  onClick={() => {
                                    setCategoryEditFor(wf.id);
                                    setCategoryEditValue(wf.category ?? "");
                                  }}
                                  title={wf.category ? `点击修改分类: ${wf.category}` : "点击设置分类"}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                                    wf.category
                                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                                      : "bg-[#0d1117] text-gray-500 border border-dashed border-[#2b3142] hover:text-gray-300 hover:border-amber-500/40"
                                  }`}
                                >
                                  <FolderTree className="w-2.5 h-2.5" />
                                  {wf.category ?? "未分类"}
                                </button>
                              )}
                              {(wf.tags ?? []).map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 inline-flex items-center gap-0.5"
                                >
                                  <Hash className="w-2.5 h-2.5" />
                                  {tag}
                                  <button
                                    onClick={() => onRemoveTag(wf.id, tag)}
                                    className="ml-0.5 -mr-0.5 text-cyan-400/60 hover:text-rose-300"
                                    aria-label={`移除标签 ${tag}`}
                                    title="移除"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              ))}
                              {tagInputFor === wf.id ? (
                                <>
                                  <datalist id={`tags-${wf.id}`}>
                                    {allTags
                                      .filter((t) => !(wf.tags ?? []).includes(t))
                                      .map((t) => (
                                        <option key={t} value={t} />
                                      ))}
                                  </datalist>
                                  <input
                                    autoFocus
                                    value={tagInputValue}
                                    onChange={(e) => setTagInputValue(e.target.value)}
                                    onBlur={() => {
                                      if (tagInputValue.trim()) onAddTag(wf.id, tagInputValue);
                                      setTagInputFor(null);
                                      setTagInputValue("");
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        if (tagInputValue.trim()) onAddTag(wf.id, tagInputValue);
                                        setTagInputFor(null);
                                        setTagInputValue("");
                                      }
                                      if (e.key === "Escape") {
                                        setTagInputFor(null);
                                        setTagInputValue("");
                                      }
                                    }}
                                    placeholder="新标签..."
                                    list={`tags-${wf.id}`}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0a0d14] border border-cyan-500/40 text-cyan-200 outline-none focus:ring-1 focus:ring-cyan-500/30 w-20"
                                  />
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    setTagInputFor(wf.id);
                                    setTagInputValue("");
                                  }}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-500 border border-dashed border-[#2b3142] hover:text-cyan-300 hover:border-cyan-500/40 flex items-center gap-0.5"
                                  title="添加标签"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          {activeTab === "active" && !isCurrent && !isEditing && (
                            <Tooltip content="切换到该工作流">
                              <button
                                onClick={() => {
                                  onSwitch(wf.id);
                                  showNotice(`已切换到 "${wf.name}"`);
                                }}
                                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-indigo-300 transition-colors"
                                aria-label="切换"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          )}
                          {activeTab === "active" && !isEditing && (
                            <Tooltip content="重命名">
                              <button
                                onClick={() => startRename(wf)}
                                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-cyan-300 transition-colors"
                                aria-label="重命名"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          )}
                          {activeTab === "active" && (
                            <Tooltip content="复制">
                              <button
                                onClick={() => handleDuplicate(wf.id)}
                                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-emerald-300 transition-colors"
                                aria-label="复制"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          )}
                          {activeTab === "trash" && (
                            <Tooltip content="还原到工作流列表">
                              <button
                                onClick={() => handleRestore(wf.id, wf.name)}
                                className="p-2 rounded-lg hover:bg-emerald-500/15 text-gray-400 hover:text-emerald-300 transition-colors"
                                aria-label="还原"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          )}
                          {activeTab === "active" ? (
                            <Tooltip content={isPendingDelete ? "再次点击确认移至回收站" : "移至回收站"}>
                              <button
                                onClick={() => handleDelete(wf.id)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isPendingDelete
                                    ? "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                                    : "text-gray-400 hover:text-amber-300 hover:bg-amber-500/10"
                                }`}
                                aria-label="移至回收站"
                              >
                                {isPendingDelete ? <AlertTriangle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </Tooltip>
                          ) : (
                            <Tooltip content={pendingPurgeId === wf.id ? "再次点击确认永久删除" : "永久删除"}>
                              <button
                                onClick={() => handlePurge(wf.id)}
                                className={`p-2 rounded-lg transition-colors ${
                                  pendingPurgeId === wf.id
                                    ? "bg-rose-600 text-white hover:bg-rose-500 shadow-lg shadow-rose-500/30"
                                    : "text-gray-400 hover:text-rose-300 hover:bg-rose-500/10"
                                }`}
                                aria-label="永久删除"
                              >
                                {pendingPurgeId === wf.id ? <AlertTriangle className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </Tooltip>
                          )}
                        </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="h-12 px-6 border-t border-[#252c3a] flex items-center justify-between shrink-0 bg-[#161b29]/50 text-[10px] text-gray-500 font-mono uppercase tracking-wider">
              <span>按 Enter 新建 · 双击行重命名</span>
              <span>v1 · 自动保存到本地</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
