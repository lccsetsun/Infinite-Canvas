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
          <linearGradient id="active-link-purple-core" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(99,102,241,0.18)" />
            <stop offset="52%" stopColor="rgba(129,140,248,0.34)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0.22)" />
          </linearGradient>
          <linearGradient id="active-link-purple-tail" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(99,102,241,0)" />
            <stop offset="22%" stopColor="rgba(99,102,241,0.04)" />
            <stop offset="54%" stopColor="rgba(129,140,248,0.28)" />
            <stop offset="82%" stopColor="rgba(147,51,234,0.96)" />
            <stop offset="100%" stopColor="rgba(244,114,182,0.1)" />
          </linearGradient>
          <linearGradient id="active-link-purple-tail-far" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(99,102,241,0)" />
            <stop offset="42%" stopColor="rgba(129,140,248,0.06)" />
            <stop offset="86%" stopColor="rgba(192,132,252,0.34)" />
            <stop offset="100%" stopColor="rgba(244,114,182,0.06)" />
          </linearGradient>
          <linearGradient id="active-link-purple-head" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(224,231,255,0.08)" />
            <stop offset="38%" stopColor="rgba(255,255,255,0.98)" />
            <stop offset="72%" stopColor="rgba(255,255,255,1)" />
            <stop offset="100%" stopColor="rgba(233,213,255,0.96)" />
          </linearGradient>
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
                      stroke="rgba(88,72,173,0.22)"
                      strokeLinecap="round"
                      strokeWidth={7}
                      opacity={0.42}
                      filter="url(#active-link-energy-glow)"
                    />
                    <path
                      d={link.path}
                      fill="none"
                      stroke="url(#active-link-purple-core)"
                      strokeLinecap="round"
                      strokeWidth={4}
                      opacity={0.72}
                    />
                    <path
                      d={link.path}
                      fill="none"
                      stroke="rgba(237,233,254,0.86)"
                      strokeLinecap="round"
                      strokeWidth={1.45}
                      opacity={0.82}
                    />
                    <path
                      d={link.path}
                      className="link-energy-pulse link-energy-pulse-far"
                      pathLength={100}
                      fill="none"
                      stroke="url(#active-link-purple-tail-far)"
                      strokeDasharray="58 42"
                      strokeLinecap="round"
                      strokeWidth={2.6}
                      opacity={0.3}
                    />
                    <path
                      d={link.path}
                      className="link-energy-pulse"
                      pathLength={100}
                      fill="none"
                      stroke="url(#active-link-purple-tail)"
                      strokeDasharray="34 66"
                      strokeLinecap="round"
                      strokeWidth={3.1}
                      filter="url(#active-link-energy-glow)"
                    />
                    <path
                      d={link.path}
                      className="link-energy-pulse link-energy-pulse-soft"
                      pathLength={100}
                      fill="none"
                      stroke="rgba(196,181,253,0.68)"
                      strokeDasharray="14 86"
                      strokeLinecap="round"
                      strokeWidth={1.45}
                    />
                    <path
                      d={link.path}
                      className="link-energy-pulse-head"
                      pathLength={100}
                      fill="none"
                      stroke="url(#active-link-purple-head)"
                      strokeDasharray="3 97"
                      strokeLinecap="round"
                      strokeWidth={2.35}
                      filter="url(#active-link-energy-glow)"
                    />
                  </>
                )}
                {hovered && !selected && (
                  <path
                    d={link.path}
                    fill="none"
                    stroke="rgba(129,140,248,0.32)"
                    strokeLinecap="round"
                    strokeWidth={6.8}
                    opacity={0.28}
                  />
                )}
                {hovered && !selected && (
                  <path
                    d={link.path}
                    fill="none"
                    stroke="rgba(233,213,255,0.88)"
                    strokeLinecap="round"
                    strokeWidth={2.2}
                    opacity={0.82}
                  />
                )}
                {selected && (
                  <path
                    d={link.path}
                    fill="none"
                    stroke="rgba(147,51,234,0.42)"
                    strokeLinecap="round"
                    strokeWidth={7.8}
                    opacity={0.36}
                  />
                )}
                {selected && (
                  <path
                    d={link.path}
                    fill="none"
                    stroke="rgba(216,180,254,0.96)"
                    strokeLinecap="round"
                    strokeWidth={2.8}
                    opacity={0.94}
                  />
                )}
                {selected && (
                  <path
                    d={link.path}
                    fill="none"
                    stroke="rgba(255,255,255,0.9)"
                    strokeLinecap="round"
                    strokeWidth={1.2}
                    opacity={0.86}
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

      {selectedLink && !selectedLink.locked && (
        <button
          type="button"
          data-node-action="true"
          aria-label="删除连线"
          title="删除连线"
          className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-violet-200/18 bg-[#121923]/96 text-violet-100 shadow-[0_10px_28px_rgba(0,0,0,0.42),0_0_18px_rgba(129,140,248,0.18)] transition hover:border-fuchsia-200/38 hover:bg-[linear-gradient(135deg,rgba(99,102,241,0.22),rgba(168,85,247,0.22))] hover:text-white"
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
