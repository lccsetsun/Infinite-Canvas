const ORDINARY_NODE_Z_INDEX = 0;
const SELECTED_NODE_Z_INDEX = 20;
const DRAGGING_NODE_Z_INDEX = 80;

export function getCanvasNodeZIndex({
  draggingNodeId,
  nodeId,
  selectedNodeId,
}: {
  draggingNodeId?: string | null;
  nodeId: string;
  selectedNodeId?: string | null;
}) {
  if (draggingNodeId === nodeId) return DRAGGING_NODE_Z_INDEX;
  if (selectedNodeId === nodeId) return SELECTED_NODE_Z_INDEX;
  return ORDINARY_NODE_Z_INDEX;
}
