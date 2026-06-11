import { Clapperboard, FileText, Music4 } from "lucide-react";

export type ReferencePreviewKind = "image" | "video" | "audio" | "text" | "asset";

export interface ReferencePreviewItem {
  kind: ReferencePreviewKind;
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

export function ReferencePreviewCard({
  compact = false,
  index,
  reference,
}: {
  compact?: boolean;
  index: number;
  reference: ReferencePreviewItem;
}) {
  const isImageReference = reference.kind === "image";
  const { containerClassName } = getReferencePreviewCardLayout(reference.kind);
  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-white/8 bg-white/[0.03] ${
        compact ? "h-9 w-9 rounded-[9px]" : `rounded-[14px] ${containerClassName}`
      }`}
      aria-label={`${reference.title} ${index + 1}`}
      title={reference.title}
    >
      {isImageReference ? (
        <img
          src={reference.value}
          alt={`reference ${index + 1}`}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className={getReferencePreviewCardIconFrameClassName(reference.kind)}>
          {getReferenceIcon(reference.kind, compact)}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_38%)]" />
      <div
        className={`pointer-events-none absolute flex items-center justify-center rounded-full border border-black/18 bg-[#0b1018]/82 font-semibold tracking-tight text-white shadow-[0_6px_16px_-10px_rgba(0,0,0,0.9)] ${
          compact
            ? "right-0.5 top-0.5 h-4 min-w-4 px-1 text-[9px]"
            : "right-1 top-1 h-5 min-w-[20px] px-1.5 text-[10px]"
        }`}
      >
        {index + 1}
      </div>
    </div>
  );
}
