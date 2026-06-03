import React from "react";
import { AnimatePresence } from "motion/react";
import AppHeader from "./components/app/AppHeader";
import CanvasControls from "./components/app/CanvasControls";
import CanvasHistoryDock from "./components/app/CanvasHistoryDock";
import CanvasNodeLayer from "./components/app/CanvasNodeLayer";
import CanvasStatusBar from "./components/app/CanvasStatusBar";
import GroupsLayer from "./components/app/GroupsLayer";
import FloatingToolbar from "./components/FloatingToolbar";
import EmptyCanvasState from "./components/app/EmptyCanvasState";
import LeaferCanvas from "./components/canvas/LeaferCanvas";
import MiniMap from "./components/app/MiniMap";
import PreviewModal, { PreviewContent } from "./components/app/PreviewModal";
import SettingsPanels from "./components/app/SettingsPanels";
import WorkflowManager from "./components/WorkflowManager";
import LoginPage from "./pages/LoginPage";
import { snapPointToGrid } from "./components/canvas/geometry";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";
import { useCanvasLinking } from "./hooks/useCanvasLinking";
import { useMiniMapConfig } from "./hooks/useMiniMapConfig";
import { useWorkflowState } from "./hooks/useWorkflowState";
import { useAppUiState } from "./hooks/useAppUiState";
import { shouldFinishCanvasLinkOnCanvasPointerUp } from "./utils/canvasPointerPolicy";
import { ConfigProvider, theme } from "antd";
import { NodeClass } from "./types";
import { ApiSettings, getActiveProfile, loadApiSettings, saveApiSettings } from "./features/api/apiSettings";

const LogicPanel = React.lazy(() => import("./components/LogicPanel"));
const SearchMenu = React.lazy(() => import("./components/SearchMenu"));

export default function App() {
  const panelFallback = (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f1218]/55 backdrop-blur-sm">
      <div className="rounded-full border border-[#2b3142] bg-[#171b26] px-4 py-2 text-sm text-gray-300">加载中...</div>
    </div>
  );

  const [apiSettings, setApiSettings] = React.useState<ApiSettings>(() => loadApiSettings());
  const activeApiProfile = React.useMemo(() => getActiveProfile(apiSettings), [apiSettings]);
  const apiBaseUrl = activeApiProfile.baseUrl;
  const apiKey = activeApiProfile.apiKey;
  const apiModel = activeApiProfile.model;
  const [workflowManagerOpen, setWorkflowManagerOpen] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });

  const handleLogin = () => {
    localStorage.setItem("isLoggedIn", "true");
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    setIsLoggedIn(false);
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
    },
  });

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
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = React.useState<Set<string>>(new Set());
  const menuCloseTimerRef = React.useRef<number | null>(null);

  const memberCountByGroup = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) {
      if (n.groupId) m.set(n.groupId, (m.get(n.groupId) ?? 0) + 1);
    }
    return m;
  }, [nodes]);

  const {
    canvasRef,
    pan,
    zoom,
    toWorld,
    fitView,
    scrollToNode,
    jumpToWorldPos,
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
      <div className="relative w-full h-screen bg-[#0f1218] text-[#e2e8f0] overflow-hidden select-none font-sans">
        <AppHeader
          showLogicPanel={showLogicPanel}
          workflowName={currentWorkflowSummary?.name}
          workflowCount={workflowList.length}
          onOpenWorkflowManager={() => setWorkflowManagerOpen(true)}
          onRun={runNow}
          onToggleLogicPanel={() => setShowLogicPanel((v) => !v)}
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
          if (!target.closest("[data-node-action='true'], .node-card, .storyboard-node-card, button, input, select, textarea")) {
            setSelectedNodeId(null);
            setSelectedNodeIds(new Set());
            setSelectedGroupId(null);
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
            showNotice("工作流设置已保存");
            setCurrentView("canvas");
            setActiveQuickTool(null);
          }}
          setAutoSaveWorkflow={setAutoSaveWorkflow}
          setWorkflowName={setWorkflowName}
          showNotice={showNotice}
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
          onSelectNode={(nodeId, e) => handleSelectNode(nodeId, e)}
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
