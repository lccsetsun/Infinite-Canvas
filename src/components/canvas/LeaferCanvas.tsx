import React from "react";
import { Ellipse, Group, Leafer, Path, Rect } from "leafer-ui";
import "@leafer-in/animate";
import { GraphLink, GraphNode } from "../../types";
import { getInputAnchor, getNodeById, getOutputAnchor, GRID_SIZE, linkPath, getNodeWidth, getNodeHeight } from "./geometry";
import { isDataTypeCompatible } from "../../utils/linking";
import { CONNECTION_DRAFT_STYLE, CONNECTION_LINK_STYLE } from "../../utils/connectionVisualTokens";

interface LeaferCanvasProps {
  nodes: GraphNode[];
  links?: GraphLink[];
  pan: { x: number; y: number };
  zoom: number;
  showGrid: boolean;
  background?: string;
  selectedNodeId?: string | null;
  showNodeDecorators?: boolean;
  draftFromNodeId?: string;
  draftToNodeId?: string;
  draftFromOutputIndex?: number;
  draftToInputIndex?: number;
  draftIssue?: string | null;
  draftCursor?: { x: number; y: number } | null;
  renderDraftPreview?: boolean;
}

type LeaferScene = {
  app: Leafer;
  host: HTMLDivElement;
  world: Group;
  grid: Group;
  links: Group;
  shells: Group;
  decorators: Group;
  draft: Group;
};

function getAdaptiveGridStep(zoom: number) {
  let worldStep = GRID_SIZE;
  while (worldStep * zoom < 18) worldStep *= 2;
  while (worldStep * zoom > 56 && worldStep > GRID_SIZE) worldStep /= 2;
  return worldStep;
}

function buildGrid(group: Group, pan: { x: number; y: number }, zoom: number, width: number, height: number) {
  group.clear();
  if (width <= 0 || height <= 0 || zoom <= 0) return;

  const worldStep = getAdaptiveGridStep(zoom);
  const screenStep = worldStep * zoom;
  const startWorldX = Math.floor((-pan.x / zoom) / worldStep) * worldStep;
  const startWorldY = Math.floor((-pan.y / zoom) / worldStep) * worldStep;
  const endWorldX = ((width - pan.x) / zoom) + worldStep;
  const endWorldY = ((height - pan.y) / zoom) + worldStep;

  for (let worldX = startWorldX; worldX <= endWorldX; worldX += worldStep) {
    const screenX = Math.round(pan.x + worldX * zoom) + 0.5;
    const isMajor = Math.abs(Math.round(worldX / worldStep)) % 4 === 0;
    group.add(
      new Rect({
        x: screenX,
        y: 0,
        width: isMajor ? 1.25 : 1,
        height,
        fill: isMajor ? "rgba(114,137,218,0.28)" : "rgba(114,137,218,0.12)",
        hitFill: "none",
      } as never)
    );
  }

  for (let worldY = startWorldY; worldY <= endWorldY; worldY += worldStep) {
    const screenY = Math.round(pan.y + worldY * zoom) + 0.5;
    const isMajor = Math.abs(Math.round(worldY / worldStep)) % 4 === 0;
    group.add(
      new Rect({
        x: 0,
        y: screenY,
        width,
        height: isMajor ? 1.25 : 1,
        fill: isMajor ? "rgba(114,137,218,0.28)" : "rgba(114,137,218,0.12)",
        hitFill: "none",
      } as never)
    );
  }

  if (screenStep >= 18) {
    const originX = Math.round(pan.x) + 0.5;
    const originY = Math.round(pan.y) + 0.5;

    if (originX >= 0 && originX <= width) {
      group.add(
        new Rect({
          x: originX,
          y: 0,
          width: 1.5,
          height,
          fill: "rgba(34,211,238,0.34)",
          hitFill: "none",
        } as never)
      );
    }

    if (originY >= 0 && originY <= height) {
      group.add(
        new Rect({
          x: 0,
          y: originY,
          width,
          height: 1.5,
          fill: "rgba(34,211,238,0.34)",
          hitFill: "none",
        } as never)
      );
    }
  }
}

function buildLinks(group: Group, nodes: GraphNode[], links: GraphLink[]) {
  group.clear();

  links.forEach((link) => {
    const fromNode = getNodeById(nodes, link.fromNodeId);
    const toNode = getNodeById(nodes, link.toNodeId);
    if (!fromNode || !toNode) {
      console.warn("[buildLinks] missing node for link", { link, fromNode: !!fromNode, toNode: !!toNode });
      return;
    }

    const from = getOutputAnchor(fromNode, link.fromOutputIndex);
    const to = getInputAnchor(toNode, link.toInputIndex);
    const path = linkPath(from, to);

    group.add(
      new Path({
        path,
        stroke: CONNECTION_LINK_STYLE.glow.stroke,
        strokeWidth: CONNECTION_LINK_STYLE.glow.strokeWidth,
        opacity: CONNECTION_LINK_STYLE.glow.opacity,
        shadow: CONNECTION_LINK_STYLE.glow.shadow,
        hitFill: "none",
      } as never)
    );

    group.add(
      new Path({
        path,
        stroke: CONNECTION_LINK_STYLE.base.stroke,
        strokeWidth: CONNECTION_LINK_STYLE.base.strokeWidth,
        opacity: CONNECTION_LINK_STYLE.base.opacity,
        hitFill: "none",
      } as never)
    );

    group.add(
      new Path({
        path,
        stroke: CONNECTION_LINK_STYLE.core.stroke,
        strokeWidth: CONNECTION_LINK_STYLE.core.strokeWidth,
        opacity: CONNECTION_LINK_STYLE.core.opacity,
        hitFill: "none",
      } as never)
    );
  });
}

function buildNodeShells(group: Group, nodes: GraphNode[], selectedNodeId?: string | null) {
  group.clear();

  nodes.forEach((node) => {
    if (hasInlinePortHandles(node)) return;

    const isSelected = selectedNodeId === node.id;
    const width = getNodeWidth(node);
    const height = getNodeHeight(node);

    group.add(
      new Rect({
        x: node.x,
        y: node.y,
        width: width,
        height: height,
        cornerRadius: 14,
        fill: "#131722",
        opacity: 0.94,
        stroke: isSelected ? "rgba(99,102,241,0.92)" : "rgba(42,48,64,0.95)",
        strokeWidth: isSelected ? 2 : 1,
        hitFill: "none",
      } as never)
    );

    group.add(
      new Rect({
        x: node.x,
        y: node.y,
        width: width,
        height: 40,
        cornerRadius: [14, 14, 0, 0],
        fill: "#161b29",
        opacity: 0.92,
        hitFill: "none",
      } as never)
    );

    group.add(
      new Path({
        path: `M ${node.x} ${node.y + 40} L ${node.x + width} ${node.y + 40}`,
        stroke: "rgba(37,44,58,0.96)",
        strokeWidth: 1,
        fill: "none",
        hitFill: "none",
      } as never)
    );
  });
}

function hasInlinePortHandles(node: GraphNode) {
  return ["text_node", "image_node", "video_node", "audio_node"].includes(node.type);
}

function buildNodeDecorators(
  group: Group,
  nodes: GraphNode[],
  selectedNodeId?: string | null,
  draftFromNodeId?: string,
  draftToNodeId?: string,
  draftFromOutputIndex = 0,
  draftToInputIndex = 0
) {
  group.clear();

  nodes.forEach((node) => {
    if (hasInlinePortHandles(node)) return;

    const isSelected = selectedNodeId === node.id;
    const fromNode = draftFromNodeId ? getNodeById(nodes, draftFromNodeId) : null;
    const fromOutput = fromNode?.outputs[draftFromOutputIndex];

    if (isSelected) {
      const width = getNodeWidth(node);
      const height = getNodeHeight(node);
      group.add(
        new Rect({
          x: node.x - 5,
          y: node.y - 5,
          width: width + 10,
          height: height + 10,
          cornerRadius: 18,
          stroke: "rgba(99,102,241,0.92)",
          strokeWidth: 2,
          fill: "rgba(99,102,241,0.05)",
          hitFill: "none",
        } as never)
      );
    }

    node.inputs.forEach((input, idx) => {
      const anchor = getInputAnchor(node, idx);
      const isDraftTarget = node.id === draftToNodeId && idx === draftToInputIndex;
      const isCompatibleWhileLinking =
        !!fromOutput &&
        draftFromNodeId &&
        draftFromNodeId !== node.id &&
        isDataTypeCompatible(fromOutput.type, input.type);
      group.add(
        new Ellipse({
          x: anchor.x - 10,
          y: anchor.y - 10,
          width: 20,
          height: 20,
          fill: isDraftTarget ? "#fbbf24" : isCompatibleWhileLinking ? "#34d399" : "#10b981",
          stroke: "#ecfeff",
          strokeWidth: isDraftTarget ? 3 : isCompatibleWhileLinking ? 2.5 : 2,
          opacity: fromOutput && !isDraftTarget && !isCompatibleWhileLinking ? 0.78 : 1,
          hitFill: "none",
        } as never)
      );
    });

    node.outputs.forEach((_, idx) => {
      const anchor = getOutputAnchor(node, idx);
      const isDraftSource = node.id === draftFromNodeId && idx === draftFromOutputIndex;
      group.add(
        new Ellipse({
          x: anchor.x - 10,
          y: anchor.y - 10,
          width: 20,
          height: 20,
          fill: isDraftSource ? "#22d3ee" : "#a78bfa",
          stroke: "#f5f3ff",
          strokeWidth: isDraftSource ? 3 : 2,
          hitFill: "none",
        } as never)
      );
    });
  });
}

function buildDraftPreview(
  group: Group,
  nodes: GraphNode[],
  draftFromNodeId = "",
  draftToNodeId = "",
  draftFromOutputIndex = 0,
  draftToInputIndex = 0,
  draftIssue?: string | null,
  draftCursor?: { x: number; y: number } | null
) {
  group.clear();

  const fromNode = draftFromNodeId ? getNodeById(nodes, draftFromNodeId) : null;
  const toNode = draftToNodeId ? getNodeById(nodes, draftToNodeId) : null;
  if (!fromNode || !fromNode.outputs[draftFromOutputIndex]) return;

  const from = getOutputAnchor(fromNode, draftFromOutputIndex);
  const to =
    toNode && toNode.inputs[draftToInputIndex]
      ? getInputAnchor(toNode, draftToInputIndex)
      : draftCursor;
  if (!to) return;
  const path = linkPath(from, to);
  const color = draftIssue ? CONNECTION_DRAFT_STYLE.flow.invalidStroke : CONNECTION_DRAFT_STYLE.flow.stroke;
  const glowColor = draftIssue ? CONNECTION_DRAFT_STYLE.glow.invalidStroke : CONNECTION_DRAFT_STYLE.glow.stroke;

  group.add(
    new Path({
      path,
      stroke: glowColor,
      strokeWidth: CONNECTION_DRAFT_STYLE.glow.strokeWidth,
      opacity: 0.44,
      shadow: CONNECTION_DRAFT_STYLE.flow.shadow,
      hitFill: "none",
    } as never)
  );

  group.add(
    new Path({
      path,
      stroke: draftIssue ? color : CONNECTION_DRAFT_STYLE.core.stroke,
      strokeWidth: CONNECTION_DRAFT_STYLE.core.strokeWidth,
      opacity: CONNECTION_DRAFT_STYLE.core.opacity,
      hitFill: "none",
    } as never)
  );

  const flowPath = new Path({
    path,
    stroke: color,
    strokeWidth: CONNECTION_DRAFT_STYLE.flow.strokeWidth,
    opacity: 0.9,
    dashPattern: [...CONNECTION_DRAFT_STYLE.flow.dashPattern],
    dashOffset: 0,
    hitFill: "none",
    shadow: draftIssue ? "0 0 16px rgba(250, 204, 21, 0.74)" : CONNECTION_DRAFT_STYLE.flow.shadow,
  } as never);

  group.add(flowPath as never);

  // 启动草图流光动画
  (flowPath as unknown as { animate: (props: Record<string, number>, opts: Record<string, unknown>) => void }).animate(
    { dashOffset: -60 },
      { duration: CONNECTION_DRAFT_STYLE.flow.duration, loop: true, easing: "linear" }
  );

}

export default function LeaferCanvas({
  nodes,
  links = [],
  pan,
  zoom,
  showGrid,
  background = "#121214",
  selectedNodeId,
  showNodeDecorators = true,
  draftFromNodeId = "",
  draftToNodeId = "",
  draftFromOutputIndex = 0,
  draftToInputIndex = 0,
  draftIssue,
  draftCursor = null,
  renderDraftPreview = true,
}: LeaferCanvasProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<LeaferScene | null>(null);
  const viewportRef = React.useRef({ pan, showGrid, zoom });
  const gridOverlayStyle = React.useMemo<React.CSSProperties>(() => {
    const screenStep = getAdaptiveGridStep(zoom) * zoom;
    const majorStep = screenStep * 4;
    const minorX = ((pan.x % screenStep) + screenStep) % screenStep;
    const minorY = ((pan.y % screenStep) + screenStep) % screenStep;
    const majorX = ((pan.x % majorStep) + majorStep) % majorStep;
    const majorY = ((pan.y % majorStep) + majorStep) % majorStep;

    return {
      backgroundImage: [
        "linear-gradient(to right, rgba(132, 160, 255, 0.26) 1px, transparent 1px)",
        "linear-gradient(to bottom, rgba(132, 160, 255, 0.26) 1px, transparent 1px)",
        "linear-gradient(to right, rgba(132, 160, 255, 0.11) 1px, transparent 1px)",
        "linear-gradient(to bottom, rgba(132, 160, 255, 0.11) 1px, transparent 1px)",
      ].join(", "),
      backgroundPosition: [
        `${majorX}px 0`,
        `0 ${majorY}px`,
        `${minorX}px 0`,
        `0 ${minorY}px`,
      ].join(", "),
      backgroundSize: [
        `${majorStep}px ${majorStep}px`,
        `${majorStep}px ${majorStep}px`,
        `${screenStep}px ${screenStep}px`,
        `${screenStep}px ${screenStep}px`,
      ].join(", "),
    };
  }, [pan.x, pan.y, zoom]);

  React.useEffect(() => {
    viewportRef.current = { pan, showGrid, zoom };
  }, [pan, showGrid, zoom]);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Leafer({ view: host, type: "design" });
    if (background) {
      host.style.backgroundColor = background;
    }
    const world = new Group();
    const grid = new Group();
    const linksLayer = new Group();
    const shells = new Group();
    const decorators = new Group();
    const draft = new Group();

    world.add(shells);
    world.add(linksLayer);
    world.add(draft);
    world.add(decorators);
    app.add(grid);
    app.add(world);

    sceneRef.current = { app, host, world, grid, links: linksLayer, shells, decorators, draft };
    const viewport = viewportRef.current;
    if (viewport.showGrid) buildGrid(grid, viewport.pan, viewport.zoom, host.clientWidth, host.clientHeight);
    grid.visible = viewport.showGrid;

    const resizeObserver = new ResizeObserver(() => {
      app.resize({ width: host.clientWidth, height: host.clientHeight });
      const nextViewport = viewportRef.current;
      if (sceneRef.current?.grid.visible && nextViewport.showGrid) {
        buildGrid(sceneRef.current.grid, nextViewport.pan, nextViewport.zoom, host.clientWidth, host.clientHeight);
      }
    });

    resizeObserver.observe(host);
    app.resize({ width: host.clientWidth, height: host.clientHeight });

    return () => {
      resizeObserver.disconnect();
      sceneRef.current = null;
      app.destroy();
    };
  }, [background]);

  React.useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    scene.world.x = pan.x;
    scene.world.y = pan.y;
    scene.world.scaleX = zoom;
    scene.world.scaleY = zoom;
    if (scene.grid.visible) {
      buildGrid(scene.grid, pan, zoom, scene.host.clientWidth, scene.host.clientHeight);
    }
    scene.app.requestRender();
  }, [pan, pan.x, pan.y, zoom]);

  React.useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (showGrid) {
      buildGrid(scene.grid, pan, zoom, scene.host.clientWidth, scene.host.clientHeight);
      scene.grid.visible = true;
      scene.grid.opacity = 1;
    } else {
      scene.grid.clear();
      scene.grid.visible = false;
      scene.grid.opacity = 0;
    }
    scene.app.requestRender();
  }, [pan, showGrid, zoom]);

  React.useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    buildLinks(scene.links, nodes, links);
    buildNodeShells(scene.shells, nodes, selectedNodeId);
    if (renderDraftPreview) {
      buildDraftPreview(scene.draft, nodes, draftFromNodeId, draftToNodeId, draftFromOutputIndex, draftToInputIndex, draftIssue, draftCursor);
    } else {
      scene.draft.clear();
    }
    if (showNodeDecorators) {
      buildNodeDecorators(
        scene.decorators,
        nodes,
        selectedNodeId,
        draftFromNodeId,
        draftToNodeId,
        draftFromOutputIndex,
        draftToInputIndex
      );
      scene.decorators.visible = true;
    } else {
      scene.decorators.clear();
      scene.decorators.visible = false;
    }
    scene.app.requestRender();
  }, [
    draftFromNodeId,
    draftFromOutputIndex,
    draftIssue,
    draftCursor,
    draftToInputIndex,
    draftToNodeId,
    links,
    nodes,
    selectedNodeId,
    showNodeDecorators,
    renderDraftPreview,
  ]);

  return (
    <div className="absolute inset-0 z-0 select-none" aria-hidden="true">
      {showGrid && <div className="absolute inset-0 pointer-events-none" style={gridOverlayStyle} />}
      <div className="absolute inset-0">
        <div ref={hostRef} className="h-full w-full" />
      </div>
    </div>
  );
}
