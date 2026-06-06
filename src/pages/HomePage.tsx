import React from "react";
import ProjectGalleryPage from "../components/home/ProjectGalleryPage";
import {
  copyRemoteProject,
  createRemoteProject,
  deleteRemoteProject,
  listRemoteProjects,
  renameRemoteProject,
  updateRemoteProjectCover,
} from "../features/workspace/remoteCanvas";
import type { HomeProjectCard } from "../features/workspace/projectTypes";
import { useRefreshOnPageVisible } from "../hooks/useRefreshOnPageVisible";

interface HomePageProps {
  onLogout: () => void;
  onOpenCanvas: (projectId?: string) => void;
  onOpenAllProjects: () => void;
}

export default function HomePage({ onLogout, onOpenCanvas, onOpenAllProjects }: HomePageProps) {
  const [projects, setProjects] = React.useState<HomeProjectCard[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState("");

  const refreshProjects = React.useCallback(() => {
    setIsLoading(true);
    setErrorMessage("");
    void listRemoteProjects({ pageNum: 1, pageSize: 8 })
      .then((result) => {
        setProjects(result.projects);
      })
      .catch((error) => {
        setProjects([]);
        setErrorMessage(error instanceof Error ? error.message : "加载最近项目失败");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleCreateProject = React.useCallback(async () => {
    const projectId = await createRemoteProject({ name: `项目 ${projects.length + 1}` });
    refreshProjects();
    if (projectId) onOpenCanvas(projectId);
  }, [onOpenCanvas, projects.length, refreshProjects]);

  React.useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useRefreshOnPageVisible(refreshProjects);

  return (
    <ProjectGalleryPage
      title="最近项目"
      subtitle="继续最近编辑过的画布项目。"
      projects={projects}
      showCreateTile={false}
      loading={isLoading}
      errorMessage={errorMessage}
      primaryActionLabel="新建项目"
      onPrimaryAction={() => {
        void handleCreateProject();
      }}
      topActionLabel="全部项目"
      onTopAction={onOpenAllProjects}
      onLogout={onLogout}
      onOpenCanvas={onOpenCanvas}
      onProjectsChanged={refreshProjects}
      onCreateProject={handleCreateProject}
      onRenameProject={async (projectId, name) => {
        await renameRemoteProject(projectId, name);
        return true;
      }}
      onChangeProjectCover={async (projectId, coverUrl) => {
        await updateRemoteProjectCover(projectId, coverUrl);
        return true;
      }}
      onDuplicateProject={async (projectId) => {
        await copyRemoteProject(projectId);
      }}
      onDeleteProject={async (projectId) => {
        await deleteRemoteProject(projectId);
        return true;
      }}
    />
  );
}
