"use client";

import { useMemo } from "react";

import type {
  ResolvedStoryPath,
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryLabels,
  StoryNodeTreeEntry,
  StoryNodeData,
  StoryState,
  StoryStateHooks,
  StorySnapshot,
} from "./story-model";
import type { StoryRenderProps } from "./story-render-types";
import { createStoryPathState, type StoryPathState } from "./story-state";
import { useStoryPathState, type UseStoryPathStateOptions } from "./use-story-path-state";
import { defineStory, getStoryNode, isStoryEnding } from "./story-validation";
import { createStoryNodeEntryLookup, getStoryNodeEntries } from "./story-node-tree";
import {
  createDefaultStoryState,
  createStorySnapshot,
  getVisibleStoryChoices,
} from "./story-state-engine";

export type CreateStoryRenderPropsInput<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  story: StoryDocument<TData, TState>;
  path: ResolvedStoryPath<TData, TState>;
  nodeEntry?: StoryNodeTreeEntry<TData, TState>;
  history?: StoryHistoryEntry<TData, TState>[];
  currentIndex?: number;
  progress?: number;
  choices?: StoryChoice<TData, TState>[];
  visibleChoices?: StoryChoice<TData, TState>[];
  canGoBack?: boolean;
  choose?: (choiceId: string) => void;
  goBack?: () => void;
  restart?: () => void;
};

export type StoryRuntimeLabels = Required<
  Pick<StoryLabels, "back" | "restart" | "choosePrompt" | "endingPrompt" | "completedBranch">
>;

export type UseStoryRuntimeOptions<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = UseStoryPathStateOptions<TData, TState> & {
  snapshot?: StorySnapshot<TData, TState>;
  defaultSnapshot?: StorySnapshot<TData, TState>;
  defaultState?: TState;
  hooks?: StoryStateHooks<TData, TState>;
  onSnapshotChange?: (
    snapshot: StorySnapshot<TData, TState>,
    state: StoryPathState<TData, TState>,
  ) => void;
  onChoice?: (
    choice: StoryChoice<TData, TState>,
    history: StoryHistoryEntry<TData, TState>[],
  ) => void;
  progress?: (state: StoryPathState<TData, TState>) => number;
};

export type UseStoryRuntimeResult<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  story: StoryDocument<TData, TState>;
  state: StoryPathState<TData, TState>;
  renderProps: StoryRenderProps<TData, TState>;
  labels: StoryRuntimeLabels;
  choices: StoryChoice<TData, TState>[];
  visibleChoices: StoryChoice<TData, TState>[];
  progress: number;
  canGoBack: boolean;
  choose: (choiceId: string) => void;
  goBack: () => void;
  restart: () => void;
  snapshot: StorySnapshot<TData, TState>;
  setSnapshot: (snapshot: StorySnapshot<TData, TState>) => void;
  setRuntimeState: (state: TState) => void;
};

export function getHistoryChoiceIds<TData extends StoryNodeData>(
  history: StoryHistoryEntry<TData>[],
) {
  return history.flatMap((entry) => (entry.choiceId ? [entry.choiceId] : []));
}

export function buildPathFromHistory<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(
  story: StoryDocument<TData, TState>,
  history: StoryHistoryEntry<TData, TState>[],
): ResolvedStoryPath<TData, TState> {
  const nodes = history.map((entry) => getStoryNode(story, entry.nodeId));
  const currentNode = nodes[nodes.length - 1] ?? getStoryNode(story, story.openingNodeId);
  const state =
    history[history.length - 1]?.state ?? story.initialState ?? createDefaultStoryState<TState>();

  return {
    nodes,
    history,
    currentNode,
    completed: isStoryEnding(story, currentNode),
    state,
    snapshot: createStorySnapshot(currentNode.id, history, state),
  };
}

export function createStoryPathStateFromHistory<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(
  story: StoryDocument<TData, TState>,
  history: StoryHistoryEntry<TData, TState>[],
): StoryPathState<TData, TState> {
  const path = buildPathFromHistory(story, history);

  return {
    path,
    history,
    currentNode: path.currentNode,
    completed: path.completed,
    state: path.state,
    snapshot: path.snapshot,
  };
}

export function createStoryRenderProps<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>({
  story,
  path,
  nodeEntry = createStoryNodeEntryLookup(story).get(path.currentNode.id),
  history = path.history,
  currentIndex = Math.max(history.length - 1, 0),
  progress = history.length / Math.max(getStoryNodeEntries(story).length, 1),
  visibleChoices = getVisibleStoryChoices(story, path.currentNode, history, path.state),
  choices = visibleChoices,
  canGoBack = history.length > 1,
  choose = () => {},
  goBack = () => {},
  restart = () => {},
}: CreateStoryRenderPropsInput<TData, TState>): StoryRenderProps<TData, TState> {
  return {
    story,
    node: path.currentNode,
    nodeEntry,
    history,
    path,
    state: path.state,
    snapshot: path.snapshot,
    currentIndex,
    progress,
    isEnding: isStoryEnding(story, path.currentNode),
    canGoBack,
    choices,
    visibleChoices,
    choose,
    goBack,
    restart,
  };
}

function resolveStoryRuntimeLabels(labels: StoryLabels | undefined): StoryRuntimeLabels {
  return {
    back: labels?.back ?? "Go back",
    restart: labels?.restart ?? "Restart",
    choosePrompt: labels?.choosePrompt ?? "Choose what happens next.",
    endingPrompt: labels?.endingPrompt ?? "This branch is complete.",
    completedBranch:
      labels?.completedBranch ??
      "Restart to explore another branch, or go back to choose a different path.",
  };
}

export function useStoryRuntime<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(
  input: StoryDocument<TData, TState>,
  options: UseStoryRuntimeOptions<TData, TState> = {},
): UseStoryRuntimeResult<TData, TState> {
  const story = useMemo(() => defineStory(input), [input]);
  const pathState = useStoryPathState(story, {
    ...options,
  });
  const labels = useMemo(() => resolveStoryRuntimeLabels(story.labels), [story.labels]);
  const progress =
    options.progress?.(pathState) ??
    pathState.history.length / Math.max(getStoryNodeEntries(story).length, 1);

  const choose = (choiceId: string) => {
    const choice = pathState.choices.find(
      (candidate) => candidate.id === choiceId && !candidate.disabled,
    );
    if (!choice) return;

    const nextState = createStoryPathState(story, {
      snapshot: pathState.snapshot,
      choose: choice.id,
      defaultState: options.defaultState,
      hooks: options.hooks,
      autoAdvanceLinearNodes: options.autoAdvanceLinearNodes,
    });

    pathState.choose(choiceId);
    options.onChoice?.(choice, nextState.history);
  };

  const renderProps = createStoryRenderProps({
    story,
    path: pathState.path,
    history: pathState.history,
    currentIndex: pathState.history.length - 1,
    progress,
    choices: pathState.choices,
    visibleChoices: pathState.visibleChoices,
    canGoBack: pathState.canGoBack,
    choose,
    goBack: pathState.goBack,
    restart: pathState.restart,
  });

  return {
    story,
    state: pathState,
    renderProps,
    labels,
    choices: pathState.choices,
    visibleChoices: pathState.visibleChoices,
    progress,
    canGoBack: pathState.canGoBack,
    choose,
    goBack: pathState.goBack,
    restart: pathState.restart,
    snapshot: pathState.snapshot,
    setSnapshot: pathState.setSnapshot,
    setRuntimeState: pathState.setRuntimeState,
  };
}
