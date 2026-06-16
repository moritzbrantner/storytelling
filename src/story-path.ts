import type {
  ResolvedStoryPath,
  StoryDocument,
  StoryHistoryEntry,
  StoryNode,
  StoryNodeData,
  StoryState,
  StoryStateHooks,
  StorySnapshot,
  StoryTimeline,
  StoryTimelineScene,
} from "./story-model";
import { createStoryNodeEntryLookup, getStoryNodeEntries } from "./story-node-tree";
import { maybeValidateStory } from "./story-validation";
import {
  applyStoryChoiceState,
  applyStoryNodeState,
  canEnterStoryNode,
  createInitialStoryState,
  createStorySnapshot,
  getSelectableStoryChoices,
  getVisibleStoryChoices,
} from "./story-state-engine";

const DEFAULT_DURATION_IN_FRAMES = 120;
const DEFAULT_TRANSITION_IN_FRAMES = 18;
const DEFAULT_FPS = 30;

export type ResolveStoryPathOptions<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  snapshot?: StorySnapshot<TData, TState>;
  defaultState?: TState;
  hooks?: StoryStateHooks<TData, TState>;
  choose?: string;
  routeChoiceIds?: string[];
  autoAdvanceLinearNodes?: boolean;
  stopAt?: string;
  maxSteps?: number;
};

export type BuildStoryTimelineOptions<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  snapshot?: StorySnapshot<TData, TState>;
  defaultState?: TState;
  hooks?: StoryStateHooks<TData, TState>;
  routeChoiceIds?: string[];
  fps?: number;
  defaultDurationInFrames?: number;
  transitionInFrames?: number;
};

function withHistoryState<TData extends StoryNodeData, TState extends StoryState>(
  entry: StoryHistoryEntry<TData, TState>,
  state: TState,
): StoryHistoryEntry<TData, TState> {
  return {
    ...entry,
    state,
  };
}

function createResolvedPath<TData extends StoryNodeData, TState extends StoryState>({
  nodes,
  history,
  currentNode,
  completed,
  state,
  stoppedReason,
  stoppedAt,
  consumedChoiceIds,
  unconsumedChoiceIds,
}: {
  nodes: StoryNode<TData, TState>[];
  history: StoryHistoryEntry<TData, TState>[];
  currentNode: StoryNode<TData, TState>;
  completed: boolean;
  state: TState;
  stoppedReason?: ResolvedStoryPath<TData, TState>["stoppedReason"];
  stoppedAt?: string;
  consumedChoiceIds?: string[];
  unconsumedChoiceIds?: string[];
}): ResolvedStoryPath<TData, TState> {
  return {
    nodes,
    history,
    currentNode,
    completed,
    state,
    snapshot: createStorySnapshot(currentNode.id, history, state, stoppedReason),
    stoppedReason,
    stoppedAt,
    consumedChoiceIds,
    unconsumedChoiceIds,
  };
}

export function resolveStoryPath<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(
  input: StoryDocument<TData, TState>,
  options: ResolveStoryPathOptions<TData, TState> = {},
): ResolvedStoryPath<TData, TState> {
  const story = maybeValidateStory(input);
  const nodeEntries = getStoryNodeEntries(story);
  const nodeLookup = new Map(nodeEntries.map((entry) => [entry.nodeId, entry.node] as const));
  const nodes: StoryNode<TData, TState>[] = [];
  const history: StoryHistoryEntry<TData, TState>[] = [];
  const routeChoiceIds = options.routeChoiceIds ?? [];
  const consumedChoiceIds: string[] = [];
  const autoAdvanceLinearNodes = options.autoAdvanceLinearNodes ?? false;
  const maxSteps = options.maxSteps ?? nodeEntries.length * 2;
  let currentNode = nodeLookup.get(options.snapshot?.nodeId ?? story.openingNodeId)!;
  let state =
    options.snapshot?.state ??
    createInitialStoryState(story, {
      defaultState: options.defaultState,
      hooks: options.hooks,
    });
  let choiceIndex = 0;
  let pendingChoose = options.choose;

  if (options.snapshot) {
    history.push(...options.snapshot.history);
    for (const entry of history) {
      const historyNode = nodeLookup.get(entry.nodeId);
      if (historyNode) {
        nodes.push(historyNode);
      }
    }
    if (nodes[nodes.length - 1]?.id !== currentNode.id) {
      nodes.push(currentNode);
    }
  } else {
    state = applyStoryNodeState(story, currentNode, history, state, options.hooks);
    nodes.push(currentNode);
    history.push(withHistoryState({ nodeId: currentNode.id, data: currentNode.data }, state));
  }

  for (let step = 0; step < maxSteps; step += 1) {
    if (options.stopAt && currentNode.id === options.stopAt) {
      return createResolvedPath({
        nodes,
        history,
        currentNode,
        completed: true,
        state,
        stoppedAt: options.stopAt,
        consumedChoiceIds,
        unconsumedChoiceIds: routeChoiceIds.slice(choiceIndex),
        stoppedReason: "stop-at",
      });
    }

    const visibleChoices = getVisibleStoryChoices(
      story,
      currentNode,
      history,
      state,
      options.hooks,
    );
    const selectableChoices = getSelectableStoryChoices(
      story,
      currentNode,
      history,
      state,
      options.hooks,
    );
    const hasExplicitChoices = (currentNode.choices?.length ?? 0) > 0;
    if (visibleChoices.length === 0) {
      return createResolvedPath({
        nodes,
        history,
        currentNode,
        completed: true,
        state,
        consumedChoiceIds,
        unconsumedChoiceIds: routeChoiceIds.slice(choiceIndex),
        stoppedReason:
          choiceIndex < routeChoiceIds.length || pendingChoose ? "invalid-choice" : "ending",
      });
    }

    const requestedChoiceId = pendingChoose ?? routeChoiceIds[choiceIndex];
    let selectedChoice =
      requestedChoiceId !== undefined
        ? selectableChoices.find((choice) => choice.id === requestedChoiceId)
        : undefined;

    if (requestedChoiceId !== undefined && hasExplicitChoices && !selectedChoice) {
      return createResolvedPath({
        nodes,
        history,
        currentNode,
        completed: false,
        state,
        consumedChoiceIds,
        unconsumedChoiceIds: routeChoiceIds.slice(choiceIndex),
        stoppedReason: "invalid-choice",
      });
    }

    if (!selectedChoice && autoAdvanceLinearNodes && !hasExplicitChoices) {
      selectedChoice = selectableChoices[0];
    }

    if (!selectedChoice) {
      return createResolvedPath({
        nodes,
        history,
        currentNode,
        completed: false,
        state,
        consumedChoiceIds,
        unconsumedChoiceIds: routeChoiceIds.slice(choiceIndex),
        stoppedReason: "awaiting-choice",
      });
    }

    if (
      requestedChoiceId === selectedChoice.id &&
      routeChoiceIds[choiceIndex] === selectedChoice.id
    ) {
      consumedChoiceIds.push(selectedChoice.id);
      choiceIndex += 1;
    }
    if (pendingChoose === selectedChoice.id) {
      consumedChoiceIds.push(selectedChoice.id);
      pendingChoose = undefined;
    }

    const nextNode = nodeLookup.get(selectedChoice.target);
    if (!nextNode) {
      return createResolvedPath({
        nodes,
        history,
        currentNode,
        completed: false,
        state,
        consumedChoiceIds,
        unconsumedChoiceIds: routeChoiceIds.slice(choiceIndex),
        stoppedReason: "invalid-choice",
      });
    }

    const choiceState = applyStoryChoiceState(
      story,
      currentNode,
      selectedChoice,
      history,
      state,
      options.hooks,
    );
    if (!canEnterStoryNode(story, nextNode, history, choiceState, options.hooks)) {
      return createResolvedPath({
        nodes,
        history,
        currentNode,
        completed: false,
        state,
        consumedChoiceIds,
        unconsumedChoiceIds: routeChoiceIds.slice(choiceIndex),
        stoppedReason: "blocked-by-condition",
      });
    }

    currentNode = nextNode;
    const nextHistoryEntry = {
      nodeId: nextNode.id,
      choiceId: selectedChoice.id,
      data: nextNode.data,
    };
    history.push(nextHistoryEntry);
    state = applyStoryNodeState(story, nextNode, history, choiceState, options.hooks);
    nodes.push(nextNode);
    history[history.length - 1] = withHistoryState(nextHistoryEntry, state);
  }

  return createResolvedPath({
    nodes,
    history,
    currentNode,
    completed: false,
    state,
    consumedChoiceIds,
    unconsumedChoiceIds: routeChoiceIds.slice(choiceIndex),
    stoppedReason: "max-steps",
  });
}

export function buildStoryTimeline<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(
  story: StoryDocument<TData, TState>,
  options: BuildStoryTimelineOptions<TData, TState> = {},
): StoryTimeline<TData, TState> {
  const path = resolveStoryPath(story, {
    snapshot: options.snapshot,
    defaultState: options.defaultState,
    hooks: options.hooks,
    routeChoiceIds: options.routeChoiceIds,
    autoAdvanceLinearNodes: true,
  });
  const nodeEntryLookup = createStoryNodeEntryLookup(story);
  const fps = options.fps ?? DEFAULT_FPS;
  const defaultDurationInFrames =
    options.defaultDurationInFrames ??
    story.defaults?.durationInFrames ??
    DEFAULT_DURATION_IN_FRAMES;
  const defaultTransitionInFrames =
    options.transitionInFrames ??
    story.defaults?.transitionInFrames ??
    DEFAULT_TRANSITION_IN_FRAMES;
  let cursor = 0;

  const scenes: StoryTimelineScene<TData, TState>[] = path.nodes.map((node, index) => {
    const durationInFrames = node.durationInFrames ?? defaultDurationInFrames;
    const transitionInFrames = node.transition?.durationInFrames ?? defaultTransitionInFrames;
    const history = path.history.slice(0, index + 1);
    const state = history[history.length - 1]?.state ?? path.state;
    const scene = {
      node,
      nodeEntry: nodeEntryLookup.get(node.id),
      startFrame: cursor,
      durationInFrames,
      endFrame: cursor + durationInFrames,
      transitionInFrames,
      pathIndex: index,
      history,
      state,
      snapshot: createStorySnapshot(node.id, history, state),
    };

    cursor = scene.endFrame;
    return scene;
  });

  return {
    scenes,
    totalFrames: cursor,
    fps,
    history: path.history,
    state: path.state,
    snapshot: path.snapshot,
  };
}
