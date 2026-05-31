import { GraphNode } from "../types";

interface NodeListProps {
  nodes: GraphNode[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
}

export default function NodeList({
  nodes,
  selectedNodeId,
  onSelectNode,
  onRemoveNode,
}: NodeListProps) {
  return (
    <div className="space-y-2 max-h-[40vh] overflow-auto pr-1">
      {nodes.length === 0 && <div className="text-sm text-gray-400">暂无节点，先添加一个节点。</div>}
      {nodes.map((node) => (
        <button
          key={node.id}
          onClick={() => onSelectNode(node.id)}
          className={`w-full border rounded-md px-3 py-2 text-left flex items-start justify-between gap-3 ${
            selectedNodeId === node.id
              ? "border-indigo-500 bg-indigo-500/10"
              : "border-[#303443] hover:border-indigo-500/40"
          }`}
        >
          <div>
            <div className="text-sm font-medium">{node.title}</div>
            <div className="text-xs text-gray-400 mt-1">
              {node.type} | in/out: {node.inputs.length}/{node.outputs.length}
            </div>
          </div>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onRemoveNode(node.id);
            }}
            className="text-xs px-2 py-1 rounded border border-[#3b2230] text-rose-300 hover:bg-rose-500/10"
          >
            删除
          </span>
        </button>
      ))}
    </div>
  );
}

