import type {
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNode,
  StoryNodeData,
  StoryRuntimeState,
  StoryStateHooks,
  StoryStatePredicateContext,
  StoryStateSnapshot,
  StoryVariables,
} from "./story-model";
import { getStoryChoices } from "./story-validation";

export function createDefaultStoryRuntimeState<TVars extends StoryVariables = StoryVariables>(
  variables = {} as TVars,
): StoryRuntimeState<TVars> {
  return {
    variables,
    score: 0,
    inventory: [],
    flags: {},
  };
}

export function cloneStoryRuntimeState<TVars extends StoryVariables>(
  state: StoryRuntimeState<TVars>,
): StoryRuntimeState<TVars> {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }

  return JSON.parse(JSON.stringify(state)) as StoryRuntimeState<TVars>;
}

export function createInitialStoryRuntimeState<
  TData extends StoryNodeData,
  TVars extends StoryVariables,
>(
  story: StoryDocument<TData, TVars>,
  options: {
    defaultState?: StoryRuntimeState<TVars>;
    hooks?: StoryStateHooks<TData, TVars>;
  } = {},
) {
  return cloneStoryRuntimeState(
    options.defaultState ??
      story.initialState ??
      options.hooks?.createInitialState?.(story) ??
      createDefaultStoryRuntimeState<TVars>(),
  );
}

export function createStorySnapshot<TData extends StoryNodeData, TVars extends StoryVariables>(
  nodeId: string,
  history: StoryHistoryEntry<TData, TVars>[],
  state: StoryRuntimeState<TVars>,
  stoppedReason?: StoryStateSnapshot<TData, TVars>["stoppedReason"],
): StoryStateSnapshot<TData, TVars> {
  return {
    nodeId,
    history,
    state: cloneStoryRuntimeState(state),
    stoppedReason,
  };
}

function createPredicateContext<TData extends StoryNodeData, TVars extends StoryVariables>(
  story: StoryDocument<TData, TVars>,
  node: StoryNode<TData, TVars>,
  history: StoryHistoryEntry<TData, TVars>[],
  state: StoryRuntimeState<TVars>,
  choice?: StoryChoice<TData, TVars>,
): StoryStatePredicateContext<TData, TVars> {
  return {
    story,
    node,
    choice,
    history,
    state,
  };
}

export function isStoryChoiceVisible<TData extends StoryNodeData, TVars extends StoryVariables>(
  story: StoryDocument<TData, TVars>,
  node: StoryNode<TData, TVars>,
  choice: StoryChoice<TData, TVars>,
  history: StoryHistoryEntry<TData, TVars>[],
  state: StoryRuntimeState<TVars>,
  hooks?: StoryStateHooks<TData, TVars>,
) {
  if (choice.hidden) return false;

  const context = createPredicateContext(story, node, history, state, choice);
  if (choice.isVisible?.(context) === false) return false;
  if (hooks?.isChoiceVisible?.(context) === false) return false;

  return true;
}

export function isStoryChoiceEnabled<TData extends StoryNodeData, TVars extends StoryVariables>(
  story: StoryDocument<TData, TVars>,
  node: StoryNode<TData, TVars>,
  choice: StoryChoice<TData, TVars>,
  history: StoryHistoryEntry<TData, TVars>[],
  state: StoryRuntimeState<TVars>,
  hooks?: StoryStateHooks<TData, TVars>,
) {
  if (choice.disabled) return false;

  const context = createPredicateContext(story, node, history, state, choice);
  if (choice.isEnabled?.(context) === false) return false;
  if (hooks?.isChoiceEnabled?.(context) === false) return false;

  return true;
}

export function getVisibleStoryChoices<TData extends StoryNodeData, TVars extends StoryVariables>(
  story: StoryDocument<TData, TVars>,
  node: StoryNode<TData, TVars>,
  history: StoryHistoryEntry<TData, TVars>[],
  state: StoryRuntimeState<TVars>,
  hooks?: StoryStateHooks<TData, TVars>,
) {
  return getStoryChoices(story, node).filter((choice) =>
    isStoryChoiceVisible(story, node, choice, history, state, hooks),
  );
}

export function getSelectableStoryChoices<
  TData extends StoryNodeData,
  TVars extends StoryVariables,
>(
  story: StoryDocument<TData, TVars>,
  node: StoryNode<TData, TVars>,
  history: StoryHistoryEntry<TData, TVars>[],
  state: StoryRuntimeState<TVars>,
  hooks?: StoryStateHooks<TData, TVars>,
) {
  return getVisibleStoryChoices(story, node, history, state, hooks).filter((choice) =>
    isStoryChoiceEnabled(story, node, choice, history, state, hooks),
  );
}

export function applyStoryChoiceState<TData extends StoryNodeData, TVars extends StoryVariables>(
  story: StoryDocument<TData, TVars>,
  node: StoryNode<TData, TVars>,
  choice: StoryChoice<TData, TVars>,
  history: StoryHistoryEntry<TData, TVars>[],
  state: StoryRuntimeState<TVars>,
  hooks?: StoryStateHooks<TData, TVars>,
) {
  const previousState = cloneStoryRuntimeState(state);
  const context = {
    ...createPredicateContext(story, node, history, state, choice),
    previousState,
  };
  const choiceState = choice.reduceState?.(context) ?? state;
  const hookContext = {
    ...createPredicateContext(story, node, history, choiceState, choice),
    previousState: cloneStoryRuntimeState(choiceState),
  };

  return hooks?.applyChoice?.(hookContext) ?? choiceState;
}

export function applyStoryNodeState<TData extends StoryNodeData, TVars extends StoryVariables>(
  story: StoryDocument<TData, TVars>,
  node: StoryNode<TData, TVars>,
  history: StoryHistoryEntry<TData, TVars>[],
  state: StoryRuntimeState<TVars>,
  hooks?: StoryStateHooks<TData, TVars>,
) {
  const previousState = cloneStoryRuntimeState(state);
  const context = {
    ...createPredicateContext(story, node, history, state),
    previousState,
  };
  const nodeState = node.reduceState?.(context) ?? state;
  const hookContext = {
    ...createPredicateContext(story, node, history, nodeState),
    previousState: cloneStoryRuntimeState(nodeState),
  };

  return hooks?.applyNode?.(hookContext) ?? nodeState;
}

export function canEnterStoryNode<TData extends StoryNodeData, TVars extends StoryVariables>(
  story: StoryDocument<TData, TVars>,
  node: StoryNode<TData, TVars>,
  history: StoryHistoryEntry<TData, TVars>[],
  state: StoryRuntimeState<TVars>,
  hooks?: StoryStateHooks<TData, TVars>,
) {
  const context = createPredicateContext(story, node, history, state);
  if (node.canEnter?.(context) === false) return false;
  if (hooks?.canEnterNode?.(context) === false) return false;

  return true;
}
