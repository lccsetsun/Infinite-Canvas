import React from "react";
import { ArrowRight, Eye, Grid3X3, LayoutGrid, LocateFixed, Play, Trash2 } from "lucide-react";
import CanvasGrid from "./components/CanvasGrid";
import FloatingToolbar from "./components/FloatingToolbar";
import LogicPanel from "./components/LogicPanel";
import SearchMenu from "./components/SearchMenu";
import TemplateCenter from "./components/TemplateCenter";
import LinksLayer from "./components/canvas/LinksLayer";
import NodeCard from "./components/canvas/NodeCard";
import { NODE_HEIGHT, NODE_WIDTH } from "./components/canvas/geometry";
import ApiSettingsPage from "./components/pages/ApiSettingsPage";
import NodeTemplatesPage from "./components/pages/NodeTemplatesPage";
import WorkflowSettingsPage from "./components/pages/WorkflowSettingsPage";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useNodeTemplateCanvas } from "./hooks/useNodeTemplateCanvas";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { NodeClass } from "./types";

export default function App() {
  const {
    nodes,
    links,
    selectedNodeId,
    selectedNode,
    setSelectedNodeId,
    loadPreset,
    clearCanvas,
    runWorkflow,
    addNode,
    removeNode,
    removeLink,
    duplicateNode,
    updateNodePosition,
    updateSelectedProperty,
    activePresetId,
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

  const [showTemplateCenter, setShowTemplateCenter] = React.useState(true);
  const [showLogicPanel, setShowLogicPanel] = React.useState(true);
  const [showGrid, setShowGrid] = React.useState(true);
  const [showMiniMap, setShowMiniMap] = React.useState(true);
  const [currentView, setCurrentView] = React.useState<"canvas" | "api" | "workflow" | "node_templates">("canvas");
  const [activeQuickTool, setActiveQuickTool] = React.useState<"api" | "workflow" | "templates" | null>(null);
  const [workflowName, setWorkflowName] = React.useState("默认工作流");
  const [autoSaveWorkflow, setAutoSaveWorkflow] = React.useState(true);
  const [defaultPreset, setDefaultPreset] = React.useState("txt2img");
  const [apiBaseUrl, setApiBaseUrl] = React.useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = React.useState("");
  const [apiModel, setApiModel] = React.useState("gpt-4.1-mini");
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const menuCloseTimerRef = React.useRef<number | null>(null);
  const [runNotice, setRunNotice] = React.useState<string | null>(null);

  const {
    canvasRef,
    pan,
    zoom,
    toWorld,
    fitView,
    autoLayout,
    onNodeDragStart,
    onCanvasPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
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
  } = useNodeTemplateCanvas();

  const addNodeAtPosition = (type: NodeClass, x: number, y: number) => {
    const world = toWorld(x, y);
    addNode(type, Math.max(60, world.x - 120), Math.max(80, world.y - 40));
  };

  const runNow = () => {
    runWorkflow();
    setRunNotice(`已触发运行（${new Date().toLocaleTimeString()}）`);
    setTimeout(() => setRunNotice(null), 1200);
  };

  const clearMenuCloseTimer = React.useCallback(() => {
    if (menuCloseTimerRef.current !== null) {
      window.clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
  }, []);

  const openQuickMenu = React.useCallback(() => {
    clearMenuCloseTimer();
    setMenuPos({ x: 24, y: 74 });
  }, [clearMenuCloseTimer]);

  const scheduleMenuClose = React.useCallback(() => {
    clearMenuCloseTimer();
    menuCloseTimerRef.current = window.setTimeout(() => {
      setMenuPos(null);
      menuCloseTimerRef.current = null;
    }, 180);
  }, [clearMenuCloseTimer]);

  const miniMapProjection = React.useMemo(() => {
    const innerW = 196;
    const innerH = 126;
    const padding = 10;
    if (nodes.length === 0) return [] as Array<{ id: string; left: number; top: number; width: number; height: number }>;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map((n) => n.y + NODE_HEIGHT));
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const scale = Math.min((innerW - padding * 2) / worldW, (innerH - padding * 2) / worldH);
    const contentW = worldW * scale;
    const contentH = worldH * scale;
    const offsetX = (innerW - contentW) / 2;
    const offsetY = (innerH - contentH) / 2;
    return nodes.map((n) => ({
      id: n.id,
      left: offsetX + (n.x - minX) * scale,
      top: offsetY + (n.y - minY) * scale,
      width: Math.max(10, NODE_WIDTH * scale),
      height: Math.max(8, NODE_HEIGHT * scale),
    }));
  }, [nodes]);

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
    <div className="h-screen bg-[#0f1218] text-gray-100 overflow-hidden">
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
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuPos({ x: e.clientX, y: e.clientY - 64 });
        }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        {showGrid && <CanvasGrid pan={pan} zoom={zoom} />}

        {showTemplateCenter && (
          <TemplateCenter activePresetId={activePresetId} onSelectPreset={loadPreset} onClose={() => setShowTemplateCenter(false)} />
        )}

        {menuPos && (
          <SearchMenu
            x={menuPos.x}
            y={menuPos.y}
            onClose={() => {
              clearMenuCloseTimer();
              setMenuPos(null);
            }}
            onAddNode={addNodeAtPosition}
            onHoverStart={clearMenuCloseTimer}
            onHoverEnd={scheduleMenuClose}
          />
        )}

        <FloatingToolbar
          menuOpen={!!menuPos}
          activeTool={activeQuickTool}
          onOpenQuickMenu={() => {
            setCurrentView("canvas");
            openQuickMenu();
          }}
          onCloseQuickMenu={() => {
            clearMenuCloseTimer();
            setMenuPos(null);
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
              setRunNotice("API 设置已保存");
              setTimeout(() => setRunNotice(null), 1200);
            }}
          />
        )}

        {currentView === "workflow" && (
          <WorkflowSettingsPage
            workflowName={workflowName}
            defaultPreset={defaultPreset}
            autoSaveWorkflow={autoSaveWorkflow}
            setWorkflowName={setWorkflowName}
            setDefaultPreset={setDefaultPreset}
            setAutoSaveWorkflow={setAutoSaveWorkflow}
            onBack={() => {
              setCurrentView("canvas");
              setActiveQuickTool(null);
            }}
            onSave={() => {
              setRunNotice("工作流设置已保存");
              setTimeout(() => setRunNotice(null), 1200);
            }}
            onOpenTemplateCenter={() => {
              setCurrentView("canvas");
              setShowTemplateCenter(true);
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

        {showMiniMap && (
          <div className="absolute left-3 bottom-13 z-30 w-[220px] h-[150px] rounded-[18px] border border-[#2a3143] bg-[#171e2d]/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.38)]">
            <div className="h-full w-full rounded-[12px] bg-[#0f1730] border border-[#2b3a5a] relative overflow-hidden">
              {miniMapProjection.map((r) => (
                <div key={`mini_${r.id}`} className="absolute rounded-[2px] bg-[#4e53bd]/72" style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />
              ))}
              {miniMapProjection.find((r) => r.id === (selectedNodeId ?? nodes[0]?.id)) && (
                <div
                  className="absolute rounded-[4px] border border-cyan-300/90 bg-[#7d85f3] shadow-[0_0_12px_rgba(125,133,243,0.65)]"
                  style={{
                    left: miniMapProjection.find((r) => r.id === (selectedNodeId ?? nodes[0]?.id))!.left,
                    top: miniMapProjection.find((r) => r.id === (selectedNodeId ?? nodes[0]?.id))!.top,
                    width: miniMapProjection.find((r) => r.id === (selectedNodeId ?? nodes[0]?.id))!.width,
                    height: miniMapProjection.find((r) => r.id === (selectedNodeId ?? nodes[0]?.id))!.height,
                  }}
                />
              )}
              <span className="absolute right-3 bottom-2 text-[10px] tracking-wider text-gray-500/90 font-semibold">MAP</span>
            </div>
          </div>
        )}

        <div className="absolute left-4 bottom-1 z-30 flex gap-2">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowGrid((v) => !v);
              setRunNotice(showGrid ? "已隐藏网格" : "已显示网格");
              setTimeout(() => setRunNotice(null), 1200);
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
              setRunNotice(showMiniMap ? "已隐藏地图" : "已显示地图");
              setTimeout(() => setRunNotice(null), 1200);
            }}
            className={`w-10 h-10 rounded-[10px] border grid place-items-center transition-colors ${
              showMiniMap ? "border-indigo-500 bg-[#212b57] text-indigo-100 shadow-[0_0_10px_rgba(91,107,255,0.35)]" : "border-indigo-500/50 bg-[#1a2030] text-gray-300"
            }`}
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute right-6 bottom-4 text-xs text-gray-400 inline-flex items-center gap-2">
          <span>缩放 {Math.round(zoom * 100)}%</span>
          <ArrowRight className="w-3 h-3" />
          <span>节点 {nodes.length} / 连线 {links.length}</span>
        </div>

        {runNotice && <div className="absolute right-6 top-20 z-50 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs">{runNotice}</div>}
      </main>
    </div>
  );
}
