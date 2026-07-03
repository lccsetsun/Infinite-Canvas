import React from "react";
import App from "./App";
import AllProjectsPage from "./pages/AllProjectsPage";
import HomePage from "./pages/HomePage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import { API_NOTICE_EVENT, type ApiNoticeDetail } from "./features/auth/apiNotice";
import { AUTH_SESSION_CHANGED_EVENT, clearAuthSession, hasAuthSession, setAccessToken } from "./features/auth/authStorage";
import { logout } from "./features/auth/authApi";
import { performLocalLogout, performOptimisticLogout } from "./features/auth/logoutFlow";

const LOGIN_PATH = "/login";
const DEFAULT_PATH = "/";
const PROJECTS_PATH = "/projects";
const CANVAS_ALIAS_PATH = "/canvas";

function getPathname() {
  if (typeof window === "undefined") return DEFAULT_PATH;
  return window.location.pathname || DEFAULT_PATH;
}

function buildCanvasUrl(projectId?: string) {
  if (!projectId) return CANVAS_ALIAS_PATH;
  const params = new URLSearchParams({ projectId });
  return `${CANVAS_ALIAS_PATH}?${params.toString()}`;
}

function navigate(to: string, replace = false) {
  if (typeof window === "undefined") return;
  const method = replace ? "replaceState" : "pushState";
  window.history[method](null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function RootApp() {
  const [pathname, setPathname] = React.useState(() => getPathname());
  const [isLoggedIn, setIsLoggedIn] = React.useState(() => hasAuthSession());
  const [apiNotice, setApiNotice] = React.useState<ApiNoticeDetail | null>(null);
  const apiNoticeTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleLocationChange = () => {
      setPathname(getPathname());
      setIsLoggedIn(hasAuthSession());
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleLocationChange);
    };
  }, []);

  React.useEffect(() => {
    if (!isLoggedIn) {
      if (pathname !== DEFAULT_PATH && pathname !== LOGIN_PATH) {
        navigate(DEFAULT_PATH, true);
      }
      return;
    }

    if (pathname === LOGIN_PATH) {
      navigate(DEFAULT_PATH, true);
      return;
    }

    if (pathname !== DEFAULT_PATH && pathname !== PROJECTS_PATH && pathname !== CANVAS_ALIAS_PATH) {
      navigate(DEFAULT_PATH, true);
    }
  }, [isLoggedIn, pathname]);

  React.useEffect(() => {
    const handleApiNotice = (event: Event) => {
      const detail = (event as CustomEvent<ApiNoticeDetail>).detail;
      if (!detail?.message) return;

      if (apiNoticeTimerRef.current !== null) {
        window.clearTimeout(apiNoticeTimerRef.current);
      }
      setApiNotice(detail);
      apiNoticeTimerRef.current = window.setTimeout(() => {
        setApiNotice(null);
        apiNoticeTimerRef.current = null;
      }, detail.kind === "error" ? 2600 : 2000);
    };

    window.addEventListener(API_NOTICE_EVENT, handleApiNotice);
    return () => {
      window.removeEventListener(API_NOTICE_EVENT, handleApiNotice);
      if (apiNoticeTimerRef.current !== null) {
        window.clearTimeout(apiNoticeTimerRef.current);
      }
    };
  }, []);

  const handleLogin = React.useCallback((accessToken: string) => {
    setAccessToken(accessToken);
    setIsLoggedIn(true);
    navigate(DEFAULT_PATH, true);
  }, []);

  const handleLoggedOut = React.useCallback(() => {
    performLocalLogout({
      clearSession: clearAuthSession,
      onLoggedOut: () => {
        setIsLoggedIn(false);
        navigate(LOGIN_PATH, true);
      },
    });
  }, []);

  const handleLogout = React.useCallback(() => {
    performOptimisticLogout({
      requestLogout: logout,
      clearSession: clearAuthSession,
      onLoggedOut: () => {
        setIsLoggedIn(false);
        navigate(LOGIN_PATH, true);
      },
    });
  }, []);

  const handleOpenCanvas = React.useCallback((projectId?: string) => {
    if (typeof window === "undefined") return;
    window.open(buildCanvasUrl(projectId), "_blank", "noopener,noreferrer");
  }, []);

  const noticeNode = apiNotice ? <GlobalApiNotice notice={apiNotice} /> : null;

  if (!isLoggedIn) {
    return (
      <>
        {pathname === LOGIN_PATH ? <LoginPage onLogin={handleLogin} /> : <LandingPage onOpenLogin={() => navigate(LOGIN_PATH)} />}
        {noticeNode}
      </>
    );
  }

  if (pathname === DEFAULT_PATH) {
    return (
      <>
        <HomePage
          onLogout={handleLogout}
          onOpenCanvas={handleOpenCanvas}
          onOpenAllProjects={() => navigate(PROJECTS_PATH)}
        />
        {noticeNode}
      </>
    );
  }

  if (pathname === PROJECTS_PATH) {
    return (
      <>
        <AllProjectsPage
          onLogout={handleLogout}
          onOpenCanvas={handleOpenCanvas}
          onBackHome={() => navigate(DEFAULT_PATH)}
        />
        {noticeNode}
      </>
    );
  }

  if (pathname !== CANVAS_ALIAS_PATH) {
    return null;
  }

  return (
    <>
      <App onLoggedOut={handleLoggedOut} />
      {noticeNode}
    </>
  );
}

function GlobalApiNotice({ notice }: { notice: ApiNoticeDetail }) {
  const tone =
    notice.kind === "warning"
      ? "border-amber-400/35 bg-amber-500/12 text-amber-100"
      : notice.kind === "success"
        ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-100"
        : "border-rose-400/35 bg-rose-500/12 text-rose-100";

  return (
    <div className={`fixed left-1/2 top-5 z-[10000] max-w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_18px_42px_rgba(0,0,0,0.32)] backdrop-blur-xl ${tone}`}>
      {notice.message}
    </div>
  );
}
