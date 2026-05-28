"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { StoryChoice, StoryDocument, StoryHistoryEntry, StoryNodeData } from "./story-model";
import { createStoryPathState, type StoryPathState } from "./story-state";
import { getStoryChoices } from "./story-validation";

export type UseStoryPathStateOptions<TData extends StoryNodeData = StoryNodeData> = {
  choiceIds?: string[];
  defaultChoiceIds?: string[];
  autoAdvanceLinearNodes?: boolean;
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
  };

function getChoiceKey(choiceIds: string[]) {
  return choiceIds.join("|");
}

export function useStoryPathState<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: UseStoryPathStateOptions<TData> = {},
): UseStoryPathStateResult<TData> {
  const { onChoiceIdsChange, onPathChange } = options;
  const autoAdvanceLinearNodes = options.autoAdvanceLinearNodes ?? false;
  const isControlled = options.choiceIds !== undefined;
  const controlledChoiceIds = options.choiceIds ?? [];
  const defaultChoiceIds = options.defaultChoiceIds ?? [];
  const controlledChoiceKey = getChoiceKey(controlledChoiceIds);
  const defaultChoiceKey = getChoiceKey(defaultChoiceIds);
  const [uncontrolledChoiceIds, setUncontrolledChoiceIds] = useState(defaultChoiceIds);
  const activeChoiceIds = isControlled ? controlledChoiceIds : uncontrolledChoiceIds;

  useEffect(() => {
    if (!isControlled) {
      setUncontrolledChoiceIds(defaultChoiceIds);
    }
  }, [defaultChoiceKey, isControlled]);

  const state = useMemo(
    () =>
      createStoryPathState(story, {
        choiceIds: activeChoiceIds,
        autoAdvanceLinearNodes,
      }),
    [activeChoiceIds, autoAdvanceLinearNodes, story],
  );
  const choices = getStoryChoices(story, state.currentNode);
  const canGoBack = state.choiceIds.length > 0;

  useEffect(() => {
    if (isControlled) {
      setUncontrolledChoiceIds(controlledChoiceIds);
    }
  }, [controlledChoiceKey, isControlled]);

  useEffect(() => {
    onPathChange?.(state.history);
  }, [onPathChange, state.history]);

  const commitChoiceIds = useCallback(
    (nextChoiceIds: string[]) => {
      const nextState = createStoryPathState(story, {
        choiceIds: nextChoiceIds,
        autoAdvanceLinearNodes,
      });

      if (!isControlled) {
        setUncontrolledChoiceIds(nextChoiceIds);
      }

      onChoiceIdsChange?.(nextChoiceIds, nextState);
    },
    [autoAdvanceLinearNodes, isControlled, onChoiceIdsChange, story],
  );

  const choose = useCallback(
    (choiceId: string) => {
      const choice = choices.find((candidate) => candidate.id === choiceId && !candidate.disabled);
      if (!choice) return;

      commitChoiceIds([...state.choiceIds, choice.id]);
    },
    [choices, commitChoiceIds, state.choiceIds],
  );

  const goBack = useCallback(() => {
    if (state.choiceIds.length === 0) return;

    commitChoiceIds(state.choiceIds.slice(0, -1));
  }, [commitChoiceIds, state.choiceIds]);

  const restart = useCallback(() => {
    commitChoiceIds([]);
  }, [commitChoiceIds]);

  return {
    ...state,
    choices,
    canGoBack,
    choose,
    goBack,
    restart,
    setChoiceIds: commitChoiceIds,
  };
}
