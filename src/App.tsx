import React from "react";
import { Tooltip } from "./components/common/Tooltip";
import { Eye, Grid3X3, LayoutGrid, LocateFixed, Magnet, Play, Trash2, X, Plus, Terminal, Download, Copy, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import FloatingToolbar from "./components/FloatingToolbar";
import LeaferCanvas from "./components/canvas/LeaferCanvas";
import NodeCard from "./components/canvas/NodeCard";
import { getInputAnchor, getOutputAnchor, getNodeHeight, getNodeWidth, NODE_HEIGHT, NODE_WIDTH, snapPointToGrid } from "./components/canvas/geometry";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { useAppUiState } from "./hooks/useAppUiState";
import { ConfigProvider, theme } from "antd";
import { NodeClass } from "./types";
import { getLinkDraftIssue } from "./utils/linking";

const LogicPanel = React.lazy(() => import("./components/LogicPanel"));
const SearchMenu = React.lazy(() => import("./components/SearchMenu"));
const ApiSettingsPage = React.lazy(() => import("./components/pages/ApiSettingsPage"));
const WorkflowSettingsPage = React.lazy(() => import("./components/pages/WorkflowSettingsPage"));

export default function App() {
  const panelFallback = (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f1218]/55 backdrop-blur-sm">
      <div className="rounded-full border border-[#2b3142] bg-[#171b26] px-4 py-2 text-sm text-gray-300">加载中...</div>
    </div>
  );

  const {
    nodes,
    links,
    selectedNodeId,
    selectedNode,
    setSelectedNodeId,
    clearCanvas,
    runWorkflow,
    addNode,
    removeNode,
    removeLink,
    duplicateNode,
    updateNodePosition,
    updateNodeProperty,
    updateNodeData,
    updateSelectedProperty,
    logs,
    linkFromNodeId,
    linkToNodeId,
    linkFromOutputIndex,
    linkToInputIndex,
    linkDraftIssue,
    setLinkFromNodeId,
    setLinkToNodeId,
    setLinkFromOutputIndex,
    setLinkToInputIndex,
    clearLinkDraft,
    addLinkFromDraft,
    addLink,
  } = useWorkflowState();

  const {
    showLogicPanel,
    setShowLogicPanel,
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

  const [workflowName, setWorkflowName] = React.useState("默认工作流");
  const [autoSaveWorkflow, setAutoSaveWorkflow] = React.useState(true);
  const [apiBaseUrl, setApiBaseUrl] = React.useState("https://api.deepseek.com/v1");
  const [apiKey, setApiKey] = React.useState("");
  const [apiModel, setApiModel] = React.useState("deepseek-v4-flash");
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const [previewContent, setPreviewContent] = React.useState<{ 
    content: string; 
    title: string; 
    nodeId?: string;
    items?: string[];
    currentIndex?: number;
  } | null>(null);
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });
  const [isLinkingOnCanvas, setIsLinkingOnCanvas] = React.useState(false);
  const [draftCursor, setDraftCursor] = React.useState<{ x: number; y: number } | null>(null);
  const menuCloseTimerRef = React.useRef<number | null>(null);

  const {
    canvasRef,
    pan,
    zoom,
    toWorld,
    fitView,
    scrollToNode,
    jumpToWorldPos,
    autoLayout,
    onNodeDragStart,
    onCanvasPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
  } = useCanvasInteraction({ nodes, snapToGridEnabled, updateNodePosition });

  const addNodeAtPosition = (type: NodeClass, x: number, y: number, initialProps?: Record<string, any>) => {
    const world = toWorld(x, y);
    // Center the node (approx 280x300) around the click point
    const snapped = snapPointToGrid({
      x: world.x - 140,
      y: world.y - 120,
    });
    addNode(type, snapped.x, snapped.y, initialProps);
  };

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

  const resetCanvasLinkDraft = React.useCallback(() => {
    clearLinkDraft();
    setDraftCursor(null);
    setIsLinkingOnCanvas(false);
  }, [clearLinkDraft]);

  const beginCanvasLink = React.useCallback(
    (nodeId: string, outputIndex: number, clientX: number, clientY: number) => {
      setSelectedNodeId(nodeId);
      setLinkFromNodeId(nodeId);
      setLinkFromOutputIndex(outputIndex);
      setLinkToNodeId("");
      setLinkToInputIndex(0);
      setDraftCursor(toWorld(clientX, clientY));
      setIsLinkingOnCanvas(true);
    },
    [setSelectedNodeId, setLinkFromNodeId, setLinkFromOutputIndex, setLinkToNodeId, setLinkToInputIndex, toWorld]
  );

  const hoverCanvasLinkTarget = React.useCallback(
    (nodeId: string, inputIndex: number) => {
      if (!isLinkingOnCanvas) return;
      const issue = getLinkDraftIssue({
        fromNodeId: linkFromNodeId,
        toNodeId: nodeId,
        fromOutputIndex: linkFromOutputIndex,
        toInputIndex: inputIndex,
        nodes,
        links,
      });
      if (issue) return;
      setLinkToNodeId(nodeId);
      setLinkToInputIndex(inputIndex);
    },
    [isLinkingOnCanvas, linkFromNodeId, linkFromOutputIndex, links, nodes, setLinkToNodeId, setLinkToInputIndex]
  );

  const leaveCanvasLinkTarget = React.useCallback(
    (nodeId: string, inputIndex: number) => {
      if (!isLinkingOnCanvas) return;
      if (linkToNodeId === nodeId && linkToInputIndex === inputIndex) {
        setLinkToNodeId("");
        setLinkToInputIndex(0);
      }
    },
    [isLinkingOnCanvas, linkToInputIndex, linkToNodeId, setLinkToNodeId, setLinkToInputIndex]
  );

  const finishCanvasLink = React.useCallback(
    (toNodeId?: string, toInputIndex?: number) => {
      if (!isLinkingOnCanvas || !linkFromNodeId) {
        resetCanvasLinkDraft();
        return;
      }

      const finalToNodeId = toNodeId ?? linkToNodeId;
      const finalToInputIndex = toInputIndex ?? linkToInputIndex;
      if (!finalToNodeId) {
        resetCanvasLinkDraft();
        return;
      }

      const created = addLinkFromDraft({
        fromNodeId: linkFromNodeId,
        toNodeId: finalToNodeId,
        fromOutputIndex: linkFromOutputIndex,
        toInputIndex: finalToInputIndex,
      });

      if (created) showNotice("已通过拖拽建立连线");
      resetCanvasLinkDraft();
    },
    [
      addLinkFromDraft,
      isLinkingOnCanvas,
      linkFromNodeId,
      linkFromOutputIndex,
      linkToInputIndex,
      linkToNodeId,
      resetCanvasLinkDraft,
      showNotice,
    ]
  );

  const getCanvasLinkTargetIssue = React.useCallback(
    (nodeId: string, inputIndex: number) => {
      if (!isLinkingOnCanvas || !linkFromNodeId) return null;
      return getLinkDraftIssue({
        fromNodeId: linkFromNodeId,
        toNodeId: nodeId,
        fromOutputIndex: linkFromOutputIndex,
        toInputIndex: inputIndex,
        nodes,
        links,
      });
    },
    [isLinkingOnCanvas, linkFromNodeId, linkFromOutputIndex, nodes, links]
  );

  const openQuickMenu = React.useCallback(() => {
    clearMenuCloseTimer();
    setIsMenuFromToolbar(true);
    setMenuPos({ x: 24, y: 74 });
  }, [clearMenuCloseTimer, setIsMenuFromToolbar]);

  const scheduleMenuClose = React.useCallback(() => {
    clearMenuCloseTimer();
    menuCloseTimerRef.current = window.setTimeout(() => {
      setMenuPos(null);
      setIsMenuFromToolbar(false);
      menuCloseTimerRef.current = null;
    }, 180);
  }, [clearMenuCloseTimer, setIsMenuFromToolbar]);

  const miniMapConfig = React.useMemo(() => {
    const innerW = 196;
    const innerH = 126;
    const padding = 10;
    if (nodes.length === 0) return null;
    const minX = Math.min(...nodes.map((n) => n.x)) - 200;
    const minY = Math.min(...nodes.map((n) => n.y)) - 200;
    const maxX = Math.max(...nodes.map((n) => n.x + getNodeWidth(n))) + 200;
    const maxY = Math.max(...nodes.map((n) => n.y + getNodeHeight(n))) + 200;
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const scale = Math.min((innerW - padding * 2) / worldW, (innerH - padding * 2) / worldH);
    const contentW = worldW * scale;
    const contentH = worldH * scale;
    const offsetX = (innerW - contentW) / 2;
    const offsetY = (innerH - contentH) / 2;

    const nodeRects = nodes.map((n) => {
      const w = getNodeWidth(n);
      const h = getNodeHeight(n);
      return {
        id: n.id,
        left: offsetX + (n.x - minX) * scale,
        top: offsetY + (n.y - minY) * scale,
        width: Math.max(10, w * scale),
        height: Math.max(8, h * scale),
      };
    });

    // Viewport box
    let viewportRect = null;
    if (canvasSize.width && canvasSize.height) {
      const vLeft = -pan.x / zoom;
      const vTop = -pan.y / zoom;
      const vWidth = canvasSize.width / zoom;
      const vHeight = canvasSize.height / zoom;

      viewportRect = {
        left: offsetX + (vLeft - minX) * scale,
        top: offsetY + (vTop - minY) * scale,
        width: vWidth * scale,
        height: vHeight * scale,
      };
    }

    return { nodeRects, viewportRect, minX, minY, scale, offsetX, offsetY };
  }, [canvasSize.height, canvasSize.width, nodes, pan.x, pan.y, zoom]);

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
    fitView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isLinkingOnCanvas) {
        resetCanvasLinkDraft();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentView, isLinkingOnCanvas, resetCanvasLinkDraft, setActiveQuickTool, setCurrentView]);

  React.useEffect(() => {
    return () => {
      if (menuCloseTimerRef.current !== null) {
        window.clearTimeout(menuCloseTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("aicanvas_api_settings");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { baseUrl?: string; apiKey?: string; model?: string };
      if (parsed.baseUrl) setApiBaseUrl(parsed.baseUrl);
      if (parsed.apiKey) setApiKey(parsed.apiKey);
      if (parsed.model) setApiModel(parsed.model);
    } catch {
      // ignore broken local storage payload
    }
  }, []);

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
      <div className="relative w-full h-screen bg-[#0f1218] text-[#e2e8f0] overflow-hidden select-none font-sans">
      <motion.header 
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="h-16 border-b border-[#232939] bg-[#171b26]/95 backdrop-blur px-4 flex items-center justify-between z-[80]"
      >
        <motion.div 
          initial={{ x: -30, opacity: 0, filter: "blur(10px)" }}
          animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          className="group relative flex items-center gap-3.5 px-5 py-2.5 rounded-2xl bg-[#0d1117]/40 backdrop-blur-2xl border border-white/5 hover:border-white/10 transition-all duration-700 overflow-hidden cursor-default"
        >
          {/* Dynamic Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          
          {/* Animated Glass Icon */}
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-700" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center shadow-2xl group-hover:border-indigo-500/50 transition-all duration-500 group-hover:scale-110">
              <motion.div
                animate={{ 
                  rotate: [0, 90, 180, 270, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-[conic-gradient(from_0deg,#6366f1,#10b981,#6366f1)] opacity-20 blur-sm"
              />
              <Plus className="w-5 h-5 text-white stroke-[2.5] relative z-10 drop-shadow-lg" />
            </div>
          </div>

          <div className="relative flex flex-col -space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                AI
              </span>
              <span className="text-xl font-black tracking-tighter bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                CANVAS
              </span>
            </div>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-y-1 group-hover:translate-y-0">
              <div className="h-px w-3 bg-indigo-500/50" />
              <span className="text-[8px] font-bold text-indigo-400 tracking-[0.3em] uppercase">
                Studio Pro
              </span>
            </div>
          </div>

          {/* Interactive Light Beam */}
          <motion.div 
            animate={{ x: ["-100%", "250%"] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.5 }}
            className="absolute top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent -skew-x-[30deg]"
          />
        </motion.div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
            <Tooltip content={showLogicPanel ? "关闭运行日志" : "查看运行日志"} position="bottom">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLogicPanel((v) => !v);
                }}
                className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer ${
                  showLogicPanel 
                    ? "bg-indigo-500/20 text-indigo-300 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <Terminal className={`w-4 h-4 ${showLogicPanel ? "animate-pulse" : ""}`} />
              </button>
            </Tooltip>

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            <Tooltip content="清除画布" position="bottom">
              <button
                onClick={clearCanvas}
                className="relative z-10 w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02, x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={runNow} 
            className="group relative px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold flex items-center gap-2.5 shadow-[0_10px_25px_-5px_rgba(99,102,241,0.4)] cursor-pointer overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <Play className="w-4 h-4 relative z-10 fill-current" />
            <span className="relative z-10 tracking-wide">运行</span>
          </motion.button>
        </div>
      </motion.header>

      <main
        ref={canvasRef}
        className="relative h-[calc(100vh-4rem)] cursor-grab active:cursor-grabbing select-none"
        onPointerDown={(e) => {
          if (isLinkingOnCanvas) {
            e.preventDefault();
            resetCanvasLinkDraft();
            return;
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
          if (isLinkingOnCanvas) finishCanvasLink();
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
        />

        {isLinkingOnCanvas && (
          <div className="absolute left-1/2 top-5 z-40 -translate-x-1/2 rounded-full border border-cyan-400/30 bg-[#0f1728]/92 px-4 py-2 text-xs text-cyan-100 shadow-[0_10px_30px_rgba(6,18,42,0.45)] backdrop-blur-md">
            拖到兼容输入端口完成连接，按 `Esc` 或点击空白处取消
          </div>
        )}

        {/* Empty State Welcome */}
        {nodes.length === 0 && !isWelcomeDismissed && currentView === "canvas" && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center backdrop-blur-xl shadow-2xl">
                <LayoutGrid className="w-10 h-10 text-indigo-400 opacity-80" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white/90 tracking-tight">准备好开始创作了吗？</h2>
                <p className="text-gray-400 text-sm">点击下方按钮或使用左侧工具栏开启您的第一个画布</p>
              </div>
              <button
                data-no-canvas-drag="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsWelcomeDismissed(true);
                }}
                className="pointer-events-auto px-8 py-3.5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all shadow-xl shadow-indigo-500/25 active:scale-95 flex items-center gap-2.5 group"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                新建画布
              </button>
            </div>
          </div>
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
                }}
                onAddNode={(type, x, y, initialProps) => {
                  addNodeAtPosition(type, x, y, initialProps);
                  setCurrentView("canvas");
                  setActiveQuickTool(null);
                }}
                onHoverStart={clearMenuCloseTimer}
                onHoverEnd={scheduleMenuClose}
              />
            </React.Suspense>
          )}
        </AnimatePresence>

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
            setActiveQuickTool("api");
            setCurrentView("api");
            clearMenuCloseTimer();
            setMenuPos(null);
          }}
          onOpenWorkflow={() => {
            setActiveQuickTool("workflow");
            setCurrentView("workflow");
            clearMenuCloseTimer();
            setMenuPos(null);
          }}
        />

        {currentView === "api" && (
          <React.Suspense fallback={panelFallback}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 z-[100]"
            >
              <ApiSettingsPage
                apiBaseUrl={apiBaseUrl}
                apiKey={apiKey}
                apiModel={apiModel}
                setApiBaseUrl={setApiBaseUrl}
                setApiKey={setApiKey}
                setApiModel={setApiModel}
                onBack={() => {
                  setCurrentView("canvas");
                  setActiveQuickTool(null);
                }}
                onSave={() => {
                  localStorage.setItem(
                    "aicanvas_api_settings",
                    JSON.stringify({
                      baseUrl: apiBaseUrl.trim(),
                      apiKey: apiKey.trim(),
                      model: apiModel.trim(),
                    })
                  );
                  showNotice("API 设置已保存");
                }}
              />
            </motion.div>
          </React.Suspense>
        )}

        {currentView === "workflow" && (
          <React.Suspense fallback={panelFallback}>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 z-[100]"
            >
              <WorkflowSettingsPage
                workflowName={workflowName}
                autoSaveWorkflow={autoSaveWorkflow}
                setWorkflowName={setWorkflowName}
                setAutoSaveWorkflow={setAutoSaveWorkflow}
                onBack={() => {
                  setCurrentView("canvas");
                  setActiveQuickTool(null);
                }}
                onSave={() => {
                  showNotice("工作流设置已保存");
                  setCurrentView("canvas");
                  setActiveQuickTool(null);
                }}
              />
            </motion.div>
          </React.Suspense>
        )}

        <div
          className="absolute inset-0 z-20 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          onPointerDown={onCanvasPointerDown}
        >
          <AnimatePresence>
            {nodes.map((node) => (
              <div key={node.id} className="absolute left-0 top-0" style={{ transform: `translate3d(${node.x}px, ${node.y}px, 0)` }}>
                <NodeCard
                  node={node}
                  selected={selectedNodeId === node.id}
                  onSelect={() => setSelectedNodeId(node.id)}
                  onDelete={() => removeNode(node.id)}
                  onDuplicate={() => duplicateNode(node.id)}
                  onDragStart={(e, currentNode) => {
                    if (isLinkingOnCanvas) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    onNodeDragStart(e, currentNode);
                  }}
                  onUpdateProperty={updateNodeProperty}
                  onUpdateData={updateNodeData}
                  apiConfig={{ baseUrl: apiBaseUrl, apiKey }}
                  onPreview={(content, title, nodeId, items, currentIndex) => 
                    setPreviewContent({ title: title || "预览内容", content, nodeId, items, currentIndex })
                  }
                />
              </div>
            ))}
          </AnimatePresence>
          {nodes.map((node) =>
            node.outputs.map((output, idx) => {
              const anchor = getOutputAnchor(node, idx);
              return (
                <button
                  key={`hit_out_${node.id}_${output.name}_${idx}`}
                  type="button"
                  className={`absolute z-30 block h-7 w-7 rounded-full transition-all ${
                    isLinkingOnCanvas && linkFromNodeId === node.id && linkFromOutputIndex === idx
                      ? "bg-cyan-300/20 ring-2 ring-cyan-300/70"
                      : "bg-transparent"
                  }`}
                  style={{ left: anchor.x - 14, top: anchor.y - 14 }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    beginCanvasLink(node.id, idx, e.clientX, e.clientY);
                  }}
                />
              );
            })
          )}
          {nodes.map((node) =>
            node.inputs.map((input, idx) => {
              const anchor = getInputAnchor(node, idx);
              const targetIssue = getCanvasLinkTargetIssue(node.id, idx);
              const isHotTarget = linkToNodeId === node.id && linkToInputIndex === idx;
              return (
                <button
                  key={`hit_in_${node.id}_${input.name}_${idx}`}
                  type="button"
                  title={targetIssue ?? `连接到 ${input.name} (${input.type})`}
                  className={`absolute z-30 block h-7 w-7 rounded-full transition-all ${
                    !isLinkingOnCanvas
                      ? "bg-transparent"
                      : targetIssue
                        ? "bg-amber-300/10 ring-1 ring-amber-300/40 cursor-not-allowed"
                        : isHotTarget
                          ? "bg-emerald-300/20 ring-2 ring-emerald-300/70 cursor-copy"
                          : "bg-emerald-300/10 ring-1 ring-emerald-300/35 cursor-copy"
                  }`}
                  style={{ left: anchor.x - 14, top: anchor.y - 14 }}
                  onPointerEnter={(e) => {
                    e.stopPropagation();
                    hoverCanvasLinkTarget(node.id, idx);
                  }}
                  onPointerLeave={(e) => {
                    e.stopPropagation();
                    leaveCanvasLinkTarget(node.id, idx);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    finishCanvasLink(node.id, idx);
                  }}
                />
              );
            })
          )}
        </div>

        {showLogicPanel && (
          <React.Suspense fallback={panelFallback}>
            <LogicPanel
              logs={logs}
              onClose={() => setShowLogicPanel(false)}
            />
          </React.Suspense>
        )}

        {showMiniMap && miniMapConfig && (
          <div
            className="absolute left-3 bottom-13 z-30 w-[220px] h-[150px] rounded-[18px] border border-[#2a3143] bg-[#171e2d]/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.38)]"
            onPointerDown={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.querySelector(".minimap-content")?.getBoundingClientRect();
              if (!rect) return;
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;

              // Map back to world
              const worldX = (x - miniMapConfig.offsetX) / miniMapConfig.scale + miniMapConfig.minX;
              const worldY = (y - miniMapConfig.offsetY) / miniMapConfig.scale + miniMapConfig.minY;
              jumpToWorldPos(worldX, worldY);
            }}
          >
            <div className="minimap-content h-full w-full rounded-[12px] bg-[#0f1730] border border-[#2b3a5a] relative overflow-hidden cursor-crosshair">
              {miniMapConfig.nodeRects.map((r) => (
                <div
                  key={`mini_${r.id}`}
                  className="absolute rounded-[2px] bg-[#4e53bd]/72 hover:bg-[#6c71e0] transition-colors cursor-pointer"
                  style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(r.id);
                    scrollToNode(r.id);
                  }}
                />
              ))}
              {(() => {
                const activeId = selectedNodeId ?? nodes[0]?.id;
                const activeRect = activeId ? miniMapConfig.nodeRects.find((r) => r.id === activeId) : null;
                if (!activeRect) return null;
                return (
                  <div
                    className="absolute rounded-[4px] border border-cyan-300/90 bg-[#7d85f3] shadow-[0_0_12px_rgba(125,133,243,0.65)] pointer-events-none"
                    style={{
                      left: activeRect.left,
                      top: activeRect.top,
                      width: activeRect.width,
                      height: activeRect.height,
                    }}
                  />
                );
              })()}

              {miniMapConfig.viewportRect && (
                <div
                  className="absolute border border-indigo-400/40 bg-indigo-400/5 pointer-events-none rounded-sm"
                  style={{
                    left: miniMapConfig.viewportRect.left,
                    top: miniMapConfig.viewportRect.top,
                    width: miniMapConfig.viewportRect.width,
                    height: miniMapConfig.viewportRect.height,
                  }}
                />
              )}

              <span className="absolute right-3 bottom-2 text-[10px] tracking-wider text-gray-500/90 font-semibold">地图</span>
            </div>
          </div>
        )}

        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="absolute left-4 bottom-1 z-30 flex gap-2"
        >
          <Tooltip content={showGrid ? "隐藏网格" : "显示网格"}>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowGrid((v) => !v);
                showNotice(showGrid ? "已隐藏网格" : "已显示网格");
              }}
              className={`w-10 h-10 rounded-[10px] border grid place-items-center transition-colors cursor-pointer ${
                showGrid ? "border-indigo-500 bg-[#212b57] text-indigo-100 shadow-[0_0_10px_rgba(91,107,255,0.35)]" : "border-indigo-500/50 bg-[#1a2030] text-gray-300"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content={snapToGridEnabled ? "关闭网格吸附" : "开启网格吸附"}>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setSnapToGridEnabled((v) => !v);
                showNotice(snapToGridEnabled ? "已关闭网格吸附" : "已开启网格吸附");
              }}
              className={`w-10 h-10 rounded-[10px] border grid place-items-center transition-colors cursor-pointer ${
                snapToGridEnabled
                  ? "border-emerald-500 bg-[#17382f] text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.32)]"
                  : "border-indigo-500/50 bg-[#1a2030] text-gray-300"
              }`}
              aria-label={snapToGridEnabled ? "关闭网格吸附" : "开启网格吸附"}
            >
              <Magnet className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content="自适应居中">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                fitView();
                showNotice("已自适应居中");
              }}
              className="w-10 h-10 rounded-[10px] border border-indigo-500/50 bg-[#1a2030] text-gray-300 grid place-items-center transition-colors hover:border-cyan-400/70 hover:text-cyan-100 cursor-pointer"
              aria-label="自适应居中"
            >
              <LocateFixed className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content="自动布局">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                autoLayout();
                showNotice("已自动布局");
              }}
              className="w-10 h-10 rounded-[10px] border border-indigo-500/50 bg-[#1a2030] text-gray-300 grid place-items-center transition-colors hover:border-amber-400/70 hover:text-amber-100 cursor-pointer"
              aria-label="自动布局"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content={showMiniMap ? "隐藏地图" : "显示地图"}>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowMiniMap((v) => !v);
                showNotice(showMiniMap ? "已隐藏地图" : "已显示地图");
              }}
              className={`w-10 h-10 rounded-[10px] border grid place-items-center transition-colors cursor-pointer ${
                showMiniMap ? "border-indigo-500 bg-[#212b57] text-indigo-100 shadow-[0_0_10px_rgba(91,107,255,0.35)]" : "border-indigo-500/50 bg-[#1a2030] text-gray-300"
              }`}
            >
              <Eye className="w-4 h-4" />
            </button>
          </Tooltip>
        </motion.div>

        <div className="absolute right-6 bottom-4 z-30 px-3 py-1.5 rounded-full border border-[#2b3142] bg-[#1c2230]/80 backdrop-blur-md text-[10px] text-gray-400 inline-flex items-center gap-3 shadow-lg select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
            <span className="font-medium tracking-tight">缩放</span>
            <span className="text-indigo-300 font-bold">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="w-px h-3 bg-[#2b3142]" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-medium">节点</span>
              <span className="text-emerald-400 font-bold">{nodes.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-medium">连线</span>
              <span className="text-cyan-400 font-bold">{links.length}</span>
            </div>
          </div>
        </div>

        {runNotice && <div className="absolute right-6 top-20 z-50 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs">{runNotice}</div>}
      </main>

      {/* Global Preview Modal */}
      <AnimatePresence>
        {previewContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#000000]/60 backdrop-blur-md"
            onClick={() => setPreviewContent(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-3xl max-h-[80vh] bg-[#121723] border border-[#2b3142] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-14 px-6 border-b border-[#252c3a] flex items-center justify-between shrink-0 bg-[#161b29]">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <span className="font-bold text-gray-100">{previewContent.title} - 完整内容</span>
                </div>
                <button
                  onClick={() => setPreviewContent(null)}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
                {previewContent.content.startsWith("http") ? (
                  <div className="flex items-center justify-center min-h-[300px] relative group/viewer">
                    {/* Navigation Buttons */}
                    {previewContent.items && previewContent.items.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newIdx = (previewContent.currentIndex! - 1 + previewContent.items!.length) % previewContent.items!.length;
                            setPreviewContent({
                              ...previewContent,
                              content: previewContent.items![newIdx],
                              currentIndex: newIdx,
                              title: previewContent.title.includes("#") 
                                ? previewContent.title.replace(/#\d+/, `#${newIdx + 1}`)
                                : previewContent.title
                            });
                          }}
                          className="absolute left-0 z-20 p-3 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 backdrop-blur-md transition-all opacity-0 group-hover/viewer:opacity-100 -translate-x-4 group-hover/viewer:translate-x-0"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newIdx = (previewContent.currentIndex! + 1) % previewContent.items!.length;
                            setPreviewContent({
                              ...previewContent,
                              content: previewContent.items![newIdx],
                              currentIndex: newIdx,
                              title: previewContent.title.includes("#") 
                                ? previewContent.title.replace(/#\d+/, `#${newIdx + 1}`)
                                : previewContent.title
                            });
                          }}
                          className="absolute right-0 z-20 p-3 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 backdrop-blur-md transition-all opacity-0 group-hover/viewer:opacity-100 translate-x-4 group-hover/viewer:translate-x-0"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </>
                    )}

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={previewContent.content}
                        initial={{ opacity: 0, scale: 0.95, x: 20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: -20 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="w-full flex justify-center"
                      >
                        {previewContent.content.match(/\.(mp4|webm|ogg)$/i) || previewContent.content.includes("mixkit") ? (
                          <video 
                            src={previewContent.content} 
                            controls 
                            autoPlay
                            className="max-w-full max-h-[60vh] rounded-xl shadow-2xl border border-white/10" 
                          />
                        ) : (
                          <img 
                            src={previewContent.content} 
                            alt="Preview" 
                            className="max-w-full max-h-[60vh] rounded-xl shadow-2xl border border-white/10 object-contain" 
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                ) : previewContent.title === "提示词编辑" ? (
                  <textarea
                    value={previewContent.content}
                    onChange={(e) => setPreviewContent({ ...previewContent, content: e.target.value })}
                    placeholder="请输入提示词内容..."
                    className="w-full h-[400px] bg-[#0d1117] border border-indigo-500/30 rounded-xl p-6 text-[15px] text-gray-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none leading-relaxed placeholder:text-gray-700 custom-scrollbar"
                    autoFocus
                  />
                ) : (
                  <div className="text-[15px] text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                    {/* Basic Markdown rendering for bold */}
                    {previewContent.content.split(/(\*\*.*?\*\*)/g).map((part, i) => 
                      part.startsWith("**") && part.endsWith("**") 
                        ? <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>
                        : part
                    )}
                  </div>
                )}
              </div>
              <div className="h-14 px-6 border-t border-[#252c3a] flex items-center justify-end gap-3 shrink-0 bg-[#161b29]/50">
                {previewContent.title === "提示词编辑" && previewContent.nodeId && (
                  <button
                    onClick={() => {
                      updateNodeProperty(previewContent.nodeId!, "text", previewContent.content);
                      showNotice("提示词已保存");
                      setPreviewContent(null);
                    }}
                    className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    保存修改
                  </button>
                )}
                
                {previewContent.content.startsWith("http") && (
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(previewContent.content);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `ai-studio-${Date.now()}.png`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        showNotice("下载已开始");
                      } catch (err) {
                        window.open(previewContent.content, '_blank');
                        showNotice("正在新窗口打开下载");
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-bold transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    下载文件
                  </button>
                )}

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(previewContent.content);
                    showNotice("内容已复制到剪贴板");
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                    previewContent.title === "提示词编辑" 
                      ? "bg-white/5 hover:bg-white/10 text-gray-300" 
                      : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20"
                  }`}
                >
                  {previewContent.content.startsWith("http") ? "复制链接" : "复制全文"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ConfigProvider>
  );
}
