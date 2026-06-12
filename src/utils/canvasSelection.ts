export type CanvasSelection =
  | { mode: "none" }
  | { mode: "node"; nodeId: string }
  | { mode: "nodes"; nodeIds: string[] }
  | { mode: "group"; groupId: string }
  | { mode: "link"; anchor: { x: number; y: number } | null; linkId: string };

export interface LegacyCanvasSelectionState {
  selectedGroupId: string | null;
  selectedLinkAnchor: { x: number; y: number } | null;
  selectedLinkId: string | null;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
}

export function clearCanvasSelection(): CanvasSelection {
  return { mode: "none" };
}

export function selectCanvasNode(nodeId: string): CanvasSelection {
  return { mode: "node", nodeId };
}

export function selectCanvasNodes(nodeIds: string[]): CanvasSelection {
  const uniqueNodeIds = Array.from(new Set(nodeIds));
  if (uniqueNodeIds.length === 0) return clearCanvasSelection();
  if (uniqueNodeIds.length === 1) return selectCanvasNode(uniqueNodeIds[0]);
  return { mode: "nodes", nodeIds: uniqueNodeIds };
}

export function selectCanvasGroup(groupId: string): CanvasSelection {
  return { groupId, mode: "group" };
}

export function selectCanvasLink(
  linkId: string,
  anchor: { x: number; y: number } | null = null
): CanvasSelection {
  return { anchor, linkId, mode: "link" };
}

export function getCanvasSelectionNodeIds(selection: CanvasSelection): string[] {
  if (selection.mode === "node") return [selection.nodeId];
  if (selection.mode === "nodes") return selection.nodeIds;
  return [];
}

export function toggleCanvasNodeSelection(
  selection: CanvasSelection,
  nodeId: string
): CanvasSelection {
  const currentNodeIds = getCanvasSelectionNodeIds(selection);
  const nextNodeIds = currentNodeIds.includes(nodeId)
    ? currentNodeIds.filter((id) => id !== nodeId)
    : [...currentNodeIds, nodeId];
  return selectCanvasNodes(nextNodeIds);
}

export function getLegacySelectionState(selection: CanvasSelection): LegacyCanvasSelectionState {
  switch (selection.mode) {
    case "node":
      return {
        selectedGroupId: null,
        selectedLinkAnchor: null,
        selectedLinkId: null,
        selectedNodeId: selection.nodeId,
        selectedNodeIds: [selection.nodeId],
      };
    case "nodes":
      return {
        selectedGroupId: null,
        selectedLinkAnchor: null,
        selectedLinkId: null,
        selectedNodeId: null,
        selectedNodeIds: selection.nodeIds,
      };
    case "group":
      return {
        selectedGroupId: selection.groupId,
        selectedLinkAnchor: null,
        selectedLinkId: null,
        selectedNodeId: null,
        selectedNodeIds: [],
      };
    case "link":
      return {
        selectedGroupId: null,
        selectedLinkAnchor: selection.anchor,
        selectedLinkId: selection.linkId,
        selectedNodeId: null,
        selectedNodeIds: [],
      };
    case "none":
      return {
        selectedGroupId: null,
        selectedLinkAnchor: null,
        selectedLinkId: null,
        selectedNodeId: null,
        selectedNodeIds: [],
      };
  }
}
