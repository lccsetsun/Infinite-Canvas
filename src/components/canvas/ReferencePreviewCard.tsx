import { Clapperboard, FileText, Music4 } from "lucide-react";

export type ReferencePreviewKind = "image" | "video" | "audio" | "text" | "asset";

export interface ReferencePreviewItem {
  kind: ReferencePreviewKind;
  title: string;
  value: string;
}

export function ReferencePreviewCard({
  index,
  reference,
}: {
  index: number;
  reference: ReferencePreviewItem;
}) {
  const isImageReference = reference.kind === "image";
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[14px] border border-white/8 bg-white/[0.03] ${
        isImageReference ? "h-14 w-14" : "h-14 min-w-[128px] max-w-[180px] px-3 py-2"
      }`}
    >
      {isImageReference ? (
        <img
          src={reference.value}
          alt={`reference ${index + 1}`}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-full min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/8 bg-white/[0.04] text-violet-100/70">
            {reference.kind === "video" ? (
              <Clapperboard className="h-4 w-4" />
            ) : reference.kind === "audio" ? (
              <Music4 className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-slate-100/82">
              {reference.title}
            </div>
            <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-400/62">
              {reference.value}
            </div>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_38%)]" />
      <div className="pointer-events-none absolute right-1 top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-black/18 bg-[#0b1018]/82 px-1.5 text-[10px] font-semibold tracking-tight text-white shadow-[0_6px_16px_-10px_rgba(0,0,0,0.9)]">
        {index + 1}
      </div>
    </div>
  );
}
