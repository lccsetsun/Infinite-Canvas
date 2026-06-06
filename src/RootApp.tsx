import React from "react";
import App from "./App";
import AllProjectsPage from "./pages/AllProjectsPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import { hasAuthSession, setAccessToken } from "./features/auth/authStorage";

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

  React.useEffect(() => {
    const handleLocationChange = () => {
      setPathname(getPathname());
      setIsLoggedIn(hasAuthSession());
    };

    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  React.useEffect(() => {
    if (!isLoggedIn) {
      if (pathname !== LOGIN_PATH) {
        navigate(LOGIN_PATH, true);
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

  const handleLogin = React.useCallback((accessToken: string) => {
    setAccessToken(accessToken);
    setIsLoggedIn(true);
    navigate(DEFAULT_PATH, true);
  }, []);

  const handleLoggedOut = React.useCallback(() => {
    setIsLoggedIn(false);
    navigate(LOGIN_PATH, true);
  }, []);

  const handleOpenCanvas = React.useCallback((projectId?: string) => {
    if (typeof window === "undefined") return;
    window.open(buildCanvasUrl(projectId), "_blank", "noopener,noreferrer");
  }, []);

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (pathname === DEFAULT_PATH) {
    return (
      <HomePage
        onLogout={handleLoggedOut}
        onOpenCanvas={handleOpenCanvas}
        onOpenAllProjects={() => navigate(PROJECTS_PATH)}
      />
    );
  }

  if (pathname === PROJECTS_PATH) {
    return (
      <AllProjectsPage
        onLogout={handleLoggedOut}
        onOpenCanvas={handleOpenCanvas}
        onBackHome={() => navigate(DEFAULT_PATH)}
      />
    );
  }

  if (pathname !== CANVAS_ALIAS_PATH) {
    return null;
  }

  return <App onLoggedOut={handleLoggedOut} />;
}
