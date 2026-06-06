export function resolveInlineProjectRename(draftName: string, currentName: string) {
  const trimmed = draftName.trim();

  if (!trimmed) {
    return {
      nextName: currentName,
      shouldPersist: false,
    };
  }

  return {
    nextName: trimmed,
    shouldPersist: trimmed !== currentName,
  };
}
