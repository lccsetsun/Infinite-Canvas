import { GraphLink, GraphNode } from "../types";

interface LinkListProps {
  links: GraphLink[];
  nodes: GraphNode[];
  onRemoveLink: (linkId: string) => void;
}

export default function LinkList({ links, nodes, onRemoveLink }: LinkListProps) {
  return (
    <div className="space-y-2 max-h-[22vh] overflow-auto pr-1">
      {links.length === 0 && <div className="text-sm text-gray-400">暂无连线。</div>}
      {links.map((link) => {
        const fromNode = nodes.find((n) => n.id === link.fromNodeId);
        const toNode = nodes.find((n) => n.id === link.toNodeId);
        const fromNodeTitle = fromNode?.title ?? link.fromNodeId;
        const toNodeTitle = toNode?.title ?? link.toNodeId;
        const fromOutput = fromNode?.outputs[link.fromOutputIndex];
        const toInput = toNode?.inputs[link.toInputIndex];
        const fromPort = fromOutput
          ? `${fromOutput.name} (${fromOutput.type})`
          : `out:${link.fromOutputIndex}`;
        const toPort = toInput ? `${toInput.name} (${toInput.type})` : `in:${link.toInputIndex}`;

        return (
          <div
            key={link.id}
            className="border border-[#303443] rounded-md px-3 py-2 flex items-center justify-between gap-2"
          >
            <div className="text-xs text-gray-300">
              {fromNodeTitle}[{fromPort}]{" -> "}
              {toNodeTitle}[{toPort}]
            </div>
            <button
              onClick={() => onRemoveLink(link.id)}
              className="text-xs px-2 py-1 rounded border border-[#3b2230] text-rose-300 hover:bg-rose-500/10"
            >
              断开
            </button>
          </div>
        );
      })}
    </div>
  );
}

