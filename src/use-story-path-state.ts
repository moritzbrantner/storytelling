"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNodeData,
  StoryState,
  StoryStateHooks,
  StorySnapshot,
} from "./story-model";
import { createStoryPathState, type StoryPathState } from "./story-state";
import {
  createInitialStoryState,
  createStorySnapshot,
  getVisibleStoryChoices,
} from "./story-state-engine";

export type UseStoryPathStateOptions<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  snapshot?: StorySnapshot<TData, TState>;
  defaultSnapshot?: StorySnapshot<TData, TState>;
  defaultState?: TState;
  hooks?: StoryStateHooks<TData, TState>;
  onSnapshotChange?: (
    snapshot: StorySnapshot<TData, TState>,
    state: StoryPathState<TData, TState>,
  ) => void;
  autoAdvanceLinearNodes?: boolean;
  stopAt?: string;
  defaultStopAt?: string;
  onStopAtChange?: (nodeId?: string) => void;
  onPathChange?: (history: StoryHistoryEntry<TData, TState>[]) => void;
};

export type UseStoryPathStateResult<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = StoryPathState<TData, TState> & {
  choices: StoryChoice<TData, TState>[];
  visibleChoices: StoryChoice<TData, TState>[];
  canGoBack: boolean;
  choose: (choiceId: string) => void;
  goBack: () => void;
  restart: () => void;
  setSnapshot: (snapshot: StorySnapshot<TData, TState>) => void;
  setRuntimeState: (state: TState) => void;
  stopAt?: string;
  setStopAt: (nodeId?: string) => void;
};

export function useStoryPathState<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(
  story: StoryDocument<TData, TState>,
  options: UseStoryPathStateOptions<TData, TState> = {},
): UseStoryPathStateResult<TData, TState> {
  const { onPathChange, onSnapshotChange, onStopAtChange } = options;
  const autoAdvanceLinearNodes = options.autoAdvanceLinearNodes ?? false;
  const isControlled = options.snapshot !== undefined;
  const isStopAtControlled = Object.hasOwn(options, "stopAt");
  const controlledStopAt = options.stopAt;
  const defaultSnapshot = options.defaultSnapshot;
  const defaultStopAt = options.defaultStopAt;
  const [uncontrolledSnapshot, setUncontrolledSnapshot] = useState<
    StorySnapshot<TData, TState> | undefined
  >(defaultSnapshot);
  const [uncontrolledStopAt, setUncontrolledStopAt] = useState(defaultStopAt);
  const activeSnapshot = isControlled ? options.snapshot : uncontrolledSnapshot;
  const activeStopAt = isStopAtControlled ? controlledStopAt : uncontrolledStopAt;

  const state = useMemo(
    () =>
      createStoryPathState(story, {
        snapshot: activeSnapshot,
        defaultState: options.defaultState,
        hooks: options.hooks,
        autoAdvanceLinearNodes,
        stopAt: activeStopAt,
      }),
    [
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
    (nextState: StoryPathState<TData, TState>, nextStopAt = activeStopAt) => {
      if (!isControlled) {
        setUncontrolledSnapshot(nextState.snapshot);
      }

      if (!isStopAtControlled) {
        setUncontrolledStopAt(nextStopAt);
      }

      onSnapshotChange?.(nextState.snapshot, nextState);
      if (nextStopAt !== activeStopAt) {
        onStopAtChange?.(nextStopAt);
      }
    },
    [activeStopAt, isControlled, isStopAtControlled, onSnapshotChange, onStopAtChange],
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
  }, [
    activeStopAt,
    autoAdvanceLinearNodes,
    commitResolvedState,
    options.defaultState,
    options.hooks,
    state.history,
    story,
  ]);

  const restart = useCallback(() => {
    const initialState = createInitialStoryState(story, {
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
    (snapshot: StorySnapshot<TData, TState>) => {
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
    (runtimeState: TState) => {
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
    stopAt: activeStopAt,
    setStopAt,
  };
}
