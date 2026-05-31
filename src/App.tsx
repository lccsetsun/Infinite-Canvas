import React from "react";
import { ArrowRight, Eye, Grid3X3, LayoutGrid, LocateFixed, Play, Trash2, X, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import CanvasGrid from "./components/CanvasGrid";
import FloatingToolbar from "./components/FloatingToolbar";
import LogicPanel from "./components/LogicPanel";
import SearchMenu from "./components/SearchMenu";
import LinksLayer from "./components/canvas/LinksLayer";
import NodeCard from "./components/canvas/NodeCard";
import { NODE_HEIGHT, NODE_WIDTH } from "./components/canvas/geometry";
import ApiSettingsPage from "./components/pages/ApiSettingsPage";
import NodeTemplatesPage from "./components/pages/NodeTemplatesPage";
import WorkflowSettingsPage from "./components/pages/WorkflowSettingsPage";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useNodeTemplateCanvas } from "./hooks/useNodeTemplateCanvas";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { useAppUiState } from "./hooks/useAppUiState";
import { NodeClass } from "./types";

export default function App() {
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
  const [previewContent, setPreviewContent] = React.useState<{ title: string; content: string } | null>(null);
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
  } = useCanvasInteraction({ nodes, updateNodePosition });

  const {
    templateNodes,
    templatePan,
    templateZoom,
    onTemplateNodeDragStart,
    onTemplateCanvasPointerDown,
    onTemplatePointerMove,
    onTemplatePointerUp,
    onTemplateWheel,
    updateTemplateNodeProperty,
    updateTemplateNodeData,
  } = useNodeTemplateCanvas();

  const addNodeAtPosition = (type: NodeClass, x: number, y: number, initialProps?: Record<string, any>) => {
    const world = toWorld(x, y);
    addNode(type, Math.max(60, world.x - 120), Math.max(80, world.y - 40), initialProps);
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
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH)) + 200;
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT)) + 200;
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const scale = Math.min((innerW - padding * 2) / worldW, (innerH - padding * 2) / worldH);
    const contentW = worldW * scale;
    const contentH = worldH * scale;
    const offsetX = (innerW - contentW) / 2;
    const offsetY = (innerH - contentH) / 2;

    const nodeRects = nodes.map((n) => ({
      id: n.id,
      left: offsetX + (n.x - minX) * scale,
      top: offsetY + (n.y - minY) * scale,
      width: Math.max(10, NODE_WIDTH * scale),
      height: Math.max(8, NODE_HEIGHT * scale),
    }));

    // Viewport box
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    let viewportRect = null;
    if (canvasRect) {
      const vLeft = -pan.x / zoom;
      const vTop = -pan.y / zoom;
      const vWidth = canvasRect.width / zoom;
      const vHeight = canvasRect.height / zoom;

      viewportRect = {
        left: offsetX + (vLeft - minX) * scale,
        top: offsetY + (vTop - minY) * scale,
        width: vWidth * scale,
        height: vHeight * scale,
      };
    }

    return { nodeRects, viewportRect, minX, minY, scale, offsetX, offsetY };
  }, [nodes, pan.x, pan.y, zoom]);

  React.useEffect(() => {
    fitView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTemplateCenter(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    <div className="relative w-full h-screen bg-[#0f1218] text-[#e2e8f0] overflow-hidden select-none font-sans">
      <header className="h-16 border-b border-[#232939] bg-[#171b26]/95 backdrop-blur px-4 flex items-center justify-between">
        <div className="px-4 py-2 rounded-xl border border-indigo-500/60 bg-[#101625] text-sm font-bold tracking-wide">
          AI <span className="text-emerald-400">CANVAS</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearCanvas} className="px-4 py-2 rounded-lg border border-[#2b3142] bg-[#1c2230] text-sm inline-flex items-center gap-1.5">
            <Trash2 className="w-4 h-4 text-rose-400" /> 清除
          </button>
          <button onClick={fitView} className="px-4 py-2 rounded-lg border border-[#2b3142] bg-[#1c2230] text-sm inline-flex items-center gap-1.5">
            <LocateFixed className="w-4 h-4 text-cyan-300" /> 自适应居中
          </button>
          <button onClick={autoLayout} className="px-4 py-2 rounded-lg border border-[#2b3142] bg-[#1c2230] text-sm inline-flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-amber-300" /> 自动布局
          </button>
          <button onClick={runNow} className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-semibold inline-flex items-center gap-1.5">
            <Play className="w-4 h-4" /> 运行
          </button>
        </div>
      </header>

      <main
        ref={canvasRef}
        className="relative h-[calc(100vh-4rem)] cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onContextMenu={(e) => {
          onContextMenu(e);
          setMenuPos({ x: e.clientX, y: e.clientY - 64 });
          setIsMenuFromToolbar(false);
          clearMenuCloseTimer();
        }}
      >
        {showGrid && <CanvasGrid pan={pan} zoom={zoom} />}

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

        {menuPos && (
          <SearchMenu
            x={menuPos.x}
            y={menuPos.y}
            isContextMenu={!isMenuFromToolbar}
            onClose={() => {
              clearMenuCloseTimer();
              setMenuPos(null);
              setIsMenuFromToolbar(false);
            }}
            onAddNode={(type, x, y) => {
              addNodeAtPosition(type, x, y);
              setCurrentView("canvas");
              setActiveQuickTool(null);
            }}
            onHoverStart={clearMenuCloseTimer}
            onHoverEnd={scheduleMenuClose}
          />
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
          onOpenTemplates={() => {
            setActiveQuickTool("templates");
            setCurrentView("node_templates");
            clearMenuCloseTimer();
            setMenuPos(null);
          }}
        />

        {currentView === "api" && (
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
        )}

        {currentView === "workflow" && (
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
        )}

        {currentView === "node_templates" && (
          <NodeTemplatesPage
            templateNodes={templateNodes}
            templatePan={templatePan}
            templateZoom={templateZoom}
            onTemplateCanvasPointerDown={onTemplateCanvasPointerDown}
            onTemplatePointerMove={onTemplatePointerMove}
            onTemplatePointerUp={onTemplatePointerUp}
            onTemplateWheel={onTemplateWheel}
            onTemplateNodeDragStart={onTemplateNodeDragStart}
            onUpdateProperty={updateTemplateNodeProperty}
            onUpdateData={updateTemplateNodeData}
            apiConfig={{ baseUrl: apiBaseUrl, apiKey }}
            onPreview={(content) => setPreviewContent({ title: "模板预览", content })}
          />
        )}

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setShowLogicPanel((v) => !v);
          }}
          className="absolute right-4 top-6 z-30 px-3 py-2 rounded-lg border border-[#2b3142] bg-[#1c2230] text-xs"
          title={showLogicPanel ? "隐藏逻辑面板" : "显示逻辑面板"}
        >
          {showLogicPanel ? "隐藏逻辑面板" : "显示逻辑面板"}
        </button>

        <div
          className="absolute inset-0 z-20 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          onPointerDown={onCanvasPointerDown}
        >
          <LinksLayer nodes={nodes} links={links} />
          {nodes.map((node) => (
            <div key={node.id}>
              <NodeCard
                node={node}
                selected={selectedNodeId === node.id}
                onSelect={() => setSelectedNodeId(node.id)}
                onDelete={() => removeNode(node.id)}
                onDuplicate={() => duplicateNode(node.id)}
                onDragStart={onNodeDragStart}
                onUpdateProperty={updateNodeProperty}
            onUpdateData={updateNodeData}
            apiConfig={{ baseUrl: apiBaseUrl, apiKey }}
            onPreview={(content) => setPreviewContent({ title: "文本节点", content })}
          />
            </div>
          ))}
        </div>

        {showLogicPanel && (
          <LogicPanel
            nodes={nodes}
            links={links}
            selectedNode={selectedNode}
            selectedNodeId={selectedNodeId}
            logs={logs}
            linkFromNodeId={linkFromNodeId}
            linkToNodeId={linkToNodeId}
            linkFromOutputIndex={linkFromOutputIndex}
            linkToInputIndex={linkToInputIndex}
            draftIssue={linkDraftIssue}
            setLinkFromNodeId={setLinkFromNodeId}
            setLinkToNodeId={setLinkToNodeId}
            setLinkFromOutputIndex={setLinkFromOutputIndex}
            setLinkToInputIndex={setLinkToInputIndex}
            onAddLink={addLink}
            onUpdateProperty={updateSelectedProperty}
            onSelectNode={setSelectedNodeId}
            onRemoveNode={removeNode}
            onRemoveLink={removeLink}
          />
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

              <span className="absolute right-3 bottom-2 text-[10px] tracking-wider text-gray-500/90 font-semibold uppercase">Map</span>
            </div>
          </div>
        )}

        <div className="absolute left-4 bottom-1 z-30 flex gap-2">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowGrid((v) => !v);
              showNotice(showGrid ? "已隐藏网格" : "已显示网格");
            }}
            className={`w-10 h-10 rounded-[10px] border grid place-items-center transition-colors ${
              showGrid ? "border-indigo-500 bg-[#212b57] text-indigo-100 shadow-[0_0_10px_rgba(91,107,255,0.35)]" : "border-indigo-500/50 bg-[#1a2030] text-gray-300"
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowMiniMap((v) => !v);
              showNotice(showMiniMap ? "已隐藏地图" : "已显示地图");
            }}
            className={`w-10 h-10 rounded-[10px] border grid place-items-center transition-colors ${
              showMiniMap ? "border-indigo-500 bg-[#212b57] text-indigo-100 shadow-[0_0_10px_rgba(91,107,255,0.35)]" : "border-indigo-500/50 bg-[#1a2030] text-gray-300"
            }`}
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

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
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="text-[15px] text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {/* Basic Markdown rendering for bold */}
                  {previewContent.content.split(/(\*\*.*?\*\*)/g).map((part, i) => 
                    part.startsWith("**") && part.endsWith("**") 
                      ? <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>
                      : part
                  )}
                </div>
              </div>
              <div className="h-14 px-6 border-t border-[#252c3a] flex items-center justify-end shrink-0 bg-[#161b29]/50">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(previewContent.content);
                    showNotice("内容已复制到剪贴板");
                  }}
                  className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  复制全文
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
