import React from "react";
import { ChevronDown, KeyRound, Loader2, LogOut, User } from "lucide-react";
import { type HeaderMenuActionKey, runHeaderMenuAction } from "./headerRightPanelActions";

interface HeaderRightPanelProps {
  username?: string;
  onOpenApiSettings?: () => void | Promise<void>;
  onLogout?: () => void | Promise<void>;
}

export default function HeaderRightPanel({
  username = "lccsetsun",
  onOpenApiSettings,
  onLogout,
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

  return (
    <div className="flex items-center gap-3">
      <div ref={menuRef} className="relative">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setMenuOpen((current) => !current)}
          className={`group flex items-center gap-3 rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(17,22,33,0.88),rgba(11,15,24,0.84))] px-3.5 py-2.5 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)] transition-all duration-200 ${
            isBusy
              ? "cursor-wait opacity-80"
              : "cursor-pointer hover:border-white/12 hover:bg-[#111827]"
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-bold text-white shadow-[0_8px_24px_rgba(99,102,241,0.32)]">
            {avatarText || <User className="h-4 w-4" />}
          </div>
          <div className="hidden min-w-0 text-left sm:block">
            <div className="max-w-[140px] truncate text-sm font-semibold text-slate-100">
              {displayName}
            </div>
            <div className="text-[11px] text-slate-500">
              {pendingAction === "logout"
                ? "正在退出..."
                : pendingAction === "api-settings"
                  ? "正在打开设置..."
                  : "账号菜单"}
            </div>
          </div>
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
          ) : (
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${menuOpen ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-[calc(100%+10px)] z-[120] w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]/96 p-2 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void runAction("api-settings", onOpenApiSettings)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                isBusy
                  ? "cursor-wait text-slate-500"
                  : "text-slate-100 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {pendingAction === "api-settings" ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              <div className="flex min-w-0 flex-col">
                <span>API 设置</span>
                <span className="text-[11px] text-slate-500">
                  {pendingAction === "api-settings" ? "正在打开..." : "查看和管理服务配置"}
                </span>
              </div>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => void runAction("logout", onLogout)}
              className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                isBusy
                  ? "cursor-wait text-slate-500"
                  : "text-slate-100 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {pendingAction === "logout" ? (
                <Loader2 className="h-4 w-4 animate-spin text-rose-300" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <div className="flex min-w-0 flex-col">
                <span>退出登录</span>
                <span className="text-[11px] text-slate-500">
                  {pendingAction === "logout" ? "正在退出..." : "立即清理本地会话"}
                </span>
              </div>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
