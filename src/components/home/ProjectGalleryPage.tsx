import React from "react";
import { motion } from "motion/react";
import { createPortal } from "react-dom";
import { ArrowRight, FolderOpen, Image as ImageIcon, Loader2, MoreHorizontal, Plus, Upload } from "lucide-react";
import AppHeader from "../app/AppHeader";
import type { HomeProjectCard } from "../../features/workspace/projectTypes";
import { uploadFileToOss } from "../../features/resource/ossApi";
import { isHomeProjectMenuInteractionInside } from "../../utils/homeProjectMenuInteraction";
import { consumeSingleImageUploadSelection } from "../../utils/consumeSingleImageUploadSelection";
import { getHomeProjectMenuPosition } from "../../utils/homeProjectMenuPosition";
import { getHomeProjectMenuState } from "../../utils/homeProjectMenuState";
import { resolveProjectEdit } from "../../utils/resolveProjectEdit";

type EditDialogState = {
  projectId: string;
  name: string;
  coverUrl: string;
  originalName: string;
  originalCoverUrl: string;
} | null;

interface ProjectGalleryPageProps {
  title: string;
  subtitle: string;
  projects: HomeProjectCard[];
  showCreateTile: boolean;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  topActionLabel?: string;
  onTopAction?: () => void;
  onLogout: () => void;
  onOpenCanvas: (projectId?: string) => void;
  onProjectsChanged: () => void;
  loading?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  onCreateProject?: () => void | Promise<void>;
  onRenameProject?: (projectId: string, name: string) => boolean | Promise<boolean>;
  onChangeProjectCover?: (projectId: string, coverUrl: string) => boolean | Promise<boolean>;
  onDuplicateProject?: (projectId: string) => void | Promise<void>;
  onDeleteProject?: (projectId: string) => boolean | Promise<boolean>;
}

const projectFrameClass =
  "overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#111318] transition-all duration-200 group-hover:border-white/[0.1] group-hover:bg-[#14171c] group-hover:shadow-[0_14px_32px_rgba(0,0,0,0.18)]";

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function PlaceholderPreview() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#16191f]">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all duration-200 group-hover:scale-[1.03] group-hover:border-white/[0.1] group-hover:bg-white/[0.03] group-hover:shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
        <ImageIcon className="h-6 w-6 text-white/20" />
      </div>
    </div>
  );
}

function ProjectMenu({
  project,
  style,
  onHoverStart,
  onHoverEnd,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
  menuRef,
}: {
  project: HomeProjectCard;
  style: { left: number; top: number };
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onOpen: (projectId: string) => void;
  onEdit: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) {
  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-40 w-48 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#14171c] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,0.34)]"
      style={style}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      {[
        { label: "打开", onClick: () => onOpen(project.id) },
        { label: "修改", onClick: () => onEdit(project.id) },
        { label: "创建副本", onClick: () => onDuplicate(project.id) },
        { label: "删除项目", onClick: () => onDelete(project.id), danger: true },
      ].map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            item.onClick();
          }}
          className={`flex w-full cursor-pointer items-center rounded-xl px-3 py-2.5 text-left text-[14px] font-medium transition ${
            item.danger
              ? "text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
              : "text-slate-200 hover:bg-white/[0.045] hover:text-white"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

interface ProjectTileProps {
  project: HomeProjectCard;
  hovered: boolean;
  menuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onHoverChange: (projectId: string | null) => void;
  onOpen: (projectId: string) => void;
  onToggleMenu: (projectId: string) => void;
  onEdit: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

function ProjectTile({
  project,
  hovered,
  menuOpen,
  menuRef,
  onHoverChange,
  onOpen,
  onToggleMenu,
  onEdit,
  onDuplicate,
  onDelete,
}: ProjectTileProps) {
  const menuState = getHomeProjectMenuState(project.id, hovered ? project.id : null, menuOpen ? project.id : null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = React.useState<{ left: number; top: number } | null>(null);
  const hoverLeaveTimerRef = React.useRef<number | null>(null);

  const clearHoverLeaveTimer = React.useCallback(() => {
    if (hoverLeaveTimerRef.current !== null) {
      window.clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  }, []);

  const handleHoverStart = React.useCallback(() => {
    clearHoverLeaveTimer();
    onHoverChange(project.id);
  }, [clearHoverLeaveTimer, onHoverChange, project.id]);

  const handleHoverEnd = React.useCallback(() => {
    clearHoverLeaveTimer();
    hoverLeaveTimerRef.current = window.setTimeout(() => {
      onHoverChange(null);
      hoverLeaveTimerRef.current = null;
    }, 120);
  }, [clearHoverLeaveTimer, onHoverChange]);

  React.useLayoutEffect(() => {
    if (!menuState.menuVisible || !triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    setMenuStyle(
      getHomeProjectMenuPosition(
        triggerRect,
        { width: 192, height: 220 },
        { width: window.innerWidth, height: window.innerHeight }
      )
    );
  }, [menuState.menuVisible]);

  React.useEffect(() => () => clearHoverLeaveTimer(), [clearHoverLeaveTimer]);

  return (
    <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.16 }} className="group">
      <button type="button" onClick={() => onOpen(project.id)} className="block w-full cursor-pointer text-left">
        <div className={projectFrameClass}>
          <div className="aspect-[1.7/1] overflow-hidden bg-[#16191f]">
            {project.previewUrl ? (
              <img
                src={project.previewUrl}
                alt={project.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <PlaceholderPreview />
            )}
          </div>
        </div>
      </button>

      <div className="mt-2.5 flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex h-8 items-center truncate text-[14px] font-medium tracking-[-0.01em] text-slate-100 transition-colors duration-200 group-hover:text-white">
            {project.name}
          </div>
          <div className="mt-1 text-[12px] text-slate-500 transition-colors duration-200 group-hover:text-slate-400">
            {formatDate(project.updatedAt)}
          </div>
        </div>

        <div className="relative shrink-0" onMouseEnter={handleHoverStart} onMouseLeave={handleHoverEnd}>
          <button
            ref={triggerRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleMenu(project.id);
            }}
            className={`cursor-pointer rounded-lg p-1.5 transition-colors ${
              menuState.menuVisible
                ? "bg-white/[0.06] text-slate-100"
                : "text-slate-500 group-hover:text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
            aria-label={`${project.name} 菜单`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuState.menuVisible && menuStyle ? (
            <ProjectMenu
              project={project}
              style={menuStyle}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
              onOpen={onOpen}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              menuRef={menuRef}
            />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

function CreateProjectTile({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.16 }} className="group">
      <button
        type="button"
        onClick={onCreate}
        className="block w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-left"
      >
        <div className={projectFrameClass}>
          <div className="relative flex aspect-[1.7/1] flex-col items-center justify-center gap-3 bg-[#16191f] px-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025] text-slate-100 transition-all duration-200 group-hover:scale-[1.03] group-hover:border-white/[0.1] group-hover:bg-white/[0.03] group-hover:shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
              <Plus className="h-5 w-5" />
            </div>
          </div>
        </div>
      </button>

      <div className="mt-2.5 flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium tracking-[-0.01em] text-slate-100 transition-colors duration-200 group-hover:text-white">
            新建项目
          </div>
          <div className="mt-1 text-[12px] text-slate-500 transition-colors duration-200 group-hover:text-slate-400">
            创建新的 AI 画布项目
          </div>
        </div>

        <div className="shrink-0 rounded-lg p-1.5 text-slate-600 transition-colors group-hover:text-slate-400">
          <Plus className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
}

function ProjectSkeletonTile() {
  return (
    <div className="animate-pulse">
      <div className={projectFrameClass}>
        <div className="aspect-[1.7/1] bg-[#16191f]" />
      </div>

      <div className="mt-2.5 space-y-2">
        <div className="h-4 w-28 rounded-full bg-white/[0.08]" />
        <div className="h-3 w-20 rounded-full bg-white/[0.05]" />
      </div>
    </div>
  );
}

function EditProjectDialog({
  state,
  isUploadingCover,
  isSubmitting,
  uploadError,
  onNameChange,
  onSelectCoverFile,
  onClose,
  onSubmit,
}: {
  state: EditDialogState;
  isUploadingCover: boolean;
  isSubmitting: boolean;
  uploadError: string;
  onNameChange: (value: string) => void;
  onSelectCoverFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const coverInputRef = React.useRef<HTMLInputElement | null>(null);

  if (!state) return null;

  const isBusy = isUploadingCover || isSubmitting;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111318] shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <div className="text-[19px] font-semibold text-white">修改项目</div>
          <div className="mt-1 text-sm text-slate-400">在一个稳定的弹窗里修改项目名称和封面图片。</div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">项目名称</label>
            <input
              autoFocus
              value={state.name}
              onChange={(event) => onNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isBusy) onSubmit();
                if (event.key === "Escape") onClose();
              }}
              placeholder="请输入项目名称"
              disabled={isBusy}
              className="w-full rounded-2xl border border-white/[0.08] bg-[#16191f] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-slate-500 focus:border-white/[0.16]"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-slate-300">封面图片</label>
              <span className="text-xs text-slate-500">仅支持单张图片，重新上传会覆盖当前封面</span>
            </div>

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onSelectCoverFile}
            />

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={isBusy}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.12] bg-[#16191f] px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/[0.22] hover:bg-[#1a1e26] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isUploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isUploadingCover ? "正在上传到 OSS..." : state.coverUrl ? "重新上传封面" : "上传封面图片"}
            </button>

            {uploadError ? <div className="mt-2 text-sm text-rose-300">{uploadError}</div> : null}

            <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#16191f]">
              {state.coverUrl ? (
                <img src={state.coverUrl} alt={`${state.name} 封面预览`} className="h-48 w-full object-cover" />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-slate-500">还没有封面图片</div>
              )}
            </div>

            {state.coverUrl ? <div className="mt-2 break-all text-xs text-slate-500">{state.coverUrl}</div> : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isBusy}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-[#111318] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? "正在保存..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectGalleryPage({
  title,
  subtitle,
  projects,
  showCreateTile,
  primaryActionLabel,
  onPrimaryAction,
  topActionLabel,
  onTopAction,
  onLogout,
  onOpenCanvas,
  onProjectsChanged,
  loading = false,
  errorMessage = "",
  emptyMessage = "还没有项目，先创建一个开始吧。",
  onCreateProject,
  onRenameProject,
  onChangeProjectCover,
  onDuplicateProject,
  onDeleteProject,
}: ProjectGalleryPageProps) {
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);
  const [hoveredMenuId, setHoveredMenuId] = React.useState<string | null>(null);
  const [editDialogState, setEditDialogState] = React.useState<EditDialogState>(null);
  const [isUploadingCover, setIsUploadingCover] = React.useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [coverUploadError, setCoverUploadError] = React.useState("");
  const menuHostRef = React.useRef<HTMLDivElement | null>(null);
  const activeMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  React.useEffect(() => {
    if (!menuOpenId) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!isHomeProjectMenuInteractionInside(event.target, [menuHostRef.current, activeMenuRef.current])) {
        setMenuOpenId(null);
        setHoveredMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpenId]);

  const closeMenus = React.useCallback(() => {
    setMenuOpenId(null);
    setHoveredMenuId(null);
  }, []);

  const resetEditDialogFeedback = React.useCallback(() => {
    setIsUploadingCover(false);
    setIsSubmittingEdit(false);
    setCoverUploadError("");
  }, []);

  const handleOpenProject = React.useCallback(
    (projectId: string) => {
      onOpenCanvas(projectId);
    },
    [onOpenCanvas]
  );

  const handleCreateProject = React.useCallback(() => {
    void Promise.resolve(onCreateProject?.()).then(() => {
      onProjectsChanged();
    });
  }, [onCreateProject, onProjectsChanged]);

  const handleEditProject = React.useCallback(
    (projectId: string) => {
      const target = projects.find((project) => project.id === projectId);
      if (!target) return;

      setEditDialogState({
        projectId,
        name: target.name,
        coverUrl: target.previewUrl ?? "",
        originalName: target.name,
        originalCoverUrl: target.previewUrl ?? "",
      });
      resetEditDialogFeedback();
      closeMenus();
    },
    [closeMenus, projects, resetEditDialogFeedback]
  );

  const handleDuplicateProject = React.useCallback(
    (projectId: string) => {
      void Promise.resolve(onDuplicateProject?.(projectId)).then(() => {
        onProjectsChanged();
      });
      closeMenus();
    },
    [closeMenus, onDuplicateProject, onProjectsChanged]
  );

  const handleDeleteProject = React.useCallback(
    (projectId: string) => {
      if (!window.confirm("确认删除这个项目吗？")) return;
      void Promise.resolve(onDeleteProject?.(projectId)).then((result) => {
        if (result !== false) onProjectsChanged();
      });
      closeMenus();
    },
    [closeMenus, onDeleteProject, onProjectsChanged]
  );

  const handleCoverFileSelection = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = consumeSingleImageUploadSelection(event.target);
      if (!file) return;

      setCoverUploadError("");
      setIsUploadingCover(true);
      const asset = await uploadFileToOss(file);
      setEditDialogState((current) => (current ? { ...current, coverUrl: asset.url } : current));
    } catch (error) {
      setCoverUploadError(error instanceof Error ? error.message : "封面上传失败");
    } finally {
      setIsUploadingCover(false);
    }
  }, []);

  const handleSubmitEditDialog = React.useCallback(() => {
    if (!editDialogState || isUploadingCover || isSubmittingEdit) return;

    const currentState = editDialogState;
    const { nextName, nextCoverUrl, shouldRename, shouldUpdateCover } = resolveProjectEdit(
      currentState.name,
      currentState.coverUrl,
      currentState.originalName,
      currentState.originalCoverUrl
    );

    if (!shouldRename && !shouldUpdateCover) {
      setEditDialogState(null);
      resetEditDialogFeedback();
      return;
    }

    setIsSubmittingEdit(true);

    void (async () => {
      let changed = false;

      try {
        if (shouldRename) {
          const renameResult = await Promise.resolve(onRenameProject?.(currentState.projectId, nextName));
          if (renameResult !== false) changed = true;
        }

        if (shouldUpdateCover) {
          const coverResult = await Promise.resolve(onChangeProjectCover?.(currentState.projectId, nextCoverUrl));
          if (coverResult !== false) changed = true;
        }

        if (changed) onProjectsChanged();
        setEditDialogState(null);
        resetEditDialogFeedback();
      } finally {
        setIsSubmittingEdit(false);
      }
    })();
  }, [editDialogState, isSubmittingEdit, isUploadingCover, onChangeProjectCover, onProjectsChanged, onRenameProject, resetEditDialogFeedback]);

  return (
    <div className="project-scrollbar h-screen overflow-x-hidden overflow-y-auto bg-[#0d0f13] text-slate-100">
      <div className="relative z-10 min-h-full">
        <AppHeader workflowName="AI CANVAS" workflowCount={0} onRun={() => {}} onLogout={onLogout} showProjectSwitcher={false} />

        <main className="mx-auto w-full max-w-[1920px] px-10 pb-14 pt-12">
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-[26px] font-semibold tracking-[-0.04em] text-white">{title}</div>

                {topActionLabel && onTopAction ? (
                  <button
                    type="button"
                    onClick={onTopAction}
                    className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-500 transition hover:text-white"
                  >
                    {topActionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {primaryActionLabel && onPrimaryAction ? (
                <button
                  type="button"
                  onClick={onPrimaryAction}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-[13px] font-semibold text-[#111318] transition hover:bg-white"
                >
                  <Plus className="h-4 w-4" />
                  {primaryActionLabel}
                </button>
              ) : null}
            </div>

            <div className="max-w-xl text-[13px] leading-6 text-slate-500">{subtitle}</div>
          </div>

          {loading && projects.length > 0 ? (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在刷新项目列表...
            </div>
          ) : null}

          <section ref={menuHostRef} className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-4">
            {showCreateTile ? <CreateProjectTile onCreate={handleCreateProject} /> : null}
            {projects.map((project) => (
              <div key={project.id}>
                <ProjectTile
                  project={project}
                  hovered={hoveredMenuId === project.id}
                  menuOpen={menuOpenId === project.id}
                  menuRef={activeMenuRef}
                  onHoverChange={setHoveredMenuId}
                  onOpen={handleOpenProject}
                  onToggleMenu={(projectId) => {
                    setMenuOpenId((current) => (current === projectId ? null : projectId));
                  }}
                  onEdit={handleEditProject}
                  onDuplicate={handleDuplicateProject}
                  onDelete={handleDeleteProject}
                />
              </div>
            ))}
            {loading && projects.length === 0
              ? Array.from({ length: showCreateTile ? 3 : 4 }, (_, index) => <ProjectSkeletonTile key={`skeleton-${index}`} />)
              : null}
          </section>

          {!loading && errorMessage ? (
            <div className="mt-10 rounded-[20px] border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-rose-100">
              <div className="inline-flex items-center gap-3 text-sm font-medium">
                <FolderOpen className="h-4 w-4 text-rose-300/80" />
                {errorMessage}
              </div>
            </div>
          ) : null}

          {!loading && !errorMessage && projects.length === 0 ? (
            <div className="mt-10 rounded-[20px] border border-white/[0.06] bg-[#111318] px-5 py-4 text-slate-400">
              <div className="inline-flex items-center gap-3 text-sm font-medium text-slate-300">
                <FolderOpen className="h-4 w-4 text-slate-500" />
                {emptyMessage}
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <EditProjectDialog
        state={editDialogState}
        isUploadingCover={isUploadingCover}
        isSubmitting={isSubmittingEdit}
        uploadError={coverUploadError}
        onNameChange={(value) => setEditDialogState((current) => (current ? { ...current, name: value } : current))}
        onSelectCoverFile={(event) => void handleCoverFileSelection(event)}
        onClose={() => {
          setEditDialogState(null);
          resetEditDialogFeedback();
        }}
        onSubmit={handleSubmitEditDialog}
      />
    </div>
  );
}
