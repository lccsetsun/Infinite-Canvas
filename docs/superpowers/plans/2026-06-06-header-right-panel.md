# Header Right Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated right-side user menu in both headers with one shared module that provides clear loading and disabled feedback for API settings and logout actions.

**Architecture:** Introduce a focused shared `HeaderRightPanel` component plus a tiny helper for menu action flow that can be unit-tested in the current Vitest setup. Keep `AppHeader` and `CanvasHeader` responsible for their page-specific left-side content, and only delegate the right-side user/menu behavior to the shared module.

**Tech Stack:** React 19, TypeScript, `motion/react`, `lucide-react`, Vitest

---

## File Structure

- Create: `src/components/app/HeaderRightPanel.tsx`
  Shared right-side header module with avatar trigger, dropdown menu, action loading state, and outside-click close behavior.

- Create: `src/components/app/headerRightPanelActions.ts`
  Small helper that serializes menu actions and prevents duplicate invocation while one action is pending.

- Create: `src/components/app/headerRightPanelActions.test.ts`
  Unit tests for the action helper in the existing `node` Vitest environment.

- Modify: `src/components/app/CanvasHeader.tsx`
  Remove duplicated right-side menu implementation and render `HeaderRightPanel`.

- Modify: `src/components/app/AppHeader.tsx`
  Remove duplicated right-side menu implementation and render `HeaderRightPanel`.

- Test: `src/components/app/headerRightPanelActions.test.ts`
  Covers pending-action behavior and reset-on-failure behavior.

---

### Task 1: Add the shared action helper and failing tests

**Files:**
- Create: `src/components/app/headerRightPanelActions.ts`
- Create: `src/components/app/headerRightPanelActions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { runHeaderMenuAction } from "./headerRightPanelActions";

describe("runHeaderMenuAction", () => {
  it("marks the action pending before invoking the async callback and clears it after success", async () => {
    const states: Array<"api-settings" | "logout" | null> = [];
    const setPendingAction = vi.fn((value: "api-settings" | "logout" | null) => {
      states.push(value);
    });
    const action = vi.fn(async () => {
      states.push("callback-ran");
    });

    await runHeaderMenuAction({
      actionKey: "api-settings",
      pendingAction: null,
      setPendingAction,
      action,
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(states).toEqual(["api-settings", "callback-ran", null]);
  });

  it("does not invoke a second action while one is already pending", async () => {
    const setPendingAction = vi.fn();
    const action = vi.fn(async () => {});

    await runHeaderMenuAction({
      actionKey: "logout",
      pendingAction: "api-settings",
      setPendingAction,
      action,
    });

    expect(action).not.toHaveBeenCalled();
    expect(setPendingAction).not.toHaveBeenCalled();
  });

  it("clears pending state when the action throws", async () => {
    const states: Array<"api-settings" | "logout" | null> = [];
    const setPendingAction = vi.fn((value: "api-settings" | "logout" | null) => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/app/headerRightPanelActions.test.ts`

Expected: FAIL with `Cannot find module './headerRightPanelActions'`

- [ ] **Step 3: Write minimal implementation**

```ts
export type HeaderMenuActionKey = "api-settings" | "logout";

type RunHeaderMenuActionOptions = {
  actionKey: HeaderMenuActionKey;
  pendingAction: HeaderMenuActionKey | null;
  setPendingAction: (value: HeaderMenuActionKey | null) => void;
  action: () => void | Promise<void>;
};

export async function runHeaderMenuAction({
  actionKey,
  pendingAction,
  setPendingAction,
  action,
}: RunHeaderMenuActionOptions) {
  if (pendingAction !== null) return;

  setPendingAction(actionKey);
  try {
    await action();
  } finally {
    setPendingAction(null);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/app/headerRightPanelActions.test.ts`

Expected: PASS with `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/components/app/headerRightPanelActions.ts src/components/app/headerRightPanelActions.test.ts
git commit -m "test: add shared header menu action helper"
```

### Task 2: Build the shared right-side header component

**Files:**
- Create: `src/components/app/HeaderRightPanel.tsx`
- Modify: `src/components/app/CanvasHeader.tsx`
- Modify: `src/components/app/AppHeader.tsx`

- [ ] **Step 1: Write the shared component skeleton**

Create `src/components/app/HeaderRightPanel.tsx` with this starting structure:

```tsx
import React from "react";
import { ChevronDown, KeyRound, Loader2, LogOut, User } from "lucide-react";
import { runHeaderMenuAction, type HeaderMenuActionKey } from "./headerRightPanelActions";

interface HeaderRightPanelProps {
  username?: string;
  onOpenApiSettings?: () => void | Promise<void>;
  onLogout?: () => void | Promise<void>;
}

export default function HeaderRightPanel({
  username = "lccsetsun",
  onOpenApiSettings,
  onLogout,
}: HeaderRightPanelProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<HeaderMenuActionKey | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const displayName = username.trim() || "用户";
  const avatarText = displayName.slice(0, 1).toUpperCase();

  return <div />;
}
```

- [ ] **Step 2: Add outside-click close behavior and action runners**

Expand the component logic:

```tsx
  React.useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  const runAction = React.useCallback(
    async (actionKey: HeaderMenuActionKey, action?: () => void | Promise<void>) => {
      if (!action) return;
      await runHeaderMenuAction({
        actionKey,
        pendingAction,
        setPendingAction,
        action: async () => {
          await action();
          setMenuOpen(false);
        },
      });
    },
    [pendingAction]
  );

  const isBusy = pendingAction !== null;
```

- [ ] **Step 3: Render the shared right-side trigger and feedback-rich menu**

Use this JSX as the concrete implementation:

```tsx
  return (
    <div className="flex items-center gap-3">
      <div ref={menuRef} className="relative">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setMenuOpen((current) => !current)}
          className={`group flex items-center gap-3 rounded-[20px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(17,22,33,0.88),rgba(11,15,24,0.84))] px-3.5 py-2.5 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)] transition-all duration-200 ${
            isBusy
              ? "cursor-wait opacity-80"
              : "cursor-pointer hover:border-white/12 hover:bg-[#111827]"
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-bold text-white shadow-[0_8px_24px_rgba(99,102,241,0.32)]">
            {avatarText || <User className="h-4 w-4" />}
          </div>
          <div className="hidden min-w-0 text-left sm:block">
            <div className="max-w-[140px] truncate text-sm font-semibold text-slate-100">
              {displayName}
            </div>
            <div className="text-[11px] text-slate-500">
              {pendingAction === "logout"
                ? "正在退出..."
                : pendingAction === "api-settings"
                  ? "正在打开设置..."
                  : "账号菜单"}
            </div>
          </div>
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
          ) : (
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${menuOpen ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {menuOpen ? (
          <div className="absolute right-0 top-[calc(100%+10px)] z-[120] w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117]/96 p-2 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void runAction("api-settings", onOpenApiSettings)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                isBusy
                  ? "cursor-wait text-slate-500"
                  : "text-slate-100 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {pendingAction === "api-settings" ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              <div className="flex min-w-0 flex-col">
                <span>API 设置</span>
                <span className="text-[11px] text-slate-500">
                  {pendingAction === "api-settings" ? "正在打开..." : "查看和管理服务配置"}
                </span>
              </div>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => void runAction("logout", onLogout)}
              className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                isBusy
                  ? "cursor-wait text-slate-500"
                  : "text-slate-100 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {pendingAction === "logout" ? (
                <Loader2 className="h-4 w-4 animate-spin text-rose-300" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <div className="flex min-w-0 flex-col">
                <span>退出登录</span>
                <span className="text-[11px] text-slate-500">
                  {pendingAction === "logout" ? "正在退出..." : "立即清理本地会话"}
                </span>
              </div>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
```

- [ ] **Step 4: Run type check for the new component before wiring it up**

Run: `npm run lint:types`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/app/HeaderRightPanel.tsx src/components/app/headerRightPanelActions.ts src/components/app/headerRightPanelActions.test.ts
git commit -m "feat: add shared header right panel"
```

### Task 3: Replace the duplicated right side in `CanvasHeader`

**Files:**
- Modify: `src/components/app/CanvasHeader.tsx`

- [ ] **Step 1: Remove duplicated menu state and imports**

Update imports to:

```tsx
import React from "react";
import { motion } from "motion/react";
import HeaderRightPanel from "./HeaderRightPanel";
```

Delete the old `ChevronDown`, `LogOut`, `KeyRound`, `User` imports and the local `menuOpen` / `menuRef` / outside-click effect.

- [ ] **Step 2: Replace the old right-side JSX**

Replace the existing right-side block with:

```tsx
      <HeaderRightPanel
        username={username}
        onOpenApiSettings={onOpenApiSettings}
        onLogout={onLogout}
      />
```

- [ ] **Step 3: Run targeted type check**

Run: `npm run lint:types`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/app/CanvasHeader.tsx
git commit -m "refactor: reuse shared canvas header right panel"
```

### Task 4: Replace the duplicated right side in `AppHeader`

**Files:**
- Modify: `src/components/app/AppHeader.tsx`

- [ ] **Step 1: Remove duplicated menu state and imports**

Update imports to:

```tsx
import React from "react";
import { ChevronDown, FolderOpen } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "../common/Tooltip";
import HeaderRightPanel from "./HeaderRightPanel";
```

Delete the local avatar-menu imports and local `menuOpen` / `menuRef` / outside-click effect.

- [ ] **Step 2: Replace the old right-side JSX**

Replace the existing right-side block with:

```tsx
      <HeaderRightPanel
        username={username}
        onOpenApiSettings={onOpenApiSettings}
        onLogout={onLogout}
      />
```

- [ ] **Step 3: Run targeted type check**

Run: `npm run lint:types`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/app/AppHeader.tsx
git commit -m "refactor: reuse shared app header right panel"
```

### Task 5: Final verification and UX check

**Files:**
- Verify: `src/components/app/HeaderRightPanel.tsx`
- Verify: `src/components/app/AppHeader.tsx`
- Verify: `src/components/app/CanvasHeader.tsx`
- Verify: `src/App.tsx`

- [ ] **Step 1: Run the focused automated checks**

Run: `npm test -- src/components/app/headerRightPanelActions.test.ts src/features/auth/logoutFlow.test.ts src/features/auth/apiEnvelope.test.ts src/features/auth/authStorage.test.ts`

Expected: PASS with all tests green

- [ ] **Step 2: Run type check and production build**

Run: `npm run lint:types && npm run build`

Expected:
- `tsc --noEmit` passes
- Vite build succeeds

- [ ] **Step 3: Manually verify the shared right-side UX in both headers**

Run: `npm run dev`

Manual checks:
- In the canvas header, open the avatar menu and confirm both items render helper text.
- Click `API 设置` and confirm immediate loading feedback appears instead of a silent close.
- Click `退出登录` and confirm the row switches to loading feedback and the app exits immediately.
- In the app/home header, repeat the same checks and confirm behavior matches the canvas header.
- Confirm repeated clicks while an action is pending do not trigger duplicate behavior.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/HeaderRightPanel.tsx src/components/app/AppHeader.tsx src/components/app/CanvasHeader.tsx src/components/app/headerRightPanelActions.ts src/components/app/headerRightPanelActions.test.ts
git commit -m "feat: unify header right panel feedback"
```
