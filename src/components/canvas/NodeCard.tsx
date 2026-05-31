import React from "react";
import { Copy, X } from "lucide-react";
import { GraphNode } from "../../types";
import { getInputAnchor, getOutputAnchor, NODE_WIDTH } from "./geometry";

interface NodeCardProps {
  node: GraphNode;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
}

function NodeCardImpl({ node, selected, onSelect, onDelete, onDuplicate, onDragStart }: NodeCardProps) {
  return (
    <div
      onPointerDown={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-node-action='true']")) {
          onDragStart(e, node);
        } else {
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`absolute text-left rounded-xl border bg-[#131722]/88 backdrop-blur-sm shadow-xl transition-[border-color,box-shadow,background-color] cursor-grab active:cursor-grabbing will-change-transform ${
        selected ? "border-indigo-500 shadow-indigo-500/20" : "border-[#2a3040] hover:border-indigo-400/60"
      }`}
      style={{ width: NODE_WIDTH, transform: `translate3d(${node.x}px, ${node.y}px, 0)` }}
    >
      <div className="h-10 px-4 flex items-center justify-between border-b border-[#252c3a]">
        <span className={`text-[17px] font-semibold ${selected ? "text-white" : "text-gray-100"}`}>{node.title}</span>
        <span className="inline-flex items-center gap-2">
          <span className="text-[10px] text-gray-400">{node.type}</span>
          <button
            data-node-action="true"
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="text-gray-500 hover:text-white cursor-pointer"
            title="复制节点"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            data-node-action="true"
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-500 hover:text-rose-300 cursor-pointer"
            title="删除节点"
          >
            <X className="w-4 h-4" />
          </button>
        </span>
      </div>

      <div className="px-4 py-3 min-h-[126px]">
        <div className="border-t border-[#252c3a] pt-3 space-y-2 min-h-[84px]">
          {node.inputs.map((input) => (
            <div key={`${node.id}_input_${input.name}`} className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-lime-400 inline-block" />
              <span className="text-[14px] text-gray-200 font-semibold">{input.name}</span>
              <span className="text-[10px] text-[#6c7da2]">({input.type})</span>
            </div>
          ))}
          {node.inputs.length === 0 && <div className="h-3" />}
        </div>
        <div className="mt-3 pt-2 border-t border-[#252c3a] flex items-center justify-between text-[10px] text-gray-400">
          <span>输入 {node.inputs.length}</span>
          <span>输出 {node.outputs.length}</span>
        </div>
      </div>

      {node.outputs.length > 0 && (
        <div className="absolute right-5 bottom-12 text-right">
          <span className="text-[10px] text-[#6c7da2] mr-2">({node.outputs[0].type})</span>
          <span className="text-[14px] text-gray-200 font-semibold">{node.outputs[0].name}</span>
        </div>
      )}

      {node.inputs.map((input, idx) => {
        const p = getInputAnchor(node, idx);
        return (
          <div
            key={`in_${idx}`}
            className="absolute -left-2.5 w-4 h-4 rounded-full border-2 border-[#11151d] bg-lime-400"
            style={{ top: p.y - node.y - 8 }}
            title={`${input.name} (${input.type})`}
          />
        );
      })}

      {node.outputs.map((output, idx) => {
        const p = getOutputAnchor(node, idx);
        return (
          <div
            key={`out_${idx}`}
            className="absolute -right-2.5 w-4 h-4 rounded-full border-2 border-[#11151d] bg-violet-400"
            style={{ top: p.y - node.y - 8 }}
            title={`${output.name} (${output.type})`}
          />
        );
      })}
    </div>
  );
}

const NodeCard = React.memo(
  NodeCardImpl,
  (prev, next) => prev.node === next.node && prev.selected === next.selected
);

export default NodeCard;
