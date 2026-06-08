export function shouldShowCanvasProjectLoading({
  currentWorkflowId,
  isProjectLoading,
  requestedWorkflowId,
}: {
  currentWorkflowId?: string | null;
  isProjectLoading: boolean;
  requestedWorkflowId: string;
}) {
  if (isProjectLoading) return true;
  if (!requestedWorkflowId) return false;
  return currentWorkflowId !== requestedWorkflowId;
}

export function shouldShowEmptyCanvasState({
  currentView,
  isCanvasProjectLoading,
  nodeCount,
}: {
  currentView: string;
  isCanvasProjectLoading: boolean;
  nodeCount: number;
}) {
  return currentView === "canvas" && !isCanvasProjectLoading && nodeCount === 0;
}
