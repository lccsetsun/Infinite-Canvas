import React from "react";
import { AnimatePresence } from "motion/react";
import CanvasHeader from "./components/app/CanvasHeader";
import CanvasControls from "./components/app/CanvasControls";
import CanvasHistoryDock from "./components/app/CanvasHistoryDock";
import CanvasNodeLayer from "./components/app/CanvasNodeLayer";
import DraftLinkOverlay from "./components/app/DraftLinkOverlay";
import GroupsLayer from "./components/app/GroupsLayer";
import LinkInteractionOverlay from "./components/app/LinkInteractionOverlay";
import EmptyCanvasState from "./components/app/EmptyCanvasState";
import LeaferCanvas from "./components/canvas/LeaferCanvas";
import MiniMap from "./components/app/MiniMap";
import PreviewModal, { PreviewContent } from "./components/app/PreviewModal";
import SettingsPanels from "./components/app/SettingsPanels";
import { Copy, Eye, Trash2 } from "lucide-react";
import { snapPointToGrid } from "./components/canvas/geometry";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useCanvasLinking } from "./hooks/useCanvasLinking";
import { useMiniMapConfig } from "./hooks/useMiniMapConfig";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { useAppUiState } from "./hooks/useAppUiState";
import { shouldOpenCanvasContextMenu } from "./utils/canvasContextMenuPolicy";
import { shouldFinishCanvasLinkOnCanvasPointerUp } from "./utils/canvasPointerPolicy";
import { cropImageGridCell, getGridChildNodePosition } from "./utils/imageGridSplit";
import { getCanvasViewportClassName } from "./utils/canvasViewportLayout";
import { ConfigProvider, theme } from "antd";
import { GraphNode, NodeClass, VideoFrameAnalysisOverview, VideoFrameAnalysisSegment, VideoSegmentTextAnalysis } from "./types";
import { ApiSettings, getActiveProfile, getProviderProfile, loadApiSettings, saveApiSettings } from "./features/api/apiSettings";
import { clearAuthSession } from "./features/auth/authStorage";
import { logout } from "./features/auth/authApi";
import { performOptimisticLogout } from "./features/auth/logoutFlow";
import { getRemoteProjectDetail, updateRemoteProject, type RemoteCanvasProject } from "./features/workspace/remoteCanvas";

const SearchMenu = React.lazy(() => import("./components/SearchMenu"));

interface AppProps {
  onLoggedOut: () => void;
}

export default function App({ onLoggedOut }: AppProps) {
  const requestedWorkflowId = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("projectId")?.trim() || "";
  }, []);

  const panelFallback = (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f1218]/55 backdrop-blur-sm">
      <div className="rounded-full border border-[#2b3142] bg-[#171b26] px-4 py-2 text-sm text-gray-300">鍔犺浇涓?..</div>
    </div>
  );

  const [apiSettings, setApiSettings] = React.useState<ApiSettings>(() => loadApiSettings());
  const activeApiProfile = React.useMemo(() => getActiveProfile(apiSettings), [apiSettings]);
  const deepseekApiProfile = React.useMemo(() => getProviderProfile(apiSettings, "deepseek"), [apiSettings]);
  const minimaxApiProfile = React.useMemo(() => getProviderProfile(apiSettings, "minimax"), [apiSettings]);
  const apiBaseUrl = activeApiProfile.baseUrl;
  const apiKey = activeApiProfile.apiKey;
  const apiModel = activeApiProfile.model;
  const [remoteProject, setRemoteProject] = React.useState<RemoteCanvasProject | null>(null);
  const [isProjectLoading, setIsProjectLoading] = React.useState(Boolean(requestedWorkflowId));
  const [projectLoadError, setProjectLoadError] = React.useState("");

  const handleLogout = React.useCallback(() => {
    performOptimisticLogout({
      requestLogout: logout,
      clearSession: clearAuthSession,
      onLoggedOut,
    });
  }, [onLoggedOut]);

  React.useEffect(() => {
    if (!requestedWorkflowId) {
      setIsProjectLoading(false);
      setProjectLoadError("Missing projectId, cannot load remote project.");
      return;
    }

    setIsProjectLoading(true);
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
  }, [requestedWorkflowId]);

  const {
    nodes,
    links,
    selectedNodeId,
    isRunning,
    setSelectedNodeId,
    clearCanvas,
    runWorkflow,
    runNode,
    addNode,
    createImagePromptStarter,
    syncImagePromptStarterLayout,
    removeNode,
    removeLink,
    duplicateNode,
    updateNodePosition,
    updateNodeProperty,
    updateNodeData,
    setPrimaryImageResult,
    addVideoFrameAnalysis,
    addSegmentVideoAnalyses,
    linkFromNodeId,
    linkToNodeId,
    linkFromOutputIndex,
    linkToInputIndex,
    linkDraftIssue,
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
    groups,
    createGroup,
    ungroup,
    updateGroup,
    runGroup,
  } = useWorkflowState({
    apiConfig: {
      baseUrl: apiBaseUrl,
      apiKey,
      model: apiModel,
      temperature: activeApiProfile.temperature,
      maxTokens: activeApiProfile.maxTokens,
      topP: activeApiProfile.topP,
      timeout: activeApiProfile.timeout,
      systemPrompt: activeApiProfile.systemPrompt,
      useSystemProxy: activeApiProfile.useSystemProxy,
      deepseekBaseUrl: deepseekApiProfile?.baseUrl || "",
      deepseekApiKey: deepseekApiProfile?.apiKey || "",
      deepseekModel: deepseekApiProfile?.model || "",
      minimaxApiKey: minimaxApiProfile?.apiKey || "",
      minimaxBaseUrl: minimaxApiProfile?.baseUrl || "",
      providerApiKeys: {
        deepseek: deepseekApiProfile?.apiKey || "",
        minimax: minimaxApiProfile?.apiKey || "",
      },
      providerBaseUrls: {
        deepseek: deepseekApiProfile?.baseUrl || "",
        minimax: minimaxApiProfile?.baseUrl || "",
      },
      providerModels: {
        deepseek: deepseekApiProfile?.model || "",
        minimax: minimaxApiProfile?.model || "",
      },
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
      });
      setRemoteProject(project);
    },
  });

  const textNodeReferenceImagesMap = React.useMemo(() => {
    const nodeById = new Map<string, GraphNode>(nodes.map((node) => [node.id, node]));
    const map = new Map<string, string[]>();

    for (const link of links) {
      const targetNode = nodeById.get(link.toNodeId);
      const sourceNode = nodeById.get(link.fromNodeId);
      if (!targetNode || !sourceNode || targetNode.type !== "text_node") continue;

      const imageUrl =
        typeof sourceNode.data?.imageUrl === "string" && sourceNode.data.imageUrl.trim()
          ? sourceNode.data.imageUrl.trim()
          : typeof sourceNode.properties.imageUrl === "string" && sourceNode.properties.imageUrl.trim()
            ? sourceNode.properties.imageUrl.trim()
            : "";

      if (!imageUrl) continue;
      const existing = map.get(targetNode.id) ?? [];
      if (!existing.includes(imageUrl)) {
        existing.push(imageUrl);
        map.set(targetNode.id, existing);
      }
    }

    return map;
  }, [links, nodes]);

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
    activeQuickTool,
    setActiveQuickTool,
    runNotice,
    showNotice,
  } = useAppUiState();

  const [workflowName, setWorkflowName] = React.useState("榛樿椤圭洰");
  const [autoSaveWorkflow, setAutoSaveWorkflow] = React.useState(true);
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const [pendingLinkMenuDraft, setPendingLinkMenuDraft] = React.useState<{
    clientX: number;
    clientY: number;
    fromNodeId: string;
    fromOutputIndex: number;
  } | null>(null);
  const [previewContent, setPreviewContent] = React.useState<PreviewContent | null>(null);
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = React.useState<string | null>(null);
  const [selectedLinkAnchor, setSelectedLinkAnchor] = React.useState<{ x: number; y: number } | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = React.useState<Set<string>>(new Set());
  const [nodeContextMenu, setNodeContextMenu] = React.useState<{ nodeId: string; x: number; y: number } | null>(null);
  const nodeContextMenuNode = React.useMemo(
    () => (nodeContextMenu ? nodes.find((node) => node.id === nodeContextMenu.nodeId) ?? null : null),
    [nodeContextMenu, nodes]
  );
  const nodeContextMenuText = React.useMemo(() => {
    if (!nodeContextMenuNode || nodeContextMenuNode.type !== "text_node") return "";
    return (nodeContextMenuNode.data?.response as string) || (nodeContextMenuNode.properties.response as string) || "";
  }, [nodeContextMenuNode]);
  const menuCloseTimerRef = React.useRef<number | null>(null);
  const autoFitStateRef = React.useRef<{ workflowId: string | null; nodeCount: number } | null>(null);

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

  const handleCreateProjectFromWelcome = React.useCallback(() => {
    setIsWelcomeDismissed(true);
    setCurrentView("canvas");
    setActiveQuickTool(null);
  }, [
    setActiveQuickTool,
    setCurrentView,
    setIsWelcomeDismissed,
  ]);

  const {
    canvasRef,
    pan,
    zoom,
    toWorld,
    fitView,
    scrollToNode,
    jumpToWorldPos,
    focusWorldRect,
    onNodeDragStart,
    onCanvasPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
  } = useCanvasInteraction({ nodes, snapToGridEnabled, updateNodePosition });

  const {
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
    clearLinkDraft,
    linkFromNodeId,
    linkFromOutputIndex,
    linkToInputIndex,
    linkToNodeId,
    links,
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
      });
      setMenuPos({
        x: draft.clientX - (rect?.left ?? 0),
        y: draft.clientY - (rect?.top ?? 0),
      });
      setIsMenuFromToolbar(false);
    },
  });

  const addNodeAtPosition = (
    type: NodeClass,
    x: number,
    y: number,
    initialProps?: Record<string, any>,
    connectFromDraft?: { fromNodeId: string; fromOutputIndex: number; toInputIndex?: number }
  ) => {
    const world = toWorld(x, y);
    // Center the node (approx 280x300) around the click point
    const snapped = snapPointToGrid({
      x: world.x - 140,
      y: world.y - 120,
    });
    addNode(type, snapped.x, snapped.y, initialProps, connectFromDraft);
  };

  const handleCreateImagePromptStarter = React.useCallback(
    (nodeId: string) => {
      const result = createImagePromptStarter(nodeId);
      if (!result) return;
      setCurrentView("canvas");
      setActiveQuickTool(null);
      setSelectedLinkId(null);
      setSelectedGroupId(null);
      setSelectedNodeIds(new Set([result.textNodeId]));
      setSelectedNodeId(result.textNodeId);
      window.requestAnimationFrame(() => {
        focusWorldRect(result.bounds, {
          maxZoom: 0.84,
          padding: 180,
          offsetX: 28,
          offsetY: -20,
        });
      });
    },
    [createImagePromptStarter, focusWorldRect, setActiveQuickTool, setCurrentView, setSelectedNodeId]
  );

  const handleSplitImageGrid = React.useCallback(
    async (nodeId: string, imageUrl: string, gridRows: number, gridCols: number, cellIndices: number[]) => {
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) {
        showNotice("Source node was not found.");
        return;
      }
      try {
        const normalizedCellIndices = Array.from(new Set(cellIndices.map((index) => Math.max(0, Math.floor(index))))).sort((a, b) => a - b);
        for (const cellIndex of normalizedCellIndices) {
          const { dataUrl, crop } = await cropImageGridCell(imageUrl, gridRows, cellIndex, gridCols);
          const position = getGridChildNodePosition(sourceNode, gridRows, cellIndex, gridCols);
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
    [addNode, nodes, showNotice]
  );

  const moveGroup = React.useCallback((groupId: string, x: number, y: number) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const dx = x - group.x;
    const dy = y - group.y;
    if (dx === 0 && dy === 0) return;
    updateGroup(groupId, { x, y });
    const memberIds: string[] = nodes.filter((n) => n.groupId === groupId).map((n) => n.id);
    memberIds.forEach((id: string) => {
      const n = nodes.find((nn) => nn.id === id);
      if (!n) return;
      updateNodePosition(id, n.x + dx, n.y + dy);
    });
  }, [groups, nodes, updateGroup, updateNodePosition]);

  const handleSelectNode = React.useCallback((nodeId: string, e?: { shiftKey?: boolean }) => {
    setSelectedGroupId(null);
    setSelectedLinkId(null);
    if (e?.shiftKey) {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
      setSelectedNodeId(nodeId);
      return;
    }
    setSelectedNodeIds(new Set([nodeId]));
    setSelectedNodeId(nodeId);
  }, [setSelectedNodeId]);

  const handleSelectLink = React.useCallback((linkId: string | null, anchor?: { x: number; y: number } | null) => {
    setSelectedNodeId(null);
    setSelectedNodeIds(new Set());
    setSelectedGroupId(null);
    setSelectedLinkId(linkId);
    setSelectedLinkAnchor(linkId ? (anchor ?? null) : null);
  }, [setSelectedNodeId]);

  const handleNodeContextMenu = React.useCallback((nodeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    setSelectedGroupId(null);
    setSelectedLinkId(null);
    setSelectedLinkAnchor(null);
    setSelectedNodeIds(new Set([nodeId]));
    setSelectedNodeId(nodeId);
    setMenuPos(null);
    setPendingLinkMenuDraft(null);
    setNodeContextMenu({
      nodeId,
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    });
  }, [canvasRef, setSelectedNodeId]);

  const closeNodeContextMenu = React.useCallback(() => {
    setNodeContextMenu(null);
  }, []);

  const handleCreateGroup = () => {
    const ids = Array.from(selectedNodeIds);
    if (ids.length < 2) {
      showNotice("Hold Shift and select at least 2 nodes before grouping.");
      return;
    }
    const group = createGroup(ids);
    if (group) {
      setSelectedGroupId(group.id);
      setSelectedNodeIds(new Set());
    }
  };

  const handleAnalyzeVideo = React.useCallback(
    async (node: GraphNode, segments: VideoFrameAnalysisSegment[], overview: VideoFrameAnalysisOverview) => {
      const videoUrl = (node.data?.videoUrl as string) || (node.properties.videoUrl as string) || "";
      if (!videoUrl || segments.length === 0) {
        showNotice("No video or keyframe data available for analysis.");
        return;
      }

      showNotice("Analyzing full video.");
      let analysisMarkdown = "";
      try {
        const response = await fetch("/api/video/frame-analysis", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(deepseekApiProfile?.apiKey ? { "X-DeepSeek-Api-Key": deepseekApiProfile.apiKey } : {}),
            ...(deepseekApiProfile?.baseUrl ? { "X-DeepSeek-Base-Url": deepseekApiProfile.baseUrl } : {}),
            ...(deepseekApiProfile?.model ? { "X-DeepSeek-Model": deepseekApiProfile.model } : {}),
          },
          body: JSON.stringify({
            video_url: videoUrl,
            segments: segments.map(({ title, start, end, frameCount, width, height }) => ({ title, start, end, frameCount, width, height })),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Video analysis failed.");
        analysisMarkdown = typeof data?.text === "string" ? data.text : "";
      } catch (error) {
        const message = error instanceof Error ? error.message : "Video analysis failed.";
        analysisMarkdown = `## Full Video Analysis\n\nBackend analysis failed: ${message}\n\nGenerated the overview and segment keyframe nodes.`;
        showNotice(message);
      }

      addVideoFrameAnalysis(node.id, segments, overview, analysisMarkdown);
      showNotice("Video analysis structure generated.");
    },
    [addVideoFrameAnalysis, deepseekApiProfile, showNotice]
  );

  const handleReverseSegmentAnalysis = React.useCallback(
    async (node: GraphNode) => {
      const videoUrl = typeof node.properties.frameAnalysisVideoUrl === "string" ? node.properties.frameAnalysisVideoUrl : "";
      const rawSegments = Array.isArray(node.properties.frameAnalysisSegments) ? node.properties.frameAnalysisSegments : [];
      const segments = rawSegments
        .map((segment) => ({
          title: typeof segment?.title === "string" ? segment.title : "",
          start: typeof segment?.start === "number" ? segment.start : 0,
          end: typeof segment?.end === "number" ? segment.end : 0,
          frameCount: typeof segment?.frameCount === "number" ? segment.frameCount : 0,
          width: typeof segment?.width === "number" ? segment.width : 0,
          height: typeof segment?.height === "number" ? segment.height : 0,
        }))
        .filter((segment) => segment.title && segment.end >= segment.start);

      if (!videoUrl || segments.length === 0) {
        showNotice("No segment data available for reverse analysis.");
        return;
      }

      showNotice(`Reverse-analyzing ${segments.length} video segments.`);
      const analyses: VideoSegmentTextAnalysis[] = await Promise.all(
        segments.map(async (segment) => {
          try {
            const response = await fetch("/api/video/frame-analysis", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                ...(deepseekApiProfile?.apiKey ? { "X-DeepSeek-Api-Key": deepseekApiProfile.apiKey } : {}),
                ...(deepseekApiProfile?.baseUrl ? { "X-DeepSeek-Base-Url": deepseekApiProfile.baseUrl } : {}),
                ...(deepseekApiProfile?.model ? { "X-DeepSeek-Model": deepseekApiProfile.model } : {}),
              },
              body: JSON.stringify({
                video_url: videoUrl,
                segments: [segment],
                prompt: [
                  `Analyze only this time range of the video: ${segment.title} (${segment.start.toFixed(1)}s-${segment.end.toFixed(1)}s).`,
                  "Return Markdown including visual content, subject motion, camera motion, pacing changes, and useful follow-up generation or editing prompts.",
                  "Do not analyze other time ranges.",
                ].join("\n"),
              }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || "Segment reverse analysis failed.");
            return {
              title: segment.title,
              start: segment.start,
              end: segment.end,
              text:
                typeof data?.text === "string" && data.text.trim()
                  ? data.text
                  : `## ${segment.title}\n\nNo analysis result was returned.`,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : "Segment reverse analysis failed.";
            return {
              title: segment.title,
              start: segment.start,
              end: segment.end,
              text: `## ${segment.title}\n\nReverse analysis failed: ${message}`,
            };
          }
        })
      );

      addSegmentVideoAnalyses(node.id, analyses);
      showNotice("Segment reverse analysis completed.");
    },
    [addSegmentVideoAnalyses, deepseekApiProfile, showNotice]
  );

  const handleUngroup = React.useCallback((groupId: string) => {
    ungroup(groupId);
    if (selectedGroupId === groupId) setSelectedGroupId(null);
  }, [ungroup, selectedGroupId]);

  const runNow = () => {
    runWorkflow();
    showNotice(`Run triggered at ${new Date().toLocaleTimeString()}.`);
  };

  const clearMenuCloseTimer = React.useCallback(() => {
    if (menuCloseTimerRef.current !== null) {
      window.clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
  }, []);

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
    const workflowId = currentWorkflowSummary?.id ?? null;
    const prev = autoFitStateRef.current;
    autoFitStateRef.current = { workflowId, nodeCount: nodes.length };

    const shouldFit =
      nodes.length > 0 &&
      (!prev || prev.workflowId !== workflowId || prev.nodeCount === 0);
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
      if (!isEditingField && (e.key === "Delete" || e.key === "Backspace") && selectedLinkId) {
        e.preventDefault();
        removeLink(selectedLinkId);
        setSelectedLinkId(null);
        return;
      }
      if (!isEditingField && (e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        e.preventDefault();
        removeNode(selectedNodeId);
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentView, isLinkingOnCanvas, resetCanvasLinkDraft, setActiveQuickTool, setCurrentView, undo, redo, selectedLinkId, removeLink, selectedNodeId, removeNode]);

  React.useEffect(() => {
    return () => {
      if (menuCloseTimerRef.current !== null) {
        window.clearTimeout(menuCloseTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    try {
      saveApiSettings(apiSettings);
    } catch {
      // quota exceeded 鈥?ignore
    }
  }, [apiSettings]);

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
      if (target.closest("[data-node-action='true'], .node-card, button, input, select, textarea")) {
        return;
      }

      e.preventDefault();
      closeNodeContextMenu();
      setPendingLinkMenuDraft(null);
      setIsMenuFromToolbar(false);
      clearMenuCloseTimer();
      setMenuPos({ x: e.clientX, y: e.clientY });
    },
    [clearMenuCloseTimer, closeNodeContextMenu, currentView, isLinkingOnCanvas, setIsMenuFromToolbar]
  );

  if (isProjectLoading) {
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
        onContextMenu={handleCanvasContextMenu}
      >
        <CanvasHeader
          onOpenApiSettings={() => {
            setCurrentView("api");
            setActiveQuickTool(null);
          }}
          onLogout={handleLogout}
        />

      <main
        ref={canvasRef}
        className={getCanvasViewportClassName()}
        onDoubleClick={handleCanvasDoubleClick}
        onPointerDown={(e) => {
          if (isLinkingOnCanvas) {
            e.preventDefault();
            resetCanvasLinkDraft();
            return;
          }
          
          // 鐐瑰嚮鑳屾櫙鏃跺彇娑堟墍鏈夐€夋嫨 (濡傛灉娌℃湁鐐瑰嚮鍒拌妭鐐规垨鍔ㄤ綔鎸夐挳)
          const target = e.target as HTMLElement;
          if (!target.closest("[data-node-action='true'], .node-card, button, input, select, textarea")) {
            setSelectedNodeId(null);
            setSelectedNodeIds(new Set());
            setSelectedGroupId(null);
            setSelectedLinkId(null);
            setSelectedLinkAnchor(null);
            closeNodeContextMenu();
          }
          
          onCanvasPointerDown(e);
        }}
        onPointerMove={onPointerMove}
        onPointerMoveCapture={(e) => {
          if (isLinkingOnCanvas) {
            setDraftCursor(toWorld(e.clientX, e.clientY));
          }
        }}
        onPointerUp={(e) => {
          onPointerUp(e);
          if (shouldFinishCanvasLinkOnCanvasPointerUp(isLinkingOnCanvas)) finishCanvasLink();
        }}
        onPointerLeave={(e) => {
          onPointerUp(e);
          if (isLinkingOnCanvas) resetCanvasLinkDraft();
        }}
      >
        <LeaferCanvas
          nodes={nodes}
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
        />

        {!isLinkingOnCanvas && (
          <LinkInteractionOverlay
            links={links}
            nodes={nodes}
            pan={pan}
            zoom={zoom}
            selectedNodeId={selectedNodeId}
            selectedLinkId={selectedLinkId}
            selectedLinkAnchor={selectedLinkAnchor}
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

        <GroupsLayer
          groups={groups}
          pan={pan}
          zoom={zoom}
          selectedNodeId={selectedNodeId}
          selectedGroupId={selectedGroupId}
          memberCountByGroup={memberCountByGroup}
          onSelectGroup={setSelectedGroupId}
          onRunGroup={runGroup}
          onUngroup={handleUngroup}
          onDeleteGroup={handleUngroup}
          onMoveGroup={moveGroup}
          isRunning={isRunning}
        />

        {nodes.length === 0 && currentView === "canvas" && (
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
                  if (pendingLinkMenuDraft) {
                    addNodeAtPosition(
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
                    addNodeAtPosition(type, x, y, initialProps);
                  }
                  setCurrentView("canvas");
                  setActiveQuickTool(null);
                  setPendingLinkMenuDraft(null);
                  closeNodeContextMenu();
                }}
                onNotice={showNotice}
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
              top: Math.min(nodeContextMenu.y, Math.max(12, canvasSize.height - (nodeContextMenuNode?.type === "text_node" ? 178 : 96))),
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
                setSelectedNodeIds(new Set());
                setSelectedLinkId(null);
                closeNodeContextMenu();
              }}
            >
              <Trash2 className="h-4 w-4" />
              删除节点
            </button>
          </div>
        )}

        <SettingsPanels
          apiSettings={apiSettings}
          autoSaveWorkflow={autoSaveWorkflow}
          currentView={currentView}
          fallback={panelFallback}
          workflowName={workflowName}
          onSaveApiSettings={(s) => {
            setApiSettings(s);
            showNotice("API settings saved.");
          }}
          onSaveWorkflow={() => {
            const trimmedName = workflowName.trim();
            if (currentWorkflowSummary?.id && trimmedName && trimmedName !== currentWorkflowSummary.name) {
              renameWorkflow(currentWorkflowSummary.id, trimmedName);
            }
            showNotice("Project settings saved.");
            setCurrentView("canvas");
            setActiveQuickTool(null);
          }}
          setAutoSaveWorkflow={setAutoSaveWorkflow}
          setWorkflowName={setWorkflowName}
          showNotice={showNotice}
        />

        <CanvasNodeLayer
          apiConfig={{
            baseUrl: apiBaseUrl,
            apiKey,
            providerModels: {
              deepseek: deepseekApiProfile?.model || "",
              minimax: minimaxApiProfile?.model || "",
            },
          }}
          isLinkingOnCanvas={isLinkingOnCanvas}
          linkFromNodeId={linkFromNodeId}
          linkFromOutputIndex={linkFromOutputIndex}
          linkToInputIndex={linkToInputIndex}
          linkToNodeId={linkToNodeId}
          nodes={nodes}
          pan={pan}
          selectedNodeId={selectedNodeId}
          zoom={zoom}
          getCanvasLinkTargetIssue={getCanvasLinkTargetIssue}
          onBeginCanvasLink={beginCanvasLink}
          onCanvasPointerDown={onCanvasPointerDown}
          onDeleteNode={removeNode}
          onDuplicateNode={duplicateNode}
          onFinishCanvasLink={finishCanvasLink}
          onHoverCanvasLinkTarget={hoverCanvasLinkTarget}
          onLeaveCanvasLinkTarget={leaveCanvasLinkTarget}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeDragStart={onNodeDragStart}
          onPreview={(content, title, nodeId, items, currentIndex) =>
            setPreviewContent({ title: title || "棰勮鍐呭", content, nodeId, items, currentIndex })
          }
          onAnalyzeVideo={handleAnalyzeVideo}
          onReverseSegmentAnalysis={handleReverseSegmentAnalysis}
          onSelectNode={(nodeId, e) => handleSelectNode(nodeId, e)}
          onUpdateNodeData={updateNodeData}
          onUpdateNodeProperty={updateNodeProperty}
          onSetPrimaryImageResult={setPrimaryImageResult}
          onSyncImagePromptStarterLayout={syncImagePromptStarterLayout}
          onSplitImageGrid={handleSplitImageGrid}
          resolvedInputsMap={resolvedInputsMap}
          textNodeReferenceImagesMap={textNodeReferenceImagesMap}
          onRunNode={runNode}
          onCreateImagePromptStarter={handleCreateImagePromptStarter}
          onNotice={showNotice}
        />
        {isLinkingOnCanvas && (
          <DraftLinkOverlay
            nodes={nodes}
            pan={pan}
            zoom={zoom}
            draftFromNodeId={linkFromNodeId}
            draftToNodeId={linkToNodeId}
            draftFromOutputIndex={linkFromOutputIndex}
            draftToInputIndex={linkToInputIndex}
            draftIssue={linkDraftIssue}
            draftCursor={draftCursor}
          />
        )}
        {currentView === "canvas" && showMiniMap && miniMapConfig && (
          <MiniMap
            activeNodeId={selectedNodeId}
            config={miniMapConfig}
            onJumpToWorldPos={jumpToWorldPos}
            onScrollToNode={scrollToNode}
            onSelectNode={setSelectedNodeId}
          />
        )}
        {currentView === "canvas" && (
          <CanvasControls
            showGrid={showGrid}
            showMiniMap={showMiniMap}
            snapToGridEnabled={snapToGridEnabled}
            selectedCount={selectedNodeIds.size}
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
            onCreateGroup={handleCreateGroup}
          />
        )}
        {currentView === "canvas" && (
          <CanvasHistoryDock
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onClearCanvas={clearCanvas}
          />
        )}
        {runNotice && <div className="absolute right-6 top-20 z-50 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs">{runNotice}</div>}
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

