import React from "react";
import { motion } from "motion/react";
import { createPortal } from "react-dom";
import { ArrowRight, FolderOpen, Image as ImageIcon, MoreHorizontal, Plus } from "lucide-react";
import AppHeader from "../components/app/AppHeader";
import {
  createHomeProject,
  deleteHomeProject,
  duplicateHomeProject,
  listRecentHomeProjects,
  openHomeProject,
  renameHomeProject,
  updateHomeProjectCover,
  type HomeProjectCard,
} from "../features/workspace/homeWorkspace";
import { getHomeProjectMenuPosition } from "../utils/homeProjectMenuPosition";
import { getHomeProjectMenuState } from "../utils/homeProjectMenuState";
import { resolveInlineProjectRename } from "../utils/inlineProjectRename";

interface HomePageProps {
  onLogout: () => void;
  onOpenCanvas: (projectId?: string) => void;
}

type CoverDialogState = { projectId: string; value: string } | null;
type InlineRenameState = { projectId: string; value: string; originalName: string } | null;

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
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
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
  onRename,
  onChangeCover,
  onDuplicate,
  onDelete,
}: {
  project: HomeProjectCard;
  style: { left: number; top: number };
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onOpen: (projectId: string) => void;
  onRename: (projectId: string) => void;
  onChangeCover: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}) {
  return createPortal(
    <div
      className="fixed z-40 w-48 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#14171c] p-1.5 shadow-[0_20px_48px_rgba(0,0,0,0.34)]"
      style={style}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      {[
        { label: "打开", onClick: () => onOpen(project.id) },
        { label: "重命名", onClick: () => onRename(project.id) },
        { label: "修改封面", onClick: () => onChangeCover(project.id) },
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

interface HomeProjectTileProps {
  project: HomeProjectCard;
  hovered: boolean;
  menuOpen: boolean;
  renameValue: string | null;
  onRenameValueChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onHoverChange: (projectId: string | null) => void;
  onOpen: (projectId: string) => void;
  onToggleMenu: (projectId: string) => void;
  onRename: (projectId: string) => void;
  onChangeCover: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

function HomeProjectTile({
  project,
  hovered,
  menuOpen,
  renameValue,
  onRenameValueChange,
  onRenameCommit,
  onRenameCancel,
  onHoverChange,
  onOpen,
  onToggleMenu,
  onRename,
  onChangeCover,
  onDuplicate,
  onDelete,
}: HomeProjectTileProps): React.JSX.Element {
  const menuState = getHomeProjectMenuState(project.id, hovered ? project.id : null, menuOpen ? project.id : null);
  const isRenaming = renameValue !== null;
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const renameInputRef = React.useRef<HTMLInputElement | null>(null);
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

  React.useEffect(() => {
    return () => {
      clearHoverLeaveTimer();
    };
  }, [clearHoverLeaveTimer]);

  React.useEffect(() => {
    if (!isRenaming || !renameInputRef.current) return;
    renameInputRef.current.focus();
    renameInputRef.current.select();
  }, [isRenaming]);

  return (
    <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.16 }} className="group">
      <button type="button" onClick={() => onOpen(project.id)} className="block w-full cursor-pointer text-left">
        <div className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#111318] transition-colors duration-200 group-hover:border-white/[0.09] group-hover:bg-[#14171c]">
          <div className="aspect-[1.7/1] overflow-hidden bg-[#16191f]">
            {project.previewUrl ? (
              <img src={project.previewUrl} alt={project.name} className="h-full w-full object-cover" />
            ) : (
              <PlaceholderPreview />
            )}
          </div>
        </div>
      </button>

      <div className="mt-2.5 flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="h-8">
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(event) => onRenameValueChange(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onBlur={onRenameCommit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onRenameCommit();
                  if (event.key === "Escape") onRenameCancel();
                }}
                className="h-8 w-full rounded-md border border-transparent border-b-white/[0.16] bg-white/[0.02] px-2 text-[14px] font-medium tracking-[-0.01em] text-white outline-none transition placeholder:text-slate-500 focus:border-white/[0.08] focus:border-b-white/[0.28] focus:bg-white/[0.035]"
                aria-label={`重命名 ${project.name}`}
              />
            ) : (
              <div className="flex h-8 items-center truncate text-[14px] font-medium tracking-[-0.01em] text-slate-100">
                {project.name}
              </div>
            )}
          </div>
          <div className="mt-1 text-[12px] text-slate-500">{formatDate(project.updatedAt)}</div>
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
              isRenaming
                ? "pointer-events-none opacity-30"
                : menuState.menuVisible
                  ? "bg-white/[0.06] text-slate-100"
                  : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
            aria-label={`${project.name} 菜单`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {!isRenaming && menuState.menuVisible && menuStyle ? (
            <ProjectMenu
              project={project}
              style={menuStyle}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
              onOpen={onOpen}
              onRename={onRename}
              onChangeCover={onChangeCover}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

function CreateProjectTile({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      transition={{ duration: 0.16 }}
      type="button"
      onClick={onCreate}
      className="group block w-full cursor-pointer text-left"
    >
      <div className="overflow-hidden rounded-[18px] border border-dashed border-white/[0.1] bg-[#111318] transition-colors duration-200 hover:border-white/[0.14] hover:bg-[#14171c]">
        <div className="flex aspect-[1.7/1] flex-col items-center justify-center gap-3 bg-[#16191f] px-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025] text-slate-100">
            <Plus className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium tracking-[-0.01em] text-slate-100">新建项目</div>
          <div className="mt-1 text-[12px] text-slate-500">创建新的 AI 画布项目</div>
        </div>

        <div className="shrink-0 rounded-lg p-1.5 text-slate-600 transition-colors group-hover:text-slate-400">
          <Plus className="h-4 w-4" />
        </div>
      </div>
    </motion.button>
  );
}

function CoverDialog({
  state,
  onValueChange,
  onClose,
  onSubmit,
}: {
  state: CoverDialogState;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}): React.JSX.Element | null {
  if (!state) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111318] shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <div className="text-[19px] font-semibold text-white">修改封面</div>
          <div className="mt-1 text-sm text-slate-400">填写一张可访问的图片 URL 作为项目封面。</div>
        </div>

        <div className="px-6 py-5">
          <label className="mb-2 block text-sm font-medium text-slate-300">封面地址</label>
          <input
            autoFocus
            value={state.value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSubmit();
              if (event.key === "Escape") onClose();
            }}
            placeholder="https://example.com/cover.png"
            className="w-full rounded-2xl border border-white/[0.08] bg-[#16191f] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-slate-500 focus:border-white/[0.16]"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-[#111318] transition hover:bg-white"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage({ onLogout, onOpenCanvas }: HomePageProps) {
  const [projects, setProjects] = React.useState<HomeProjectCard[]>(() => listRecentHomeProjects(4));
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);
  const [hoveredMenuId, setHoveredMenuId] = React.useState<string | null>(null);
  const [coverDialogState, setCoverDialogState] = React.useState<CoverDialogState>(null);
  const [inlineRenameState, setInlineRenameState] = React.useState<InlineRenameState>(null);
  const menuHostRef = React.useRef<HTMLDivElement | null>(null);

  const refreshProjects = React.useCallback(() => {
    setProjects(listRecentHomeProjects(4));
  }, []);

  React.useEffect(() => {
    refreshProjects();
    window.addEventListener("focus", refreshProjects);
    window.addEventListener("storage", refreshProjects);
    return () => {
      window.removeEventListener("focus", refreshProjects);
      window.removeEventListener("storage", refreshProjects);
    };
  }, [refreshProjects]);

  React.useEffect(() => {
    if (!menuOpenId) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuHostRef.current && !menuHostRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
        setHoveredMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpenId]);

  const handleOpenProject = React.useCallback(
    (projectId: string) => {
      if (!openHomeProject(projectId)) return;
      onOpenCanvas(projectId);
    },
    [onOpenCanvas]
  );

  const handleCreateProject = React.useCallback(() => {
    const projectId = createHomeProject();
    refreshProjects();
    onOpenCanvas(projectId);
  }, [onOpenCanvas, refreshProjects]);

  const finalizeInlineRename = React.useCallback(
    (mode: "commit" | "cancel") => {
      if (!inlineRenameState) return;

      const currentState = inlineRenameState;
      setInlineRenameState(null);

      if (mode === "cancel") return;

      const renameResult = resolveInlineProjectRename(currentState.value, currentState.originalName);
      if (!renameResult.shouldPersist) return;

      if (renameHomeProject(currentState.projectId, renameResult.nextName)) {
        refreshProjects();
      }
    },
    [inlineRenameState, refreshProjects]
  );

  const handleRenameProject = React.useCallback(
    (projectId: string) => {
      if (inlineRenameState && inlineRenameState.projectId !== projectId) {
        const renameResult = resolveInlineProjectRename(inlineRenameState.value, inlineRenameState.originalName);
        if (renameResult.shouldPersist && renameHomeProject(inlineRenameState.projectId, renameResult.nextName)) {
          refreshProjects();
        }
      }

      const target = projects.find((project) => project.id === projectId);
      setInlineRenameState({
        projectId,
        value: target?.name ?? "",
        originalName: target?.name ?? "",
      });
      setMenuOpenId(null);
      setHoveredMenuId(null);
    },
    [inlineRenameState, projects, refreshProjects]
  );

  const handleChangeCover = React.useCallback(
    (projectId: string) => {
      const target = projects.find((project) => project.id === projectId);
      setCoverDialogState({ projectId, value: target?.previewUrl ?? "" });
      setMenuOpenId(null);
      setHoveredMenuId(null);
    },
    [projects]
  );

  const handleDuplicateProject = React.useCallback(
    (projectId: string) => {
      duplicateHomeProject(projectId);
      refreshProjects();
      setMenuOpenId(null);
      setHoveredMenuId(null);
    },
    [refreshProjects]
  );

  const handleDeleteProject = React.useCallback(
    (projectId: string) => {
      if (!window.confirm("确认删除这个项目吗？")) return;
      if (deleteHomeProject(projectId)) {
        refreshProjects();
      }
      setMenuOpenId(null);
      setHoveredMenuId(null);
    },
    [refreshProjects]
  );

  const handleSubmitCoverDialog = React.useCallback(() => {
    if (!coverDialogState) return;
    if (updateHomeProjectCover(coverDialogState.projectId, coverDialogState.value)) {
      refreshProjects();
    }
    setCoverDialogState(null);
  }, [coverDialogState, refreshProjects]);

  return (
    <div className="min-h-screen bg-[#0d0f13] text-slate-100">
      <div className="relative z-10">
        <AppHeader workflowName="AI CANVAS" workflowCount={0} onRun={() => {}} onLogout={onLogout} showProjectSwitcher={false} />

        <main className="mx-auto w-full max-w-[1920px] px-10 pb-14 pt-12">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="text-[26px] font-semibold tracking-[-0.04em] text-white">最近项目</div>
              <div className="mt-1.5 text-[12px] text-slate-500">继续最近编辑过的画布项目。</div>
            </div>

            <button
              type="button"
              onClick={onOpenCanvas}
              className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-400 transition hover:text-white"
            >
              全部项目
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <section ref={menuHostRef} className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-4">
            <CreateProjectTile onCreate={handleCreateProject} />
            {projects.map((project) => (
              <div key={project.id}>
                <HomeProjectTile
                  project={project}
                  hovered={hoveredMenuId === project.id}
                  menuOpen={menuOpenId === project.id}
                  renameValue={inlineRenameState?.projectId === project.id ? inlineRenameState.value : null}
                  onRenameValueChange={(value) =>
                    setInlineRenameState((current) =>
                      current && current.projectId === project.id ? { ...current, value } : current
                    )
                  }
                  onRenameCommit={() => finalizeInlineRename("commit")}
                  onRenameCancel={() => finalizeInlineRename("cancel")}
                  onHoverChange={setHoveredMenuId}
                  onOpen={handleOpenProject}
                  onToggleMenu={(projectId) => {
                    setMenuOpenId((current) => (current === projectId ? null : projectId));
                  }}
                  onRename={handleRenameProject}
                  onChangeCover={handleChangeCover}
                  onDuplicate={handleDuplicateProject}
                  onDelete={handleDeleteProject}
                />
              </div>
            ))}
          </section>

          {projects.length === 0 ? (
            <div className="mt-10 rounded-[20px] border border-white/[0.06] bg-[#111318] px-5 py-4 text-slate-400">
              <div className="inline-flex items-center gap-3 text-sm font-medium text-slate-300">
                <FolderOpen className="h-4 w-4 text-slate-500" />
                还没有最近项目，先创建一个开始吧。
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <CoverDialog
        state={coverDialogState}
        onValueChange={(value) => setCoverDialogState((current) => (current ? { ...current, value } : current))}
        onClose={() => setCoverDialogState(null)}
        onSubmit={handleSubmitCoverDialog}
      />
    </div>
  );
}
