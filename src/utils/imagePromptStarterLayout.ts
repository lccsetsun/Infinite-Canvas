export const IMAGE_PROMPT_STARTER_GAP_X = 160;

export function getImagePromptStarterTextNodeX(imageNodeX: number, imageNodeWidth: number, gapX = IMAGE_PROMPT_STARTER_GAP_X) {
  return imageNodeX + imageNodeWidth + gapX;
}
