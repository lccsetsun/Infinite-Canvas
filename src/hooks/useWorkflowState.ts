import { useEffect, useMemo, useState } from "react";
import { createNodeFromType } from "../features/nodes/nodeFactory";
import { ExecutionLog, GraphLink, GraphNode, NodeClass } from "../types";
import { getLinkDraftIssue } from "../utils/linking";

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function makeLog(type: ExecutionLog["type"], message: string): ExecutionLog {
  return {
    id: makeId("log"),
    timestamp: new Date().toLocaleTimeString(),
    type,
    message,
  };
}

export function useWorkflowState() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([
    makeLog("info", "初始化完成：工作流编辑器已就绪。"),
  ]);

  const [linkFromNodeId, setLinkFromNodeId] = useState("");
  const [linkToNodeId, setLinkToNodeId] = useState("");
  const [linkFromOutputIndex, setLinkFromOutputIndex] = useState(0);
  const [linkToInputIndex, setLinkToInputIndex] = useState(0);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const linkDraftIssue = useMemo(
    () =>
      getLinkDraftIssue({
        fromNodeId: linkFromNodeId,
        toNodeId: linkToNodeId,
        fromOutputIndex: linkFromOutputIndex,
        toInputIndex: linkToInputIndex,
        nodes,
        links,
      }),
    [linkFromNodeId, linkToNodeId, linkFromOutputIndex, linkToInputIndex, nodes, links]
  );

  const appendLog = (type: ExecutionLog["type"], message: string) => {
    setLogs((prev) => [...prev, makeLog(type, message)].slice(-80));
  };

  const addNode = (type: NodeClass, x?: number, y?: number, initialProps?: Record<string, any>) => {
    const id = makeId("node");
    const nextX = x ?? 80 + (nodes.length % 4) * 280;
    const nextY = y ?? 120 + Math.floor(nodes.length / 4) * 180;
    const node = createNodeFromType(type, id, nextX, nextY);
    if (initialProps) {
      node.properties = { ...node.properties, ...initialProps };
    }
    setNodes((prev) => [...prev, node]);
    setSelectedNodeId(node.id);
    appendLog("success", `已添加节点：${node.title}`);
  };

  const removeNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setLinks((prev) => prev.filter((l) => l.fromNodeId !== nodeId && l.toNodeId !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    appendLog("warning", `已删除节点：${node?.title ?? nodeId}`);
  };

  const duplicateNode = (nodeId: string) => {
    const src = nodes.find((n) => n.id === nodeId);
    if (!src) return;
    const id = makeId("node");
    const clone: GraphNode = {
      ...src,
      id,
      x: src.x + 36,
      y: src.y + 36,
      inputs: src.inputs.map((i) => ({ ...i })),
      outputs: src.outputs.map((o) => ({ ...o })),
      properties: { ...src.properties },
      data: src.data ? { ...src.data } : {},
    };
    setNodes((prev) => [...prev, clone]);
    setSelectedNodeId(id);
    appendLog("info", `已复制节点：${src.title}`);
  };

  const updateNodePosition = (nodeId: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n))
    );
  };

  const clearCanvas = () => {
    setNodes([]);
    setLinks([]);
    setSelectedNodeId(null);
    appendLog("warning", "画布已清空。");
  };

  const addLink = () => {
    if (linkDraftIssue) {
      appendLog("warning", linkDraftIssue);
      return;
    }

    const fromNode = nodes.find((n) => n.id === linkFromNodeId)!;
    const toNode = nodes.find((n) => n.id === linkToNodeId)!;

    const link: GraphLink = {
      id: makeId("link"),
      fromNodeId: linkFromNodeId,
      fromOutputIndex: linkFromOutputIndex,
      toNodeId: linkToNodeId,
      toInputIndex: linkToInputIndex,
    };
    setLinks((prev) => [...prev, link]);
    appendLog(
      "success",
      `已建立连线：${fromNode.title}[${fromNode.outputs[linkFromOutputIndex].name}] -> ${toNode.title}[${toNode.inputs[linkToInputIndex].name}]`
    );
  };

  const removeLink = (linkId: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    appendLog("warning", `已移除连线：${linkId}`);
  };

  const updateNodeProperty = (nodeId: string, key: string, value: unknown) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, properties: { ...n.properties, [key]: value } } : n
      )
    );
  };

  const updateNodeData = (nodeId: string, data: Partial<GraphNode["data"]>) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, data: { ...(n.data || {}), ...data } } : n
      )
    );
  };

  const updateSelectedProperty = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    updateNodeProperty(selectedNodeId, key, value);
  };

  const runWorkflow = () => {
    if (!nodes.length) {
      appendLog("warning", "当前没有节点可执行。");
      return;
    }
    appendLog("info", `开始执行，共 ${nodes.length} 个节点。`);
    nodes.forEach((node, idx) =>
      appendLog("success", `[${idx + 1}/${nodes.length}] ${node.title}`)
    );
    appendLog("success", "流水线执行完成。");
  };

  return {
    nodes,
    links,
    selectedNodeId,
    selectedNode,
    logs,
    linkFromNodeId,
    linkToNodeId,
    linkFromOutputIndex,
    linkToInputIndex,
    linkDraftIssue,
    setSelectedNodeId,
    setLinkFromNodeId,
    setLinkToNodeId,
    setLinkFromOutputIndex,
    setLinkToInputIndex,
    addNode,
    removeNode,
    duplicateNode,
    updateNodePosition,
    updateNodeProperty,
    updateNodeData,
    clearCanvas,
    addLink,
    removeLink,
    updateSelectedProperty,
    runWorkflow,
  };
}
