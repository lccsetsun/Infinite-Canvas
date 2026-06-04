import React from "react";

export type ViewType = "canvas" | "api" | "workflow";
export type QuickToolType = "api" | "workflow" | null;

const UI_PREFERENCES_STORAGE_KEY = "aicanvas_ui_preferences_v1";

interface UiPreferences {
  showGrid: boolean;
  showMiniMap: boolean;
  snapToGridEnabled: boolean;
}

const DEFAULT_UI_PREFERENCES: UiPreferences = {
  showGrid: false,
  showMiniMap: true,
  snapToGridEnabled: false,
};

function loadUiPreferences(): UiPreferences {
  if (typeof localStorage === "undefined") return DEFAULT_UI_PREFERENCES;
  try {
    const raw = localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_UI_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    return {
      showGrid: typeof parsed.showGrid === "boolean" ? parsed.showGrid : DEFAULT_UI_PREFERENCES.showGrid,
      showMiniMap: typeof parsed.showMiniMap === "boolean" ? parsed.showMiniMap : DEFAULT_UI_PREFERENCES.showMiniMap,
      snapToGridEnabled:
        typeof parsed.snapToGridEnabled === "boolean" ? parsed.snapToGridEnabled : DEFAULT_UI_PREFERENCES.snapToGridEnabled,
    };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

export function useAppUiState() {
  const initialUiPreferences = React.useMemo(() => loadUiPreferences(), []);
  const [showLogicPanel, setShowLogicPanel] = React.useState(false);
  const [isWelcomeDismissed, setIsWelcomeDismissed] = React.useState(false);
  const [isMenuFromToolbar, setIsMenuFromToolbar] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(initialUiPreferences.showGrid);
  const [snapToGridEnabled, setSnapToGridEnabled] = React.useState(initialUiPreferences.snapToGridEnabled);
  const [showMiniMap, setShowMiniMap] = React.useState(initialUiPreferences.showMiniMap);
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

  React.useEffect(() => {
    try {
      localStorage.setItem(
        UI_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          showGrid,
          showMiniMap,
          snapToGridEnabled,
        })
      );
    } catch {
      // Ignore storage failures; UI toggles should still work for the current session.
    }
  }, [showGrid, showMiniMap, snapToGridEnabled]);

  return {
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
  };
}
