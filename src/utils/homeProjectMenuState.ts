export function getHomeProjectMenuState(
  projectId: string,
  hoveredProjectId: string | null,
  toggledProjectId: string | null
) {
  return {
    buttonVisible: true,
    menuVisible: hoveredProjectId === projectId || toggledProjectId === projectId,
  };
}
