import type {
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNode,
  StoryNodeData,
  StoryState,
  StoryStateHooks,
  StoryStatePredicateContext,
  StorySnapshot,
} from "./story-model";
import { getStoryChoices } from "./story-validation";

export function createDefaultStoryState<TState extends StoryState = StoryState>(
  state = {} as TState,
): TState {
  return state;
}

export function cloneStoryState<TState extends StoryState>(state: TState): TState {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }

  return JSON.parse(JSON.stringify(state)) as TState;
}

export function createInitialStoryState<TData extends StoryNodeData, TState extends StoryState>(
  story: StoryDocument<TData, TState>,
  options: {
    defaultState?: TState;
    hooks?: StoryStateHooks<TData, TState>;
  } = {},
) {
  return cloneStoryState(
    options.defaultState ??
      story.initialState ??
      options.hooks?.createInitialState?.(story) ??
      createDefaultStoryState<TState>(),
  );
}

export function createStorySnapshot<TData extends StoryNodeData, TState extends StoryState>(
  nodeId: string,
  history: StoryHistoryEntry<TData, TState>[],
  state: TState,
  stoppedReason?: StorySnapshot<TData, TState>["stoppedReason"],
): StorySnapshot<TData, TState> {
  return {
    nodeId,
    history,
    state: cloneStoryState(state),
    stoppedReason,
  };
}

function createPredicateContext<TData extends StoryNodeData, TState extends StoryState>(
  story: StoryDocument<TData, TState>,
  node: StoryNode<TData, TState>,
  history: StoryHistoryEntry<TData, TState>[],
  state: TState,
  choice?: StoryChoice<TData, TState>,
): StoryStatePredicateContext<TData, TState> {
  return {
    story,
    node,
    choice,
    history,
    state,
  };
}

export function isStoryChoiceVisible<TData extends StoryNodeData, TState extends StoryState>(
  story: StoryDocument<TData, TState>,
  node: StoryNode<TData, TState>,
  choice: StoryChoice<TData, TState>,
  history: StoryHistoryEntry<TData, TState>[],
  state: TState,
  hooks?: StoryStateHooks<TData, TState>,
) {
  if (choice.hidden) return false;

  const context = createPredicateContext(story, node, history, state, choice);
  if (hooks?.isChoiceVisible?.(context) === false) return false;

  return true;
}

export function isStoryChoiceEnabled<TData extends StoryNodeData, TState extends StoryState>(
  story: StoryDocument<TData, TState>,
  node: StoryNode<TData, TState>,
  choice: StoryChoice<TData, TState>,
  history: StoryHistoryEntry<TData, TState>[],
  state: TState,
  hooks?: StoryStateHooks<TData, TState>,
) {
  if (choice.disabled) return false;

  const context = createPredicateContext(story, node, history, state, choice);
  if (hooks?.isChoiceEnabled?.(context) === false) return false;

  return true;
}

export function getVisibleStoryChoices<TData extends StoryNodeData, TState extends StoryState>(
  story: StoryDocument<TData, TState>,
  node: StoryNode<TData, TState>,
  history: StoryHistoryEntry<TData, TState>[],
  state: TState,
  hooks?: StoryStateHooks<TData, TState>,
) {
  return getStoryChoices(story, node).filter((choice) =>
    isStoryChoiceVisible(story, node, choice, history, state, hooks),
  );
}

export function getSelectableStoryChoices<TData extends StoryNodeData, TState extends StoryState>(
  story: StoryDocument<TData, TState>,
  node: StoryNode<TData, TState>,
  history: StoryHistoryEntry<TData, TState>[],
  state: TState,
  hooks?: StoryStateHooks<TData, TState>,
) {
  return getVisibleStoryChoices(story, node, history, state, hooks).filter((choice) =>
    isStoryChoiceEnabled(story, node, choice, history, state, hooks),
  );
}

export function applyStoryChoiceState<TData extends StoryNodeData, TState extends StoryState>(
  story: StoryDocument<TData, TState>,
  node: StoryNode<TData, TState>,
  choice: StoryChoice<TData, TState>,
  history: StoryHistoryEntry<TData, TState>[],
  state: TState,
  hooks?: StoryStateHooks<TData, TState>,
) {
  if (!hooks?.applyChoice) {
    return state;
  }

  const previousState = cloneStoryState(state);
  const hookContext = {
    ...createPredicateContext(story, node, history, state, choice),
    previousState,
  };

  return hooks.applyChoice(hookContext);
}

export function applyStoryNodeState<TData extends StoryNodeData, TState extends StoryState>(
  story: StoryDocument<TData, TState>,
  node: StoryNode<TData, TState>,
  history: StoryHistoryEntry<TData, TState>[],
  state: TState,
  hooks?: StoryStateHooks<TData, TState>,
) {
  if (!hooks?.applyNode) {
    return state;
  }

  const previousState = cloneStoryState(state);
  const context = {
    ...createPredicateContext(story, node, history, state),
    previousState,
  };

  return hooks.applyNode(context);
}

export function canEnterStoryNode<TData extends StoryNodeData, TState extends StoryState>(
  story: StoryDocument<TData, TState>,
  node: StoryNode<TData, TState>,
  history: StoryHistoryEntry<TData, TState>[],
  state: TState,
  hooks?: StoryStateHooks<TData, TState>,
) {
  const context = createPredicateContext(story, node, history, state);
  if (hooks?.canEnterNode?.(context) === false) return false;

  return true;
}
