import React from "react";
import { AnimatePresence } from "motion/react";
import CanvasHeader from "./components/app/CanvasHeader";
import CanvasControls from "./components/app/CanvasControls";
import CanvasHistoryDock from "./components/app/CanvasHistoryDock";
import CanvasNodeLayer from "./components/app/CanvasNodeLayer";
import DraftLinkOverlay from "./components/app/DraftLinkOverlay";
import GroupsLayer from "./components/app/GroupsLayer";
import LinkInteractionOverlay from "./components/app/LinkInteractionOverlay";
import MultiSelectionLayer from "./components/app/MultiSelectionLayer";
import EmptyCanvasState from "./components/app/EmptyCanvasState";
import LeaferCanvas from "./components/canvas/LeaferCanvas";
import MiniMap from "./components/app/MiniMap";
import PreviewModal, { PreviewContent } from "./components/app/PreviewModal";
import SettingsPanels from "./components/app/SettingsPanels";
import { Copy, Eye, Loader2, Trash2 } from "lucide-react";
import { snapPointToGrid } from "./components/canvas/geometry";
import {
  shouldStartCanvasPan,
  useCanvasInteraction,
  type CanvasViewport,
} from "./hooks/useCanvasInteraction";
import { useCanvasLinking } from "./hooks/useCanvasLinking";
import { useMiniMapConfig } from "./hooks/useMiniMapConfig";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { useAppUiState } from "./hooks/useAppUiState";
import { shouldOpenCanvasContextMenu } from "./utils/canvasContextMenuPolicy";
import { shouldFinishCanvasLinkOnCanvasPointerUp } from "./utils/canvasPointerPolicy";
import {
  cropImageGridCell,
  getGridChildNodePosition,
  replaceImageGridCell,
} from "./utils/imageGridSplit";
import { getPointerAlignedNodePosition } from "./utils/dropAlignedNodePosition";
import { getCanvasViewportClassName } from "./utils/canvasViewportLayout";
import { shouldDeferCanvasContentRender } from "./utils/canvasRenderReadiness";
import {
  getBatchOutputDrafts,
  getNodesFullyInsideSelection,
  getSelectionBounds,
  isClickWithoutDrag,
  normalizeSelectionRect,
  type Point,
  type Rect,
} from "./utils/multiSelection";
import {
  createMultiNodeClipboardPayload,
  parseMultiNodeClipboardPayload,
  pasteMultiNodeClipboardPayload,
  type MultiNodeClipboardPayload,
} from "./utils/multiSelectionOperations";
import {
  clearCanvasSelection,
  getLegacySelectionState,
  selectCanvasGroup,
  selectCanvasLink,
  selectCanvasNode,
  selectCanvasNodes,
  toggleCanvasNodeSelection,
  type CanvasSelection,
} from "./utils/canvasSelection";
import { buildCanvasGraphIndex } from "./utils/canvasGraphIndex";
import {
  shouldShowCanvasProjectLoading,
  shouldShowEmptyCanvasState,
} from "./utils/canvasLoadState";
import {
  getFilesFromTransfer,
  transferHasFiles,
  uploadCanvasFileAsNode,
} from "./utils/canvasFileUpload";
import { collectTextNodeReferences } from "./utils/textNodeReferences";
import { ConfigProvider, theme } from "antd";
import { GraphNode, NodeClass } from "./types";
import type { VideoFrameCaptureItem } from "./features/video/frameCapture";
import { fetchVideoPrompt } from "./features/video/videoPrompts";
import {
  fetchAiModelCatalog,
  makeEmptyAiModelsByType,
  type AiModelsByType,
} from "./features/api/aiModelCatalog";
import {
  fetchCanvasGenerationDictionaries,
  type CanvasGenerationDictionaries,
} from "./features/api/canvasGenerationDictionaries";
import { clearAuthSession } from "./features/auth/authStorage";
import { logout } from "./features/auth/authApi";
import { performOptimisticLogout } from "./features/auth/logoutFlow";
import {
  getRemoteProjectDetail,
  updateRemoteProject,
  type RemoteCanvasProject,
} from "./features/workspace/remoteCanvas";

const SearchMenu = React.lazy(() => import("./components/SearchMenu"));

const CANVAS_VIEWPORT_STORAGE_PREFIX = "aistudio:canvas-viewport:";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readStoredCanvasViewport(workflowId: string | null): CanvasViewport | null {
  if (!workflowId || typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(`${CANVAS_VIEWPORT_STORAGE_PREFIX}${workflowId}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CanvasViewport>;
    const pan = parsed.pan;
    if (!pan || !isFiniteNumber(pan.x) || !isFiniteNumber(pan.y) || !isFiniteNumber(parsed.zoom)) {
      return null;
    }

    return {
      pan: { x: pan.x, y: pan.y },
      zoom: Math.min(3, Math.max(0.15, parsed.zoom)),
    };
  } catch {
    return null;
  }
}

function writeStoredCanvasViewport(workflowId: string | null, viewport: CanvasViewport) {
  if (!workflowId || typeof localStorage === "undefined") return;

  localStorage.setItem(`${CANVAS_VIEWPORT_STORAGE_PREFIX}${workflowId}`, JSON.stringify(viewport));
}

interface AppProps {
  onLoggedOut: () => void;
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export default function App({ onLoggedOut }: AppProps) {
  const requestedWorkflowId = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("projectId")?.trim() || "";
  }, []);

  const panelFallback = (
    <div className="flex min-h-screen items-center justify-center bg-[#202637] text-slate-200">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-black/10 px-5 py-2.5 text-sm text-slate-300 backdrop-blur-sm">
        <Loader2 className="h-4 w-4 animate-spin text-cyan-100/70" />
        <span>加载中...</span>
      </div>
    </div>
  );

  const [remoteProject, setRemoteProject] = React.useState<RemoteCanvasProject | null>(null);
  const [isProjectLoading, setIsProjectLoading] = React.useState(Boolean(requestedWorkflowId));
  const [projectLoadError, setProjectLoadError] = React.useState("");
  const [remoteModelsByType, setRemoteModelsByType] = React.useState<AiModelsByType>(() =>
    makeEmptyAiModelsByType()
  );
  const [generationDictionaries, setGenerationDictionaries] =
    React.useState<CanvasGenerationDictionaries | null>(null);

  const refreshRemoteProject = React.useCallback(
    (showLoading = true) => {
      if (!requestedWorkflowId) {
        setIsProjectLoading(false);
        setProjectLoadError("Missing projectId, cannot load remote project.");
        return;
      }

      if (showLoading) setIsProjectLoading(true);
      setProjectLoadError("");
      void getRemoteProjectDetail(requestedWorkflowId)
        .then((project) => {
          setRemoteProject(project);
        })
        .catch((error) => {
          setProjectLoadError(error instanceof Error ? error.message : "鍔犺浇椤圭洰璇︽儏澶辫触");
        })
        .finally(() => {
          setIsProjectLoading(false);
        });
    },
    [requestedWorkflowId]
  );

  const handleLogout = React.useCallback(() => {
    performOptimisticLogout({
      requestLogout: logout,
      clearSession: clearAuthSession,
      onLoggedOut,
    });
  }, [onLoggedOut]);

  React.useEffect(() => {
    refreshRemoteProject(true);
  }, [refreshRemoteProject]);

  const {
    nodes,
    links,
    selectedNodeId,
    isRunning,
    setSelectedNodeId,
    clearCanvas,
    runNode,
    addNode,
    syncImagePromptStarterLayout,
    removeNode,
    removeNodes,
    removeLink,
    duplicateNode,
    insertNodesAndLinks,
    updateNodePosition,
    updateNodePositions,
    updateNodeProperty,
    updateNodeData,
    setPrimaryImageResult,
    addVideoFrameAnalysis,
    addVideoPromptTextNode,
    extractFrameImageNode,
    createVideoFrameImageNode,
    completeVideoFrameImageNode,
    failVideoFrameImageNode,
    replaceFrameImageUrl,
    linkFromNodeId,
    linkToNodeId,
    linkFromOutputIndex,
    linkToInputIndex,
    linkDraftIssue,
    nodeOutputs,
    resolvedInputsMap,
    canUndo,
    canRedo,
    undo,
    redo,
    currentWorkflowSummary,
    renameWorkflow,
    setLinkFromNodeId,
    setLinkToNodeId,
    setLinkFromOutputIndex,
    setLinkToInputIndex,
    clearLinkDraft,
    addLinkFromDraft,
    addLinksFromDrafts,
    groups,
    ungroup,
    updateGroup,
    runGroup,
  } = useWorkflowState({
    apiConfig: {
      baseUrl: "",
      apiKey: "",
      remoteModelsByType,
    },
    remoteProject,
    onRemotePersist: async (project) => {
      await updateRemoteProject({
        id: project.id,
        name: project.name,
        coverUrl: project.coverUrl,
        category: project.category,
        tags: project.tags,
        workflow: project.workflow,
        includeCover: false,
      });
      setRemoteProject(project);
    },
  });

  const textNodeReferencesMap = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof collectTextNodeReferences>>();
    nodes.forEach((node) => {
      if (node.type !== "text_node") return;
      map.set(
        node.id,
        collectTextNodeReferences({ links, nodeOutputs, nodes, textNodeId: node.id })
      );
    });
    return map;
  }, [links, nodeOutputs, nodes]);

  const {
    isWelcomeDismissed,
    setIsWelcomeDismissed,
    isMenuFromToolbar,
    setIsMenuFromToolbar,
    showGrid,
    setShowGrid,
    snapToGridEnabled,
    setSnapToGridEnabled,
    showMiniMap,
    setShowMiniMap,
    currentView,
    setCurrentView,
    setActiveQuickTool,
    runNotice,
    showNotice,
  } = useAppUiState();

  React.useEffect(() => {
    let cancelled = false;

    void fetchAiModelCatalog()
      .then((catalog) => {
        if (!cancelled) setRemoteModelsByType(catalog);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to load remote AI model catalog", error);
        }
      })
      .finally(() => undefined);

    void fetchCanvasGenerationDictionaries()
      .then((dictionaries) => {
        if (!cancelled) setGenerationDictionaries(dictionaries);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to load remote canvas dictionaries", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const [workflowName, setWorkflowName] = React.useState("榛樿椤圭洰");
  const [autoSaveWorkflow, setAutoSaveWorkflow] = React.useState(true);
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const [pendingLinkMenuDraft, setPendingLinkMenuDraft] = React.useState<{
    clientX: number;
    clientY: number;
    fromNodeId: string;
    fromOutputIndex: number;
    sources?: Array<{ fromNodeId: string; fromOutputIndex: number }>;
  } | null>(null);
  const [previewContent, setPreviewContent] = React.useState<PreviewContent | null>(null);
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = React.useState<string | null>(null);
  const [selectedLinkAnchor, setSelectedLinkAnchor] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = React.useState<Set<string>>(new Set());
  const multiNodeClipboardRef = React.useRef<MultiNodeClipboardPayload | null>(null);
  const pasteIdCounterRef = React.useRef(0);
  const [selectionDrag, setSelectionDrag] = React.useState<{
    start: Point;
    current: Point;
  } | null>(null);
  const blankPointerDownRef = React.useRef<{ client: Point; world: Point } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = React.useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const nodeContextMenuNode = React.useMemo(
    () =>
      nodeContextMenu ? (nodes.find((node) => node.id === nodeContextMenu.nodeId) ?? null) : null,
    [nodeContextMenu, nodes]
  );
  const nodeContextMenuText = React.useMemo(() => {
    if (!nodeContextMenuNode || nodeContextMenuNode.type !== "text_node") return "";
    return (
      (nodeContextMenuNode.data?.response as string) ||
      (nodeContextMenuNode.properties.response as string) ||
      ""
    );
  }, [nodeContextMenuNode]);
  const menuCloseTimerRef = React.useRef<number | null>(null);
  const autoFitStateRef = React.useRef<{ workflowId: string | null; nodeCount: number } | null>(
    null
  );
  const lastCanvasPointerRef = React.useRef<{ clientX: number; clientY: number } | null>(null);
  const activeWorkflowId = currentWorkflowSummary?.id ?? null;
  const storedCanvasViewport = React.useMemo(
    () => readStoredCanvasViewport(activeWorkflowId),
    [activeWorkflowId]
  );

  React.useEffect(() => {
    if (!currentWorkflowSummary?.name) return;
    setWorkflowName(currentWorkflowSummary.name);
  }, [currentWorkflowSummary?.name]);

  const memberCountByGroup = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) {
      if (n.groupId) m.set(n.groupId, (m.get(n.groupId) ?? 0) + 1);
    }
    return m;
  }, [nodes]);

  const selectedNodes = React.useMemo(
    () => nodes.filter((node) => selectedNodeIds.has(node.id)),
    [nodes, selectedNodeIds]
  );
  const multiSelectionBounds = React.useMemo(
    () => (selectedNodes.length > 1 ? getSelectionBounds(selectedNodes, 44) : null),
    [selectedNodes]
  );
  const selectionDragRect = React.useMemo<Rect | null>(
    () =>
      selectionDrag ? normalizeSelectionRect(selectionDrag.start, selectionDrag.current) : null,
    [selectionDrag]
  );
  const batchLinkSources = React.useMemo(
    () => getBatchOutputDrafts(selectedNodes),
    [selectedNodes]
  );
  const canvasGraphIndex = React.useMemo(() => buildCanvasGraphIndex(nodes, links), [links, nodes]);

  const currentCanvasSelection = React.useMemo<CanvasSelection>(() => {
    if (selectedLinkId) return selectCanvasLink(selectedLinkId, selectedLinkAnchor);
    if (selectedGroupId) return selectCanvasGroup(selectedGroupId);
    return selectCanvasNodes(Array.from(selectedNodeIds));
  }, [selectedGroupId, selectedLinkAnchor, selectedLinkId, selectedNodeIds]);

  const applyCanvasSelection = React.useCallback(
    (selection: CanvasSelection) => {
      const legacy = getLegacySelectionState(selection);
      setSelectedNodeId(legacy.selectedNodeId);
      setSelectedNodeIds(new Set(legacy.selectedNodeIds));
      setSelectedGroupId(legacy.selectedGroupId);
      setSelectedLinkId(legacy.selectedLinkId);
      setSelectedLinkAnchor(legacy.selectedLinkAnchor);
    },
    [setSelectedNodeId]
  );

  const handleCreateProjectFromWelcome = React.useCallback(() => {
    setIsWelcomeDismissed(true);
    setCurrentView("canvas");
    setActiveQuickTool(null);
  }, [setActiveQuickTool, setCurrentView, setIsWelcomeDismissed]);

  const {
    canvasRef,
    pan,
    zoom,
    toWorld,
    fitView,
    scrollToNode,
    jumpToWorldPos,
    draggingNodeId,
    isCanvasPanning,
    onNodeDragStart,
    onNodesDragStart,
    onCanvasPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
  } = useCanvasInteraction({
    initialViewport: storedCanvasViewport,
    nodes,
    snapToGridEnabled,
    updateNodePosition,
    updateNodePositions,
    viewportKey: activeWorkflowId,
  });

  React.useEffect(() => {
    if (currentView !== "canvas" || !activeWorkflowId) return;

    const saveTimer = window.setTimeout(() => {
      writeStoredCanvasViewport(activeWorkflowId, { pan, zoom });
    }, 120);

    return () => window.clearTimeout(saveTimer);
  }, [activeWorkflowId, currentView, pan, zoom]);

  const {
    batchLinkSources: activeBatchLinkSources,
    beginBatchCanvasLink,
    beginCanvasLink,
    draftCursor,
    finishCanvasLink,
    getCanvasLinkTargetIssue,
    hoverCanvasLinkTarget,
    isLinkingOnCanvas,
    leaveCanvasLinkTarget,
    resetCanvasLinkDraft,
    setDraftCursor,
  } = useCanvasLinking({
    addLinkFromDraft,
    addLinksFromDrafts,
    clearLinkDraft,
    linkFromNodeId,
    linkFromOutputIndex,
    linkToInputIndex,
    linkToNodeId,
    links,
    graphIndex: canvasGraphIndex,
    nodes,
    setLinkFromNodeId,
    setLinkFromOutputIndex,
    setLinkToInputIndex,
    setLinkToNodeId,
    setSelectedNodeId,
    showNotice,
    toWorld,
    onBlankLinkDrop: (draft) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      setPendingLinkMenuDraft({
        clientX: draft.clientX,
        clientY: draft.clientY,
        fromNodeId: draft.fromNodeId,
        fromOutputIndex: draft.fromOutputIndex,
        sources: draft.sources,
      });
      setMenuPos({
        x: draft.clientX - (rect?.left ?? 0),
        y: draft.clientY - (rect?.top ?? 0),
      });
      setIsMenuFromToolbar(false);
    },
  });

  const addNodeAtPosition = React.useCallback(
    (
      type: NodeClass,
      x: number,
      y: number,
      initialProps?: Record<string, unknown>,
      connectFromDraft?: { fromNodeId: string; fromOutputIndex: number; toInputIndex?: number }
    ) => {
      const world = toWorld(x, y);
      // Center the node (approx 280x300) around the click point.
      const snapped = snapPointToGrid({
        x: world.x - 140,
        y: world.y - 120,
      });
      const nodeId = addNode(type, snapped.x, snapped.y, initialProps, connectFromDraft);
      return nodeId;
    },
    [addNode, toWorld]
  );

  const getCanvasCenterClientPosition = React.useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      return {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      };
    }
    return {
      clientX: typeof window === "undefined" ? 0 : window.innerWidth / 2,
      clientY: typeof window === "undefined" ? 0 : window.innerHeight / 2,
    };
  }, [canvasRef]);

  const handleSplitImageGrid = React.useCallback(
    async (
      nodeId: string,
      imageUrl: string,
      gridRows: number,
      gridCols: number,
      cellIndices: number[],
      clientPoint?: { clientX: number; clientY: number }
    ) => {
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) {
        showNotice("Source node was not found.");
        return;
      }
      try {
        const normalizedCellIndices = Array.from(
          new Set(cellIndices.map((index) => Math.max(0, Math.floor(index))))
        ).sort((a, b) => a - b);
        for (const cellIndex of normalizedCellIndices) {
          const { dataUrl, crop } = await cropImageGridCell(
            imageUrl,
            gridRows,
            cellIndex,
            gridCols
          );
          const dropPosition = clientPoint
            ? toWorld(clientPoint.clientX, clientPoint.clientY)
            : null;
          const position = dropPosition
            ? getPointerAlignedNodePosition(dropPosition)
            : getGridChildNodePosition(sourceNode, gridRows, cellIndex, gridCols);
          addNode(
            "image_node",
            position.x,
            position.y,
            {
              __nodeTitle: `瀹牸鍒囧垎 ${gridRows}x${gridCols} #${cellIndex + 1}`,
              __uploadedAssetUrl: dataUrl,
              __uploadedAssetKind: "image",
              imageUrl: dataUrl,
              text: `鏉ヨ嚜 ${sourceNode.title} 鐨?${gridRows}x${gridCols} 绗?${cellIndex + 1} 鏍?(${crop.sw}x${crop.sh})`,
              status: "success",
            },
            { fromNodeId: nodeId, fromOutputIndex: 0, toInputIndex: 0 }
          );
        }
        showNotice(
          normalizedCellIndices.length > 1
            ? `Created ${normalizedCellIndices.length} grid child nodes and linked them automatically.`
            : `Created grid child node #${normalizedCellIndices[0] + 1} and linked it automatically.`
        );
        setPreviewContent(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "鍥剧墖鍒囧垎澶辫触";
        showNotice(message);
      }
    },
    [addNode, nodes, showNotice, toWorld]
  );

  const handleReplaceImageGridCell = React.useCallback(
    async (
      nodeId: string,
      imageUrl: string,
      replacementUrl: string,
      gridRows: number,
      gridCols: number,
      cellIndex: number
    ) => {
      try {
        const { dataUrl } = await replaceImageGridCell(
          imageUrl,
          replacementUrl,
          gridRows,
          cellIndex,
          gridCols
        );
        updateNodeData(nodeId, {
          imageUrl: dataUrl,
          imageUrls: [dataUrl],
          activeImageIndex: 0,
          imageNaturalWidth: undefined,
          imageNaturalHeight: undefined,
          imageDisplayWidth: undefined,
          imageDisplayHeight: undefined,
        });
        updateNodeProperty(nodeId, "imageUrl", dataUrl);
        setPrimaryImageResult(nodeId, dataUrl, 0);
        showNotice(`已永久替换第 ${cellIndex + 1} 个宫格`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "图片切片替换失败";
        showNotice(message);
      }
    },
    [setPrimaryImageResult, showNotice, updateNodeData, updateNodeProperty]
  );

  const moveGroup = React.useCallback(
    (groupId: string, x: number, y: number) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      const dx = x - group.x;
      const dy = y - group.y;
      if (dx === 0 && dy === 0) return;
      updateGroup(groupId, { x, y });
      updateNodePositions(
        nodes
          .filter((node) => node.groupId === groupId)
          .map((node) => ({ nodeId: node.id, x: node.x + dx, y: node.y + dy }))
      );
    },
    [groups, nodes, updateGroup, updateNodePositions]
  );

  const handleSelectNode = React.useCallback(
    (nodeId: string, e?: { shiftKey?: boolean }) => {
      if (e?.shiftKey) {
        applyCanvasSelection(toggleCanvasNodeSelection(currentCanvasSelection, nodeId));
        return;
      }
      applyCanvasSelection(selectCanvasNode(nodeId));
    },
    [applyCanvasSelection, currentCanvasSelection]
  );

  const handleSelectLink = React.useCallback(
    (linkId: string | null, anchor?: { x: number; y: number } | null) => {
      applyCanvasSelection(
        linkId ? selectCanvasLink(linkId, anchor ?? null) : clearCanvasSelection()
      );
    },
    [applyCanvasSelection]
  );

  const isCanvasSelectionBlocked = React.useCallback((target: HTMLElement | null) => {
    return Boolean(
      target?.closest(
        "[data-node-action='true'], [data-group-action='true'], .node-card, button, input, select, textarea, [contenteditable='true'], [role='textbox']"
      )
    );
  }, []);

  const handleBeginNodeCanvasLink = React.useCallback(
    (nodeId: string, outputIndex: number, clientX: number, clientY: number) => {
      if (selectedNodeIds.size > 1 && selectedNodeIds.has(nodeId) && batchLinkSources.length > 1) {
        beginBatchCanvasLink(batchLinkSources, clientX, clientY);
        return;
      }
      beginCanvasLink(nodeId, outputIndex, clientX, clientY);
    },
    [batchLinkSources, beginBatchCanvasLink, beginCanvasLink, selectedNodeIds]
  );

  const handleNodeContextMenu = React.useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = canvasRef.current?.getBoundingClientRect();
      const node = nodes.find((candidate) => candidate.id === nodeId);
      applyCanvasSelection(selectCanvasNode(nodeId));
      setMenuPos(null);
      setPendingLinkMenuDraft(null);
      if (node?.type === "text_node") {
        setNodeContextMenu(null);
        return;
      }
      setNodeContextMenu({
        nodeId,
        x: event.clientX - (rect?.left ?? 0),
        y: event.clientY - (rect?.top ?? 0),
      });
    },
    [applyCanvasSelection, canvasRef, nodes]
  );

  const closeNodeContextMenu = React.useCallback(() => {
    setNodeContextMenu(null);
  }, []);

  const handleCanvasSelectionPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (currentView !== "canvas" || menuPos || isLinkingOnCanvas || e.button !== 0) return false;
      const target = e.target as HTMLElement | null;
      if (isCanvasSelectionBlocked(target)) return false;

      const world = toWorld(e.clientX, e.clientY);
      const client = { x: e.clientX, y: e.clientY };
      blankPointerDownRef.current = { client, world };
      setSelectionDrag({ current: world, start: world });
      e.preventDefault();
      e.stopPropagation();
      return true;
    },
    [currentView, isCanvasSelectionBlocked, isLinkingOnCanvas, menuPos, toWorld]
  );

  const handleCanvasSelectionPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!selectionDrag) return false;
      setSelectionDrag((current) =>
        current ? { ...current, current: toWorld(e.clientX, e.clientY) } : current
      );
      e.preventDefault();
      e.stopPropagation();
      return true;
    },
    [selectionDrag, toWorld]
  );

  const handleCanvasSelectionPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      if (!selectionDrag) return false;
      const pointerStart = blankPointerDownRef.current;
      const pointerEnd = { x: e.clientX, y: e.clientY };
      const finalRect = normalizeSelectionRect(selectionDrag.start, toWorld(e.clientX, e.clientY));
      const isClick = pointerStart ? isClickWithoutDrag(pointerStart.client, pointerEnd) : false;
      setSelectionDrag(null);
      blankPointerDownRef.current = null;

      if (isClick) {
        applyCanvasSelection(clearCanvasSelection());
        closeNodeContextMenu();
      } else {
        const nextSelectedNodes = getNodesFullyInsideSelection(nodes, finalRect);
        const nextIds = nextSelectedNodes.map((node) => node.id);
        applyCanvasSelection(selectCanvasNodes(nextIds));
        closeNodeContextMenu();
      }

      e.preventDefault();
      e.stopPropagation();
      return true;
    },
    [applyCanvasSelection, closeNodeContextMenu, nodes, selectionDrag, toWorld]
  );

  const makePastedFragmentId = React.useCallback((prefix: "node" | "link") => {
    pasteIdCounterRef.current += 1;
    return `${prefix}_${Date.now().toString(36)}_${pasteIdCounterRef.current.toString(36)}`;
  }, []);

  const handleCopySelectedNodes = React.useCallback(() => {
    if (selectedNodes.length === 0) return false;
    const payload = createMultiNodeClipboardPayload(nodes, links, selectedNodeIds);
    if (payload.nodes.length === 0) return false;
    multiNodeClipboardRef.current = payload;
    const text = JSON.stringify(payload);
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    showNotice(`已复制 ${payload.nodes.length} 个节点。`);
    return true;
  }, [links, nodes, selectedNodeIds, selectedNodes.length, showNotice]);

  const handlePasteSelectedNodes = React.useCallback(
    (payload: MultiNodeClipboardPayload, clientPoint?: { clientX: number; clientY: number }) => {
      if (payload.nodes.length === 0) return false;
      const anchorClient =
        clientPoint ?? lastCanvasPointerRef.current ?? getCanvasCenterClientPosition();
      const pasted = pasteMultiNodeClipboardPayload(payload, {
        anchor: toWorld(anchorClient.clientX, anchorClient.clientY),
        existingNodes: nodes,
        idFactory: makePastedFragmentId,
      });
      if (pasted.nodes.length === 0) return false;
      insertNodesAndLinks(pasted.nodes, pasted.links);
      applyCanvasSelection(selectCanvasNodes(pasted.selectedNodeIds));
      closeNodeContextMenu();
      setMenuPos(null);
      return true;
    },
    [
      applyCanvasSelection,
      closeNodeContextMenu,
      getCanvasCenterClientPosition,
      insertNodesAndLinks,
      makePastedFragmentId,
      nodes,
      toWorld,
    ]
  );

  const handleRemoveSelectedNodes = React.useCallback(() => {
    const ids = Array.from(selectedNodeIds) as string[];
    if (ids.length === 0) return false;
    const removedCount = removeNodes(ids);
    if (removedCount > 0) applyCanvasSelection(clearCanvasSelection());
    return removedCount > 0;
  }, [applyCanvasSelection, removeNodes, selectedNodeIds]);

  const handleAnalyzeVideo = React.useCallback(
    async (node: GraphNode, captures: VideoFrameCaptureItem[]) => {
      if (captures.length === 0) {
        showNotice(
          "\u9010\u5e27\u5206\u6790\u63a5\u53e3\u6ca1\u6709\u8fd4\u56de\u53ef\u7528\u6570\u636e\u3002"
        );
        return;
      }

      addVideoFrameAnalysis(node.id, captures);
      showNotice(
        `\u5df2\u751f\u6210 ${captures.length} \u7ec4\u9010\u5e27\u5206\u6790\u8282\u70b9\u3002`
      );
    },
    [addVideoFrameAnalysis, showNotice]
  );

  const handleReverseVideoPrompt = React.useCallback(
    async (node: GraphNode, videoUrl: string) => {
      const prompt = await fetchVideoPrompt(videoUrl);
      if (!prompt.trim()) {
        showNotice("视频反推提示词接口没有返回可用内容。");
        return;
      }
      addVideoPromptTextNode(node.id, prompt);
      showNotice("已生成视频反推提示词文本节点。");
    },
    [addVideoPromptTextNode, showNotice]
  );

  const handleExtractFrameImage = React.useCallback(
    (nodeId: string, frameIndex: number, clientPoint?: { clientX: number; clientY: number }) => {
      const worldPoint = clientPoint ? toWorld(clientPoint.clientX, clientPoint.clientY) : null;
      const position = worldPoint ? getPointerAlignedNodePosition(worldPoint) : undefined;
      extractFrameImageNode(nodeId, frameIndex, position);
    },
    [extractFrameImageNode, toWorld]
  );

  const handleUngroup = React.useCallback(
    (groupId: string) => {
      ungroup(groupId);
      if (selectedGroupId === groupId) applyCanvasSelection(clearCanvasSelection());
    },
    [applyCanvasSelection, ungroup, selectedGroupId]
  );

  const clearMenuCloseTimer = React.useCallback(() => {
    if (menuCloseTimerRef.current !== null) {
      window.clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
  }, []);

  const closeFloatingMenus = React.useCallback(() => {
    clearMenuCloseTimer();
    setMenuPos(null);
    setIsMenuFromToolbar(false);
    setPendingLinkMenuDraft(null);
    setNodeContextMenu(null);
  }, [clearMenuCloseTimer, setIsMenuFromToolbar]);

  const handleNodeDragStart = React.useCallback(
    (event: React.PointerEvent, node: GraphNode) => {
      closeFloatingMenus();
      const batchNodes =
        selectedNodeIds.size > 1 && selectedNodeIds.has(node.id) ? selectedNodes : undefined;
      onNodeDragStart(event, node, { batchNodes });
    },
    [closeFloatingMenus, onNodeDragStart, selectedNodeIds, selectedNodes]
  );

  const handleSelectionDragStart = React.useCallback(
    (event: React.PointerEvent) => {
      if (selectedNodes.length < 2) return;
      closeFloatingMenus();
      onNodesDragStart(event, selectedNodes);
    },
    [closeFloatingMenus, onNodesDragStart, selectedNodes]
  );

  const openQuickMenu = React.useCallback(() => {
    clearMenuCloseTimer();
    setPendingLinkMenuDraft(null);
    setNodeContextMenu(null);
    setIsMenuFromToolbar(true);
    setMenuPos({ x: 24, y: 154 });
  }, [clearMenuCloseTimer, setIsMenuFromToolbar]);

  const scheduleMenuClose = React.useCallback(() => {
    clearMenuCloseTimer();
    menuCloseTimerRef.current = window.setTimeout(() => {
      setMenuPos(null);
      setIsMenuFromToolbar(false);
      menuCloseTimerRef.current = null;
    }, 180);
  }, [clearMenuCloseTimer, setIsMenuFromToolbar]);

  const uploadFilesToCanvas = React.useCallback(
    (files: File[], position: { clientX: number; clientY: number }) => {
      if (files.length === 0) return;

      clearMenuCloseTimer();
      setMenuPos(null);
      setIsMenuFromToolbar(false);
      setPendingLinkMenuDraft(null);
      closeNodeContextMenu();

      files.forEach((file, index) => {
        const offset = index * 36;
        void uploadCanvasFileAsNode({
          file,
          position: {
            clientX: position.clientX + offset,
            clientY: position.clientY + offset,
          },
          addNode: addNodeAtPosition,
          onUpdateNodeData: updateNodeData,
          onUpdateNodeProperty: updateNodeProperty,
          onNotice: showNotice,
        });
      });
    },
    [
      addNodeAtPosition,
      clearMenuCloseTimer,
      closeNodeContextMenu,
      setIsMenuFromToolbar,
      showNotice,
      updateNodeData,
      updateNodeProperty,
    ]
  );

  const miniMapConfig = useMiniMapConfig(nodes, canvasSize, pan, zoom);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncCanvasSize = () => {
      setCanvasSize({
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      });
    };

    syncCanvasSize();

    const resizeObserver = new ResizeObserver(syncCanvasSize);
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, [canvasRef]);

  React.useEffect(() => {
    if (currentView !== "canvas") return;

    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableEventTarget(event.target)) return;

      const files = getFilesFromTransfer(event.clipboardData);
      if (files.length > 0) {
        event.preventDefault();
        uploadFilesToCanvas(files, lastCanvasPointerRef.current ?? getCanvasCenterClientPosition());
        return;
      }

      const clipboardText =
        event.clipboardData?.getData("application/json") ||
        event.clipboardData?.getData("text/plain") ||
        "";
      const payload =
        parseMultiNodeClipboardPayload(clipboardText) ?? multiNodeClipboardRef.current;
      if (!payload) return;
      event.preventDefault();
      handlePasteSelectedNodes(payload);
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [currentView, getCanvasCenterClientPosition, handlePasteSelectedNodes, uploadFilesToCanvas]);

  React.useEffect(() => {
    const workflowId = currentWorkflowSummary?.id ?? null;
    const prev = autoFitStateRef.current;
    autoFitStateRef.current = { workflowId, nodeCount: nodes.length };

    const shouldFit = nodes.length === 1 && prev?.workflowId === workflowId && prev.nodeCount === 0;
    if (shouldFit) fitView();
  }, [currentWorkflowSummary?.id, fitView, nodes.length]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingField =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (e.key === "Escape" && isLinkingOnCanvas) {
        resetCanvasLinkDraft();
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (!isEditingField && mod && (e.key === "c" || e.key === "C")) {
        if (handleCopySelectedNodes()) e.preventDefault();
        return;
      }
      if (!isEditingField && (e.key === "Delete" || e.key === "Backspace") && selectedLinkId) {
        e.preventDefault();
        removeLink(selectedLinkId);
        applyCanvasSelection(clearCanvasSelection());
        return;
      }
      if (!isEditingField && (e.key === "Delete" || e.key === "Backspace")) {
        if (handleRemoveSelectedNodes()) {
          e.preventDefault();
          return;
        }
      }
      if (!isEditingField && (e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        e.preventDefault();
        removeNode(selectedNodeId);
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentView,
    isLinkingOnCanvas,
    resetCanvasLinkDraft,
    setActiveQuickTool,
    setCurrentView,
    undo,
    redo,
    selectedLinkId,
    removeLink,
    selectedNodeId,
    removeNode,
    applyCanvasSelection,
    handleCopySelectedNodes,
    handleRemoveSelectedNodes,
  ]);

  React.useEffect(() => {
    return () => {
      if (menuCloseTimerRef.current !== null) {
        window.clearTimeout(menuCloseTimerRef.current);
      }
    };
  }, []);

  const handleCanvasContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      if (currentView !== "canvas") return;
      if (!shouldOpenCanvasContextMenu(e.target)) return;

      if (isLinkingOnCanvas) {
        e.preventDefault();
        resetCanvasLinkDraft();
        return;
      }

      onContextMenu(e);
      setPendingLinkMenuDraft(null);
      closeNodeContextMenu();
      setMenuPos({ x: e.clientX, y: e.clientY });
      setIsMenuFromToolbar(false);
      clearMenuCloseTimer();
    },
    [
      clearMenuCloseTimer,
      closeNodeContextMenu,
      currentView,
      isLinkingOnCanvas,
      onContextMenu,
      resetCanvasLinkDraft,
      setIsMenuFromToolbar,
    ]
  );

  const handleCanvasDoubleClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (currentView !== "canvas") return;
      if (isLinkingOnCanvas) return;

      const target = e.target as HTMLElement;
      if (
        target.closest("[data-node-action='true'], .node-card, button, input, select, textarea")
      ) {
        return;
      }

      e.preventDefault();
      closeNodeContextMenu();
      setPendingLinkMenuDraft(null);
      setIsMenuFromToolbar(false);
      clearMenuCloseTimer();
      setMenuPos({ x: e.clientX, y: e.clientY });
    },
    [
      clearMenuCloseTimer,
      closeNodeContextMenu,
      currentView,
      isLinkingOnCanvas,
      setIsMenuFromToolbar,
    ]
  );

  const isCanvasProjectLoading = shouldShowCanvasProjectLoading({
    currentWorkflowId: currentWorkflowSummary?.id,
    isProjectLoading,
    requestedWorkflowId,
  });
  const showEmptyCanvasState = shouldShowEmptyCanvasState({
    currentView,
    isCanvasProjectLoading,
    nodeCount: nodes.length,
  });
  const shouldRenderCanvasContent = !shouldDeferCanvasContentRender({
    activeWorkflowId,
    currentView,
    groupCount: groups.length,
    linkCount: links.length,
    nodeCount: nodes.length,
  });

  if (isCanvasProjectLoading && !projectLoadError) {
    return panelFallback;
  }

  if (projectLoadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0f13] px-6 text-slate-100">
        <div className="max-w-lg rounded-3xl border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-sm text-rose-100">
          {projectLoadError}
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#6366f1",
          borderRadius: 12,
        },
      }}
    >
      <div
        className="relative w-full h-screen bg-[#202637] text-[#e2e8f0] overflow-hidden select-none font-sans"
        data-canvas-panning={isCanvasPanning ? "true" : undefined}
        onContextMenu={handleCanvasContextMenu}
      >
        <CanvasHeader
          projectName={remoteProject?.name}
          onProjectRenamed={(name) => {
            setRemoteProject((project) => (project ? { ...project, name } : project));
            setWorkflowName(name);
            if (currentWorkflowSummary) {
              renameWorkflow(currentWorkflowSummary.id, name);
            }
          }}
          onNotice={showNotice}
          onLogout={handleLogout}
        />

        <main
          ref={canvasRef}
          className={getCanvasViewportClassName()}
          onDoubleClick={handleCanvasDoubleClick}
          onDragOver={(e) => {
            if (currentView !== "canvas") return;
            if (!transferHasFiles(e.dataTransfer)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            if (currentView !== "canvas") return;
            const files = getFilesFromTransfer(e.dataTransfer);
            if (files.length === 0) return;
            e.preventDefault();
            e.stopPropagation();
            uploadFilesToCanvas(files, { clientX: e.clientX, clientY: e.clientY });
          }}
          onPointerDownCapture={(e) => {
            if (menuPos) return;
            if (!shouldStartCanvasPan(e.button)) return;
            lastCanvasPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
            onCanvasPointerDown(e);
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            lastCanvasPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
            if (menuPos) return;
            if (isLinkingOnCanvas) {
              e.preventDefault();
              resetCanvasLinkDraft();
              return;
            }
            if (handleCanvasSelectionPointerDown(e)) return;

            onCanvasPointerDown(e);
          }}
          onPointerMove={(e) => {
            lastCanvasPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
            if (handleCanvasSelectionPointerMove(e)) return;
            onPointerMove(e);
          }}
          onPointerMoveCapture={(e) => {
            if (isLinkingOnCanvas) {
              setDraftCursor(toWorld(e.clientX, e.clientY));
            }
          }}
          onPointerUp={(e) => {
            if (handleCanvasSelectionPointerUp(e)) return;
            onPointerUp(e);
            if (shouldFinishCanvasLinkOnCanvasPointerUp(isLinkingOnCanvas)) finishCanvasLink();
          }}
          onPointerLeave={(e) => {
            if (selectionDrag) {
              setSelectionDrag(null);
              blankPointerDownRef.current = null;
            }
            onPointerUp(e);
            if (isLinkingOnCanvas) resetCanvasLinkDraft();
          }}
        >
          {shouldRenderCanvasContent && (
            <LeaferCanvas
              nodes={nodes}
              nodeById={canvasGraphIndex.nodeById}
              links={links}
              pan={pan}
              zoom={zoom}
              showGrid={showGrid}
              selectedNodeId={selectedNodeId}
              draftFromNodeId={linkFromNodeId}
              draftToNodeId={linkToNodeId}
              draftFromOutputIndex={linkFromOutputIndex}
              draftToInputIndex={linkToInputIndex}
              draftIssue={linkDraftIssue}
              draftCursor={draftCursor}
              renderDraftPreview={false}
              animationsPaused={isCanvasPanning}
            />
          )}

          {shouldRenderCanvasContent && !isLinkingOnCanvas && (
            <LinkInteractionOverlay
              links={links}
              graphIndex={canvasGraphIndex}
              nodes={nodes}
              pan={pan}
              zoom={zoom}
              selectedNodeId={selectedNodeId}
              selectedLinkId={selectedLinkId}
              selectedLinkAnchor={selectedLinkAnchor}
              animationsPaused={isCanvasPanning}
              onSelectLink={(linkId, anchor) => {
                if (!linkId || !anchor) {
                  handleSelectLink(linkId, null);
                  return;
                }
                handleSelectLink(linkId, toWorld(anchor.x, anchor.y));
              }}
              onDeleteLink={removeLink}
            />
          )}

          {shouldRenderCanvasContent && (
            <GroupsLayer
              groups={groups}
              pan={pan}
              zoom={zoom}
              selectedNodeId={selectedNodeId}
              selectedGroupId={selectedGroupId}
              memberCountByGroup={memberCountByGroup}
              onSelectGroup={(groupId) => applyCanvasSelection(selectCanvasGroup(groupId))}
              onRunGroup={runGroup}
              onUngroup={handleUngroup}
              onDeleteGroup={handleUngroup}
              onMoveGroup={moveGroup}
              isRunning={isRunning}
            />
          )}

          {showEmptyCanvasState && (
            <EmptyCanvasState
              mode={isWelcomeDismissed ? "empty-project" : "welcome"}
              onPrimaryAction={isWelcomeDismissed ? openQuickMenu : handleCreateProjectFromWelcome}
            />
          )}
          <AnimatePresence>
            {menuPos && (
              <React.Suspense fallback={null}>
                <SearchMenu
                  x={menuPos.x}
                  y={menuPos.y}
                  isContextMenu={!isMenuFromToolbar}
                  onClose={() => {
                    clearMenuCloseTimer();
                    setMenuPos(null);
                    setIsMenuFromToolbar(false);
                    setPendingLinkMenuDraft(null);
                    closeNodeContextMenu();
                  }}
                  onAddNode={(type, x, y, initialProps) => {
                    let nodeId: string | undefined;
                    if (pendingLinkMenuDraft?.sources && pendingLinkMenuDraft.sources.length > 1) {
                      nodeId = addNodeAtPosition(
                        type,
                        pendingLinkMenuDraft.clientX,
                        pendingLinkMenuDraft.clientY,
                        initialProps
                      );
                      if (nodeId) {
                        addLinksFromDrafts(
                          pendingLinkMenuDraft.sources.map((source) => ({
                            fromNodeId: source.fromNodeId,
                            fromOutputIndex: source.fromOutputIndex,
                            toNodeId: nodeId!,
                            toInputIndex: 0,
                          }))
                        );
                      }
                    } else if (pendingLinkMenuDraft) {
                      nodeId = addNodeAtPosition(
                        type,
                        pendingLinkMenuDraft.clientX,
                        pendingLinkMenuDraft.clientY,
                        initialProps,
                        {
                          fromNodeId: pendingLinkMenuDraft.fromNodeId,
                          fromOutputIndex: pendingLinkMenuDraft.fromOutputIndex,
                        }
                      );
                    } else {
                      nodeId = addNodeAtPosition(type, x, y, initialProps);
                    }
                    setCurrentView("canvas");
                    setActiveQuickTool(null);
                    setPendingLinkMenuDraft(null);
                    closeNodeContextMenu();
                    return nodeId;
                  }}
                  onNotice={showNotice}
                  onUpdateNodeData={updateNodeData}
                  onUpdateNodeProperty={updateNodeProperty}
                  onHoverStart={clearMenuCloseTimer}
                  onHoverEnd={scheduleMenuClose}
                />
              </React.Suspense>
            )}
          </AnimatePresence>

          {nodeContextMenu && (
            <div
              data-node-action="true"
              className="absolute z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#141923]/96 p-1.5 text-sm text-slate-100 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95),0_0_28px_rgba(56,189,248,0.12)] backdrop-blur-xl"
              style={{
                left: Math.min(nodeContextMenu.x, Math.max(12, canvasSize.width - 188)),
                top: Math.min(
                  nodeContextMenu.y,
                  Math.max(
                    12,
                    canvasSize.height - (nodeContextMenuNode?.type === "text_node" ? 178 : 96)
                  )
                ),
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {nodeContextMenuNode?.type === "text_node" && (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-slate-200 transition hover:bg-cyan-300/10 hover:text-cyan-100"
                    onClick={() => {
                      if (!nodeContextMenuText) {
                        showNotice("This text node has no content to copy.");
                        closeNodeContextMenu();
                        return;
                      }
                      void navigator.clipboard.writeText(nodeContextMenuText);
                      showNotice("Text content copied.");
                      closeNodeContextMenu();
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    复制内容
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-slate-200 transition hover:bg-cyan-300/10 hover:text-cyan-100"
                    onClick={() => {
                      if (!nodeContextMenuText) {
                        showNotice("This text node has no content to preview.");
                        closeNodeContextMenu();
                        return;
                      }
                      setPreviewContent({
                        content: nodeContextMenuText,
                        nodeId: nodeContextMenu.nodeId,
                        title: "文本节点输出",
                      });
                      closeNodeContextMenu();
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    展开查看
                  </button>
                  <div className="my-1 h-px bg-white/10" />
                </>
              )}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-slate-200 transition hover:bg-cyan-300/10 hover:text-cyan-100"
                onClick={() => {
                  duplicateNode(nodeContextMenu.nodeId);
                  closeNodeContextMenu();
                }}
              >
                <Copy className="h-4 w-4" />
                复制节点
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-rose-100/90 transition hover:bg-rose-400/12 hover:text-rose-50"
                onClick={() => {
                  removeNode(nodeContextMenu.nodeId);
                  applyCanvasSelection(clearCanvasSelection());
                  closeNodeContextMenu();
                }}
              >
                <Trash2 className="h-4 w-4" />
                删除节点
              </button>
            </div>
          )}

          <SettingsPanels
            autoSaveWorkflow={autoSaveWorkflow}
            currentView={currentView}
            fallback={panelFallback}
            workflowName={workflowName}
            onSaveWorkflow={() => {
              const trimmedName = workflowName.trim();
              if (
                currentWorkflowSummary?.id &&
                trimmedName &&
                trimmedName !== currentWorkflowSummary.name
              ) {
                renameWorkflow(currentWorkflowSummary.id, trimmedName);
              }
              showNotice("Project settings saved.");
              setCurrentView("canvas");
              setActiveQuickTool(null);
            }}
            setAutoSaveWorkflow={setAutoSaveWorkflow}
            setWorkflowName={setWorkflowName}
          />

          {shouldRenderCanvasContent && (
            <CanvasNodeLayer
              apiConfig={{
                baseUrl: "",
                apiKey: "",
                remoteModelsByType,
              }}
              canvasSize={canvasSize}
              imageResolutionGroups={generationDictionaries?.imageResolutionGroups}
              videoResolutionGroups={generationDictionaries?.videoResolutionGroups}
              isLinkingOnCanvas={isLinkingOnCanvas}
              linkFromNodeId={linkFromNodeId}
              linkFromOutputIndex={linkFromOutputIndex}
              linkToInputIndex={linkToInputIndex}
              linkToNodeId={linkToNodeId}
              links={links}
              graphIndex={canvasGraphIndex}
              nodes={nodes}
              pan={pan}
              draggingNodeId={draggingNodeId}
              selectedNodeId={selectedNodeId}
              selectedNodeIds={selectedNodeIds}
              zoom={zoom}
              getCanvasLinkTargetIssue={getCanvasLinkTargetIssue}
              onBeginCanvasLink={handleBeginNodeCanvasLink}
              onCanvasPointerDown={onCanvasPointerDown}
              onDeleteNode={removeNode}
              onDuplicateNode={duplicateNode}
              onFinishCanvasLink={finishCanvasLink}
              onHoverCanvasLinkTarget={hoverCanvasLinkTarget}
              onLeaveCanvasLinkTarget={leaveCanvasLinkTarget}
              onNodeContextMenu={handleNodeContextMenu}
              onNodeDragStart={handleNodeDragStart}
              onPreview={(content, title, nodeId, items, currentIndex) =>
                setPreviewContent({
                  title: title || "棰勮鍐呭",
                  content,
                  nodeId,
                  items,
                  currentIndex,
                })
              }
              onAnalyzeVideo={handleAnalyzeVideo}
              onReverseVideoPrompt={handleReverseVideoPrompt}
              onSelectNode={(nodeId, e) => handleSelectNode(nodeId, e)}
              onUpdateNodeData={updateNodeData}
              onUpdateNodeProperty={updateNodeProperty}
              onSetPrimaryImageResult={setPrimaryImageResult}
              onExtractFrameImage={handleExtractFrameImage}
              onCreateVideoFrameImage={createVideoFrameImageNode}
              onCompleteVideoFrameImage={completeVideoFrameImageNode}
              onFailVideoFrameImage={failVideoFrameImageNode}
              onReplaceFrameImage={replaceFrameImageUrl}
              onSyncImagePromptStarterLayout={syncImagePromptStarterLayout}
              onSplitImageGrid={handleSplitImageGrid}
              onReplaceImageGridCell={handleReplaceImageGridCell}
              resolvedInputsMap={resolvedInputsMap}
              textNodeReferencesMap={textNodeReferencesMap}
              onRunNode={runNode}
              onNotice={showNotice}
            />
          )}
          {shouldRenderCanvasContent && (
            <MultiSelectionLayer
              bounds={multiSelectionBounds}
              dragRect={selectionDragRect}
              hasLinkableSources={batchLinkSources.length > 1 && !isLinkingOnCanvas}
              pan={pan}
              zoom={zoom}
              onBeginBatchLink={(clientX, clientY) => {
                beginBatchCanvasLink(batchLinkSources, clientX, clientY);
              }}
              onBeginSelectionDrag={handleSelectionDragStart}
            />
          )}
          {shouldRenderCanvasContent && isLinkingOnCanvas && (
            <DraftLinkOverlay
              nodes={nodes}
              nodeById={canvasGraphIndex.nodeById}
              pan={pan}
              zoom={zoom}
              draftSources={activeBatchLinkSources}
              draftFromNodeId={linkFromNodeId}
              draftToNodeId={linkToNodeId}
              draftFromOutputIndex={linkFromOutputIndex}
              draftToInputIndex={linkToInputIndex}
              draftIssue={linkDraftIssue}
              draftCursor={draftCursor}
            />
          )}
          {shouldRenderCanvasContent &&
            currentView === "canvas" &&
            showMiniMap &&
            miniMapConfig && (
              <MiniMap
                activeNodeId={selectedNodeId}
                config={miniMapConfig}
                onJumpToWorldPos={jumpToWorldPos}
                onScrollToNode={scrollToNode}
                onSelectNode={(nodeId) => applyCanvasSelection(selectCanvasNode(nodeId))}
              />
            )}
          {shouldRenderCanvasContent && currentView === "canvas" && (
            <CanvasControls
              showGrid={showGrid}
              showMiniMap={showMiniMap}
              snapToGridEnabled={snapToGridEnabled}
              zoom={zoom}
              onFitView={() => {
                fitView();
                showNotice("已自适应居中");
              }}
              onToggleGrid={() => {
                setShowGrid((v) => !v);
                showNotice(showGrid ? "已隐藏网格" : "已显示网格");
              }}
              onToggleMiniMap={() => {
                setShowMiniMap((v) => !v);
                showNotice(showMiniMap ? "已隐藏小地图" : "已显示小地图");
              }}
              onToggleSnapToGrid={() => {
                setSnapToGridEnabled((v) => !v);
                showNotice(snapToGridEnabled ? "已关闭网格吸附" : "已开启网格吸附");
              }}
            />
          )}
          {currentView === "canvas" && (
            <CanvasHistoryDock
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
              onClearCanvas={() => {
                clearCanvas();
                applyCanvasSelection(clearCanvasSelection());
              }}
            />
          )}
          {runNotice && (
            <div className="absolute right-6 top-20 z-50 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs">
              {runNotice}
            </div>
          )}
        </main>

        {previewContent && (
          <PreviewModal
            preview={previewContent}
            onClose={() => setPreviewContent(null)}
            onPreviewChange={setPreviewContent}
            onUpdateNodeText={(nodeId, text) => updateNodeProperty(nodeId, "text", text)}
            onSetPrimaryImageResult={setPrimaryImageResult}
            showNotice={showNotice}
          />
        )}
      </div>
    </ConfigProvider>
  );
}
