import { describe, expect, it } from "vitest";
import {
  REMOTE_FULL_SNAPSHOT_MIN_INTERVAL_MS,
  shouldDeferRemoteSnapshotForInFlight,
  shouldPersistRemoteSnapshot,
  type RemoteDirtyKind,
} from "./remotePersistPolicy";

describe("remotePersistPolicy", () => {
  it("skips identical signatures", () => {
    expect(
      shouldPersistRemoteSnapshot({
        dirtyKind: "content",
        hasPendingRuntimeState: false,
        lastPersistedAt: 0,
        lastSignature: "same",
        now: 1_000,
        nextSignature: "same",
      })
    ).toBe(false);
  });

  it("skips snapshots while non-persistable runtime state exists", () => {
    expect(
      shouldPersistRemoteSnapshot({
        dirtyKind: "content",
        hasPendingRuntimeState: true,
        lastPersistedAt: 0,
        lastSignature: "old",
        now: 1_000,
        nextSignature: "next",
      })
    ).toBe(false);
  });

  it("persists changed content and structure snapshots immediately", () => {
    const dirtyKinds: RemoteDirtyKind[] = ["content", "structure"];

    dirtyKinds.forEach((dirtyKind) => {
      expect(
        shouldPersistRemoteSnapshot({
          dirtyKind,
          hasPendingRuntimeState: false,
          lastPersistedAt: 1_000,
          lastSignature: "old",
          now: 1_500,
          nextSignature: "next",
        })
      ).toBe(true);
    });
  });

  it("throttles position-only snapshots", () => {
    expect(
      shouldPersistRemoteSnapshot({
        dirtyKind: "position",
        hasPendingRuntimeState: false,
        lastPersistedAt: 1_000,
        lastSignature: "old",
        now: 1_000 + REMOTE_FULL_SNAPSHOT_MIN_INTERVAL_MS - 1,
        nextSignature: "next",
      })
    ).toBe(false);
    expect(
      shouldPersistRemoteSnapshot({
        dirtyKind: "position",
        hasPendingRuntimeState: false,
        lastPersistedAt: 1_000,
        lastSignature: "old",
        now: 1_000 + REMOTE_FULL_SNAPSHOT_MIN_INTERVAL_MS,
        nextSignature: "next",
      })
    ).toBe(true);
  });

  it("persists the first position-only snapshot when no snapshot has been sent yet", () => {
    expect(
      shouldPersistRemoteSnapshot({
        dirtyKind: "position",
        hasPendingRuntimeState: false,
        lastPersistedAt: 0,
        lastSignature: "",
        now: 1_000,
        nextSignature: "next",
      })
    ).toBe(true);
  });

  it("defers a new snapshot while another remote persist is in flight", () => {
    expect(
      shouldDeferRemoteSnapshotForInFlight({
        inFlightKey: "payload-a",
        nextKey: "payload-b",
      })
    ).toBe(true);
  });

  it("does not defer when no remote persist is in flight", () => {
    expect(
      shouldDeferRemoteSnapshotForInFlight({
        inFlightKey: "",
        nextKey: "payload-b",
      })
    ).toBe(false);
  });
});
