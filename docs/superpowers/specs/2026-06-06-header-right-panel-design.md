# Header Right Panel Design

## Goal

Unify the right-side header user area used by both `AppHeader` and `CanvasHeader` so that:

- the avatar menu is implemented once
- logout and API settings actions have explicit visual loading/disabled feedback
- future auth/session behavior stays consistent across both headers

This design intentionally does **not** unify the full header shell. The left side of each header remains separate because the canvas page and app/home page have different content and layout responsibilities.

## Scope

In scope:

- extract the shared right-side header module
- centralize avatar button, dropdown menu, outside-click close behavior
- add action-level loading states for:
  - opening API settings
  - logging out
- prevent duplicate clicks while an action is in progress
- preserve the optimistic logout behavior already introduced

Out of scope:

- refactoring the left side branding/project switcher area
- merging `AppHeader` and `CanvasHeader` into one shell component
- redesigning the global notification system

## Recommended Approach

Create a reusable `HeaderRightPanel` component and replace the duplicated right-side menu code in:

- `src/components/app/AppHeader.tsx`
- `src/components/app/CanvasHeader.tsx`

The new shared component will own menu state, action state, and user feedback. The existing headers will only provide props and keep responsibility for page-specific left-side content.

## Component Design

### `HeaderRightPanel`

Expected props:

- `username?: string`
- `onOpenApiSettings?: () => void | Promise<void>`
- `onLogout?: () => void | Promise<void>`

Responsibilities:

- render the avatar trigger
- render the dropdown menu
- manage `menuOpen`
- close on outside pointer interaction
- track in-flight menu actions
- lock interactions during action execution
- show explicit loading UI for the active action

Internal state:

- `menuOpen: boolean`
- `pendingAction: "api-settings" | "logout" | null`

Derived behavior:

- if `pendingAction !== null`, both menu items become non-interactive
- the active item shows a spinner and temporary label
- avatar trigger can also be visually muted/disabled while an action is running

## Interaction Design

### Default State

- avatar button matches the current visual style
- menu opens with the existing glass panel look
- menu items remain:
  - `API 设置`
  - `退出登录`

### Opening API Settings

When the user clicks `API 设置`:

- set `pendingAction = "api-settings"`
- show spinner on that row with text like `正在打开...`
- block repeated clicks
- call `onOpenApiSettings`
- close menu after the action is handed off
- clear pending state after completion

Because this action is local and usually fast, the loading state is mainly to make the click feel acknowledged and consistent.

### Logging Out

When the user clicks `退出登录`:

- set `pendingAction = "logout"`
- show spinner on that row with text like `正在退出...`
- block repeated clicks
- call `onLogout`
- keep optimistic local logout behavior so the app exits immediately even if the remote logout request is slow or fails

This makes the feedback explicit while preserving the non-blocking session teardown we already fixed.

## Error Handling

- `HeaderRightPanel` should not invent its own toast/error system
- action failures continue to be surfaced by the existing app-level behavior where applicable
- if a local action throws before navigation/state change, `pendingAction` must reset so the menu does not get stuck

## Reuse Boundaries

`HeaderRightPanel` should contain only the shared right-side user area.

It should **not** know about:

- workflow/project switcher content
- page title/branding content
- canvas-specific controls

This keeps the abstraction small and reduces the chance that the two headers become awkwardly coupled.

## Testing Plan

Add focused tests around shared auth/menu behavior where practical:

- clicking logout should enter loading state and invoke the logout handler once
- repeated clicks while pending should not trigger duplicate calls
- menu action state should reset if a non-navigation action fails

If component-level UI tests are too heavy for the current setup, cover the critical behavior with small unit tests around the shared action flow and verify the rendered interaction manually.

## Risks

### Risk: Over-abstracting too early

If the component absorbs header-wide responsibilities, it becomes a disguised shell refactor.

Mitigation:

- keep the shared module limited to the right-side user area only

### Risk: Navigation unmount races

Logout may immediately unmount the component after local session cleanup.

Mitigation:

- avoid depending on post-logout state updates for correctness
- treat logout as fire-and-transition behavior

## Implementation Notes

- Preserve the current visual language: rounded glass menu, dark panel, subtle hover treatment
- Improve clarity rather than redesigning from scratch
- Prefer a single shared implementation source over prop-heavy duplication

## Success Criteria

The work is successful when:

- both headers use the same shared right-side module
- clicking `API 设置` and `退出登录` gives immediate visible feedback
- logout remains immediate even when remote auth services are degraded
- future right-side behavior changes only need to be made in one place
