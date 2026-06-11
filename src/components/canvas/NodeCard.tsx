import React from "react";
import { Copy, X } from "lucide-react";
import { motion } from "motion/react";
import { GraphNode } from "../../types";
import { getNodeWidth } from "./geometry";
import { Tooltip } from "../common/Tooltip";

interface NodeCardProps {
  node: GraphNode;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (event: React.PointerEvent, node: GraphNode) => void;
  style?: React.CSSProperties;
}

function formatPropertyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  return JSON.stringify(value);
}

function NodeCardImpl({
  node,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
  onDragStart,
  style,
}: NodeCardProps) {
  const visibleProperties = Object.entries(node.properties).slice(0, 4);

  return (
    <motion.div
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (!target.closest("[data-node-action='true']")) {
          onDragStart(event, node);
        } else {
          event.stopPropagation();
        }
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(event);
      }}
      className={`absolute node-card cursor-grab rounded-2xl border bg-[#0b0e14]/90 text-left shadow-[0_24px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 active:cursor-grabbing ${
        selected
          ? "border-violet-300/24 shadow-[0_40px_82px_-24px_rgba(0,0,0,0.78),0_0_0_1px_rgba(196,181,253,0.18),0_0_0_7px_rgba(139,92,246,0.08)]"
          : "border-white/[0.06] hover:border-white/[0.12]"
      }`}
      style={{ width: getNodeWidth(node), ...style }}
    >
      <div
        className={`flex h-11 items-center justify-between border-b px-4 transition-colors ${
          selected ? "border-violet-400/20 bg-violet-500/[0.04]" : "border-[#252c3a] bg-white/[0.02]"
        }`}
      >
        <div className="min-w-0">
          <div className={`truncate text-[13px] font-bold tracking-tight ${selected ? "text-violet-50" : "text-gray-200"}`}>
            {node.title}
          </div>
          <div className="mt-0.5 text-[9px] font-mono uppercase tracking-[0.14em] text-gray-600">
            {node.type}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Tooltip content="复制节点" position="top">
            <button
              data-node-action="true"
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate();
              }}
              className="cursor-pointer rounded-lg p-1.5 text-gray-500 transition-all hover:bg-white/5 hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="删除节点" position="top">
            <button
              data-node-action="true"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="cursor-pointer rounded-lg p-1.5 text-gray-500 transition-all hover:bg-rose-500/10 hover:text-rose-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-[126px] space-y-3 px-4 py-3">
        {visibleProperties.length > 0 ? (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
            <div className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-gray-600">
              属性
            </div>
            <div className="space-y-1.5">
              {visibleProperties.map(([key, value]) => (
                <div key={key} className="flex min-w-0 items-center gap-2 text-[11px]">
                  <span className="shrink-0 text-gray-500">{key}</span>
                  <span className="min-w-0 flex-1 truncate text-right font-mono text-gray-300">
                    {formatPropertyValue(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="border-t border-white/[0.05] pt-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-gray-600">
            <span>端口</span>
            <span>
              In {node.inputs.length} / Out {node.outputs.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              {node.inputs.length === 0 ? (
                <div className="text-[11px] text-gray-600">无输入</div>
              ) : (
                node.inputs.map((input) => (
                  <div key={`${node.id}_input_${input.name}`} className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-gray-200">{input.name}</div>
                    <div className="text-[9px] font-mono text-emerald-300/70">{input.type}</div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1.5 text-right">
              {node.outputs.length === 0 ? (
                <div className="text-[11px] text-gray-600">无输出</div>
              ) : (
                node.outputs.map((output) => (
                  <div key={`${node.id}_output_${output.name}`} className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-gray-200">{output.name}</div>
                    <div className="text-[9px] font-mono text-indigo-300/70">{output.type}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const NodeCard = React.memo(
  NodeCardImpl,
  (prev, next) => prev.node === next.node && prev.selected === next.selected
);

export default NodeCard;
