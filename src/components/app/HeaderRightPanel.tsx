import React from "react";
import { ChevronDown, Loader2, LogOut, Zap } from "lucide-react";
import { type HeaderMenuActionKey, runHeaderMenuAction } from "./headerRightPanelActions";
import {
  fetchCurrentUserInfo,
  formatUserCredits,
  type CurrentUserInfo,
} from "../../features/user/userInfo";

interface HeaderRightPanelProps {
  username?: string;
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

function DefaultAvatar() {
  return (
    <div
      aria-hidden="true"
      className="relative h-full w-full overflow-hidden rounded-[inherit] bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.34),transparent_33%),linear-gradient(135deg,#9f7aea_0%,#6d5dfc_48%,#3b2f91_100%)]"
    >
      <span className="absolute left-1/2 top-[22%] h-[29%] w-[29%] -translate-x-1/2 rounded-full bg-violet-50/90 shadow-[0_0_12px_rgba(255,255,255,0.28)]" />
      <span className="absolute left-1/2 bottom-[15%] h-[34%] w-[56%] -translate-x-1/2 rounded-t-full bg-violet-50/88 shadow-[0_-4px_14px_rgba(255,255,255,0.14)]" />
      <span className="absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-12px_18px_rgba(19,13,55,0.28)]" />
    </div>
  );
}

export default function HeaderRightPanel({
  username = "lccsetsun",
  onLogout,
  variant = "default",
}: HeaderRightPanelProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<HeaderMenuActionKey | null>(null);
  const [userInfo, setUserInfo] = React.useState<CurrentUserInfo | null>(null);
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

  React.useEffect(() => {
    let cancelled = false;

    void fetchCurrentUserInfo()
      .then((info) => {
        if (!cancelled) setUserInfo(info);
      })
      .catch(() => {
        if (!cancelled) setUserInfo(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
  const displayName = userInfo?.displayName || username.trim() || "用户";
  const accountName = userInfo?.username || displayName;
  const creditsLabel = formatUserCredits(userInfo?.credits);
  const isCompact = variant === "compact";
  const panelOpacity = isCompact && !(menuOpen || isBusy) ? 0.78 : 1;

  const buttonClassName = isCompact
    ? `inline-flex h-10 items-center gap-2 rounded-2xl bg-[#141923]/44 px-2.5 py-1.5 shadow-[0_10px_24px_-20px_rgba(0,0,0,0.92)] backdrop-blur-xl transition-all ${
        isBusy ? "cursor-wait" : "cursor-pointer hover:bg-[#141923]/58"
      }`
    : `group flex h-11 items-center gap-2 rounded-2xl border border-violet-200/[0.10] bg-[#151d2b]/88 px-2.5 transition-all duration-200 shadow-[0_16px_34px_-24px_rgba(8,13,24,0.96),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl ${
        isBusy ? "cursor-wait opacity-80" : "cursor-pointer hover:border-violet-200/[0.18] hover:bg-[#182235]/92"
      }`;

  const avatarClassName = isCompact
    ? "grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-violet-200/15 bg-violet-300/[0.105] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_22px_-18px_rgba(139,92,246,0.9)]"
    : "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-200/15 bg-violet-300/[0.105] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_22px_-18px_rgba(139,92,246,0.9)]";

  const menuClassName = isCompact
    ? "absolute right-0 top-[calc(100%+8px)] z-[120] w-[212px] rounded-2xl bg-[#141923]/92 p-2 shadow-[0_18px_36px_-24px_rgba(0,0,0,0.95)] backdrop-blur-xl"
    : "absolute right-0 top-[calc(100%+10px)] z-[120] w-56 overflow-hidden rounded-2xl border border-violet-200/[0.10] bg-[#141c2a]/96 p-2 shadow-[0_24px_60px_-30px_rgba(3,7,18,0.9),0_0_34px_-24px_rgba(139,92,246,0.48),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-2xl";

  const avatarNode = userInfo?.avatarUrl ? (
    <img src={userInfo.avatarUrl} alt={displayName} className="h-full w-full rounded-[inherit] object-cover" />
  ) : (
    <DefaultAvatar />
  );

  return (
    <div className="flex items-center gap-2.5" data-no-canvas-context-menu="true">
      <div ref={menuRef} className="relative">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setMenuOpen((current) => !current)}
          className={buttonClassName}
          style={{ opacity: panelOpacity }}
        >
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-100">
            <Zap className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
            {creditsLabel}
          </span>

          <div className={avatarClassName}>{avatarNode}</div>

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
            <div className="mb-1.5 flex items-center gap-3 rounded-xl border border-violet-200/[0.09] bg-violet-300/[0.065] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
              <div className={avatarClassName}>{avatarNode}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-100">{displayName}</div>
                <div className="truncate text-[11px] text-slate-500">{accountName}</div>
              </div>
            </div>

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
