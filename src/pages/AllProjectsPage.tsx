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
import { useRefreshOnPageVisible } from "../hooks/useRefreshOnPageVisible";

const ALL_PROJECTS_PAGE_SIZE = 8;

interface AllProjectsPageProps {
  onLogout: () => void;
  onOpenCanvas: (projectId?: string) => void;
  onBackHome: () => void;
}

export default function AllProjectsPage({ onLogout, onOpenCanvas, onBackHome }: AllProjectsPageProps) {
  const [projects, setProjects] = React.useState<HomeProjectCard[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [pageNum, setPageNum] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const refreshProjects = React.useCallback(() => {
    setIsLoading(true);
    setErrorMessage("");
    void listRemoteProjects({ pageNum, pageSize: ALL_PROJECTS_PAGE_SIZE })
      .then((result) => {
        setProjects(result.projects);
        setTotal(result.total);
      })
      .catch((error) => {
        setProjects([]);
        setTotal(0);
        setErrorMessage(error instanceof Error ? error.message : "加载项目列表失败");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [pageNum]);

  React.useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  React.useEffect(() => {
    if (total <= 0) return;
    const pageCount = Math.max(1, Math.ceil(total / ALL_PROJECTS_PAGE_SIZE));
    if (pageNum > pageCount) setPageNum(pageCount);
  }, [pageNum, total]);

  useRefreshOnPageVisible(refreshProjects);

  return (
    <ProjectGalleryPage
      title="全部项目"
      subtitle="查看所有远端画布项目。"
      projects={projects}
      showCreateTile={false}
      loading={isLoading}
      errorMessage={errorMessage}
      pagination={{
        pageNum,
        pageSize: ALL_PROJECTS_PAGE_SIZE,
        total,
        onPageChange: setPageNum,
      }}
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
