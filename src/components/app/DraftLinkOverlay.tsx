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
          stroke={draftIssue ? flowStroke : "rgba(151,210,255,0.56)"}
          strokeLinecap="round"
          strokeWidth={6.5}
          opacity={draftIssue ? CONNECTION_DRAFT_STYLE.core.opacity : 0.9}
        />
        <path
          d={path}
          fill="none"
          stroke={draftIssue ? flowStroke : "rgba(236,248,255,0.88)"}
          strokeLinecap="round"
          strokeWidth={2.3}
          opacity="0.94"
        />
        <path
          d={path}
          className="link-energy-pulse"
          fill="none"
          stroke={flowStroke}
          strokeDasharray="54 260"
          strokeLinecap="round"
          strokeWidth={draftIssue ? CONNECTION_DRAFT_STYLE.flow.strokeWidth : 8}
          opacity="0.96"
          filter="url(#draft-link-overlay-glow)"
        />
        {!draftIssue && (
          <path
            d={path}
            className="link-energy-pulse link-energy-pulse-soft"
            fill="none"
            stroke="rgba(178,225,255,0.96)"
            strokeDasharray="28 286"
            strokeLinecap="round"
            strokeWidth={3.2}
          />
        )}
      </g>
    </svg>
  );
}
