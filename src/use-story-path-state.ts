"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { StoryChoice, StoryDocument, StoryHistoryEntry, StoryNodeData } from "./story-model";
import { createStoryPathState, type StoryPathState } from "./story-state";
import { getStoryChoices } from "./story-validation";

export type UseStoryPathStateOptions<TData extends StoryNodeData = StoryNodeData> = {
  choiceIds?: string[];
  defaultChoiceIds?: string[];
  autoAdvanceLinearNodes?: boolean;
  stopAt?: string;
  defaultStopAt?: string;
  onStopAtChange?: (nodeId?: string) => void;
  onChoiceIdsChange?: (choiceIds: string[], state: StoryPathState<TData>) => void;
  onPathChange?: (history: StoryHistoryEntry<TData>[]) => void;
};

export type UseStoryPathStateResult<TData extends StoryNodeData = StoryNodeData> =
  StoryPathState<TData> & {
    choices: StoryChoice[];
    canGoBack: boolean;
    choose: (choiceId: string) => void;
    goBack: () => void;
    restart: () => void;
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

export function useStoryPathState<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: UseStoryPathStateOptions<TData> = {},
): UseStoryPathStateResult<TData> {
  const { onChoiceIdsChange, onPathChange, onStopAtChange } = options;
  const autoAdvanceLinearNodes = options.autoAdvanceLinearNodes ?? false;
  const isControlled = options.choiceIds !== undefined;
  const isStopAtControlled = Object.hasOwn(options, "stopAt");
  const controlledChoiceIds = options.choiceIds ?? [];
  const controlledStopAt = options.stopAt;
  const defaultChoiceIds = options.defaultChoiceIds ?? [];
  const defaultStopAt = options.defaultStopAt;
  const controlledChoiceKey = getChoiceKey(controlledChoiceIds);
  const defaultChoiceKey = getChoiceKey(defaultChoiceIds);
  const [uncontrolledChoiceIds, setUncontrolledChoiceIds] = useState(defaultChoiceIds);
  const [uncontrolledStopAt, setUncontrolledStopAt] = useState(defaultStopAt);
  const activeChoiceIds = isControlled ? controlledChoiceIds : uncontrolledChoiceIds;
  const activeStopAt = isStopAtControlled ? controlledStopAt : uncontrolledStopAt;

  useEffect(() => {
    if (!isControlled) {
      setUncontrolledChoiceIds(defaultChoiceIds);
    }
  }, [defaultChoiceKey, isControlled]);

  useEffect(() => {
    if (!isStopAtControlled) {
      setUncontrolledStopAt(defaultStopAt);
    }
  }, [defaultStopAt, isStopAtControlled]);

  const state = useMemo(
    () =>
      createStoryPathState(story, {
        choiceIds: activeChoiceIds,
        autoAdvanceLinearNodes,
        stopAt: activeStopAt,
      }),
    [activeChoiceIds, activeStopAt, autoAdvanceLinearNodes, story],
  );
  const choices = getStoryChoices(story, state.currentNode);
  const canGoBack = state.history.length > 1;

  useEffect(() => {
    if (isControlled) {
      setUncontrolledChoiceIds(controlledChoiceIds);
    }
  }, [controlledChoiceKey, isControlled]);

  useEffect(() => {
    if (isStopAtControlled) {
      setUncontrolledStopAt(controlledStopAt);
    }
  }, [controlledStopAt, isStopAtControlled]);

  useEffect(() => {
    onPathChange?.(state.history);
  }, [onPathChange, state.history]);

  const commitState = useCallback(
    (nextChoiceIds: string[], nextStopAt = activeStopAt) => {
      const nextState = createStoryPathState(story, {
        choiceIds: nextChoiceIds,
        autoAdvanceLinearNodes,
        stopAt: nextStopAt,
      });

      if (!isControlled) {
        setUncontrolledChoiceIds(nextChoiceIds);
      }

      if (!isStopAtControlled) {
        setUncontrolledStopAt(nextStopAt);
      }

      onChoiceIdsChange?.(nextChoiceIds, nextState);
      if (nextStopAt !== activeStopAt) {
        onStopAtChange?.(nextStopAt);
      }
    },
    [
      activeStopAt,
      autoAdvanceLinearNodes,
      isControlled,
      isStopAtControlled,
      onChoiceIdsChange,
      onStopAtChange,
      story,
    ],
  );

  const commitChoiceIds = useCallback(
    (nextChoiceIds: string[]) => commitState(nextChoiceIds),
    [commitState],
  );

  const setStopAt = useCallback(
    (nodeId?: string) => {
      commitState(activeChoiceIds, nodeId);
    },
    [activeChoiceIds, commitState],
  );

  const choose = useCallback(
    (choiceId: string) => {
      const choice = choices.find((candidate) => candidate.id === choiceId && !candidate.disabled);
      if (!choice) return;

      commitState([...state.choiceIds, choice.id], undefined);
    },
    [choices, commitState, state.choiceIds],
  );

  const goBack = useCallback(() => {
    if (state.history.length <= 1) return;

    if (autoAdvanceLinearNodes) {
      const previousNodeId = state.history[state.history.length - 2]?.nodeId;
      const previousChoiceIds = getHistoryChoiceIds(state.history.slice(0, -1));

      commitState(previousChoiceIds, previousNodeId);
      return;
    }

    commitChoiceIds(state.choiceIds.slice(0, -1));
  }, [autoAdvanceLinearNodes, commitChoiceIds, commitState, state.choiceIds, state.history]);

  const restart = useCallback(() => {
    commitState([], undefined);
  }, [commitState]);

  return {
    ...state,
    choices,
    canGoBack,
    choose,
    goBack,
    restart,
    setChoiceIds: commitChoiceIds,
    stopAt: activeStopAt,
    setStopAt,
  };
}
