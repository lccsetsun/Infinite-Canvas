import React from "react";
import { ConfigProvider, theme } from "antd";
import { X } from "lucide-react";
import type { ApiSettings } from "../../features/api/apiSettings";

const ApiSettingsPage = React.lazy(() => import("../pages/ApiSettingsPage"));

interface ApiSettingsModalProps {
  open: boolean;
  settings: ApiSettings;
  onClose: () => void;
  onSave: (settings: ApiSettings) => void;
  showNotice: (message: string, kind?: "info" | "success" | "warning" | "error") => void;
}

export default function ApiSettingsModal({
  open,
  settings,
  onClose,
  onSave,
  showNotice,
}: ApiSettingsModalProps) {
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#6366f1",
          borderRadius: 12,
        },
      }}
    >
      <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/62 px-5 py-6 backdrop-blur-sm">
        <div className="relative h-[min(820px,calc(100vh-48px))] w-[min(1120px,calc(100vw-40px))] overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0f1218] shadow-[0_30px_110px_rgba(0,0,0,0.55)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-[260] grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="关闭 API 设置"
          >
            <X className="h-4 w-4" />
          </button>

          <React.Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                正在加载 API 设置...
              </div>
            }
          >
            <div className="relative h-full">
              <ApiSettingsPage initial={settings} onSave={onSave} showNotice={showNotice} />
            </div>
          </React.Suspense>
        </div>
      </div>
    </ConfigProvider>
  );
}
