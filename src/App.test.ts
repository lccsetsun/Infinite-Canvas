import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("App preview overlay", () => {
  it("hides the canvas header while the preview modal is open", () => {
    const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(source).toContain("const isPreviewOpen = Boolean(previewContent);");
    expect(source).toMatch(/\{!isPreviewOpen && \(\s*<CanvasHeader/);
    expect(source).toMatch(/\{previewContent && \(\s*<PreviewModal/);
  });
});

describe("App node context menu", () => {
  it("positions node right-click menu with viewport coordinates instead of canvas-local offsets", () => {
    const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

    expect(source).toContain('import { getSearchMenuPosition } from "./utils/searchMenuPosition";');
    expect(source).toContain("const NODE_CONTEXT_MENU_SIZE");
    expect(source).toContain("x: event.clientX");
    expect(source).toContain("y: event.clientY");
    expect(source).not.toContain("x: event.clientX - (rect?.left ?? 0)");
    expect(source).not.toContain("y: event.clientY - (rect?.top ?? 0)");
    expect(source).toContain('className="fixed z-50');
    expect(source).toContain("getSearchMenuPosition(");
  });

  it("adds image asset review to image node context menu and node layer wiring", () => {
    const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const nodeLayerSource = readFileSync(
      new URL("./components/app/CanvasNodeLayer.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('import { reviewAsset } from "./features/api/assetReview";');
    expect(source).toContain("const handleReviewImageAsset = React.useCallback");
    expect(source).toContain("await reviewAsset(ossId)");
    expect(source).toContain("reviewedNode?.data?.assetReviewPassedOssIds");
    expect(source).toContain("assetReviewLastResult: result || \"已完成\"");
    expect(source).toContain("assetReviewLastReviewedAt: Date.now()");
    expect(source).toContain("assetReviewPassedOssIds: Array.from(new Set([...existingPassedOssIds, ossId.trim()]))");
    expect(source).toContain('showNotice(`送审成功：${result || "已完成"}`');
    expect(source).toContain('showNotice(`送审失败：${message}`');
    expect(source).toContain("getPrimaryImageNodeOssId(nodeContextMenuNode,");
    expect(source).toContain("nodeContextMenuNode?.type === \"image_node\"");
    expect(source).toContain(
      'reviewingAssetNodeId === nodeContextMenu.nodeId ? "送审中" : "送审"'
    );
    expect(source).toContain("送审");
    expect(source).toContain("onReviewAsset={handleReviewImageAsset}");
    expect(source).toContain("reviewingAssetNodeId={reviewingAssetNodeId}");
    expect(nodeLayerSource).toContain("onReviewAsset?:");
    expect(nodeLayerSource).toContain("reviewingAssetNodeId?:");
    expect(nodeLayerSource).toContain("onReviewAsset={onReviewAsset}");
    expect(nodeLayerSource).toContain("isReviewingAsset={reviewingAssetNodeId === node.id}");
  });
});
