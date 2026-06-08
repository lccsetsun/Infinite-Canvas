import React from "react";
import { motion } from "motion/react";
import { ChevronDown, FolderPlus, Home, Layers3, Loader2, Trash2 } from "lucide-react";
import HeaderRightPanel from "./HeaderRightPanel";
import aiCanvasMark from "../../assets/brand/ai-canvas-mark.svg";
import { createRemoteProject, deleteRemoteProject } from "../../features/workspace/remoteCanvas";

interface CanvasHeaderProps {
  projectName?: string;
  username?: string;
  onOpenApiSettings?: () => void;
  onLogout?: () => void;
}

type ProjectMenuAction = "create" | "delete" | null;

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

function MenuItem({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
  busy = false,
}: {
  icon: React.ReactNode;
  label: string;
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
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition ${
        disabled
          ? "cursor-not-allowed text-slate-500"
          : danger
            ? "text-rose-100/92 hover:bg-rose-400/[0.08]"
            : "text-slate-100 hover:bg-white/[0.04]"
      }`}
    >
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
          danger ? "text-rose-200/80" : "text-slate-400"
        }`}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      </div>
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function CanvasHeader({
  projectName: loadedProjectName,
  username = "lccsetsun",
  onOpenApiSettings,
  onLogout,
}: CanvasHeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<ProjectMenuAction>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const projectName = getCanvasHeaderProjectName(loadedProjectName);

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
  const isVisible = menuOpen || isBusy;

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-[120] flex h-16 items-center justify-between overflow-visible px-5"
    >
      <motion.div
        ref={menuRef}
        data-no-canvas-context-menu="true"
        initial={{ x: -14, opacity: 0 }}
        animate={{ x: 0, opacity: isVisible ? 1 : 0.64 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.24 }}
        className="relative flex min-w-0 items-center"
      >
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setMenuOpen((current) => !current)}
          className={`inline-flex h-10 max-w-[188px] items-center gap-2.5 rounded-2xl bg-[#141923]/34 px-3 py-1.5 text-left shadow-[0_10px_24px_-20px_rgba(0,0,0,0.92)] backdrop-blur-xl transition-all ${
            isBusy ? "cursor-wait" : "cursor-pointer hover:bg-[#141923]/48"
          }`}
        >
          <BrandGlyph />

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-slate-100">
              {projectName}
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
            className="absolute left-0 top-[calc(100%+8px)] z-[130] w-[196px] rounded-2xl bg-[#141923]/88 p-2 shadow-[0_18px_36px_-24px_rgba(0,0,0,0.95)] backdrop-blur-xl"
          >
            <MenuItem icon={<Home className="h-4 w-4" />} label="回到主页" onClick={() => navigateTo("/")} />
            <MenuItem
              icon={<Layers3 className="h-4 w-4" />}
              label="全部项目"
              onClick={() => navigateTo("/projects")}
            />

            <div className="my-1.5 h-px bg-white/[0.06]" />

            <MenuItem
              icon={<FolderPlus className="h-4 w-4" />}
              label="创建项目"
              disabled={isBusy}
              busy={pendingAction === "create"}
              onClick={() => void handleCreateProject()}
            />
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

      <HeaderRightPanel
        username={username}
        onOpenApiSettings={onOpenApiSettings}
        onLogout={onLogout}
        variant="compact"
      />
    </motion.header>
  );
}
