import React from "react";
import ProjectGalleryPage from "../components/home/ProjectGalleryPage";
import { listHomeProjects } from "../features/workspace/homeWorkspace";

interface AllProjectsPageProps {
  onLogout: () => void;
  onOpenCanvas: (projectId?: string) => void;
  onBackHome: () => void;
}

export default function AllProjectsPage({ onLogout, onOpenCanvas, onBackHome }: AllProjectsPageProps) {
  const [projects, setProjects] = React.useState(() => listHomeProjects());

  const refreshProjects = React.useCallback(() => {
    setProjects(listHomeProjects());
  }, []);

  React.useEffect(() => {
    refreshProjects();
    window.addEventListener("focus", refreshProjects);
    window.addEventListener("storage", refreshProjects);
    return () => {
      window.removeEventListener("focus", refreshProjects);
      window.removeEventListener("storage", refreshProjects);
    };
  }, [refreshProjects]);

  return (
    <ProjectGalleryPage
      title="全部项目"
      subtitle="查看所有画布项目。"
      projects={projects}
      showCreateTile={false}
      topActionLabel="最近项目"
      onTopAction={onBackHome}
      onLogout={onLogout}
      onOpenCanvas={onOpenCanvas}
      onProjectsChanged={refreshProjects}
    />
  );
}
