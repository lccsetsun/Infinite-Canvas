export function isHomeProjectMenuInteractionInside(
  target: EventTarget | null,
  containers: Array<Pick<HTMLElement, "contains"> | null>
) {
  if (!target) return false;
  return containers.some((container) => Boolean(container?.contains(target as Node)));
}
