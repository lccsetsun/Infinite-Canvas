import React from "react";
import ProjectGalleryPage from "../components/home/ProjectGalleryPage";
import {
  copyRemoteProject,
  deleteRemoteProject,
  listRemoteProjects,
  renameRemoteProject,
  updateRemoteProjectCover,
} from "../features/workspace/remoteCanvas";
import type { HomeProjectCard } from "../features/workspace/projectTypes";

interface AllProjectsPageProps {
  onLogout: () => void;
  onOpenCanvas: (projectId?: string) => void;
  onBackHome: () => void;
}

export default function AllProjectsPage({ onLogout, onOpenCanvas, onBackHome }: AllProjectsPageProps) {
  const [projects, setProjects] = React.useState<HomeProjectCard[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState("");

  const refreshProjects = React.useCallback(() => {
    setIsLoading(true);
    setErrorMessage("");
    void listRemoteProjects({ pageNum: 1, pageSize: 20 })
      .then((result) => {
        setProjects(result.projects);
      })
      .catch((error) => {
        setProjects([]);
        setErrorMessage(error instanceof Error ? error.message : "加载项目列表失败");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  React.useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return (
    <ProjectGalleryPage
      title="全部项目"
      subtitle="查看所有远端画布项目。"
      projects={projects}
      showCreateTile={false}
      loading={isLoading}
      errorMessage={errorMessage}
      topActionLabel="最近项目"
      onTopAction={onBackHome}
      onLogout={onLogout}
      onOpenCanvas={onOpenCanvas}
      onProjectsChanged={refreshProjects}
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
