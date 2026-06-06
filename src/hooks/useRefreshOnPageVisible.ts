import React from "react";

export function shouldRefreshOnVisibilityState(visibilityState: DocumentVisibilityState) {
  return visibilityState === "visible";
}

export function useRefreshOnPageVisible(onRefresh: () => void, minIntervalMs = 800) {
  const refreshRef = React.useRef(onRefresh);
  const lastRefreshAtRef = React.useRef(0);

  React.useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  React.useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleVisibilityChange = () => {
      if (!shouldRefreshOnVisibilityState(document.visibilityState)) return;

      const now = Date.now();
      if (now - lastRefreshAtRef.current < minIntervalMs) return;
      lastRefreshAtRef.current = now;
      refreshRef.current();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [minIntervalMs]);
}
