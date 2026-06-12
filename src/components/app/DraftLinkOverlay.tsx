import { GraphNode } from "../../types";
import { getInputAnchor, getNodeById, getOutputAnchor, linkPath } from "../canvas/geometry";
import {
  CONNECTION_DRAFT_STYLE,
  getDraftLinkVisualState,
} from "../../utils/connectionVisualTokens";

interface DraftLinkOverlayProps {
  nodes: GraphNode[];
  pan: { x: number; y: number };
  zoom: number;
  draftSources?: Array<{ fromNodeId: string; fromOutputIndex: number }>;
  draftFromNodeId?: string;
  draftToNodeId?: string;
  draftFromOutputIndex?: number;
  draftToInputIndex?: number;
  draftIssue?: string | null;
  draftCursor?: { x: number; y: number } | null;
}

export default function DraftLinkOverlay({
  nodes,
  pan,
  zoom,
  draftSources,
  draftFromNodeId = "",
  draftToNodeId = "",
  draftFromOutputIndex = 0,
  draftToInputIndex = 0,
  draftIssue,
  draftCursor = null,
}: DraftLinkOverlayProps) {
  const toNode = draftToNodeId ? getNodeById(nodes, draftToNodeId) : null;
  const sources =
    draftSources && draftSources.length > 0
      ? draftSources
      : [{ fromNodeId: draftFromNodeId, fromOutputIndex: draftFromOutputIndex }];
  const renderedPaths = sources
    .map((source) => {
      const fromNode = source.fromNodeId ? getNodeById(nodes, source.fromNodeId) : null;
      if (!fromNode || !fromNode.outputs[source.fromOutputIndex]) return null;
      const from = getOutputAnchor(fromNode, source.fromOutputIndex);
      const to =
        toNode && toNode.inputs[draftToInputIndex]
          ? getInputAnchor(toNode, draftToInputIndex)
          : draftCursor;
      if (!to) return null;
      return {
        key: `${source.fromNodeId}:${source.fromOutputIndex}`,
        path: linkPath(from, to),
      };
    })
    .filter((path): path is { key: string; path: string } => Boolean(path));
  if (renderedPaths.length === 0) return null;

  const visualState = getDraftLinkVisualState({
    draftIssue,
    hasTargetNode: Boolean(toNode),
  });
  const isInvalidTarget = visualState === "invalid";
  const isValidTarget = visualState === "valid";
  const flowStroke = isInvalidTarget
    ? CONNECTION_DRAFT_STYLE.flow.invalidStroke
    : CONNECTION_DRAFT_STYLE.flow.stroke;
  const glowStroke = isInvalidTarget
    ? CONNECTION_DRAFT_STYLE.glow.invalidStroke
    : CONNECTION_DRAFT_STYLE.glow.stroke;
  const baseStroke = isInvalidTarget
    ? flowStroke
    : isValidTarget
      ? "rgba(103,232,249,0.46)"
      : "rgba(129,140,248,0.24)";
  const softPulseStroke = isValidTarget
    ? "rgba(165,243,252,0.72)"
    : "rgba(196,181,253,0.48)";

  return (
    <svg className="pointer-events-none absolute inset-0 z-[35] overflow-visible" aria-hidden="true">
      <defs>
        <filter id="draft-link-overlay-glow" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="draft-link-cyan-violet-tail" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(103,232,249,0)" />
          <stop offset="30%" stopColor="rgba(103,232,249,0.2)" />
          <stop offset="72%" stopColor="rgba(167,139,250,0.88)" />
          <stop offset="100%" stopColor="rgba(224,231,255,0.22)" />
        </linearGradient>
        <linearGradient id="draft-link-cyan-head" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(224,231,255,0.08)" />
          <stop offset="46%" stopColor="rgba(255,255,255,0.98)" />
          <stop offset="100%" stopColor="rgba(103,232,249,0.94)" />
        </linearGradient>
        <linearGradient id="draft-link-rose-tail" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(244,63,94,0)" />
          <stop offset="62%" stopColor="rgba(251,113,133,0.74)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.22)" />
        </linearGradient>
      </defs>
      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        {renderedPaths.map(({ key, path }) => (
          <g key={key}>
            <path
              d={path}
              fill="none"
              stroke={glowStroke}
              strokeLinecap="round"
              strokeWidth={CONNECTION_DRAFT_STYLE.glow.strokeWidth}
              opacity="0.58"
              filter="url(#draft-link-overlay-glow)"
            />
            <path
              d={path}
              fill="none"
              stroke={baseStroke}
              strokeLinecap="round"
              strokeWidth={isValidTarget ? 4.8 : 4.2}
              opacity={isInvalidTarget ? CONNECTION_DRAFT_STYLE.core.opacity : 0.72}
            />
            <path
              d={path}
              fill="none"
              stroke={isInvalidTarget ? flowStroke : "rgba(224,231,255,0.7)"}
              strokeLinecap="round"
              strokeWidth={1.65}
              opacity={isValidTarget ? 0.95 : 0.82}
            />
            <path
              d={path}
              className="link-energy-pulse"
              pathLength={100}
              fill="none"
              stroke={
                isInvalidTarget
                  ? "url(#draft-link-rose-tail)"
                  : "url(#draft-link-cyan-violet-tail)"
              }
              strokeDasharray={isInvalidTarget ? "54 260" : "34 66"}
              strokeLinecap="round"
              strokeWidth={isInvalidTarget ? 3.1 : isValidTarget ? 3.4 : 2.8}
              opacity={isInvalidTarget ? 0.84 : 0.9}
              filter="url(#draft-link-overlay-glow)"
            />
            {!isInvalidTarget && (
              <path
                d={path}
                className="link-energy-pulse link-energy-pulse-soft"
                pathLength={100}
                fill="none"
                stroke={softPulseStroke}
                strokeDasharray="16 84"
                strokeLinecap="round"
                strokeWidth={1.45}
              />
            )}
            {!isInvalidTarget && (
              <path
                d={path}
                className="link-energy-pulse-head"
                pathLength={100}
                fill="none"
                stroke="url(#draft-link-cyan-head)"
                strokeDasharray="3 97"
                strokeLinecap="round"
                strokeWidth={isValidTarget ? 2.05 : 1.7}
                filter="url(#draft-link-overlay-glow)"
              />
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}
