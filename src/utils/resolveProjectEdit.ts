export function resolveProjectEdit(draftName: string, draftCoverUrl: string, currentName: string, currentCoverUrl: string) {
  const nextName = draftName.trim() || currentName;
  const nextCoverUrl = draftCoverUrl.trim();

  return {
    nextName,
    nextCoverUrl,
    shouldRename: nextName !== currentName,
    shouldUpdateCover: nextCoverUrl !== currentCoverUrl,
  };
}
