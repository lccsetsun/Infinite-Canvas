export type ApiNoticeKind = "info" | "success" | "warning" | "error";

export const API_NOTICE_EVENT = "api-notice";

export type ApiNoticeDetail = {
  message: string;
  kind: ApiNoticeKind;
};

const NOTICE_DEDUPE_MS = 1200;
const lastNoticeAt = new Map<string, number>();

export function emitApiNotice(message: string, kind: ApiNoticeKind = "error", dedupeKey = message) {
  if (typeof window === "undefined" || !message.trim()) return;

  const now = Date.now();
  const last = lastNoticeAt.get(dedupeKey) ?? 0;
  if (now - last < NOTICE_DEDUPE_MS) return;

  lastNoticeAt.set(dedupeKey, now);
  window.dispatchEvent(
    new CustomEvent<ApiNoticeDetail>(API_NOTICE_EVENT, {
      detail: { message, kind },
    })
  );
}
