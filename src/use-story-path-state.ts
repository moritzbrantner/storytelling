"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNodeData,
  StoryRuntimeState,
  StoryStateHooks,
  StoryStateSnapshot,
  StoryVariables,
} from "./story-model";
import { createStoryPathState, type StoryPathState } from "./story-state";
import {
  createInitialStoryRuntimeState,
  createStorySnapshot,
  getVisibleStoryChoices,
} from "./story-state-engine";

export type UseStoryPathStateOptions<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  snapshot?: StoryStateSnapshot<TData, TVars>;
  defaultSnapshot?: StoryStateSnapshot<TData, TVars>;
  defaultState?: StoryRuntimeState<TVars>;
  hooks?: StoryStateHooks<TData, TVars>;
  onSnapshotChange?: (
    snapshot: StoryStateSnapshot<TData, TVars>,
    state: StoryPathState<TData, TVars>,
  ) => void;
  /** @deprecated Use snapshot instead. */
  choiceIds?: string[];
  /** @deprecated Use defaultSnapshot instead. */
  defaultChoiceIds?: string[];
  autoAdvanceLinearNodes?: boolean;
  stopAt?: string;
  defaultStopAt?: string;
  onStopAtChange?: (nodeId?: string) => void;
  /** @deprecated Use onSnapshotChange instead. */
  onChoiceIdsChange?: (choiceIds: string[], state: StoryPathState<TData, TVars>) => void;
  onPathChange?: (history: StoryHistoryEntry<TData, TVars>[]) => void;
};

export type UseStoryPathStateResult<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = StoryPathState<TData, TVars> & {
  choices: StoryChoice<TData, TVars>[];
  visibleChoices: StoryChoice<TData, TVars>[];
  canGoBack: boolean;
  choose: (choiceId: string) => void;
  goBack: () => void;
  restart: () => void;
  setSnapshot: (snapshot: StoryStateSnapshot<TData, TVars>) => void;
  setRuntimeState: (state: StoryRuntimeState<TVars>) => void;
  /** @deprecated Use setSnapshot instead. */
  setChoiceIds: (choiceIds: string[]) => void;
  stopAt?: string;
  setStopAt: (nodeId?: string) => void;
};

function getChoiceKey(choiceIds: string[]) {
  return choiceIds.join("|");
}

function getHistoryChoiceIds<TData extends StoryNodeData>(history: StoryHistoryEntry<TData>[]) {
  return history.flatMap((entry) => (entry.choiceId ? [entry.choiceId] : []));
}

export function useStoryPathState<
  TData extends StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
>(
  story: StoryDocument<TData, TVars>,
  options: UseStoryPathStateOptions<TData, TVars> = {},
): UseStoryPathStateResult<TData, TVars> {
  const { onChoiceIdsChange, onPathChange, onSnapshotChange, onStopAtChange } = options;
  const autoAdvanceLinearNodes = options.autoAdvanceLinearNodes ?? false;
  const isControlled = options.snapshot !== undefined;
  const isChoiceIdsControlled = options.choiceIds !== undefined;
  const isStopAtControlled = Object.hasOwn(options, "stopAt");
  const controlledChoiceIds = options.choiceIds ?? [];
  const controlledStopAt = options.stopAt;
  const defaultChoiceIds = options.defaultChoiceIds ?? [];
  const defaultSnapshot = options.defaultSnapshot;
  const defaultStopAt = options.defaultStopAt;
  const controlledChoiceKey = getChoiceKey(controlledChoiceIds);
  const defaultChoiceKey = getChoiceKey(defaultChoiceIds);
  const [uncontrolledChoiceIds, setUncontrolledChoiceIds] = useState(defaultChoiceIds);
  const [uncontrolledSnapshot, setUncontrolledSnapshot] = useState<
    StoryStateSnapshot<TData, TVars> | undefined
  >(defaultSnapshot);
  const [uncontrolledStopAt, setUncontrolledStopAt] = useState(defaultStopAt);
  const activeChoiceIds = isChoiceIdsControlled ? controlledChoiceIds : uncontrolledChoiceIds;
  const activeSnapshot = isChoiceIdsControlled
    ? undefined
    : isControlled
      ? options.snapshot
      : uncontrolledSnapshot;
  const activeStopAt = isStopAtControlled ? controlledStopAt : uncontrolledStopAt;

  useEffect(() => {
    if (!isChoiceIdsControlled) {
      setUncontrolledChoiceIds(defaultChoiceIds);
    }
  }, [defaultChoiceKey, isChoiceIdsControlled]);

  useEffect(() => {
    if (!isControlled) {
      setUncontrolledSnapshot(defaultSnapshot);
    }
  }, [defaultSnapshot, isControlled]);

  useEffect(() => {
    if (!isStopAtControlled) {
      setUncontrolledStopAt(defaultStopAt);
    }
  }, [defaultStopAt, isStopAtControlled]);

  const state = useMemo(
    () =>
      createStoryPathState(story, {
        choiceIds: activeSnapshot ? undefined : activeChoiceIds,
        snapshot: activeSnapshot,
        defaultState: options.defaultState,
        hooks: options.hooks,
        autoAdvanceLinearNodes,
        stopAt: activeStopAt,
      }),
    [
      activeChoiceIds,
      activeSnapshot,
      activeStopAt,
      autoAdvanceLinearNodes,
      options.defaultState,
      options.hooks,
      story,
    ],
  );
  const visibleChoices = getVisibleStoryChoices(
    story,
    state.currentNode,
    state.history,
    state.state,
    options.hooks,
  );
  const choices = visibleChoices;
  const canGoBack = state.history.length > 1;

  useEffect(() => {
    if (isChoiceIdsControlled) {
      setUncontrolledChoiceIds(controlledChoiceIds);
    }
  }, [controlledChoiceKey, isChoiceIdsControlled]);

  useEffect(() => {
    if (isControlled) {
      setUncontrolledSnapshot(options.snapshot);
    }
  }, [isControlled, options.snapshot]);

  useEffect(() => {
    if (isStopAtControlled) {
      setUncontrolledStopAt(controlledStopAt);
    }
  }, [controlledStopAt, isStopAtControlled]);

  useEffect(() => {
    onPathChange?.(state.history);
  }, [onPathChange, state.history]);

  const commitResolvedState = useCallback(
    (nextState: StoryPathState<TData, TVars>, nextStopAt = activeStopAt) => {
      const nextChoiceIds = getHistoryChoiceIds(nextState.history);

      if (!isControlled && !isChoiceIdsControlled) {
        setUncontrolledSnapshot(nextState.snapshot);
      }

      if (!isChoiceIdsControlled) {
        setUncontrolledChoiceIds(nextChoiceIds);
      }

      if (!isStopAtControlled) {
        setUncontrolledStopAt(nextStopAt);
      }

      onSnapshotChange?.(nextState.snapshot, nextState);
      onChoiceIdsChange?.(nextChoiceIds, nextState);
      if (nextStopAt !== activeStopAt) {
        onStopAtChange?.(nextStopAt);
      }
    },
    [
      activeStopAt,
      isChoiceIdsControlled,
      isControlled,
      isStopAtControlled,
      onChoiceIdsChange,
      onSnapshotChange,
      onStopAtChange,
    ],
  );

  const commitState = useCallback(
    (nextChoiceIds: string[], nextStopAt = activeStopAt) => {
      const nextState = createStoryPathState(story, {
        choiceIds: nextChoiceIds,
        defaultState: options.defaultState,
        hooks: options.hooks,
        autoAdvanceLinearNodes,
        stopAt: nextStopAt,
      });

      commitResolvedState(nextState, nextStopAt);
    },
    [
      activeStopAt,
      autoAdvanceLinearNodes,
      commitResolvedState,
      options.defaultState,
      options.hooks,
      story,
    ],
  );

  const commitChoiceIds = useCallback(
    (nextChoiceIds: string[]) => commitState(nextChoiceIds),
    [commitState],
  );

  const setStopAt = useCallback(
    (nodeId?: string) => {
      const nextState = createStoryPathState(story, {
        snapshot: state.snapshot,
        defaultState: options.defaultState,
        hooks: options.hooks,
        autoAdvanceLinearNodes,
        stopAt: nodeId,
      });

      commitResolvedState(nextState, nodeId);
    },
    [
      autoAdvanceLinearNodes,
      commitResolvedState,
      options.defaultState,
      options.hooks,
      state.snapshot,
      story,
    ],
  );

  const choose = useCallback(
    (choiceId: string) => {
      const choice = choices.find((candidate) => candidate.id === choiceId && !candidate.disabled);
      if (!choice) return;

      const nextState = createStoryPathState(story, {
        snapshot: state.snapshot,
        choose: choice.id,
        defaultState: options.defaultState,
        hooks: options.hooks,
        autoAdvanceLinearNodes,
      });

      commitResolvedState(nextState, undefined);
    },
    [
      autoAdvanceLinearNodes,
      choices,
      commitResolvedState,
      options.defaultState,
      options.hooks,
      state.snapshot,
      story,
    ],
  );

  const goBack = useCallback(() => {
    if (state.history.length <= 1) return;

    const previousHistory = state.history.slice(0, -1);
    const previousEntry = previousHistory[previousHistory.length - 1];
    if (previousEntry?.state) {
      const previousSnapshot = createStorySnapshot(
        previousEntry.nodeId,
        previousHistory,
        previousEntry.state,
      );
      const previousState = createStoryPathState(story, {
        snapshot: previousSnapshot,
        defaultState: options.defaultState,
        hooks: options.hooks,
        autoAdvanceLinearNodes: false,
      });

      commitResolvedState(
        previousState,
        autoAdvanceLinearNodes ? previousEntry.nodeId : activeStopAt,
      );
      return;
    }

    if (autoAdvanceLinearNodes) {
      const previousNodeId = state.history[state.history.length - 2]?.nodeId;
      const previousChoiceIds = getHistoryChoiceIds(state.history.slice(0, -1));

      commitState(previousChoiceIds, previousNodeId);
      return;
    }

    commitChoiceIds(state.choiceIds.slice(0, -1));
  }, [
    activeStopAt,
    autoAdvanceLinearNodes,
    commitChoiceIds,
    commitResolvedState,
    commitState,
    options.defaultState,
    options.hooks,
    state.choiceIds,
    state.history,
    story,
  ]);

  const restart = useCallback(() => {
    const initialState = createInitialStoryRuntimeState(story, {
      defaultState: options.defaultState,
      hooks: options.hooks,
    });
    const nextState = createStoryPathState(story, {
      snapshot: undefined,
      defaultState: initialState,
      hooks: options.hooks,
      autoAdvanceLinearNodes: false,
    });

    commitResolvedState(nextState, undefined);
  }, [commitResolvedState, options.defaultState, options.hooks, story]);

  const setSnapshot = useCallback(
    (snapshot: StoryStateSnapshot<TData, TVars>) => {
      const nextState = createStoryPathState(story, {
        snapshot,
        defaultState: options.defaultState,
        hooks: options.hooks,
        autoAdvanceLinearNodes,
      });

      commitResolvedState(nextState);
    },
    [autoAdvanceLinearNodes, commitResolvedState, options.defaultState, options.hooks, story],
  );

  const setRuntimeState = useCallback(
    (runtimeState: StoryRuntimeState<TVars>) => {
      setSnapshot(createStorySnapshot(state.currentNode.id, state.history, runtimeState));
    },
    [setSnapshot, state.currentNode.id, state.history],
  );

  return {
    ...state,
    choices,
    visibleChoices,
    canGoBack,
    choose,
    goBack,
    restart,
    setSnapshot,
    setRuntimeState,
    setChoiceIds: commitChoiceIds,
    stopAt: activeStopAt,
    setStopAt,
  };
}
