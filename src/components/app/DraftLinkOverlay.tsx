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
  const dashPattern = CONNECTION_DRAFT_STYLE.flow.dashPattern.join(" ");

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
          stroke={draftIssue ? flowStroke : CONNECTION_DRAFT_STYLE.core.stroke}
          strokeLinecap="round"
          strokeWidth={CONNECTION_DRAFT_STYLE.core.strokeWidth}
          opacity={CONNECTION_DRAFT_STYLE.core.opacity}
        />
        <path
          d={path}
          className="animate-[draft-link-flow_0.95s_linear_infinite]"
          fill="none"
          stroke={flowStroke}
          strokeDasharray={dashPattern}
          strokeLinecap="round"
          strokeWidth={CONNECTION_DRAFT_STYLE.flow.strokeWidth}
          opacity="0.96"
          filter="url(#draft-link-overlay-glow)"
        />
      </g>
    </svg>
  );
}
