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
  StoryRuntimeState,
  StoryStateHooks,
  StoryStateSnapshot,
  StoryVariables,
} from "./story-model";
import type { StoryRenderProps } from "./story-render-types";
import { createStoryPathState, type StoryPathState } from "./story-state";
import { useStoryPathState, type UseStoryPathStateOptions } from "./use-story-path-state";
import { defineStory, getStoryNode, isStoryEnding } from "./story-validation";
import { createStoryNodeEntryLookup, getStoryNodeEntries } from "./story-node-tree";
import {
  createDefaultStoryRuntimeState,
  createStorySnapshot,
  getVisibleStoryChoices,
} from "./story-state-engine";

export type CreateStoryRenderPropsInput<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  story: StoryDocument<TData, TVars>;
  path: ResolvedStoryPath<TData, TVars>;
  nodeEntry?: StoryNodeTreeEntry<TData, TVars>;
  history?: StoryHistoryEntry<TData, TVars>[];
  currentIndex?: number;
  progress?: number;
  choices?: StoryChoice<TData, TVars>[];
  visibleChoices?: StoryChoice<TData, TVars>[];
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
  TVars extends StoryVariables = StoryVariables,
> = Omit<UseStoryPathStateOptions<TData, TVars>, "onChoiceIdsChange"> & {
  snapshot?: StoryStateSnapshot<TData, TVars>;
  defaultSnapshot?: StoryStateSnapshot<TData, TVars>;
  defaultState?: StoryRuntimeState<TVars>;
  hooks?: StoryStateHooks<TData, TVars>;
  onSnapshotChange?: (
    snapshot: StoryStateSnapshot<TData, TVars>,
    state: StoryPathState<TData, TVars>,
  ) => void;
  /** @deprecated Use defaultSnapshot instead. */
  initialChoiceIds?: string[];
  /** @deprecated Use defaultSnapshot instead. */
  defaultChoiceIds?: string[];
  onChoice?: (
    choice: StoryChoice<TData, TVars>,
    history: StoryHistoryEntry<TData, TVars>[],
  ) => void;
  /** @deprecated Use onSnapshotChange instead. */
  onChoiceIdsChange?: (choiceIds: string[], state: StoryPathState<TData, TVars>) => void;
  progress?: (state: StoryPathState<TData, TVars>) => number;
};

export type UseStoryRuntimeResult<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  story: StoryDocument<TData, TVars>;
  state: StoryPathState<TData, TVars>;
  renderProps: StoryRenderProps<TData, TVars>;
  labels: StoryRuntimeLabels;
  choices: StoryChoice<TData, TVars>[];
  visibleChoices: StoryChoice<TData, TVars>[];
  progress: number;
  canGoBack: boolean;
  choose: (choiceId: string) => void;
  goBack: () => void;
  restart: () => void;
  snapshot: StoryStateSnapshot<TData, TVars>;
  setSnapshot: (snapshot: StoryStateSnapshot<TData, TVars>) => void;
  setRuntimeState: (state: StoryRuntimeState<TVars>) => void;
  /** @deprecated Use setSnapshot instead. */
  setChoiceIds: (choiceIds: string[]) => void;
};

export function getHistoryChoiceIds<TData extends StoryNodeData>(
  history: StoryHistoryEntry<TData>[],
) {
  return history.flatMap((entry) => (entry.choiceId ? [entry.choiceId] : []));
}

export function buildPathFromHistory<
  TData extends StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
>(
  story: StoryDocument<TData, TVars>,
  history: StoryHistoryEntry<TData, TVars>[],
): ResolvedStoryPath<TData, TVars> {
  const nodes = history.map((entry) => getStoryNode(story, entry.nodeId));
  const currentNode = nodes[nodes.length - 1] ?? getStoryNode(story, story.openingNodeId);
  const state =
    history[history.length - 1]?.state ??
    story.initialState ??
    createDefaultStoryRuntimeState<TVars>();

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
  TVars extends StoryVariables = StoryVariables,
>(
  story: StoryDocument<TData, TVars>,
  history: StoryHistoryEntry<TData, TVars>[],
  choiceIds: string[] = getHistoryChoiceIds(history),
): StoryPathState<TData, TVars> {
  const path = buildPathFromHistory(story, history);

  return {
    choiceIds,
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
  TVars extends StoryVariables = StoryVariables,
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
}: CreateStoryRenderPropsInput<TData, TVars>): StoryRenderProps<TData, TVars> {
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
  TVars extends StoryVariables = StoryVariables,
>(
  input: StoryDocument<TData, TVars>,
  options: UseStoryRuntimeOptions<TData, TVars> = {},
): UseStoryRuntimeResult<TData, TVars> {
  const story = useMemo(() => defineStory(input), [input]);
  const resolvedDefaultChoiceIds = options.defaultChoiceIds ?? options.initialChoiceIds ?? [];
  const autoAdvanceLinearNodes =
    options.autoAdvanceLinearNodes ?? resolvedDefaultChoiceIds.length > 0;
  const pathState = useStoryPathState(story, {
    ...options,
    defaultChoiceIds: resolvedDefaultChoiceIds,
    autoAdvanceLinearNodes,
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

    const nextChoiceIds = [...pathState.choiceIds, choice.id];
    const nextState = createStoryPathState(story, {
      choiceIds: nextChoiceIds,
      defaultState: options.defaultState,
      hooks: options.hooks,
      autoAdvanceLinearNodes,
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
    setChoiceIds: pathState.setChoiceIds,
  };
}
