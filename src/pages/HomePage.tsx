import React from "react";
import { motion } from "motion/react";
import { ArrowRight, FolderOpen, Image as ImageIcon, MoreHorizontal, Plus, Sparkles } from "lucide-react";
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

interface HomePageProps {
  onLogout: () => void;
  onOpenCanvas: (projectId?: string) => void;
}

type ProjectDialogState =
  | { type: "rename"; projectId: string; value: string }
  | { type: "cover"; projectId: string; value: string }
  | null;

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function PlaceholderPreview() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#20232a_0%,#181b22_100%)]">
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.32) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.32) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(99,102,241,0.15),transparent_30%),radial-gradient(circle_at_50%_92%,rgba(56,189,248,0.08),transparent_36%)]" />
      <div className="relative flex h-26 w-26 items-center justify-center rounded-[28px] border border-white/[0.07] bg-black/12 backdrop-blur-md">
        <ImageIcon className="h-12 w-12 text-white/18" />
      </div>
    </div>
  );
}

interface HomeProjectTileProps {
  project: HomeProjectCard;
  onOpen: (projectId: string) => void;
  menuOpen: boolean;
  onToggleMenu: (projectId: string) => void;
  onRename: (projectId: string) => void;
  onChangeCover: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

function HomeProjectTile({
  project,
  onOpen,
  menuOpen,
  onToggleMenu,
  onRename,
  onChangeCover,
  onDuplicate,
  onDelete,
}: HomeProjectTileProps): React.JSX.Element {
  return (
    <motion.div whileHover={{ y: -4 }} className="group block w-full text-left">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onOpen(project.id)}
          className="relative block w-full overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#1f232b] shadow-[0_24px_60px_-38px_rgba(0,0,0,0.92)] transition-all duration-300 group-hover:border-white/[0.12] group-hover:shadow-[0_28px_70px_-40px_rgba(0,0,0,0.98)]"
        >
          <div className="relative aspect-[1.58/1] overflow-hidden">
            {project.previewUrl ? (
              <img
                src={project.previewUrl}
                alt={project.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            ) : (
              <PlaceholderPreview />
            )}
          </div>
        </button>

        <div className="relative flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <div className="truncate text-[18px] font-medium tracking-[-0.03em] text-white">{project.name}</div>
            <div className="mt-1 text-[13px] text-slate-500">{formatDate(project.updatedAt)}</div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleMenu(project.id);
            }}
            className={`rounded-xl p-2 transition-all duration-200 ${
              menuOpen
                ? "bg-white/[0.05] text-slate-200 opacity-100"
                : "text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-white/[0.05] hover:text-slate-200"
            }`}
            aria-label={`${project.name} 菜单`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-48 overflow-hidden rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(46,48,52,0.98),rgba(38,40,44,0.98))] p-2 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.78)] backdrop-blur-xl">
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
                  className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-[15px] font-semibold tracking-[-0.02em] transition ${
                    item.danger
                      ? "text-rose-100/92 hover:bg-white/[0.055] hover:text-white"
                      : "text-white/96 hover:bg-white/[0.055] hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

function CreateProjectTile({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      type="button"
      onClick={onCreate}
      className="group block w-full text-left"
    >
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-[20px] border border-white/[0.07] bg-[linear-gradient(180deg,#2d3138_0%,#1f242d_100%)] shadow-[0_24px_60px_-38px_rgba(0,0,0,0.92)] transition-all duration-300 group-hover:border-white/[0.12] group-hover:shadow-[0_28px_70px_-40px_rgba(0,0,0,0.98)]">
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.34) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.34) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_26%,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_50%_88%,rgba(99,102,241,0.14),transparent_42%)]" />
          <div className="relative flex aspect-[1.58/1] flex-col items-center justify-center gap-4 px-6 text-white">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_0_50px_rgba(148,163,184,0.08)]">
              <Plus className="h-11 w-11" />
            </div>
            <div className="text-center">
              <div className="text-[20px] font-semibold tracking-[-0.03em]">开始创作</div>
              <div className="mt-2 text-[14px] text-slate-400">新建一个 AI 画布项目</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#343940] px-5 py-4">
          <div className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-100">
            <Sparkles className="h-4 w-4 text-slate-300" />
            立即进入
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </motion.button>
  );
}

function ProjectActionDialog({
  state,
  onValueChange,
  onClose,
  onSubmit,
}: {
  state: ProjectDialogState;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}): React.JSX.Element | null {
  if (!state) return null;

  const isRename = state.type === "rename";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(31,35,43,0.98),rgba(24,27,34,0.98))] shadow-[0_30px_90px_-30px_rgba(0,0,0,0.88)]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <div className="text-[22px] font-semibold tracking-[-0.03em] text-white">{isRename ? "重命名项目" : "修改封面"}</div>
          <div className="mt-1 text-sm text-slate-400">
            {isRename ? "为当前项目设置一个更清晰的名称。" : "填写一张可访问的图片 URL 作为项目封面。"}
          </div>
        </div>

        <div className="px-6 py-5">
          <label className="mb-2 block text-sm font-medium text-slate-300">
            {isRename ? "项目名称" : "封面地址"}
          </label>
          <input
            autoFocus
            value={state.value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSubmit();
              if (event.key === "Escape") onClose();
            }}
            placeholder={isRename ? "请输入项目名称" : "https://example.com/cover.png"}
            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/28 focus:bg-white/[0.05]"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-2xl bg-[linear-gradient(90deg,#4f46e5_0%,#7c3aed_50%,#a855f7_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_32px_-16px_rgba(124,58,237,0.9)] transition hover:brightness-110"
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
  const [dialogState, setDialogState] = React.useState<ProjectDialogState>(null);
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

  const handleRenameProject = React.useCallback(
    (projectId: string) => {
      const target = projects.find((project) => project.id === projectId);
      setDialogState({ type: "rename", projectId, value: target?.name ?? "" });
      setMenuOpenId(null);
    },
    [projects]
  );

  const handleChangeCover = React.useCallback((projectId: string) => {
    const target = projects.find((project) => project.id === projectId);
    setDialogState({ type: "cover", projectId, value: target?.previewUrl ?? "" });
    setMenuOpenId(null);
  }, [projects]);

  const handleDuplicateProject = React.useCallback(
    (projectId: string) => {
      duplicateHomeProject(projectId);
      refreshProjects();
      setMenuOpenId(null);
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
    },
    [refreshProjects]
  );

  const handleSubmitDialog = React.useCallback(() => {
    if (!dialogState) return;
    const value = dialogState.value.trim();

    if (dialogState.type === "rename") {
      if (!value) return;
      if (renameHomeProject(dialogState.projectId, value)) {
        refreshProjects();
      }
    } else {
      if (updateHomeProjectCover(dialogState.projectId, value)) {
        refreshProjects();
      }
    }

    setDialogState(null);
  }, [dialogState, refreshProjects]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#14161b] text-[#e2e8f0]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_24%),radial-gradient(circle_at_82%_14%,rgba(34,211,238,0.06),transparent_20%),linear-gradient(180deg,#17181c_0%,#121316_100%)]" />
      <div className="absolute inset-0 opacity-[0.045]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.85) 1px, transparent 0)", backgroundSize: "24px 24px" }} />

      <div className="relative z-10">
        <AppHeader workflowName="AI CANVAS" workflowCount={0} onRun={() => {}} onLogout={onLogout} showProjectSwitcher={false} />

        <main className="mx-auto w-full max-w-[1920px] px-10 pb-12 pt-12">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="text-[28px] font-semibold tracking-[-0.04em] text-white">最近项目</div>
            </div>
            <button
              type="button"
              onClick={onOpenCanvas}
              className="inline-flex items-center gap-2 text-[15px] font-medium text-slate-400 transition hover:text-white"
            >
              全部项目
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <section ref={menuHostRef} className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <CreateProjectTile onCreate={handleCreateProject} />
            {projects.map((project) => (
              <div key={project.id}>
                <HomeProjectTile
                  project={project}
                  onOpen={handleOpenProject}
                  menuOpen={menuOpenId === project.id}
                  onToggleMenu={(projectId) => setMenuOpenId((current) => (current === projectId ? null : projectId))}
                  onRename={handleRenameProject}
                  onChangeCover={handleChangeCover}
                  onDuplicate={handleDuplicateProject}
                  onDelete={handleDeleteProject}
                />
              </div>
            ))}
          </section>

          {projects.length === 0 ? (
            <div className="mt-8 rounded-[28px] border border-white/[0.06] bg-white/[0.02] p-8 text-slate-400">
              <div className="inline-flex items-center gap-3 text-base font-medium text-slate-300">
                <FolderOpen className="h-5 w-5 text-cyan-300/80" />
                还没有最近项目，点击左侧卡片开始创建。
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <ProjectActionDialog
        state={dialogState}
        onValueChange={(value) =>
          setDialogState((current) => (current ? { ...current, value } : current))
        }
        onClose={() => setDialogState(null)}
        onSubmit={handleSubmitDialog}
      />
    </div>
  );
}
