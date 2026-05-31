import { GraphLink, GraphNode } from "../../types";
import { getInputAnchor, getNodeById, getOutputAnchor, linkPath } from "./geometry";

interface LinksLayerProps {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function LinksLayer({ nodes, links }: LinksLayerProps) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      {links.map((link) => {
        const fromNode = getNodeById(nodes, link.fromNodeId);
        const toNode = getNodeById(nodes, link.toNodeId);
        if (!fromNode || !toNode) return null;
        const from = getOutputAnchor(fromNode, link.fromOutputIndex);
        const to = getInputAnchor(toNode, link.toInputIndex);
        return (
          <g key={link.id}>
            <path d={linkPath(from, to)} stroke="rgba(122,245,56,0.9)" strokeWidth={3} fill="none" />
            <path d={linkPath(from, to)} stroke="rgba(47,184,255,0.8)" strokeWidth={1.2} fill="none" />
          </g>
        );
      })}
    </svg>
  );
}
