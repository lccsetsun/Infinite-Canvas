import React from "react";
import { motion } from "motion/react";
import { ChevronDown, FolderPlus, Home, Layers3, Loader2, Pencil, Trash2 } from "lucide-react";
import HeaderRightPanel from "./HeaderRightPanel";
import aiCanvasMark from "../../assets/brand/ai-canvas-mark.svg";
import type { RemotePersistStatus } from "../../utils/remotePersistPolicy";
import {
  createRemoteProject,
  deleteRemoteProject,
  renameRemoteProject,
} from "../../features/workspace/remoteCanvas";

interface CanvasHeaderProps {
  projectName?: string;
  username?: string;
  assistantPanelOpen?: boolean;
  onLogout?: () => void;
  onProjectRenamed?: (name: string) => void;
  onNotice?: (message: string) => void;
  persistStatus?: RemotePersistStatus;
  lastPersistError?: string;
}

type ProjectMenuAction = "create" | "rename" | "delete" | null;

function buildCanvasUrl(projectId?: string) {
  if (!projectId) return "/canvas";
  const params = new URLSearchParams({ projectId });
  return `/canvas?${params.toString()}`;
}

function BrandGlyph() {
  return <img src={aiCanvasMark} alt="幻影AI" className="h-5 w-5 shrink-0 object-contain opacity-95" />;
}

export function getCanvasHeaderProjectName(projectName?: string) {
  return projectName?.trim() || "未命名";
}

export function getCanvasHeaderPersistStatusLabel(status: RemotePersistStatus = "idle") {
  if (status === "saving") return "保存中";
  if (status === "saved") return "已保存";
  if (status === "dirty") return "未保存";
  if (status === "error") return "保存失败";
  return "";
}

export function resolveCanvasProjectRename(currentName: string, draftName: string) {
  const fallbackName = getCanvasHeaderProjectName(currentName);
  const nextName = draftName.trim();
  if (!nextName) {
    return {
      ok: false,
      name: fallbackName,
      changed: false,
      error: "项目名称不能为空",
    };
  }

  return {
    ok: true,
    name: nextName,
    changed: nextName !== fallbackName,
  };
}

function MenuItem({
  icon,
  label,
  helper,
  onClick,
  disabled = false,
  danger = false,
  busy = false,
}: {
  icon: React.ReactNode;
  label: string;
  helper?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group/item flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition ${
        disabled
          ? "cursor-not-allowed text-slate-500"
          : danger
            ? "text-slate-300 hover:bg-rose-400/[0.08] hover:text-rose-50"
            : "text-slate-100 hover:bg-white/[0.045]"
      }`}
    >
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${
          danger
            ? "text-rose-300/72 group-hover/item:text-rose-200"
            : "text-slate-400 group-hover/item:text-slate-200"
        }`}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      </div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{label}</span>
        {helper ? <span className="mt-0.5 block truncate text-[10px] text-slate-500">{helper}</span> : null}
      </span>
    </button>
  );
}

function MenuSection({ label }: { label: string }) {
  return (
    <div className="px-2 pb-1 pt-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
      {label}
    </div>
  );
}

export default function CanvasHeader({
  projectName: loadedProjectName,
  username = "lccsetsun",
  assistantPanelOpen = false,
  onLogout,
  onProjectRenamed,
  onNotice,
  persistStatus = "idle",
  lastPersistError = "",
}: CanvasHeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<ProjectMenuAction>(null);
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [renameError, setRenameError] = React.useState("");
  const [localProjectName, setLocalProjectName] = React.useState("");
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const projectName = getCanvasHeaderProjectName(localProjectName || loadedProjectName);
  const persistLabel = getCanvasHeaderPersistStatusLabel(persistStatus);
  const renameState = resolveCanvasProjectRename(projectName, renameDraft);
  const canSaveRename = renameState.ok && renameState.changed && pendingAction !== "rename";

  React.useEffect(() => {
    setLocalProjectName("");
  }, [loadedProjectName]);

  const projectId = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("projectId")?.trim() || "";
  }, []);

  React.useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  const navigateTo = React.useCallback((path: string) => {
    if (typeof window === "undefined") return;
    window.location.href = path;
  }, []);

  const handleCreateProject = React.useCallback(async () => {
    setPendingAction("create");
    try {
      const createdId = await createRemoteProject({ name: "新建项目", includeCover: false });
      navigateTo(buildCanvasUrl(createdId || undefined));
    } finally {
      setPendingAction(null);
      setMenuOpen(false);
    }
  }, [navigateTo]);

  const openRenameDialog = React.useCallback(() => {
    setRenameDraft(projectName);
    setRenameError("");
    setRenameDialogOpen(true);
    setMenuOpen(false);
  }, [projectName]);

  const handleRenameProject = React.useCallback(async () => {
    if (!projectId) return;
    const result = resolveCanvasProjectRename(projectName, renameDraft);
    if (!result.ok) {
      setRenameError(result.error);
      return;
    }
    if (!result.changed) {
      setRenameDialogOpen(false);
      setRenameError("");
      return;
    }

    setPendingAction("rename");
    setRenameError("");
    try {
      await renameRemoteProject(projectId, result.name);
      setLocalProjectName(result.name);
      onProjectRenamed?.(result.name);
      onNotice?.("项目名称已更新");
      setRenameDialogOpen(false);
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "项目名称修改失败");
    } finally {
      setPendingAction(null);
    }
  }, [onNotice, onProjectRenamed, projectId, projectName, renameDraft]);

  const handleDeleteProject = React.useCallback(async () => {
    if (!projectId) return;
    if (!window.confirm(`确认删除项目「${projectName}」吗？`)) return;

    setPendingAction("delete");
    try {
      await deleteRemoteProject(projectId);
      navigateTo("/");
    } finally {
      setPendingAction(null);
      setMenuOpen(false);
    }
  }, [navigateTo, projectId, projectName]);

  const isBusy = pendingAction !== null;

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={`pointer-events-none relative z-[120] flex h-16 items-center justify-between overflow-visible px-5 transition-[padding] duration-300 ease-out ${
        assistantPanelOpen ? "pr-[704px]" : ""
      }`}
    >
      <motion.div
        ref={menuRef}
        data-no-canvas-context-menu="true"
        initial={{ x: -14, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.24 }}
        className="pointer-events-auto relative flex min-w-0 items-center"
      >
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setMenuOpen((current) => !current)}
          title={projectName}
          className={`inline-flex h-11 w-[228px] max-w-[calc(100vw-120px)] items-center gap-2.5 rounded-[18px] border px-3 py-1.5 text-left shadow-[0_16px_34px_-24px_rgba(8,13,24,0.96),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl transition-all ${
            menuOpen
              ? "border-violet-200/[0.18] bg-[#182235]/92 ring-1 ring-violet-300/12"
              : "border-violet-200/[0.10] bg-[#151d2b]/88"
          } ${isBusy ? "cursor-wait" : "cursor-pointer hover:border-violet-200/[0.18] hover:bg-[#182235]/92"}`}
        >
          <BrandGlyph />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-slate-100">
                {projectName}
              </span>
              {persistLabel ? (
                <span
                  title={lastPersistError || persistLabel}
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                    persistStatus === "error"
                      ? "bg-rose-400/10 text-rose-200"
                      : persistStatus === "dirty"
                        ? "bg-amber-300/10 text-amber-200"
                        : persistStatus === "saving"
                          ? "bg-cyan-300/10 text-cyan-100"
                          : "bg-emerald-300/10 text-emerald-200"
                  }`}
                >
                  {persistLabel}
                </span>
              ) : null}
            </div>
          </div>

          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-300" />
          ) : (
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${
                menuOpen ? "rotate-180 text-slate-300" : ""
              }`}
            />
          )}
        </button>

        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 top-[calc(100%+10px)] z-[130] w-[236px] overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#121722]/94 p-2 shadow-[0_24px_50px_-28px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
          >
            <MenuSection label="导航" />
            <MenuItem icon={<Home className="h-4 w-4" />} label="回到主页" onClick={() => navigateTo("/")} />
            <MenuItem
              icon={<Layers3 className="h-4 w-4" />}
              label="全部项目"
              onClick={() => navigateTo("/projects")}
            />

            <div className="my-1.5 h-px bg-white/[0.06]" />

            <MenuSection label="项目操作" />
            <MenuItem
              icon={<FolderPlus className="h-4 w-4" />}
              label="创建项目"
              disabled={isBusy}
              busy={pendingAction === "create"}
              onClick={() => void handleCreateProject()}
            />
            <MenuItem
              icon={<Pencil className="h-4 w-4" />}
              label="修改名称"
              helper="重命名当前画布"
              disabled={isBusy || !projectId}
              busy={pendingAction === "rename"}
              onClick={openRenameDialog}
            />

            <div className="my-1.5 h-px bg-white/[0.06]" />

            <MenuSection label="危险操作" />
            <MenuItem
              icon={<Trash2 className="h-4 w-4" />}
              label="删除项目"
              disabled={isBusy || !projectId}
              danger
              busy={pendingAction === "delete"}
              onClick={() => void handleDeleteProject()}
            />
          </motion.div>
        ) : null}
      </motion.div>

      {renameDialogOpen ? (
        <div
          className="pointer-events-auto fixed inset-0 z-[160] flex items-center justify-center bg-black/46 px-4 backdrop-blur-sm"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && !isBusy) {
              setRenameDialogOpen(false);
              setRenameError("");
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-[380px] rounded-[22px] border border-white/[0.08] bg-[#131924]/97 p-5 shadow-[0_28px_80px_-34px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4">
              <div className="text-[18px] font-semibold tracking-[-0.03em] text-white">
                重命名项目
              </div>
              <div className="mt-1 text-[12px] text-slate-500">名称会同步保存到当前项目。</div>
            </div>

            <input
              autoFocus
              value={renameDraft}
              disabled={pendingAction === "rename"}
              maxLength={60}
              onChange={(event) => {
                setRenameDraft(event.target.value);
                if (renameError) setRenameError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleRenameProject();
                }
                if (event.key === "Escape" && pendingAction !== "rename") {
                  setRenameDialogOpen(false);
                  setRenameError("");
                }
              }}
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0b1018] px-3 text-[14px] font-medium text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-200/42 focus:ring-2 focus:ring-violet-400/10 disabled:cursor-wait disabled:opacity-70"
              placeholder="请输入项目名称"
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
              <span>{renameState.ok && !renameState.changed ? "名称未变化" : "最多 60 个字符"}</span>
              <span>{renameDraft.length}/60</span>
            </div>

            {renameError ? (
              <div className="mt-3 rounded-lg border border-rose-300/18 bg-rose-400/[0.08] px-3 py-2 text-[12px] text-rose-100">
                {renameError}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pendingAction === "rename"}
                onClick={() => {
                  setRenameDialogOpen(false);
                  setRenameError("");
                }}
                className="h-9 rounded-xl px-4 text-[13px] font-medium text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100 disabled:cursor-wait disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!canSaveRename}
                onClick={() => void handleRenameProject()}
                className="inline-flex h-9 min-w-[88px] items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-[13px] font-semibold text-white shadow-[0_12px_28px_-18px_rgba(139,92,246,0.9)] transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-slate-500 disabled:shadow-none"
              >
                {pendingAction === "rename" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                保存
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}

      <HeaderRightPanel
        username={username}
        onLogout={onLogout}
      />
    </motion.header>
  );
}
