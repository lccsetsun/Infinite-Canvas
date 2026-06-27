export type RemoteDirtyKind = "none" | "position" | "content" | "structure";
export type RemotePersistStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export const REMOTE_FULL_SNAPSHOT_MIN_INTERVAL_MS = 10_000;

export function shouldPersistRemoteSnapshot({
  dirtyKind,
  hasPendingRuntimeState,
  lastPersistedAt,
  lastSignature,
  now,
  nextSignature,
}: {
  dirtyKind: RemoteDirtyKind;
  hasPendingRuntimeState: boolean;
  lastPersistedAt: number;
  lastSignature: string;
  now: number;
  nextSignature: string;
}) {
  if (hasPendingRuntimeState) return false;
  if (nextSignature === lastSignature) return false;
  if (dirtyKind === "none") return false;
  if (dirtyKind === "position" && lastPersistedAt > 0) {
    return now - lastPersistedAt >= REMOTE_FULL_SNAPSHOT_MIN_INTERVAL_MS;
  }
  return true;
}

export function shouldDeferRemoteSnapshotForInFlight({
  inFlightKey,
  nextKey,
}: {
  inFlightKey: string;
  nextKey: string;
}) {
  return Boolean(inFlightKey && nextKey && inFlightKey !== nextKey);
}

export function isDuplicateRemotePersistError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /拒绝重复提交|请勿重复提交|重复提交|duplicate\s+submission|duplicate\s+submit/i.test(
    message
  );
}

export function getLeaveProtectionState({
  hasNonRecoverableRuntimeState,
  hasUnsavedRemoteChanges,
  persistStatus,
}: {
  hasNonRecoverableRuntimeState: boolean;
  hasUnsavedRemoteChanges: boolean;
  persistStatus: RemotePersistStatus;
}) {
  if (hasNonRecoverableRuntimeState) {
    return { shouldWarn: true, reason: "non-recoverable-runtime" as const };
  }
  if (hasUnsavedRemoteChanges || persistStatus === "dirty" || persistStatus === "saving") {
    return { shouldWarn: true, reason: "unsaved" as const };
  }
  if (persistStatus === "error") {
    return { shouldWarn: true, reason: "save-error" as const };
  }
  return { shouldWarn: false, reason: "none" as const };
}
