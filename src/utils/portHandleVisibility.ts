interface InlinePortVisibilityState {
  isHovered: boolean;
  isLinkingOnCanvas?: boolean;
  selected: boolean;
}

export function shouldShowInlinePortHandles({
  isHovered,
  isLinkingOnCanvas,
  selected,
}: InlinePortVisibilityState) {
  return isHovered || selected || isLinkingOnCanvas === true;
}
