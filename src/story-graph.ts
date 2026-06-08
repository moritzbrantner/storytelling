import type {
  ResolvedStoryPath,
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNode,
  StoryNodeData,
  StoryRuntimeState,
  StoryStateHooks,
  StoryStateSnapshot,
  StoryVariables,
} from "./story-model";
import { getStoryNodeEntries } from "./story-node-tree";
import { assertStoryDocument, createStoryNodeLookup, getStoryChoices } from "./story-validation";
import {
  applyStoryChoiceState,
  applyStoryNodeState,
  canEnterStoryNode,
  createInitialStoryRuntimeState,
  createStorySnapshot,
  getSelectableStoryChoices,
} from "./story-state-engine";

export type StoryGraphEdge<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  id: string;
  source: StoryNode<TData, TVars>;
  target: StoryNode<TData, TVars>;
  choice: StoryChoice<TData, TVars>;
  kind: "choice" | "next";
  disabled: boolean;
  conditional: boolean;
};

export type CompiledStoryNode<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  node: StoryNode<TData, TVars>;
  incoming: StoryGraphEdge<TData, TVars>[];
  outgoing: StoryGraphEdge<TData, TVars>[];
};

export type CompiledStory<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  story: StoryDocument<TData, TVars>;
  openingNode: StoryNode<TData, TVars>;
  nodeLookup: ReadonlyMap<string, StoryNode<TData, TVars>>;
  nodes: CompiledStoryNode<TData, TVars>[];
  edges: StoryGraphEdge<TData, TVars>[];
};

export type EnumerateStoryPathsOptions<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  includeDisabledChoices?: boolean;
  defaultState?: StoryRuntimeState<TVars>;
  hooks?: StoryStateHooks<TData, TVars>;
  maxDepth?: number;
  maxPaths?: number;
};

export type EnumeratedStoryPath<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = ResolvedStoryPath<TData, TVars> & {
  choiceIds: string[];
  state: StoryRuntimeState<TVars>;
  snapshot: StoryStateSnapshot<TData, TVars>;
};

function getChoiceKind<TData extends StoryNodeData>(node: StoryNode<TData>) {
  return node.choices && node.choices.length > 0 ? "choice" : "next";
}

export function compileStory<TData extends StoryNodeData>(
  input: StoryDocument<TData>,
): CompiledStory<TData> {
  const story = assertStoryDocument(input);
  const nodeLookup = createStoryNodeLookup(story);
  const nodeEntries = getStoryNodeEntries(story);
  const compiledNodes = new Map<string, CompiledStoryNode<TData>>();
  const edges: StoryGraphEdge<TData>[] = [];

  for (const { node } of nodeEntries) {
    compiledNodes.set(node.id, {
      node,
      incoming: [],
      outgoing: [],
    });
  }

  for (const { node: source } of nodeEntries) {
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
        conditional: Boolean(
          choice.hidden ||
          choice.isVisible ||
          choice.isEnabled ||
          choice.reduceState ||
          target.canEnter ||
          target.reduceState,
        ),
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
  options: EnumerateStoryPathsOptions<TData> = {},
): EnumeratedStoryPath<TData>[] {
  const compiledStory = compileStory(input);
  const nodeEntries = new Map(compiledStory.nodes.map((entry) => [entry.node.id, entry] as const));
  const maxDepth = options.maxDepth ?? compiledStory.nodes.length;
  const maxPaths = options.maxPaths ?? 1000;
  const paths: EnumeratedStoryPath<TData>[] = [];
  const openingState = applyStoryNodeState(
    compiledStory.story,
    compiledStory.openingNode,
    [],
    createInitialStoryRuntimeState(compiledStory.story, {
      defaultState: options.defaultState,
      hooks: options.hooks,
    }),
    options.hooks,
  );

  const visit = (
    node: StoryNode<TData>,
    nodes: StoryNode<TData>[],
    history: StoryHistoryEntry<TData>[],
    choiceIds: string[],
    state: StoryRuntimeState,
  ) => {
    if (paths.length >= maxPaths) return;

    const entry = nodeEntries.get(node.id);
    const selectableChoices = options.includeDisabledChoices
      ? getStoryChoices(compiledStory.story, node)
      : getSelectableStoryChoices(compiledStory.story, node, history, state, options.hooks);
    const selectableEdges =
      entry?.outgoing.filter((edge) =>
        selectableChoices.some((choice) => choice.id === edge.choice.id),
      ) ?? [];

    if (selectableEdges.length === 0 || nodes.length >= maxDepth) {
      const snapshot = createStorySnapshot(node.id, history, state);
      paths.push({
        nodes,
        history,
        currentNode: node,
        completed: (entry?.outgoing.length ?? 0) === 0,
        choiceIds,
        state,
        snapshot,
      });
      return;
    }

    for (const edge of selectableEdges) {
      const choiceState = applyStoryChoiceState(
        compiledStory.story,
        node,
        edge.choice,
        history,
        state,
        options.hooks,
      );
      if (
        !canEnterStoryNode(compiledStory.story, edge.target, history, choiceState, options.hooks)
      ) {
        continue;
      }
      const nextHistoryEntry = {
        nodeId: edge.target.id,
        choiceId: edge.choice.id,
        data: edge.target.data,
      };
      const nextHistory = [...history, nextHistoryEntry];
      const nextState = applyStoryNodeState(
        compiledStory.story,
        edge.target,
        nextHistory,
        choiceState,
        options.hooks,
      );
      visit(
        edge.target,
        [...nodes, edge.target],
        [...history, { ...nextHistoryEntry, state: nextState }],
        [...choiceIds, edge.choice.id],
        nextState,
      );
    }
  };

  visit(
    compiledStory.openingNode,
    [compiledStory.openingNode],
    [
      {
        nodeId: compiledStory.openingNode.id,
        data: compiledStory.openingNode.data,
        state: openingState,
      },
    ],
    [],
    openingState,
  );

  return paths;
}
