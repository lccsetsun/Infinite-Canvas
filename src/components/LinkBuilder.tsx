import { Link2 } from "lucide-react";
import { GraphNode } from "../types";
import { findFirstCompatibleInputIndex, findFirstCompatibleOutputIndex } from "../utils/linking";

interface LinkBuilderProps {
  nodes: GraphNode[];
  linkFromNodeId: string;
  linkToNodeId: string;
  linkFromOutputIndex: number;
  linkToInputIndex: number;
  setLinkFromNodeId: (v: string) => void;
  setLinkToNodeId: (v: string) => void;
  setLinkFromOutputIndex: (v: number) => void;
  setLinkToInputIndex: (v: number) => void;
  onAddLink: () => void;
  draftIssue: string | null;
}

export default function LinkBuilder(props: LinkBuilderProps) {
  const {
    nodes,
    linkFromNodeId,
    linkToNodeId,
    linkFromOutputIndex,
    linkToInputIndex,
    setLinkFromNodeId,
    setLinkToNodeId,
    setLinkFromOutputIndex,
    setLinkToInputIndex,
    onAddLink,
    draftIssue,
  } = props;

  const linkFromNode = nodes.find((n) => n.id === linkFromNodeId) ?? null;
  const linkToNode = nodes.find((n) => n.id === linkToNodeId) ?? null;
  const fromOutput = linkFromNode?.outputs[linkFromOutputIndex];
  const toInput = linkToNode?.inputs[linkToInputIndex];

  return (
    <div className="mt-6 border-t border-[#303443] pt-4">
      <h3 className="text-sm font-semibold mb-2 inline-flex items-center gap-2">
        <Link2 className="w-4 h-4" />
        基础连线
      </h3>
      <div className="space-y-2">
        <select
          className="w-full bg-[#111215] border border-[#303443] rounded px-2 py-1 text-sm"
          value={linkFromNodeId}
          onChange={(e) => {
            const next = e.target.value;
            setLinkFromNodeId(next);
            const nextFromNode = nodes.find((node) => node.id === next);
            if (!nextFromNode) {
              setLinkFromOutputIndex(0);
              return;
            }
            if (linkToNode && linkToNode.inputs.length > 0) {
              setLinkFromOutputIndex(
                findFirstCompatibleOutputIndex(nextFromNode, linkToNode, linkToInputIndex)
              );
            } else {
              setLinkFromOutputIndex(0);
            }
          }}
        >
          <option value="">选择起点节点</option>
          {nodes.map((n) => (
            <option key={`from_${n.id}`} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>

        <select
          className="w-full bg-[#111215] border border-[#303443] rounded px-2 py-1 text-sm"
          value={linkFromOutputIndex}
          onChange={(e) => setLinkFromOutputIndex(Number(e.target.value))}
          disabled={!linkFromNode || linkFromNode.outputs.length === 0}
        >
          {!linkFromNode && <option value={0}>先选择起点节点</option>}
          {linkFromNode && linkFromNode.outputs.length === 0 && (
            <option value={0}>该节点无输出端口</option>
          )}
          {linkFromNode?.outputs.map((output, idx) => (
            <option key={`${linkFromNode.id}_out_${idx}`} value={idx}>
              输出 {idx}: {output.name} ({output.type})
            </option>
          ))}
        </select>

        <select
          className="w-full bg-[#111215] border border-[#303443] rounded px-2 py-1 text-sm"
          value={linkToNodeId}
          onChange={(e) => {
            const next = e.target.value;
            setLinkToNodeId(next);
            const nextToNode = nodes.find((node) => node.id === next);
            if (!nextToNode) {
              setLinkToInputIndex(0);
              return;
            }
            if (linkFromNode && linkFromNode.outputs.length > 0) {
              setLinkToInputIndex(
                findFirstCompatibleInputIndex(linkFromNode, nextToNode, linkFromOutputIndex)
              );
            } else {
              setLinkToInputIndex(0);
            }
          }}
        >
          <option value="">选择终点节点</option>
          {nodes.map((n) => (
            <option key={`to_${n.id}`} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>

        <select
          className="w-full bg-[#111215] border border-[#303443] rounded px-2 py-1 text-sm"
          value={linkToInputIndex}
          onChange={(e) => setLinkToInputIndex(Number(e.target.value))}
          disabled={!linkToNode || linkToNode.inputs.length === 0}
        >
          {!linkToNode && <option value={0}>先选择终点节点</option>}
          {linkToNode && linkToNode.inputs.length === 0 && (
            <option value={0}>该节点无输入端口</option>
          )}
          {linkToNode?.inputs.map((input, idx) => (
            <option key={`${linkToNode.id}_in_${idx}`} value={idx}>
              输入 {idx}: {input.name} ({input.type})
            </option>
          ))}
        </select>

        <div className="text-xs border border-[#303443] rounded px-2 py-1 bg-[#12141a] text-gray-300">
          <div className="font-semibold mb-1">连线预览</div>
          <div>
            起点：{linkFromNode?.title ?? "未选择"}
            {fromOutput ? ` / ${fromOutput.name} (${fromOutput.type})` : ""}
          </div>
          <div>
            终点：{linkToNode?.title ?? "未选择"}
            {toInput ? ` / ${toInput.name} (${toInput.type})` : ""}
          </div>
        </div>

        {draftIssue ? (
          <div className="text-xs text-amber-300 border border-amber-500/30 rounded px-2 py-1 bg-amber-500/10">
            {draftIssue}
          </div>
        ) : (
          <div className="text-xs text-emerald-300 border border-emerald-500/30 rounded px-2 py-1 bg-emerald-500/10">
            连线配置有效，可建立连接。
          </div>
        )}

        <button
          onClick={onAddLink}
          disabled={!!draftIssue}
          className="w-full px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/40 disabled:text-gray-400 text-white text-sm"
        >
          建立连线
        </button>
      </div>
    </div>
  );
}
