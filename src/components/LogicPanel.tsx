import LinkBuilder from "./LinkBuilder";
import LinkList from "./LinkList";
import LogPanel from "./LogPanel";
import NodeInspector from "./NodeInspector";
import NodeList from "./NodeList";
import { ExecutionLog, GraphLink, GraphNode } from "../types";

interface LogicPanelProps {
  nodes: GraphNode[];
  links: GraphLink[];
  selectedNode: GraphNode | null;
  selectedNodeId: string | null;
  logs: ExecutionLog[];
  linkFromNodeId: string;
  linkToNodeId: string;
  linkFromOutputIndex: number;
  linkToInputIndex: number;
  draftIssue: string | null;
  setLinkFromNodeId: (value: string) => void;
  setLinkToNodeId: (value: string) => void;
  setLinkFromOutputIndex: (value: number) => void;
  setLinkToInputIndex: (value: number) => void;
  onAddLink: () => void;
  onUpdateProperty: (key: string, value: unknown) => void;
  onSelectNode: (nodeId: string | null) => void;
  onRemoveNode: (nodeId: string) => void;
  onRemoveLink: (linkId: string) => void;
}

export default function LogicPanel({
  nodes,
  links,
  selectedNode,
  selectedNodeId,
  logs,
  linkFromNodeId,
  linkToNodeId,
  linkFromOutputIndex,
  linkToInputIndex,
  draftIssue,
  setLinkFromNodeId,
  setLinkToNodeId,
  setLinkFromOutputIndex,
  setLinkToInputIndex,
  onAddLink,
  onUpdateProperty,
  onSelectNode,
  onRemoveNode,
  onRemoveLink,
}: LogicPanelProps) {
  return (
    <aside className="absolute right-4 top-16 bottom-4 z-40 w-[360px] rounded-xl border border-[#2b3142] bg-[#121723]/95 backdrop-blur p-3 overflow-auto space-y-3">
      <LinkBuilder
        nodes={nodes}
        linkFromNodeId={linkFromNodeId}
        linkToNodeId={linkToNodeId}
        linkFromOutputIndex={linkFromOutputIndex}
        linkToInputIndex={linkToInputIndex}
        setLinkFromNodeId={setLinkFromNodeId}
        setLinkToNodeId={setLinkToNodeId}
        setLinkFromOutputIndex={setLinkFromOutputIndex}
        setLinkToInputIndex={setLinkToInputIndex}
        onAddLink={onAddLink}
        draftIssue={draftIssue}
      />
      <NodeInspector node={selectedNode} onUpdateProperty={onUpdateProperty} />
      <div className="border border-[#26282f] rounded-lg p-3 bg-[#171920]">
        <div className="text-sm font-semibold mb-2">节点列表</div>
        <NodeList nodes={nodes} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} onRemoveNode={onRemoveNode} />
      </div>
      <div className="border border-[#26282f] rounded-lg p-3 bg-[#171920]">
        <div className="text-sm font-semibold mb-2">连线列表</div>
        <LinkList links={links} nodes={nodes} onRemoveLink={onRemoveLink} />
      </div>
      <LogPanel logs={logs} />
    </aside>
  );
}
