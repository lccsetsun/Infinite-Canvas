const ACTIVE_LINK_ANIMATION_LIMIT = 96;
const DRAFT_LINK_ANIMATION_LIMIT = 12;

export interface LinkInteractionRenderPolicy {
  renderActiveAnimation: boolean;
  renderActiveStaticHighlight: boolean;
  renderGlowFilters: boolean;
}

export interface DraftLinkRenderPolicy {
  renderDraftAnimation: boolean;
  renderGlowFilters: boolean;
}

export function getLinkInteractionRenderPolicy({
  animationsPaused = false,
  linkCount,
}: {
  animationsPaused?: boolean;
  linkCount: number;
}): LinkInteractionRenderPolicy {
  const canAnimate = !animationsPaused && linkCount <= ACTIVE_LINK_ANIMATION_LIMIT;
  return {
    renderActiveAnimation: canAnimate,
    renderActiveStaticHighlight: true,
    renderGlowFilters: canAnimate,
  };
}

export function getDraftLinkRenderPolicy({
  draftPathCount,
}: {
  draftPathCount: number;
}): DraftLinkRenderPolicy {
  const canAnimate = draftPathCount <= DRAFT_LINK_ANIMATION_LIMIT;
  return {
    renderDraftAnimation: canAnimate,
    renderGlowFilters: canAnimate,
  };
}
