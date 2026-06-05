import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, FileText, Plus, Trash2, X, Pencil, FolderOpen, AlertTriangle, Search, SearchX, Archive, Trash, FolderTree, Hash, GripVertical, Clock, RotateCcw } from "lucide-react";
import { Tooltip } from "./common/Tooltip";
import { WorkflowSummary } from "../hooks/useWorkflowState";

type Tab = "active" | "trash";

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
  const sourceList = activeTab === "active" ? list : trash;
  const currentProject = list.find((wf) => wf.id === currentId) ?? null;
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
            className="relative w-full max-w-[960px] max-h-[86vh] bg-[#121723] border border-[#2b3142] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#252c3a] flex items-center justify-between shrink-0 bg-[#161b29]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_24px_rgba(99,102,241,0.16)]">
                  <FolderOpen className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <div className="text-lg font-bold text-white tracking-tight">项目中心</div>
                  <div className="text-[11px] text-gray-500">
                    每个项目都是一张独立自由画布,可创建、切换和归档。
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
              <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-4 px-6 py-4 border-b border-[#252c3a] bg-[#0d1117]/40 max-lg:grid-cols-1">
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] p-4">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-300/80">当前项目</div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xl font-black text-white">{currentProject?.name ?? workflowName}</div>
                      <div className="mt-1 text-[11px] text-gray-500">
                        {currentProject ? `更新于 ${formatTime(currentProject.updatedAt)} · 创建于 ${new Date(currentProject.createdAt).toLocaleDateString()}` : "本地自动保存"}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-[11px] font-bold text-indigo-200">
                      正在编辑
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/[0.08] bg-[#0a0d14]/70 p-3">
                    <div className="text-[10px] text-gray-500">项目</div>
                    <div className="mt-1 text-2xl font-black text-white">{list.length}</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-[#0a0d14]/70 p-3">
                    <div className="text-[10px] text-gray-500">回收站</div>
                    <div className="mt-1 text-2xl font-black text-rose-200">{trash.length}</div>
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-2 max-lg:col-span-1">
                  <input
                    ref={inputRef}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") setNewName("");
                    }}
                    placeholder="新项目名称 (留空将自动命名)"
                    className="flex-1 bg-[#0a0d14] border border-[#2b3142] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-gray-600"
                  />
                  <button
                    onClick={handleCreate}
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    新建项目
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
                    回收站中共有 <span className="font-bold text-rose-200">{trash.length}</span> 个项目
                    {expiredCount > 0 && (
                      <span className="text-rose-400/90">
                        · <span className="font-bold text-rose-200">{expiredCount}</span> 个已过期(30 天)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {expiredCount > 0 && (
                      <Tooltip content={`立即清理 ${expiredCount} 个超过 30 天的过期项目 (系统每小时也会自动清理)`}>
                        <button
                          onClick={() => {
                            const n = onPurgeExpired();
                            if (n > 0) showNotice(`已清理 ${n} 个过期项目`);
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
                    placeholder="搜索项目名称..."
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
                    匹配 <span className="text-indigo-300 font-bold">{filteredList.length}</span> / {sourceList.length} 个{activeTab === "trash" ? "已删除" : ""}项目
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
              {sourceList.length === 0 ? (
                activeTab === "trash" ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-600 gap-2">
                    <Archive className="w-10 h-10 opacity-30" />
                    <span className="text-sm">回收站是空的,没有已删除的项目</span>
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-600 gap-2">
                    <FileText className="w-10 h-10 opacity-30" />
                    <span className="text-sm">暂无项目,在上方输入名称并点击"新建"</span>
                  </div>
                )
              ) : filteredList.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-500 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-[#0d1117] border border-[#2b3142] flex items-center justify-center">
                    <SearchX className="w-7 h-7 opacity-40" />
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-sm font-semibold text-gray-300">
                      未找到匹配 "<span className="text-indigo-300">{searchQuery}</span>" 的项目
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
                            <Tooltip content="切换到该项目">
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
                            <Tooltip content="还原到项目列表">
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
