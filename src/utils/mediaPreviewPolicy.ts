export type VideoPreloadMode = "none" | "metadata" | "auto";
export type ImageLoadingMode = "eager" | "lazy";

export function getVideoPreloadMode({
  hovered,
  playing,
  selected,
}: {
  hovered: boolean;
  playing: boolean;
  selected: boolean;
}): VideoPreloadMode {
  if (playing) return "auto";
  if (selected || hovered) return "metadata";
  return "none";
}

export function getImageLoadingMode({
  selected,
  visible,
}: {
  selected: boolean;
  visible: boolean;
}): ImageLoadingMode {
  if (selected || !visible) return "eager";
  return "lazy";
}

export function getStripThumbnailLoadingMode({
  activeIndex,
  eagerRadius = 1,
  index,
}: {
  activeIndex: number;
  eagerRadius?: number;
  index: number;
}): ImageLoadingMode {
  return Math.abs(index - activeIndex) <= eagerRadius ? "eager" : "lazy";
}

export function getCanvasMediaLoadAllowance({
  activeNodeIds,
  mediaNodeIds,
  retainedNodeIds = [],
}: {
  activeNodeIds: Iterable<string>;
  mediaNodeIds: Iterable<string>;
  retainedNodeIds?: Iterable<string>;
}): Set<string> {
  const allowed = new Set(retainedNodeIds);

  for (const nodeId of activeNodeIds) {
    allowed.add(nodeId);
  }
  for (const nodeId of mediaNodeIds) {
    allowed.add(nodeId);
  }

  return allowed;
}
