import React from "react";
import { Trash2 } from "lucide-react";
import { GraphLink, GraphNode } from "../../types";
import { isLinkConnectedToNode } from "../../utils/linkAnimationState";
import { getInputAnchor, getNodeById, getOutputAnchor, linkPath } from "../canvas/geometry";

interface LinkInteractionOverlayProps {
  links: GraphLink[];
  nodes: GraphNode[];
  pan: { x: number; y: number };
  zoom: number;
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  onSelectLink: (linkId: string | null) => void;
  onDeleteLink: (linkId: string) => void;
}

function getBezierMidpoint(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = Math.max(80, Math.abs(to.x - from.x) * 0.35);
  const p0 = from;
  const p1 = { x: from.x + dx, y: from.y };
  const p2 = { x: to.x - dx, y: to.y };
  const p3 = to;
  const t = 0.5;
  const mt = 1 - t;

  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

export default function LinkInteractionOverlay({
  links,
  nodes,
  pan,
  zoom,
  selectedNodeId,
  selectedLinkId,
  onSelectLink,
  onDeleteLink,
}: LinkInteractionOverlayProps) {
  const [hoveredLinkId, setHoveredLinkId] = React.useState<string | null>(null);
  const renderedLinks = links
    .map((link) => {
      const fromNode = getNodeById(nodes, link.fromNodeId);
      const toNode = getNodeById(nodes, link.toNodeId);
      if (!fromNode || !toNode) return null;

      const from = getOutputAnchor(fromNode, link.fromOutputIndex);
      const to = getInputAnchor(toNode, link.toInputIndex);
      return {
        fromNodeId: link.fromNodeId,
        from,
        id: link.id,
        midpoint: getBezierMidpoint(from, to),
        path: linkPath(from, to),
        to,
        toNodeId: link.toNodeId,
      };
    })
    .filter((link): link is NonNullable<typeof link> => Boolean(link));

  const selectedLink = renderedLinks.find((link) => link.id === selectedLinkId) ?? null;
  const buttonLeft = selectedLink ? pan.x + selectedLink.midpoint.x * zoom : 0;
  const buttonTop = selectedLink ? pan.y + selectedLink.midpoint.y * zoom : 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-[18] overflow-visible" aria-hidden={links.length === 0}>
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <filter id="active-link-energy-glow" x="-35%" y="-80%" width="170%" height="260%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0.15  0 0 0 0 0.58  0 0 0 0 1  0 0 0 1 0"
              result="blueGlow"
            />
            <feMerge>
              <feMergeNode in="blueGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {renderedLinks.map((link) => {
            const selected = link.id === selectedLinkId;
            const hovered = link.id === hoveredLinkId;
            const active = isLinkConnectedToNode(link, selectedNodeId);
            return (
              <React.Fragment key={link.id}>
                {active && (
                  <>
                    <path
                      d={link.path}
                      fill="none"
                      stroke="rgba(43,122,178,0.42)"
                      strokeLinecap="round"
                      strokeWidth={11}
                      opacity={0.72}
                      filter="url(#active-link-energy-glow)"
                    />
                    <path
                      d={link.path}
                      fill="none"
                      stroke="rgba(151,210,255,0.52)"
                      strokeLinecap="round"
                      strokeWidth={6.4}
                      opacity={0.92}
                    />
                    <path
                      d={link.path}
                      fill="none"
                      stroke="rgba(236,248,255,0.86)"
                      strokeLinecap="round"
                      strokeWidth={2.2}
                      opacity={0.9}
                    />
                    <path
                      d={link.path}
                      className="link-energy-pulse"
                      fill="none"
                      stroke="rgba(83,178,255,0.98)"
                      strokeDasharray="54 260"
                      strokeLinecap="round"
                      strokeWidth={8}
                      filter="url(#active-link-energy-glow)"
                    />
                    <path
                      d={link.path}
                      className="link-energy-pulse link-energy-pulse-soft"
                      fill="none"
                      stroke="rgba(178,225,255,0.96)"
                      strokeDasharray="28 286"
                      strokeLinecap="round"
                      strokeWidth={3.2}
                    />
                  </>
                )}
                {(hovered || selected) && (
                  <path
                    d={link.path}
                    fill="none"
                    stroke={hovered ? "rgba(34,211,238,0.82)" : "rgba(125,211,252,0.7)"}
                    strokeLinecap="round"
                    strokeWidth={hovered ? 9 : 7}
                    opacity={hovered ? 0.5 : 0.36}
                  />
                )}
                {(hovered || selected) && (
                  <path
                    d={link.path}
                    fill="none"
                    stroke={hovered ? "rgba(236,254,255,0.98)" : "rgba(165,243,252,0.92)"}
                    strokeLinecap="round"
                    strokeWidth={hovered ? 3.8 : 3}
                    opacity={0.92}
                  />
                )}
                <path
                  d={link.path}
                  fill="none"
                  stroke="transparent"
                  strokeLinecap="round"
                  strokeWidth={24}
                  style={{ pointerEvents: "stroke" }}
                  className="cursor-pointer"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerEnter={() => setHoveredLinkId(link.id)}
                  onPointerLeave={() => setHoveredLinkId((current) => (current === link.id ? null : current))}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectLink(link.id);
                  }}
                />
              </React.Fragment>
            );
          })}
        </g>
      </svg>

      {selectedLink && (
        <button
          type="button"
          data-node-action="true"
          aria-label="删除连线"
          title="删除连线"
          className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-rose-300/30 bg-[#121923]/95 text-rose-100 shadow-[0_10px_28px_rgba(0,0,0,0.42),0_0_18px_rgba(248,113,113,0.22)] transition hover:border-rose-200/60 hover:bg-rose-500/20 hover:text-white"
          style={{ left: buttonLeft, pointerEvents: "auto", top: buttonTop }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDeleteLink(selectedLink.id);
            onSelectLink(null);
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
