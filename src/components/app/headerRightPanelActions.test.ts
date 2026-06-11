import { describe, expect, it, vi } from "vitest";
import { runHeaderMenuAction } from "./headerRightPanelActions";

describe("runHeaderMenuAction", () => {
  it("marks the action pending before invoking the async callback and clears it after success", async () => {
    const states: Array<"logout" | null | "callback-ran"> = [];
    const setPendingAction = vi.fn((value: "logout" | null) => {
      states.push(value);
    });
    const action = vi.fn(async () => {
      states.push("callback-ran");
    });

    await runHeaderMenuAction({
      actionKey: "logout",
      pendingAction: null,
      setPendingAction,
      action,
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(states).toEqual(["logout", "callback-ran", null]);
  });

  it("does not invoke a second action while one is already pending", async () => {
    const setPendingAction = vi.fn();
    const action = vi.fn(async () => {});

    await runHeaderMenuAction({
      actionKey: "logout",
      pendingAction: "logout",
      setPendingAction,
      action,
    });

    expect(action).not.toHaveBeenCalled();
    expect(setPendingAction).not.toHaveBeenCalled();
  });

  it("clears pending state when the action throws", async () => {
    const states: Array<"logout" | null> = [];
    const setPendingAction = vi.fn((value: "logout" | null) => {
      states.push(value);
    });

    await expect(
      runHeaderMenuAction({
        actionKey: "logout",
        pendingAction: null,
        setPendingAction,
        action: async () => {
          throw new Error("boom");
        },
      })
    ).rejects.toThrow("boom");

    expect(states).toEqual(["logout", null]);
  });
});
