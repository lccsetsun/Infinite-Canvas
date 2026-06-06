import React from "react";
import { ChevronDown, KeyRound, Loader2, LogOut, User } from "lucide-react";
import { type HeaderMenuActionKey, runHeaderMenuAction } from "./headerRightPanelActions";

interface HeaderRightPanelProps {
  username?: string;
  onOpenApiSettings?: () => void | Promise<void>;
  onLogout?: () => void | Promise<void>;
  variant?: "default" | "compact";
}

function AccountMenuItem({
  icon,
  title,
  hint,
  onClick,
  busy = false,
  disabled = false,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        disabled
          ? "cursor-wait text-slate-500"
          : danger
            ? "text-rose-100/90 hover:bg-rose-400/[0.08]"
            : "text-slate-100 hover:bg-white/[0.06]"
      }`}
    >
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
          danger ? "text-rose-200/80" : "text-slate-400"
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-[11px] text-slate-500">{hint}</div>
      </div>
    </button>
  );
}

export default function HeaderRightPanel({
  username = "lccsetsun",
  onOpenApiSettings,
  onLogout,
  variant = "default",
}: HeaderRightPanelProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<HeaderMenuActionKey | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

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

  const runAction = React.useCallback(
    async (actionKey: HeaderMenuActionKey, action?: () => void | Promise<void>) => {
      if (!action) return;
      await runHeaderMenuAction({
        actionKey,
        pendingAction,
        setPendingAction,
        action: async () => {
          await action();
          setMenuOpen(false);
        },
      });
    },
    [pendingAction]
  );

  const isBusy = pendingAction !== null;
  const displayName = username.trim() || "用户";
  const avatarText = displayName.slice(0, 1).toUpperCase();
  const isCompact = variant === "compact";
  const panelOpacity = isCompact && !(menuOpen || isBusy) ? 0.64 : 1;

  const buttonClassName = isCompact
    ? `inline-flex h-10 items-center gap-2 rounded-2xl bg-[#141923]/34 px-2.5 py-1.5 shadow-[0_10px_24px_-20px_rgba(0,0,0,0.92)] backdrop-blur-xl transition-all ${
        isBusy ? "cursor-wait" : "cursor-pointer hover:bg-[#141923]/48"
      }`
    : `group flex items-center gap-3 rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(17,22,33,0.88),rgba(11,15,24,0.84))] px-3.5 py-2.5 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)] transition-all duration-200 ${
        isBusy
          ? "cursor-wait opacity-80"
          : "cursor-pointer hover:border-white/12 hover:bg-[#111827]"
      }`;

  const avatarClassName = isCompact
    ? "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#7c5cff,#d24dff)] text-xs font-bold text-white shadow-[0_8px_18px_-10px_rgba(124,92,255,0.8)]"
    : "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-bold text-white shadow-[0_8px_24px_rgba(99,102,241,0.32)]";

  const menuClassName = isCompact
    ? "absolute right-0 top-[calc(100%+8px)] z-[120] w-[188px] rounded-2xl bg-[#141923]/88 p-2 shadow-[0_18px_36px_-24px_rgba(0,0,0,0.95)] backdrop-blur-xl"
    : "absolute right-0 top-[calc(100%+10px)] z-[120] w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]/96 p-2 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] backdrop-blur-2xl";

  return (
    <div className="flex items-center gap-3" data-no-canvas-context-menu="true">
      <div ref={menuRef} className="relative">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setMenuOpen((current) => !current)}
          className={buttonClassName}
          style={{ opacity: panelOpacity }}
        >
          <div className={avatarClassName}>{avatarText || <User className="h-4 w-4" />}</div>

          <div className="hidden min-w-0 text-left sm:block">
            <div
              className={`truncate font-semibold tracking-[-0.02em] text-slate-100 ${
                isCompact ? "max-w-[120px] text-[13px]" : "max-w-[140px] text-sm"
              }`}
            >
              {displayName}
            </div>

            {!isCompact ? (
              <div className="text-[11px] text-slate-500">
                {pendingAction === "logout"
                  ? "正在退出..."
                  : pendingAction === "api-settings"
                    ? "正在打开设置..."
                    : "账号菜单"}
              </div>
            ) : null}
          </div>

          {isBusy ? (
            <Loader2 className={`${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0 animate-spin text-slate-300`} />
          ) : (
            <ChevronDown
              className={`${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0 text-slate-500 transition-transform ${
                menuOpen ? "rotate-180 text-slate-300" : ""
              }`}
            />
          )}
        </button>

        {menuOpen ? (
          <div className={menuClassName}>
            <AccountMenuItem
              icon={<KeyRound className="h-4 w-4" />}
              title="API 设置"
              hint={pendingAction === "api-settings" ? "正在打开..." : "管理服务配置"}
              disabled={isBusy}
              busy={pendingAction === "api-settings"}
              onClick={() => void runAction("api-settings", onOpenApiSettings)}
            />

            <AccountMenuItem
              icon={<LogOut className="h-4 w-4" />}
              title="退出登录"
              hint={pendingAction === "logout" ? "正在退出..." : "清理当前会话"}
              disabled={isBusy}
              busy={pendingAction === "logout"}
              danger
              onClick={() => void runAction("logout", onLogout)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
