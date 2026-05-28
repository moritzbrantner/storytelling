import type { StoryChoice, StoryDocument, StoryNode, StoryNodeData } from "./story-model";
import { analyzeStory, type StoryAuthoringIssue } from "./story-authoring";
import { compileStory } from "./story-graph";

export type StoryWorkflowNodeData<TData extends StoryNodeData = StoryNodeData> = {
  storyNode: StoryNode<TData>;
  opening: boolean;
  terminal: boolean;
  diagnostics?: StoryAuthoringIssue[];
};

export type StoryWorkflowEdgeData = {
  choiceId: string;
  choiceLabel: string;
  disabled?: boolean;
  kind: "choice" | "next";
  diagnostics?: StoryAuthoringIssue[];
};

export type StoryWorkflowPort = {
  id: string;
  label: string;
  type?: { kind: string };
};

export type StoryWorkflowNode<TData extends StoryNodeData = StoryNodeData> = {
  id: string;
  label: string;
  description?: string;
  kind: "story.node";
  category?: string;
  categoryPath?: readonly string[];
  x: number;
  y: number;
  inputs?: StoryWorkflowPort[];
  outputs?: StoryWorkflowPort[];
  data: StoryWorkflowNodeData<TData>;
};

export type StoryWorkflowEdge = {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  data: StoryWorkflowEdgeData;
};

export type StoryWorkflowDocument<TData extends StoryNodeData = StoryNodeData> = {
  nodes: Array<StoryWorkflowNode<TData>>;
  edges: StoryWorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
};

export type StoryWorkflowNodeTemplate = Omit<StoryWorkflowNode, "x" | "y" | "data"> & {
  data?: Partial<StoryWorkflowNodeData>;
};

export type StoryWorkflowPosition = { x: number; y: number };

export type StoryWorkflowLayoutOptions = {
  columnGap?: number;
  rowGap?: number;
  positions?: Record<string, StoryWorkflowPosition>;
  direction?: "horizontal" | "vertical";
  includeDiagnostics?: boolean;
};

export type StoryWorkflowDocumentToStoryOptions<TData extends StoryNodeData = StoryNodeData> = {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  openingNodeId?: string;
  labels?: StoryDocument<TData>["labels"];
  defaults?: StoryDocument<TData>["defaults"];
};

const STORY_PORT_TYPE = { kind: "story-node" };

function getWorkflowOutputPort(choice: StoryChoice) {
  return {
    id: choice.id,
    label: choice.label,
    type: STORY_PORT_TYPE,
  };
}

export function storyToWorkflowDocument<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  layout: StoryWorkflowLayoutOptions = {},
): StoryWorkflowDocument<TData> {
  const compiledStory = compileStory(story);
  const columnGap = layout.columnGap ?? 320;
  const rowGap = layout.rowGap ?? 180;
  const direction = layout.direction ?? "horizontal";
  const diagnostics = layout.includeDiagnostics ? analyzeStory(story).issues : [];
  const depths = new Map<string, number>([[story.openingNodeId, 0]]);
  const queue = [story.openingNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const depth = depths.get(nodeId) ?? 0;
    const compiledNode = compiledStory.nodes.find((entry) => entry.node.id === nodeId);

    for (const edge of compiledNode?.outgoing ?? []) {
      if (!depths.has(edge.target.id)) {
        depths.set(edge.target.id, depth + 1);
        queue.push(edge.target.id);
      }
    }
  }

  const rowIndexes = new Map<number, number>();
  const nodes = compiledStory.nodes.map((entry) => {
    const depth = depths.get(entry.node.id) ?? 0;
    const row = rowIndexes.get(depth) ?? 0;
    const position = layout.positions?.[entry.node.id] ?? {
      x: direction === "horizontal" ? depth * columnGap : row * columnGap,
      y: direction === "horizontal" ? row * rowGap : depth * rowGap,
    };

    rowIndexes.set(depth, row + 1);

    return {
      id: entry.node.id,
      label: entry.node.title,
      description: entry.node.prompt,
      kind: "story.node" as const,
      category: "Story",
      categoryPath: ["Story"],
      x: position.x,
      y: position.y,
      inputs: [{ id: "in", label: "In", type: STORY_PORT_TYPE }],
      outputs: entry.outgoing.map((edge) => getWorkflowOutputPort(edge.choice)),
      data: {
        storyNode: entry.node,
        opening: entry.node.id === story.openingNodeId,
        terminal: entry.outgoing.length === 0,
        ...(layout.includeDiagnostics
          ? { diagnostics: diagnostics.filter((issue) => issue.nodeId === entry.node.id) }
          : {}),
      },
    };
  });

  return {
    nodes,
    edges: compiledStory.edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.source.id,
      sourcePortId: edge.choice.id,
      targetNodeId: edge.target.id,
      targetPortId: "in",
      data: {
        choiceId: edge.choice.id,
        choiceLabel: edge.choice.label,
        disabled: edge.choice.disabled,
        kind: edge.kind,
        ...(layout.includeDiagnostics
          ? {
              diagnostics: diagnostics.filter(
                (issue) =>
                  issue.nodeId === edge.source.id &&
                  (issue.choiceId === edge.choice.id || issue.target === edge.target.id),
              ),
            }
          : {}),
      },
    })),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function workflowDocumentToStory<TData extends StoryNodeData = StoryNodeData>(
  document: StoryWorkflowDocument<TData>,
  options: StoryWorkflowDocumentToStoryOptions<TData> = {},
): StoryDocument<TData> {
  const openingNodeId =
    options.openingNodeId ??
    document.nodes.find((node) => node.data?.opening)?.id ??
    document.nodes[0]?.id ??
    "";
  const edgesBySource = new Map<string, StoryWorkflowEdge[]>();

  for (const edge of document.edges) {
    const edges = edgesBySource.get(edge.sourceNodeId) ?? [];
    edges.push(edge);
    edgesBySource.set(edge.sourceNodeId, edges);
  }

  const nodes = document.nodes.map((workflowNode): StoryNode<TData> => {
    const sourceEdges = edgesBySource.get(workflowNode.id) ?? [];
    const storyNode = workflowNode.data?.storyNode ?? {
      id: workflowNode.id,
      title: workflowNode.label,
    };
    const nextEdge =
      sourceEdges.length === 1 && sourceEdges[0]?.data.kind === "next" ? sourceEdges[0] : null;
    const choices = nextEdge
      ? undefined
      : sourceEdges.map(
          (edge): StoryChoice => ({
            id: edge.data.choiceId || edge.sourcePortId,
            label: edge.data.choiceLabel || edge.sourcePortId,
            target: edge.targetNodeId,
            disabled: edge.data.disabled,
          }),
        );

    return {
      ...storyNode,
      id: workflowNode.id,
      title: storyNode.title || workflowNode.label,
      next: nextEdge?.targetNodeId,
      choices: choices && choices.length > 0 ? choices : undefined,
    };
  });

  return {
    id: options.id ?? "workflow-story",
    title: options.title ?? "Workflow story",
    subtitle: options.subtitle,
    description: options.description,
    openingNodeId,
    nodes,
    defaults: options.defaults,
    labels: options.labels,
  };
}

export function createStoryWorkflowNodeTemplates(): StoryWorkflowNodeTemplate[] {
  return [
    {
      id: "story-node",
      label: "Story node",
      description: "A serializable StoryDocument node with choices as outgoing ports.",
      kind: "story.node",
      category: "Story",
      categoryPath: ["Story"],
      inputs: [{ id: "in", label: "In", type: STORY_PORT_TYPE }],
      outputs: [{ id: "continue", label: "Continue", type: STORY_PORT_TYPE }],
    },
  ];
}
