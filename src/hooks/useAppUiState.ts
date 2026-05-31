import React from "react";

export type ViewType = "canvas" | "api" | "workflow" | "node_templates";
export type QuickToolType = "api" | "workflow" | "templates" | null;

export function useAppUiState() {
  const [showLogicPanel, setShowLogicPanel] = React.useState(false);
  const [isWelcomeDismissed, setIsWelcomeDismissed] = React.useState(false);
  const [isMenuFromToolbar, setIsMenuFromToolbar] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(true);
  const [showMiniMap, setShowMiniMap] = React.useState(true);
  const [currentView, setCurrentView] = React.useState<ViewType>("canvas");
  const [activeQuickTool, setActiveQuickTool] = React.useState<QuickToolType>(null);
  const [runNotice, setRunNotice] = React.useState<string | null>(null);

  const noticeTimerRef = React.useRef<number | null>(null);

  const showNotice = React.useCallback((message: string, duration = 1200) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setRunNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      setRunNotice(null);
      noticeTimerRef.current = null;
    }, duration);
  }, []);

  // Clean up timer on unmount
  React.useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  return {
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
  };
}
