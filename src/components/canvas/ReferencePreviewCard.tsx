import { Clapperboard, FileText, Music4, X } from "lucide-react";

export type ReferencePreviewKind = "image" | "video" | "audio" | "text" | "asset";

export interface ReferencePreviewItem {
  kind: ReferencePreviewKind;
  linkId?: string;
  title: string;
  value: string;
}

export function getReferencePreviewCardLayout(_kind: ReferencePreviewKind) {
  return {
    containerClassName: "h-14 w-14",
  };
}

export function getReferencePreviewCardIconFrameClassName(_kind: ReferencePreviewKind) {
  return "flex h-full w-full items-center justify-center text-violet-100/78";
}

function getReferenceIcon(kind: ReferencePreviewKind, compact = false) {
  const className = compact ? "h-4 w-4" : "h-6 w-6";
  if (kind === "video") return <Clapperboard className={className} />;
  if (kind === "audio") return <Music4 className={className} />;
  return <FileText className={className} />;
}

function getReferencePreviewContent(reference: ReferencePreviewItem, index: number) {
  if (reference.kind === "image") {
    return (
      <img
        src={reference.value}
        alt={`reference preview ${index + 1}`}
        className="h-full w-full max-w-none rounded-[14px] object-contain"
        draggable={false}
      />
    );
  }

  if (reference.kind === "video") {
    return (
      <video
        src={reference.value}
        className="h-full w-full max-w-none rounded-[14px] bg-black object-contain"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  if (reference.kind === "text") {
    return (
      <div className="h-full w-full overflow-y-auto rounded-[14px] bg-[#121a28] px-4 py-3 text-left text-[13px] leading-6 text-slate-100/88 custom-scrollbar">
        {reference.value}
      </div>
    );
  }

  return (
    <div className="flex h-[180px] w-[280px] flex-col items-center justify-center gap-3 rounded-[14px] bg-[#121a28] text-slate-200/78">
      {getReferenceIcon(reference.kind)}
      <span className="max-w-[220px] truncate text-[13px] font-medium">{reference.title}</span>
    </div>
  );
}

export function ReferencePreviewCard({
  compact = false,
  index,
  onRemove,
  reference,
}: {
  compact?: boolean;
  index: number;
  onRemove?: (reference: ReferencePreviewItem) => void;
  reference: ReferencePreviewItem;
}) {
  const isImageReference = reference.kind === "image";
  const { containerClassName } = getReferencePreviewCardLayout(reference.kind);
  const roundedClassName = compact ? "rounded-[9px]" : "rounded-[14px]";
  return (
    <div
      className={`group/reference relative shrink-0 cursor-pointer overflow-visible ${
        compact ? `h-9 w-9 ${roundedClassName}` : `${roundedClassName} ${containerClassName}`
      }`}
      aria-label={`${reference.title} ${index + 1}`}
      title={reference.title}
    >
      <div className="pointer-events-none absolute bottom-[calc(100%+14px)] left-1/2 z-[140] hidden h-[210px] w-[360px] -translate-x-1/2 rounded-[18px] border border-white/12 bg-[#0b1018]/96 p-1.5 shadow-[0_24px_54px_-22px_rgba(0,0,0,0.95),0_0_0_1px_rgba(139,92,246,0.12)] backdrop-blur-xl group-hover/reference:block">
        {getReferencePreviewContent(reference, index)}
      </div>
      <div
        className={`relative h-full w-full overflow-hidden border border-white/8 bg-white/[0.03] ${roundedClassName}`}
      >
        {isImageReference ? (
          <img
            src={reference.value}
            alt={`reference ${index + 1}`}
            className="h-full w-full object-cover transition-transform duration-200 group-hover/reference:scale-[1.04]"
            draggable={false}
          />
        ) : (
          <div className={getReferencePreviewCardIconFrameClassName(reference.kind)}>
            {getReferenceIcon(reference.kind, compact)}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_38%)]" />
      </div>
      {onRemove ? (
        <button
          type="button"
          aria-label={`移除输入 ${index + 1}`}
          className={`absolute flex items-center justify-center rounded-full border border-black/18 bg-[#0b1018]/82 font-semibold tracking-tight text-white shadow-[0_6px_16px_-10px_rgba(0,0,0,0.9)] transition-colors hover:bg-rose-500/88 ${
            compact
              ? "right-0.5 top-0.5 h-4 min-w-4 px-1 text-[9px]"
              : "right-1 top-1 h-5 min-w-[20px] px-1.5 text-[10px]"
          }`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove(reference);
          }}
        >
          <span className="group-hover/reference:hidden">{index + 1}</span>
          <X
            className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} hidden group-hover/reference:block`}
          />
        </button>
      ) : (
        <div
          className={`pointer-events-none absolute flex items-center justify-center rounded-full border border-black/18 bg-[#0b1018]/82 font-semibold tracking-tight text-white shadow-[0_6px_16px_-10px_rgba(0,0,0,0.9)] ${
            compact
              ? "right-0.5 top-0.5 h-4 min-w-4 px-1 text-[9px]"
              : "right-1 top-1 h-5 min-w-[20px] px-1.5 text-[10px]"
          }`}
        >
          <span className="group-hover/reference:hidden">{index + 1}</span>
          <X
            className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} hidden group-hover/reference:block`}
          />
        </div>
      )}
    </div>
  );
}
