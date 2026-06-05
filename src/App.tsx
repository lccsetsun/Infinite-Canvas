import React from "react";
import { AnimatePresence } from "motion/react";
import AppHeader from "./components/app/AppHeader";
import CanvasControls from "./components/app/CanvasControls";
import CanvasHistoryDock from "./components/app/CanvasHistoryDock";
import CanvasNodeLayer from "./components/app/CanvasNodeLayer";
import CanvasStatusBar from "./components/app/CanvasStatusBar";
import DraftLinkOverlay from "./components/app/DraftLinkOverlay";
import GroupsLayer from "./components/app/GroupsLayer";
import LinkInteractionOverlay from "./components/app/LinkInteractionOverlay";
import FloatingToolbar from "./components/FloatingToolbar";
import EmptyCanvasState from "./components/app/EmptyCanvasState";
import LeaferCanvas from "./components/canvas/LeaferCanvas";
import MiniMap from "./components/app/MiniMap";
import PreviewModal, { PreviewContent } from "./components/app/PreviewModal";
import SettingsPanels from "./components/app/SettingsPanels";
import WorkflowManager from "./components/WorkflowManager";
import LoginPage from "./pages/LoginPage";
import { Copy, Eye, Trash2 } from "lucide-react";
import { snapPointToGrid } from "./components/canvas/geometry";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useCanvasLinking } from "./hooks/useCanvasLinking";
import { useMiniMapConfig } from "./hooks/useMiniMapConfig";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { useAppUiState } from "./hooks/useAppUiState";
import { shouldFinishCanvasLinkOnCanvasPointerUp } from "./utils/canvasPointerPolicy";
import { cropImageGridCell, getGridChildNodePosition } from "./utils/imageGridSplit";
import { ConfigProvider, theme } from "antd";
import { GraphNode, NodeClass, VideoFrameAnalysisOverview, VideoFrameAnalysisSegment, VideoSegmentTextAnalysis } from "./types";
import { ApiSettings, getActiveProfile, getProviderProfile, loadApiSettings, saveApiSettings } from "./features/api/apiSettings";
import { clearAuthSession, hasAuthSession, setAccessToken } from "./features/auth/authStorage";
import { logout } from "./features/auth/authApi";

const SearchMenu = React.lazy(() => import("./components/SearchMenu"));

export default function App() {
  const panelFallback = (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f1218]/55 backdrop-blur-sm">
      <div className="rounded-full border border-[#2b3142] bg-[#171b26] px-4 py-2 text-sm text-gray-300">加载中...</div>
    </div>
  );

  const [apiSettings, setApiSettings] = React.useState<ApiSettings>(() => loadApiSettings());
  const activeApiProfile = React.useMemo(() => getActiveProfile(apiSettings), [apiSettings]);
  const deepseekApiProfile = React.useMemo(() => getProviderProfile(apiSettings, "deepseek"), [apiSettings]);
  const minimaxApiProfile = React.useMemo(() => getProviderProfile(apiSettings, "minimax"), [apiSettings]);
  const apiBaseUrl = activeApiProfile.baseUrl;
  const apiKey = activeApiProfile.apiKey;
  const apiModel = activeApiProfile.model;
  const [workflowManagerOpen, setWorkflowManagerOpen] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(() => {
    return hasAuthSession();
  });

  const handleLogin = (accessToken: string) => {
    setAccessToken(accessToken);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
      showNotice("已退出登录");
    } catch (error) {
      showNotice(error instanceof Error ? `退出接口调用失败：${error.message}` : "退出接口调用失败，已清理本地登录态");
    } finally {
      clearAuthSession();
      setIsLoggedIn(false);
    }
  };

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
    workflowList,
    trashList,
    currentWorkflowSummary,
    allCategories,
    allTags,
    createWorkflow,
    switchWorkflow,
    renameWorkflow,
    setWorkflowCategory,
    addTagToWorkflow,
    removeTagFromWorkflow,
    moveWorkflow,
    deleteWorkflow,
    duplicateWorkflow,
    restoreWorkflow,
    purgeWorkflow,
    emptyTrash,
    purgeExpiredTrash,
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

  const [workflowName, setWorkflowName] = React.useState("默认项目");
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

    if (
      workflowList.length === 1 &&
      nodes.length === 0 &&
      links.length === 0 &&
      currentWorkflowSummary?.id &&
      currentWorkflowSummary.name === "默认项目"
    ) {
      renameWorkflow(currentWorkflowSummary.id, "项目 1");
      showNotice('已进入空白项目 "项目 1"');
      return;
    }

    const project = createWorkflow();
    if (project) {
      switchWorkflow(project.id);
      showNotice(`已创建并切换到 "${project.name}"`);
    }
  }, [
    createWorkflow,
    currentWorkflowSummary?.id,
    currentWorkflowSummary?.name,
    links.length,
    nodes.length,
    renameWorkflow,
    setActiveQuickTool,
    setCurrentView,
    setIsWelcomeDismissed,
    showNotice,
    switchWorkflow,
    workflowList.length,
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
        showNotice("来源节点不存在，无法切分");
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
              __nodeTitle: `宫格切分 ${gridRows}x${gridCols} #${cellIndex + 1}`,
              __uploadedAssetUrl: dataUrl,
              __uploadedAssetKind: "image",
              imageUrl: dataUrl,
              text: `来自 ${sourceNode.title} 的 ${gridRows}x${gridCols} 第 ${cellIndex + 1} 格 (${crop.sw}x${crop.sh})`,
              status: "success",
            },
            { fromNodeId: nodeId, fromOutputIndex: 0, toInputIndex: 0 }
          );
        }
        showNotice(
          normalizedCellIndices.length > 1
            ? `已生成 ${normalizedCellIndices.length} 个格子节点并自动连线`
            : `已生成第 ${normalizedCellIndices[0] + 1} 格子节点并自动连线`
        );
        setPreviewContent(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "图片切分失败";
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

  const handleSelectLink = React.useCallback((linkId: string | null) => {
    setSelectedNodeId(null);
    setSelectedNodeIds(new Set());
    setSelectedGroupId(null);
    setSelectedLinkId(linkId);
  }, [setSelectedNodeId]);

  const handleNodeContextMenu = React.useCallback((nodeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    setSelectedGroupId(null);
    setSelectedLinkId(null);
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
      showNotice("请按住 Shift 多选至少 2 个节点,再点击「打组」");
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
        showNotice("没有可分析的视频或关键帧");
        return;
      }

      showNotice("正在分析完整视频");
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
        if (!response.ok) throw new Error(data?.error || "视频分析失败");
        analysisMarkdown = typeof data?.text === "string" ? data.text : "";
      } catch (error) {
        const message = error instanceof Error ? error.message : "视频分析失败";
        analysisMarkdown = `## 完整视频分析\n\n后端分析失败: ${message}\n\n已生成完整逐帧总览图和分段关键帧节点。`;
        showNotice(message);
      }

      addVideoFrameAnalysis(node.id, segments, overview, analysisMarkdown);
      showNotice("逐帧分析结构已生成");
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
        showNotice("没有可反推的分段信息");
        return;
      }

      showNotice(`正在反推 ${segments.length} 个分段视频分析`);
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
                  `请只分析视频的这个时间分段: ${segment.title} (${segment.start.toFixed(1)}s-${segment.end.toFixed(1)}s)。`,
                  "输出 Markdown，包含：画面内容、主体运动、镜头运动、节奏变化、可用于后续生成/剪辑的提示。",
                  "不要分析其他时间段。",
                ].join("\n"),
              }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || "分段反推失败");
            return {
              title: segment.title,
              start: segment.start,
              end: segment.end,
              text: typeof data?.text === "string" && data.text.trim() ? data.text : `## ${segment.title}\n\n暂无分析结果。`,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : "分段反推失败";
            return {
              title: segment.title,
              start: segment.start,
              end: segment.end,
              text: `## ${segment.title}\n\n反推失败: ${message}`,
            };
          }
        })
      );

      addSegmentVideoAnalyses(node.id, analyses);
      showNotice("分段反推完成");
    },
    [addSegmentVideoAnalyses, deepseekApiProfile, showNotice]
  );

  const handleUngroup = React.useCallback((groupId: string) => {
    ungroup(groupId);
    if (selectedGroupId === groupId) setSelectedGroupId(null);
  }, [ungroup, selectedGroupId]);

  const runNow = () => {
    runWorkflow();
    showNotice(`已触发运行（${new Date().toLocaleTimeString()}）`);
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
      // quota exceeded — ignore
    }
  }, [apiSettings]);

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
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
      <div className="relative w-full h-screen bg-[#202637] text-[#e2e8f0] overflow-hidden select-none font-sans">
        <AppHeader
          workflowName={currentWorkflowSummary?.name}
          workflowCount={workflowList.length}
          onOpenWorkflowManager={() => setWorkflowManagerOpen(true)}
          onRun={runNow}
          onLogout={handleLogout}
        />

      <main
        ref={canvasRef}
        className="relative h-[calc(100vh-4rem)] cursor-grab active:cursor-grabbing select-none"
        onPointerDown={(e) => {
          if (isLinkingOnCanvas) {
            e.preventDefault();
            resetCanvasLinkDraft();
            return;
          }
          
          // 点击背景时取消所有选择 (如果没有点击到节点或动作按钮)
          const target = e.target as HTMLElement;
          if (!target.closest("[data-node-action='true'], .node-card, button, input, select, textarea")) {
            setSelectedNodeId(null);
            setSelectedNodeIds(new Set());
            setSelectedGroupId(null);
            setSelectedLinkId(null);
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
        onContextMenu={(e) => {
          if (isLinkingOnCanvas) {
            e.preventDefault();
            resetCanvasLinkDraft();
            return;
          }
          onContextMenu(e);
          setPendingLinkMenuDraft(null);
          closeNodeContextMenu();
          setMenuPos({ x: e.clientX, y: e.clientY - 64 });
          setIsMenuFromToolbar(false);
          clearMenuCloseTimer();
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
            onSelectLink={handleSelectLink}
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
                      showNotice("当前文本节点暂无内容可复制");
                      closeNodeContextMenu();
                      return;
                    }
                    void navigator.clipboard.writeText(nodeContextMenuText);
                    showNotice("文本内容已复制");
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
                      showNotice("当前文本节点暂无内容可查看");
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

        <FloatingToolbar
          menuOpen={isMenuFromToolbar}
          activeTool={activeQuickTool}
          onOpenQuickMenu={() => {
            openQuickMenu();
          }}
          onCloseQuickMenu={() => {
            clearMenuCloseTimer();
            setMenuPos(null);
            setIsMenuFromToolbar(false);
          }}
          onScheduleQuickMenuClose={scheduleMenuClose}
          onOpenApi={() => {
            if (currentView === "api") {
              setCurrentView("canvas");
              setActiveQuickTool(null);
            } else {
              setActiveQuickTool("api");
              setCurrentView("api");
            }
            clearMenuCloseTimer();
            setMenuPos(null);
          }}
          onOpenWorkflow={() => {
            if (currentView === "workflow") {
              setCurrentView("canvas");
              setActiveQuickTool(null);
            } else {
              setActiveQuickTool("workflow");
              setCurrentView("workflow");
            }
            clearMenuCloseTimer();
            setMenuPos(null);
          }}
        />

        <SettingsPanels
          apiSettings={apiSettings}
          autoSaveWorkflow={autoSaveWorkflow}
          currentView={currentView}
          fallback={panelFallback}
          workflowName={workflowName}
          onSaveApiSettings={(s) => {
            setApiSettings(s);
            showNotice("API 设置已保存");
          }}
          onSaveWorkflow={() => {
            showNotice("项目设置已保存");
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
            setPreviewContent({ title: title || "预览内容", content, nodeId, items, currentIndex })
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
        {currentView === "canvas" && (
          <CanvasStatusBar nodeCount={nodes.length} linkCount={links.length} zoom={zoom} />
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

      <WorkflowManager
        open={workflowManagerOpen}
        list={workflowList}
        trash={trashList}
        allCategories={allCategories}
        allTags={allTags}
        currentId={currentWorkflowSummary?.id ?? null}
        workflowName={currentWorkflowSummary?.name ?? "默认项目"}
        onClose={() => setWorkflowManagerOpen(false)}
        onSwitch={switchWorkflow}
        onCreate={createWorkflow}
        onRename={renameWorkflow}
        onSetCategory={setWorkflowCategory}
        onAddTag={addTagToWorkflow}
        onRemoveTag={removeTagFromWorkflow}
        onMove={moveWorkflow}
        onDelete={deleteWorkflow}
        onDuplicate={duplicateWorkflow}
        onRestore={restoreWorkflow}
        onPurge={purgeWorkflow}
        onEmptyTrash={emptyTrash}
        onPurgeExpired={purgeExpiredTrash}
        showNotice={showNotice}
      />
    </div>
    </ConfigProvider>
  );
}
