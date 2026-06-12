export function shouldDeferCanvasContentRender({
  activeWorkflowId,
  currentView,
  groupCount,
  linkCount,
  nodeCount,
}: {
  activeWorkflowId: string | null;
  currentView: string;
  groupCount: number;
  linkCount: number;
  nodeCount: number;
}) {
  if (currentView !== "canvas") return false;
  if (activeWorkflowId) return false;
  return nodeCount > 0 || linkCount > 0 || groupCount > 0;
}
