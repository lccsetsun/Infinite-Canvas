import React from "react";
import { AnimatePresence } from "motion/react";
import AppHeader from "./components/app/AppHeader";
import CanvasControls from "./components/app/CanvasControls";
import CanvasNodeLayer from "./components/app/CanvasNodeLayer";
import CanvasStatusBar from "./components/app/CanvasStatusBar";
import FloatingToolbar from "./components/FloatingToolbar";
import EmptyCanvasState from "./components/app/EmptyCanvasState";
import LeaferCanvas from "./components/canvas/LeaferCanvas";
import MiniMap from "./components/app/MiniMap";
import PreviewModal, { PreviewContent } from "./components/app/PreviewModal";
import SettingsPanels from "./components/app/SettingsPanels";
import WorkflowManager from "./components/WorkflowManager";
import { snapPointToGrid } from "./components/canvas/geometry";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useCanvasLinking } from "./hooks/useCanvasLinking";
import { useMiniMapConfig } from "./hooks/useMiniMapConfig";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { useAppUiState } from "./hooks/useAppUiState";
import { ConfigProvider, theme } from "antd";
import { NodeClass } from "./types";

const LogicPanel = React.lazy(() => import("./components/LogicPanel"));
const SearchMenu = React.lazy(() => import("./components/SearchMenu"));

export default function App() {
  const panelFallback = (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f1218]/55 backdrop-blur-sm">
      <div className="rounded-full border border-[#2b3142] bg-[#171b26] px-4 py-2 text-sm text-gray-300">鍔犺浇涓?..</div>
    </div>
  );

  const [apiBaseUrl, setApiBaseUrl] = React.useState("https://api.deepseek.com/v1");
  const [apiKey, setApiKey] = React.useState("");
  const [apiModel, setApiModel] = React.useState("deepseek-v4-flash");
  const [workflowManagerOpen, setWorkflowManagerOpen] = React.useState(false);

  const {
    nodes,
    links,
    selectedNodeId,
    setSelectedNodeId,
    clearCanvas,
    runWorkflow,
    runNode,
    addNode,
    removeNode,
    duplicateNode,
    updateNodePosition,
    updateNodeProperty,
    updateNodeData,
    logs,
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
    createWorkflowFromTemplate,
    resetCurrentToDemo,
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
    exportWorkspaceJson,
    importWorkspaceJson,
    setLinkFromNodeId,
    setLinkToNodeId,
    setLinkFromOutputIndex,
    setLinkToInputIndex,
    clearLinkDraft,
    addLinkFromDraft,
  } = useWorkflowState({ apiConfig: { baseUrl: apiBaseUrl, apiKey } });

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
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const [previewContent, setPreviewContent] = React.useState<PreviewContent | null>(null);
  const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });
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
  });

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
    fitView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

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
      if (!isEditingField && (e.key === "Delete" || e.key === "Backspace") && selectedNodeId) {
        e.preventDefault();
        removeNode(selectedNodeId);
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentView, isLinkingOnCanvas, resetCanvasLinkDraft, setActiveQuickTool, setCurrentView, undo, redo, selectedNodeId, removeNode]);

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
        <AppHeader
          showLogicPanel={showLogicPanel}
          canUndo={canUndo}
          canRedo={canRedo}
          workflowName={currentWorkflowSummary?.name}
          workflowCount={workflowList.length}
          onUndo={undo}
          onRedo={redo}
          onOpenWorkflowManager={() => setWorkflowManagerOpen(true)}
          onClearCanvas={clearCanvas}
          onRun={runNow}
          onToggleLogicPanel={() => setShowLogicPanel((v) => !v)}
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
            拖到兼容输入端口完成连接，按 Esc 或点击空白处取消
          </div>
        )}

        {nodes.length === 0 && !isWelcomeDismissed && currentView === "canvas" && (
          <EmptyCanvasState onDismiss={() => setIsWelcomeDismissed(true)} />
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

        <SettingsPanels
          apiBaseUrl={apiBaseUrl}
          apiKey={apiKey}
          apiModel={apiModel}
          autoSaveWorkflow={autoSaveWorkflow}
          currentView={currentView}
          fallback={panelFallback}
          workflowName={workflowName}
          onBack={() => {
            setCurrentView("canvas");
            setActiveQuickTool(null);
          }}
          onSaveApi={() => {
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
          onSaveWorkflow={() => {
            showNotice("工作流设置已保存");
            setCurrentView("canvas");
            setActiveQuickTool(null);
          }}
          setApiBaseUrl={setApiBaseUrl}
          setApiKey={setApiKey}
          setApiModel={setApiModel}
          setAutoSaveWorkflow={setAutoSaveWorkflow}
          setWorkflowName={setWorkflowName}
        />

        <CanvasNodeLayer
          apiConfig={{ baseUrl: apiBaseUrl, apiKey }}
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
          onNodeDragStart={onNodeDragStart}
          onPreview={(content, title, nodeId, items, currentIndex) =>
            setPreviewContent({ title: title || "预览内容", content, nodeId, items, currentIndex })
          }
          onSelectNode={setSelectedNodeId}
          onUpdateNodeData={updateNodeData}
          onUpdateNodeProperty={updateNodeProperty}
          resolvedInputsMap={resolvedInputsMap}
          onRunNode={runNode}
        />
        {showLogicPanel && (
          <React.Suspense fallback={panelFallback}>
            <LogicPanel
              logs={logs}
              onClose={() => setShowLogicPanel(false)}
            />
          </React.Suspense>
        )}

        {showMiniMap && miniMapConfig && (
          <MiniMap
            activeNodeId={selectedNodeId}
            config={miniMapConfig}
            onJumpToWorldPos={jumpToWorldPos}
            onScrollToNode={scrollToNode}
            onSelectNode={setSelectedNodeId}
          />
        )}
        <CanvasControls
          showGrid={showGrid}
          showMiniMap={showMiniMap}
          snapToGridEnabled={snapToGridEnabled}
          onAutoLayout={() => {
            autoLayout();
            showNotice("已自动布局");
          }}
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
        <CanvasStatusBar nodeCount={nodes.length} linkCount={links.length} zoom={zoom} />
        {runNotice && <div className="absolute right-6 top-20 z-50 px-3 py-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs">{runNotice}</div>}
      </main>

      {previewContent && (
        <PreviewModal
          preview={previewContent}
          onClose={() => setPreviewContent(null)}
          onPreviewChange={setPreviewContent}
          onUpdateNodeText={(nodeId, text) => updateNodeProperty(nodeId, "text", text)}
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
        workflowName={currentWorkflowSummary?.name ?? "默认工作流"}
        onClose={() => setWorkflowManagerOpen(false)}
        onSwitch={switchWorkflow}
        onCreate={createWorkflow}
        onCreateFromTemplate={createWorkflowFromTemplate}
        onResetToDemo={resetCurrentToDemo}
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
        onExportJson={exportWorkspaceJson}
        onImportJson={importWorkspaceJson}
        showNotice={showNotice}
      />
    </div>
    </ConfigProvider>
  );
}
