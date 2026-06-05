import { GraphNode } from "../../types";
import { getInputAnchor, getNodeById, getOutputAnchor, linkPath } from "../canvas/geometry";
import { CONNECTION_DRAFT_STYLE } from "../../utils/connectionVisualTokens";

interface DraftLinkOverlayProps {
  nodes: GraphNode[];
  pan: { x: number; y: number };
  zoom: number;
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
  draftFromNodeId = "",
  draftToNodeId = "",
  draftFromOutputIndex = 0,
  draftToInputIndex = 0,
  draftIssue,
  draftCursor = null,
}: DraftLinkOverlayProps) {
  const fromNode = draftFromNodeId ? getNodeById(nodes, draftFromNodeId) : null;
  const toNode = draftToNodeId ? getNodeById(nodes, draftToNodeId) : null;
  if (!fromNode || !fromNode.outputs[draftFromOutputIndex]) return null;

  const from = getOutputAnchor(fromNode, draftFromOutputIndex);
  const to = toNode && toNode.inputs[draftToInputIndex] ? getInputAnchor(toNode, draftToInputIndex) : draftCursor;
  if (!to) return null;

  const path = linkPath(from, to);
  const flowStroke = draftIssue ? CONNECTION_DRAFT_STYLE.flow.invalidStroke : CONNECTION_DRAFT_STYLE.flow.stroke;
  const glowStroke = draftIssue ? CONNECTION_DRAFT_STYLE.glow.invalidStroke : CONNECTION_DRAFT_STYLE.glow.stroke;

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
        <linearGradient id="draft-link-purple-tail" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(99,102,241,0)" />
          <stop offset="30%" stopColor="rgba(129,140,248,0.16)" />
          <stop offset="76%" stopColor="rgba(147,51,234,0.92)" />
          <stop offset="100%" stopColor="rgba(244,114,182,0.1)" />
        </linearGradient>
        <linearGradient id="draft-link-purple-head" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(224,231,255,0.08)" />
          <stop offset="48%" stopColor="rgba(255,255,255,0.98)" />
          <stop offset="100%" stopColor="rgba(233,213,255,0.96)" />
        </linearGradient>
      </defs>
      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
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
          stroke={draftIssue ? flowStroke : "rgba(129,140,248,0.32)"}
          strokeLinecap="round"
          strokeWidth={5.6}
          opacity={draftIssue ? CONNECTION_DRAFT_STYLE.core.opacity : 0.9}
        />
        <path
          d={path}
          fill="none"
          stroke={draftIssue ? flowStroke : "rgba(233,213,255,0.84)"}
          strokeLinecap="round"
          strokeWidth={1.8}
          opacity="0.94"
        />
        <path
          d={path}
          className="link-energy-pulse"
          pathLength={100}
          fill="none"
          stroke={draftIssue ? flowStroke : "url(#draft-link-purple-tail)"}
          strokeDasharray={draftIssue ? "54 260" : "34 66"}
          strokeLinecap="round"
          strokeWidth={draftIssue ? CONNECTION_DRAFT_STYLE.flow.strokeWidth : 4.2}
          opacity="0.96"
          filter="url(#draft-link-overlay-glow)"
        />
        {!draftIssue && (
          <path
            d={path}
            className="link-energy-pulse link-energy-pulse-soft"
            pathLength={100}
            fill="none"
            stroke="rgba(196,181,253,0.68)"
            strokeDasharray="16 84"
            strokeLinecap="round"
            strokeWidth={1.8}
          />
        )}
        {!draftIssue && (
          <path
            d={path}
            className="link-energy-pulse-head"
            pathLength={100}
            fill="none"
            stroke="url(#draft-link-purple-head)"
            strokeDasharray="3 97"
            strokeLinecap="round"
            strokeWidth={2.1}
            filter="url(#draft-link-overlay-glow)"
          />
        )}
      </g>
    </svg>
  );
}
