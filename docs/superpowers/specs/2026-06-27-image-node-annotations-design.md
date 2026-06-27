# Image Node Annotation Design

## Goal

Add non-destructive doodle annotations to image nodes so users can mark regions, draw attention, and communicate review intent without modifying the original image asset.

## Scope

The first version focuses on image nodes only. It supports rectangular marks, freehand pen strokes, undo, clear, color selection, and stroke width selection. The original image URL and OSS metadata remain unchanged. Annotation data is saved as structured node data and can be rendered again after refresh.

This version does not upload a flattened marked image, does not add text labels, and does not add persistent editable shape selection. Those can be added after the basic marking workflow proves useful.

## User Experience

Image nodes get a new top-toolbar action named `标记`. Clicking it enters annotation mode for the selected image node. The image preview receives a transparent annotation layer above the image and a compact floating annotation toolbar.

The annotation toolbar includes:

- Rectangle tool for box marks.
- Pen tool for freehand strokes.
- Color swatches: red, yellow, blue, green.
- Stroke width control: 2, 4, 8.
- Undo last mark.
- Clear all marks.
- Done or close annotation mode.

When a node has saved annotations, the normal image toolbar shows a small count indicator such as `已标记 3`. The marks remain visible on the node preview by default. A later version can add hide/show if the marks become visually noisy.

## Data Model

Annotations are stored on `GraphNode["data"].annotations` as image-relative values, not screen pixels. Coordinates are normalized to the displayed image content box:

```ts
type ImageAnnotation =
  | {
      id: string;
      type: "rect";
      color: string;
      strokeWidth: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      type: "pen";
      color: string;
      strokeWidth: number;
      points: Array<{ x: number; y: number }>;
    };
```

Every coordinate is normalized from `0` to `1`. This keeps annotations aligned when the node is zoomed, resized, or rendered in preview. Invalid annotations are ignored during rendering.

## Rendering

The image node renders an SVG overlay above the image element. SVG is a better fit than canvas for version one because marks remain inspectable, scalable, and easy to serialize. The SVG uses `viewBox="0 0 1 1"` with `vector-effect="non-scaling-stroke"` avoided because stroke width should visually scale with the displayed image enough to feel natural at canvas zoom. The renderer converts normalized stroke width into a stable display stroke.

Pointer interactions are active only in annotation mode. Outside annotation mode, the overlay is pointer-transparent so existing drag, selection, grid splitting, frame extraction, and image preview behavior remain unchanged.

## State And Persistence

Annotation mode is local UI state. Annotation content is persistent node data. On every committed mark, undo, or clear, the component calls `onUpdateData(node.id, { annotations: nextAnnotations })`. This reuses the existing workflow persistence path.

Undo is implemented by removing the last item from the persisted annotation array. The first version does not need a separate undo stack because each mark is an append-only item and clear can be treated as an explicit destructive annotation action.

## Integration With Existing Actions

The feature should not change existing image generation, upload, download, grid split, batch replacement, extraction, or send-for-review behavior.

The first implementation only displays marks and stores them. Later, send-for-review can offer:

- `送审原图`
- `送审带标记图`

That later version will need a flattening step that renders image plus SVG overlay into a canvas, uploads the flattened image to OSS, and sends the returned OSS id.

## Error Handling

If the image has no loaded dimensions yet, annotation mode opens but drawing is disabled until the image content box is measurable. If annotation data is malformed, the renderer skips invalid items and keeps the node usable. Clear all requires a deliberate toolbar click, but no modal confirmation is needed for version one because the annotation list is lightweight and undo remains available until clear is persisted.

## Accessibility And Design

All toolbar controls use icon buttons with tooltips and `aria-label` values. The annotation controls should match the existing media node toolbar styling: compact, dark, floating, and icon-led. Color swatches are visual controls with accessible names like `红色标记`, `黄色标记`.

The default tool is rectangle and the default color is red because review marking most often means boxing a region. The UI should not use visible instructional copy inside the node; controls should be self-explanatory through icons and tooltips.

## Testing

Tests should cover:

- Annotation normalization and denormalization helpers.
- Rectangle creation from pointer start/end.
- Pen point collection and minimum-point filtering.
- Image node source-level wiring for the `标记` toolbar action.
- Persistence path calls `onUpdateData` with `annotations`.
- Existing image node tests continue to pass.

Full verification should include targeted annotation tests, image node tests, `npm run lint`, `npm test`, and `npm run build`.
