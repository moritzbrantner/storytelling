import type {
  ResolvedStoryPath,
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNode,
  StoryNodeData,
} from "./story-model";
import { assertStoryDocument, createStoryNodeLookup, getStoryChoices } from "./story-validation";

export type StoryGraphEdge<TData extends StoryNodeData = StoryNodeData> = {
  id: string;
  source: StoryNode<TData>;
  target: StoryNode<TData>;
  choice: StoryChoice;
  kind: "choice" | "next";
  disabled: boolean;
};

export type CompiledStoryNode<TData extends StoryNodeData = StoryNodeData> = {
  node: StoryNode<TData>;
  incoming: StoryGraphEdge<TData>[];
  outgoing: StoryGraphEdge<TData>[];
};

export type CompiledStory<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  openingNode: StoryNode<TData>;
  nodeLookup: ReadonlyMap<string, StoryNode<TData>>;
  nodes: CompiledStoryNode<TData>[];
  edges: StoryGraphEdge<TData>[];
};

export type EnumerateStoryPathsOptions = {
  includeDisabledChoices?: boolean;
  maxDepth?: number;
  maxPaths?: number;
};

export type EnumeratedStoryPath<TData extends StoryNodeData = StoryNodeData> =
  ResolvedStoryPath<TData> & {
    choiceIds: string[];
  };

function getChoiceKind<TData extends StoryNodeData>(node: StoryNode<TData>) {
  return node.choices && node.choices.length > 0 ? "choice" : "next";
}

export function compileStory<TData extends StoryNodeData>(
  input: StoryDocument<TData>,
): CompiledStory<TData> {
  const story = assertStoryDocument(input);
  const nodeLookup = createStoryNodeLookup(story);
  const compiledNodes = new Map<string, CompiledStoryNode<TData>>();
  const edges: StoryGraphEdge<TData>[] = [];

  for (const node of story.nodes) {
    compiledNodes.set(node.id, {
      node,
      incoming: [],
      outgoing: [],
    });
  }

  for (const source of story.nodes) {
    const kind = getChoiceKind(source);

    for (const choice of getStoryChoices(story, source)) {
      const target = nodeLookup.get(choice.target);
      if (!target) continue;

      const edge: StoryGraphEdge<TData> = {
        id: `${source.id}:${choice.id}`,
        source,
        target,
        choice,
        kind,
        disabled: Boolean(choice.disabled),
      };

      edges.push(edge);
      compiledNodes.get(source.id)?.outgoing.push(edge);
      compiledNodes.get(target.id)?.incoming.push(edge);
    }
  }

  return {
    story,
    openingNode: nodeLookup.get(story.openingNodeId)!,
    nodeLookup,
    nodes: Array.from(compiledNodes.values()),
    edges,
  };
}

export function getStoryBranches<TData extends StoryNodeData>(compiledStory: CompiledStory<TData>) {
  return compiledStory.nodes
    .filter((entry) => entry.outgoing.filter((edge) => !edge.disabled).length > 1)
    .map((entry) => entry.node);
}

export function getStoryEndings<TData extends StoryNodeData>(compiledStory: CompiledStory<TData>) {
  return compiledStory.nodes
    .filter((entry) => entry.outgoing.length === 0)
    .map((entry) => entry.node);
}

export function enumerateStoryPaths<TData extends StoryNodeData>(
  input: StoryDocument<TData>,
  options: EnumerateStoryPathsOptions = {},
): EnumeratedStoryPath<TData>[] {
  const compiledStory = compileStory(input);
  const nodeEntries = new Map(compiledStory.nodes.map((entry) => [entry.node.id, entry] as const));
  const maxDepth = options.maxDepth ?? compiledStory.story.nodes.length;
  const maxPaths = options.maxPaths ?? 1000;
  const paths: EnumeratedStoryPath<TData>[] = [];

  const visit = (
    node: StoryNode<TData>,
    nodes: StoryNode<TData>[],
    history: StoryHistoryEntry<TData>[],
    choiceIds: string[],
  ) => {
    if (paths.length >= maxPaths) return;

    const entry = nodeEntries.get(node.id);
    const selectableEdges =
      entry?.outgoing.filter((edge) => options.includeDisabledChoices || !edge.disabled) ?? [];

    if (selectableEdges.length === 0 || nodes.length >= maxDepth) {
      paths.push({
        nodes,
        history,
        currentNode: node,
        completed: (entry?.outgoing.length ?? 0) === 0,
        choiceIds,
      });
      return;
    }

    for (const edge of selectableEdges) {
      visit(
        edge.target,
        [...nodes, edge.target],
        [
          ...history,
          {
            nodeId: edge.target.id,
            choiceId: edge.choice.id,
            data: edge.target.data,
          },
        ],
        [...choiceIds, edge.choice.id],
      );
    }
  };

  visit(
    compiledStory.openingNode,
    [compiledStory.openingNode],
    [{ nodeId: compiledStory.openingNode.id, data: compiledStory.openingNode.data }],
    [],
  );

  return paths;
}
