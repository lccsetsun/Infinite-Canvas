export type RemoteDirtyKind = "none" | "position" | "content" | "structure";

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
