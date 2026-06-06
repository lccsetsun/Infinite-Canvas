# Canvas Empty State Design

## Goal

Refine the centered empty-canvas hint into a more premium and restrained visual treatment without reducing canvas space or adding distracting UI.

The empty state should feel:

- quieter than a CTA button
- more premium than plain text
- supportive rather than attention-seeking
- consistent with the dark canvas environment

## Scope

This design only changes the centered hint shown on an empty canvas.

It does not change:

- canvas header layout
- node creation behavior
- right-click menu behavior
- project pages

## Recommended Direction

Use a restrained Apple-like floating capsule:

- a frosted translucent pill centered on the canvas
- a very subtle cool-toned glow behind it
- a fine highlight edge and inner shadow for depth
- cleaner typography with cool silver-blue text
- extremely slow ambient motion instead of obvious animation

## Visual System

### Container

The hint becomes a compact floating capsule with:

- rounded full-pill silhouette
- translucent deep-blue glass background
- thin outer border with low-contrast light edge
- inner shadow for a slightly carved, polished feel
- soft background blur so it feels layered above the grid

### Light

Behind the capsule:

- one restrained radial glow
- cool blue-cyan tint
- low opacity
- tight spread so the canvas still feels open

Avoid large bloom, neon edges, or bright halos.

### Typography

Use a single-line hint:

`双击画布 自由生成节点`

Typography treatment:

- medium weight
- slightly increased tracking
- cool silver-blue text tone
- subtle text shadow only if needed for separation

## Motion

Use ambient motion only:

1. Capsule drift
   - vertical float of about 1-2px
   - long duration
   - seamless loop

2. Highlight sweep
   - very slow sheen passing across the capsule
   - low opacity
   - should read as premium material, not loading state

No pulsing scale, no strong shimmer, no aggressive glow breathing.

## Interaction

The hint remains non-blocking:

- pointer-events disabled
- no button affordance
- no click target

It is purely instructional and disappears once the canvas is no longer empty, following current behavior.

## Implementation Notes

Primary file:

- `src/components/app/EmptyCanvasState.tsx`

Potential supporting styles:

- inline Tailwind utility composition in the component
- optional small keyframes in `src/index.css` only if needed for precise sheen/glow timing

Prefer local component styling first. Add shared CSS only for animation definitions that are awkward in utilities.

## Risks And Guards

Risk:

- effect becomes too decorative and competes with the canvas

Guard:

- keep opacity low
- keep animation slow
- keep the capsule compact
- prioritize material depth over bright color

Risk:

- blurred glass effect reduces text clarity

Guard:

- maintain clear text contrast
- avoid overly transparent center fill

## Verification

After implementation, verify:

- the hint feels visually elevated but restrained
- it does not dominate the empty canvas
- text remains legible at normal desktop viewing distance
- animation remains subtle and does not resemble a loading indicator
- no layout shift occurs when the state appears
