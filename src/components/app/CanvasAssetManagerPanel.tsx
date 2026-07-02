import React from "react";
import { ArrowDownUp, Check, Image as ImageIcon, ListChecks, Music2, X, ZoomIn, ZoomOut } from "lucide-react";
import type { HistoryCanvasTabOption } from "../../features/api/canvasGenerationDictionaries";
import { listOssResourceAssets } from "../../features/api/ossResourceAssets";
import type { CanvasAsset, CanvasAssetKind } from "../../utils/canvasAssets";

function getAssetKindLabel(kind: CanvasAssetKind) {
  if (kind === "video") return "视频";
  if (kind === "audio") return "音频";
  return "图片";
}

function AssetPreview({ asset }: { asset: CanvasAsset }) {
  if (asset.kind === "image") {
    return <img src={asset.url} alt={asset.nodeTitle} className="h-full w-full object-cover" draggable={false} />;
  }

  if (asset.kind === "video") {
    return <video src={asset.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />;
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#252525] text-slate-300/76">
      <Music2 className="h-5 w-5" />
      <span className="max-w-full truncate px-2 text-[10px] font-semibold">音频素材</span>
    </div>
  );
}

function formatAssetDate(timestamp: number) {
  if (!timestamp) return "未知日期";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "未知日期";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupAssetsByDate(assets: CanvasAsset[]) {
  const groups = new Map<string, CanvasAsset[]>();
  assets.forEach((asset) => {
    const date = formatAssetDate(asset.createdAt);
    groups.set(date, [...(groups.get(date) ?? []), asset]);
  });
  return Array.from(groups.entries()).map(([date, items]) => ({ date, items }));
}

export default function CanvasAssetManagerPanel({
  assets,
  tabs,
  onClose,
  onPreviewAsset,
}: {
  assets: CanvasAsset[];
  tabs: HistoryCanvasTabOption[];
  onClose: () => void;
  onPreviewAsset?: (asset: CanvasAsset) => void;
}) {
  const [activeKind, setActiveKind] = React.useState<CanvasAssetKind | "portrait">(
    () => tabs[0]?.kind ?? "image"
  );
  const [batchMode, setBatchMode] = React.useState(false);
  const [newestFirst, setNewestFirst] = React.useState(true);
  const [remoteAssets, setRemoteAssets] = React.useState<CanvasAsset[]>([]);
  const [remoteError, setRemoteError] = React.useState("");
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<Set<string>>(() => new Set());
  const [tileSize, setTileSize] = React.useState(76);
  const activeTab = React.useMemo(
    () => tabs.find((tab) => tab.kind === activeKind) ?? tabs[0],
    [activeKind, tabs]
  );
  const sourceAssets = remoteAssets.length > 0 || remoteLoading || activeTab?.tabType ? remoteAssets : assets;
  const visibleAssets = React.useMemo(
    () =>
      sourceAssets
        .filter((asset) => activeKind === "portrait" || asset.kind === activeKind)
        .sort((a, b) =>
          newestFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
        ),
    [activeKind, newestFirst, sourceAssets]
  );
  const assetDateGroups = React.useMemo(() => groupAssetsByDate(visibleAssets), [visibleAssets]);

  React.useEffect(() => {
    setSelectedAssetIds(new Set());
  }, [activeKind, batchMode]);

  React.useEffect(() => {
    if (!tabs.some((tab) => tab.kind === activeKind)) {
      setActiveKind(tabs[0]?.kind ?? "image");
    }
  }, [activeKind, tabs]);

  React.useEffect(() => {
    if (!activeTab?.tabType) return;
    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError("");
    setRemoteAssets([]);
    void listOssResourceAssets({
      fileName: "",
      kind: activeTab.kind,
      tabType: activeTab.tabType,
    })
      .then((items) => {
        if (!cancelled) setRemoteAssets(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setRemoteAssets([]);
          console.warn("Failed to load canvas history assets", error);
          setRemoteError("历史资产加载失败，请稍后重试");
        }
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab?.kind, activeTab?.tabType]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      data-canvas-asset-manager="true"
      className="absolute bottom-20 left-4 z-40 flex h-[min(520px,calc(100vh-132px))] w-[min(880px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-violet-200/[0.12] bg-[#151d2b]/94 text-slate-100 shadow-[0_24px_70px_-28px_rgba(8,13,24,0.98),0_0_0_1px_rgba(139,92,246,0.08),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-violet-100/[0.08] bg-[#182131]/78 px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[13px] font-semibold tracking-tight text-slate-100">历史资产</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-[9px] text-slate-300/72 outline-none transition hover:bg-violet-300/[0.08] hover:text-violet-50 focus-visible:ring-2 focus-visible:ring-violet-200/50"
            aria-label="缩小缩略图"
            onClick={() => setTileSize((size) => Math.max(56, size - 10))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-[10px] font-semibold tabular-nums text-slate-300/68">
            {Math.round((tileSize / 76) * 100)}%
          </span>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-[9px] text-slate-300/72 outline-none transition hover:bg-violet-300/[0.08] hover:text-violet-50 focus-visible:ring-2 focus-visible:ring-violet-200/50"
            aria-label="放大缩略图"
            onClick={() => setTileSize((size) => Math.min(118, size + 10))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="ml-1 grid h-7 w-7 place-items-center rounded-[9px] text-slate-300/72 outline-none transition hover:bg-violet-300/[0.08] hover:text-violet-50 focus-visible:ring-2 focus-visible:ring-violet-200/50"
            aria-label="关闭资产管理"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-violet-100/[0.07] bg-[#111827]/46 px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          {tabs.map((filter) => {
            const active = activeKind === filter.kind;
            return (
              <button
                key={filter.kind}
                type="button"
                className={`rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-violet-200/45 ${
                  active
                    ? "bg-violet-300/[0.11] text-violet-50 shadow-[inset_0_0_0_1px_rgba(196,181,253,0.16)]"
                    : "text-slate-400/78 hover:bg-white/[0.045] hover:text-slate-100"
                }`}
              onClick={() => setActiveKind(filter.kind)}
            >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {batchMode && (
            <span className="text-[11px] font-semibold text-slate-300/76">
              已选 {selectedAssetIds.size}
            </span>
          )}
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] font-semibold text-slate-300/76 outline-none transition hover:bg-violet-300/[0.08] hover:text-violet-50 focus-visible:ring-2 focus-visible:ring-violet-200/45"
            title={newestFirst ? "当前：时间倒序" : "当前：时间正序"}
            onClick={() => setNewestFirst((current) => !current)}
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            <span>时间排序</span>
          </button>
          <button
            type="button"
            className={`inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-violet-200/45 ${
              batchMode
                ? "bg-violet-200/90 text-[#151d2b] shadow-[0_10px_24px_-18px_rgba(196,181,253,0.8)]"
                : "text-slate-300/76 hover:bg-violet-300/[0.08] hover:text-violet-50"
            }`}
            onClick={() => setBatchMode((current) => !current)}
          >
            <ListChecks className="h-3.5 w-3.5" />
            <span>{batchMode ? "退出批量" : "批量操作"}</span>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#101827]/58 p-3.5 custom-scrollbar">
        {remoteLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400/72">
            <ImageIcon className="h-8 w-8 animate-pulse text-violet-100/50" />
            <span className="text-[12px] font-semibold">正在加载历史资产</span>
          </div>
        ) : visibleAssets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400/72">
            <ImageIcon className="h-8 w-8 text-violet-100/42" />
            <span className="text-[12px] font-semibold">
              {remoteError || "当前暂无历史资产"}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {assetDateGroups.map((group) => (
              <section key={group.date}>
                <div className="mb-2 text-[11px] font-bold text-slate-200/82">{group.date}</div>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}
                >
                  {group.items.map((asset) => {
                    const selected = selectedAssetIds.has(asset.id);
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        className={`group relative overflow-hidden rounded-[8px] bg-[#0b1220] text-left outline-none transition ${
                          selected
                            ? "shadow-[0_0_0_2px_rgba(196,181,253,0.9),0_18px_38px_-26px_rgba(139,92,246,0.95)]"
                            : "shadow-[0_0_0_1px_rgba(196,181,253,0.11)] hover:shadow-[0_0_0_2px_rgba(196,181,253,0.52),0_18px_38px_-28px_rgba(139,92,246,0.8)] focus-visible:shadow-[0_0_0_2px_rgba(196,181,253,0.8)]"
                        }`}
                        style={{ height: Math.round(tileSize * 1.28) }}
                        title={`${asset.nodeTitle} · ${getAssetKindLabel(asset.kind)}`}
                        onClick={() => {
                          if (batchMode) {
                            setSelectedAssetIds((current) => {
                              const next = new Set(current);
                              if (next.has(asset.id)) next.delete(asset.id);
                              else next.add(asset.id);
                              return next;
                            });
                            return;
                          }
                          onPreviewAsset?.(asset);
                        }}
                      >
                        <AssetPreview asset={asset} />
                        {batchMode && (
                          <span
                            className={`pointer-events-none absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full border text-white transition ${
                              selected
                                ? "border-violet-100 bg-violet-100 text-[#151d2b]"
                                : "border-violet-100/72 bg-[#0b1220]/62"
                            }`}
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                        )}
                        <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/62 px-1.5 py-0.5 text-[9px] font-bold text-white/88 opacity-0 transition group-hover:opacity-100">
                          {getAssetKindLabel(asset.kind)}
                        </span>
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/82 to-transparent px-1.5 pb-1 pt-5 text-[9px] font-semibold text-white/88 opacity-0 transition group-hover:opacity-100">
                          {asset.nodeTitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
