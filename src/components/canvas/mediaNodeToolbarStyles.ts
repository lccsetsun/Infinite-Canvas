export const mediaNodeFloatingToolbarClass =
  "absolute left-1/2 top-0 z-40 flex h-11 -translate-x-1/2 -translate-y-[calc(100%+30px)] items-center gap-1 rounded-[15px] border border-slate-400/12 bg-[#111925]/82 px-2.5 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.86),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-xl";

export const mediaNodeFloatingToolbarRaisedClass =
  "absolute left-1/2 top-0 z-[70] flex h-11 -translate-x-1/2 -translate-y-[calc(100%+30px)] items-center gap-1 rounded-[15px] border border-slate-400/12 bg-[#111925]/82 px-2.5 shadow-[0_12px_28px_-20px_rgba(0,0,0,0.86),inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-xl";

export const mediaNodeToolbarButtonClass =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-slate-300/72 transition-colors hover:bg-white/[0.055] hover:text-slate-50";

export const mediaNodeToolbarUploadButtonClass =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] text-slate-300/72 transition-colors hover:bg-white/[0.055] hover:text-slate-50 disabled:cursor-wait disabled:text-slate-500";

export const mediaNodeToolbarDividerClass = "mx-0.5 h-5 w-px bg-slate-400/14";

export function getReadableCanvasOverlayScale(canvasZoom: number, minCanvasZoom = 0.15) {
  const normalizedZoom = Number.isFinite(canvasZoom) && canvasZoom > 0 ? canvasZoom : 1;
  return 1 / Math.max(minCanvasZoom, Math.min(1, normalizedZoom));
}
