export function isLinkConnectedToNode(
  link: { fromNodeId: string; toNodeId: string },
  activeNodeId?: string | null
): boolean {
  return Boolean(activeNodeId && (link.fromNodeId === activeNodeId || link.toNodeId === activeNodeId));
}
