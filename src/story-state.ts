import type {
  ResolvedStoryPath,
  StoryDocument,
  StoryHistoryEntry,
  StoryNode,
  StoryNodeData,
} from "./story-model";
import { resolveStoryPath, type ResolveStoryPathOptions } from "./story-path";

export type StoryPathState<TData extends StoryNodeData = StoryNodeData> = {
  choiceIds: string[];
  path: ResolvedStoryPath<TData>;
  history: StoryHistoryEntry<TData>[];
  currentNode: StoryNode<TData>;
  completed: boolean;
};

export type CreateStoryPathStateOptions = Omit<ResolveStoryPathOptions, "choiceIds"> & {
  choiceIds?: string[];
};

export function createStoryPathState<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: CreateStoryPathStateOptions = {},
): StoryPathState<TData> {
  const choiceIds = options.choiceIds ?? [];
  const path = resolveStoryPath(story, {
    ...options,
    choiceIds,
  });

  return {
    choiceIds,
    path,
    history: path.history,
    currentNode: path.currentNode,
    completed: path.completed,
  };
}

export function serializeStoryPath(value: string[] | Pick<StoryPathState, "choiceIds">): string {
  const choiceIds = Array.isArray(value) ? value : value.choiceIds;
  const params = new URLSearchParams();

  for (const choiceId of choiceIds) {
    params.append("choice", choiceId);
  }

  return params.toString();
}

export function parseStoryPath(input: string): string[] {
  const normalizedInput = input.startsWith("?") ? input.slice(1) : input;

  if (!normalizedInput) {
    return [];
  }

  const params = new URLSearchParams(normalizedInput);
  const repeatedChoiceIds = params.getAll("choice");

  if (repeatedChoiceIds.length > 0) {
    return repeatedChoiceIds;
  }

  const legacyChoiceIds = params.get("choices");

  if (legacyChoiceIds) {
    return legacyChoiceIds
      .split(",")
      .map((choiceId) => choiceId.trim())
      .filter(Boolean);
  }

  if (!normalizedInput.includes("=")) {
    return normalizedInput
      .split(",")
      .map((choiceId) => decodeURIComponent(choiceId.trim()))
      .filter(Boolean);
  }

  return [];
}
