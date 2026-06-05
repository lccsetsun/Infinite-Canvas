type SerializableNode = {
  properties?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

type SerializableWorkflowData = {
  nodes: SerializableNode[];
  nodeOutputs: [string, [number, unknown][]][];
};

type SerializableWorkflow = {
  data: SerializableWorkflowData;
};

type SerializableWorkspace = {
  workflows: Record<string, SerializableWorkflow>;
  trash?: SerializableWorkflow[];
};

function shouldStripPersistedMediaUrl(value: unknown) {
  if (typeof value !== "string" || !value) return false;
  if (value.startsWith("blob:")) return true;
  if (value.startsWith("data:image/svg+xml")) return false;
  return value.startsWith("data:image/") || value.startsWith("data:video/") || value.startsWith("data:audio/");
}

function sanitizeMediaField(value: unknown) {
  return shouldStripPersistedMediaUrl(value) ? "" : value;
}

function sanitizeMediaList(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.filter((item) => !shouldStripPersistedMediaUrl(item));
}

function sanitizeNode(node: SerializableNode): SerializableNode {
  const nextProperties = node.properties
    ? {
        ...node.properties,
        imageUrl: sanitizeMediaField(node.properties.imageUrl),
        videoUrl: sanitizeMediaField(node.properties.videoUrl),
        audioUrl: sanitizeMediaField(node.properties.audioUrl),
      }
    : node.properties;

  const nextData = node.data
    ? {
        ...node.data,
        imageUrl: sanitizeMediaField(node.data.imageUrl),
        imageUrls: sanitizeMediaList(node.data.imageUrls),
        videoUrl: sanitizeMediaField(node.data.videoUrl),
        audioUrl: sanitizeMediaField(node.data.audioUrl),
      }
    : node.data;

  return {
    ...node,
    properties: nextProperties,
    data: nextData,
  };
}

function sanitizeNodeOutputs(nodeOutputs: [string, [number, unknown][]][]) {
  return nodeOutputs.map(([nodeId, outputs]) => [
    nodeId,
    outputs.map(([index, value]) => [index, sanitizeMediaField(value)] as [number, unknown]),
  ] as [string, [number, unknown][]]);
}

function sanitizeWorkflow(workflow: SerializableWorkflow): SerializableWorkflow {
  return {
    ...workflow,
    data: {
      ...workflow.data,
      nodes: workflow.data.nodes.map(sanitizeNode),
      nodeOutputs: sanitizeNodeOutputs(workflow.data.nodeOutputs),
    },
  };
}

export function sanitizeWorkspaceForStorage<T extends SerializableWorkspace>(workspace: T): T {
  const workflows = Object.fromEntries(
    Object.entries(workspace.workflows).map(([id, workflow]) => [id, sanitizeWorkflow(workflow)])
  ) as T["workflows"];

  return {
    ...workspace,
    workflows,
    trash: Array.isArray(workspace.trash) ? (workspace.trash.map(sanitizeWorkflow) as T["trash"]) : workspace.trash,
  };
}
