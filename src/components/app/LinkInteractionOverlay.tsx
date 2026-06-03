import React from "react";
import { Trash2 } from "lucide-react";
import { GraphLink, GraphNode } from "../../types";
import { getInputAnchor, getNodeById, getOutputAnchor, linkPath } from "../canvas/geometry";

interface LinkInteractionOverlayProps {
  links: GraphLink[];
  nodes: GraphNode[];
  pan: { x: number; y: number };
  zoom: number;
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
  selectedLinkId,
  onSelectLink,
  onDeleteLink,
}: LinkInteractionOverlayProps) {
  const renderedLinks = links
    .map((link) => {
      const fromNode = getNodeById(nodes, link.fromNodeId);
      const toNode = getNodeById(nodes, link.toNodeId);
      if (!fromNode || !toNode) return null;

      const from = getOutputAnchor(fromNode, link.fromOutputIndex);
      const to = getInputAnchor(toNode, link.toInputIndex);
      return {
        from,
        id: link.id,
        midpoint: getBezierMidpoint(from, to),
        path: linkPath(from, to),
        to,
      };
    })
    .filter((link): link is NonNullable<typeof link> => Boolean(link));

  const selectedLink = renderedLinks.find((link) => link.id === selectedLinkId) ?? null;
  const buttonLeft = selectedLink ? pan.x + selectedLink.midpoint.x * zoom : 0;
  const buttonTop = selectedLink ? pan.y + selectedLink.midpoint.y * zoom : 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-[18] overflow-visible" aria-hidden={links.length === 0}>
      <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {renderedLinks.map((link) => {
            const selected = link.id === selectedLinkId;
            return (
              <React.Fragment key={link.id}>
                {selected && (
                  <path
                    d={link.path}
                    fill="none"
                    stroke="rgba(248,113,113,0.92)"
                    strokeLinecap="round"
                    strokeWidth={3}
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
