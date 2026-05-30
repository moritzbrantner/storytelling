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
} from "./story-model";
import type { StoryRenderProps } from "./story-render-types";
import { createStoryPathState, type StoryPathState } from "./story-state";
import { useStoryPathState, type UseStoryPathStateOptions } from "./use-story-path-state";
import { defineStory, getStoryChoices, getStoryNode, isStoryEnding } from "./story-validation";
import { createStoryNodeEntryLookup, getStoryNodeEntries } from "./story-node-tree";

export type CreateStoryRenderPropsInput<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  path: ResolvedStoryPath<TData>;
  nodeEntry?: StoryNodeTreeEntry<TData>;
  history?: StoryHistoryEntry<TData>[];
  currentIndex?: number;
  progress?: number;
  choices?: StoryChoice[];
  canGoBack?: boolean;
  choose?: (choiceId: string) => void;
  goBack?: () => void;
  restart?: () => void;
};

export type StoryRuntimeLabels = Required<
  Pick<StoryLabels, "back" | "restart" | "choosePrompt" | "endingPrompt" | "completedBranch">
>;

export type UseStoryRuntimeOptions<TData extends StoryNodeData = StoryNodeData> = Omit<
  UseStoryPathStateOptions<TData>,
  "onChoiceIdsChange"
> & {
  initialChoiceIds?: string[];
  defaultChoiceIds?: string[];
  onChoice?: (choice: StoryChoice, history: StoryHistoryEntry<TData>[]) => void;
  onChoiceIdsChange?: (choiceIds: string[], state: StoryPathState<TData>) => void;
  progress?: (state: StoryPathState<TData>) => number;
};

export type UseStoryRuntimeResult<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  state: StoryPathState<TData>;
  renderProps: StoryRenderProps<TData>;
  labels: StoryRuntimeLabels;
  choices: StoryChoice[];
  progress: number;
  canGoBack: boolean;
  choose: (choiceId: string) => void;
  goBack: () => void;
  restart: () => void;
  setChoiceIds: (choiceIds: string[]) => void;
};

export function getHistoryChoiceIds<TData extends StoryNodeData>(
  history: StoryHistoryEntry<TData>[],
) {
  return history.flatMap((entry) => (entry.choiceId ? [entry.choiceId] : []));
}

export function buildPathFromHistory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  history: StoryHistoryEntry<TData>[],
): ResolvedStoryPath<TData> {
  const nodes = history.map((entry) => getStoryNode(story, entry.nodeId));
  const currentNode = nodes[nodes.length - 1] ?? getStoryNode(story, story.openingNodeId);

  return {
    nodes,
    history,
    currentNode,
    completed: isStoryEnding(story, currentNode),
  };
}

export function createStoryPathStateFromHistory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  history: StoryHistoryEntry<TData>[],
  choiceIds: string[] = getHistoryChoiceIds(history),
): StoryPathState<TData> {
  const path = buildPathFromHistory(story, history);

  return {
    choiceIds,
    path,
    history,
    currentNode: path.currentNode,
    completed: path.completed,
  };
}

export function createStoryRenderProps<TData extends StoryNodeData>({
  story,
  path,
  nodeEntry = createStoryNodeEntryLookup(story).get(path.currentNode.id),
  history = path.history,
  currentIndex = Math.max(history.length - 1, 0),
  progress = history.length / Math.max(getStoryNodeEntries(story).length, 1),
  choices = getStoryChoices(story, path.currentNode),
  canGoBack = history.length > 1,
  choose = () => {},
  goBack = () => {},
  restart = () => {},
}: CreateStoryRenderPropsInput<TData>): StoryRenderProps<TData> {
  return {
    story,
    node: path.currentNode,
    nodeEntry,
    history,
    path,
    currentIndex,
    progress,
    isEnding: isStoryEnding(story, path.currentNode),
    canGoBack,
    choices,
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

export function useStoryRuntime<TData extends StoryNodeData>(
  input: StoryDocument<TData>,
  options: UseStoryRuntimeOptions<TData> = {},
): UseStoryRuntimeResult<TData> {
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
    progress,
    canGoBack: pathState.canGoBack,
    choose,
    goBack: pathState.goBack,
    restart: pathState.restart,
    setChoiceIds: pathState.setChoiceIds,
  };
}
