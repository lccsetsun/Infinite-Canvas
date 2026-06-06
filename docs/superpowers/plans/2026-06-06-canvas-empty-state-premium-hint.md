# Canvas Empty State Premium Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain centered empty-canvas hint with a premium, restrained Apple-like floating capsule that feels elevated without competing with the canvas.

**Architecture:** Keep the change isolated to the empty-state presentation layer. Implement the premium capsule directly in `EmptyCanvasState.tsx`, and add only minimal shared keyframes in `index.css` for the slow float and highlight sweep animations.

**Tech Stack:** React, TypeScript, Tailwind utility classes, global CSS keyframes in `src/index.css`

---

### Task 1: Add animation primitives

**Files:**
- Modify: `C:/Users/14282/Desktop/ai/aistudio/src/index.css`
- Test: `C:/Users/14282/Desktop/ai/aistudio/src/components/app/EmptyCanvasState.tsx`

- [ ] **Step 1: Add the slow premium hint keyframes**

```css
@keyframes canvas-hint-float {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-2px);
  }
}

@keyframes canvas-hint-sheen {
  0% {
    transform: translateX(-140%) skewX(-20deg);
    opacity: 0;
  }
  15% {
    opacity: 0.18;
  }
  50% {
    opacity: 0.22;
  }
  85% {
    opacity: 0.1;
  }
  100% {
    transform: translateX(160%) skewX(-20deg);
    opacity: 0;
  }
}
```

- [ ] **Step 2: Run typecheck to confirm the CSS addition does not break the app**

Run: `npm run lint:types`  
Expected: PASS with `tsc --noEmit`

### Task 2: Rebuild the empty state as a premium floating capsule

**Files:**
- Modify: `C:/Users/14282/Desktop/ai/aistudio/src/components/app/EmptyCanvasState.tsx`
- Test: `C:/Users/14282/Desktop/ai/aistudio/src/components/app/EmptyCanvasState.tsx`

- [ ] **Step 1: Replace the plain text pill with a layered glass capsule**

```tsx
interface EmptyCanvasStateProps {
  mode: "welcome" | "empty-project";
  onPrimaryAction: () => void;
}

export default function EmptyCanvasState({ mode: _mode, onPrimaryAction: _onPrimaryAction }: EmptyCanvasStateProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
      <div className="relative [animation:canvas-hint-float_7s_ease-in-out_infinite]">
        <div className="absolute inset-0 scale-[1.22] rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.14)_0%,rgba(59,130,246,0.08)_34%,rgba(15,23,42,0)_72%)] blur-2xl" />
        <div className="relative overflow-hidden rounded-full border border-white/[0.08] bg-[linear-gradient(180deg,rgba(23,30,46,0.76),rgba(17,23,35,0.7))] px-8 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-12px_24px_rgba(15,23,42,0.22)] backdrop-blur-xl">
          <div className="absolute inset-[1px] rounded-full border border-white/[0.04]" />
          <div className="absolute -left-1/3 top-0 h-full w-24 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0)_100%)] blur-md [animation:canvas-hint-sheen_9s_ease-in-out_infinite]" />
          <div className="relative flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/70 shadow-[0_0_12px_rgba(103,232,249,0.32)]" />
            <p className="text-[15px] font-medium tracking-[0.02em] text-slate-200/95">
              双击画布 自由生成节点
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck to verify the rebuilt component**

Run: `npm run lint:types`  
Expected: PASS with `tsc --noEmit`

### Task 3: Visual verification and cleanup

**Files:**
- Modify: `C:/Users/14282/Desktop/ai/aistudio/src/components/app/EmptyCanvasState.tsx` (only if needed after review)
- Modify: `C:/Users/14282/Desktop/ai/aistudio/src/index.css` (only if needed after review)
- Test: `C:/Users/14282/Desktop/ai/aistudio/src/components/app/EmptyCanvasState.tsx`

- [ ] **Step 1: Review against the approved design constraints**

Check that the result is:

- centered and compact
- clearly more premium than plain text
- visibly layered above the grid
- still restrained enough to avoid becoming a CTA
- animated slowly enough to feel ambient rather than busy

- [ ] **Step 2: Run final typecheck**

Run: `npm run lint:types`  
Expected: PASS with `tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/app/EmptyCanvasState.tsx src/index.css docs/superpowers/specs/2026-06-06-canvas-empty-state-design.md docs/superpowers/plans/2026-06-06-canvas-empty-state-premium-hint.md
git commit -m "Refine canvas empty state hint"
```
