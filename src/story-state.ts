import type {
  ResolvedStoryPath,
  StoryDocument,
  StoryHistoryEntry,
  StoryNode,
  StoryNodeData,
  StoryRuntimeState,
  StoryStateHooks,
  StoryStateSnapshot,
  StoryVariables,
} from "./story-model";
import { resolveStoryPath, type ResolveStoryPathOptions } from "./story-path";

export type StoryPathState<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  choiceIds: string[];
  path: ResolvedStoryPath<TData, TVars>;
  history: StoryHistoryEntry<TData, TVars>[];
  currentNode: StoryNode<TData, TVars>;
  completed: boolean;
  state: StoryRuntimeState<TVars>;
  snapshot: StoryStateSnapshot<TData, TVars>;
};

export type CreateStoryPathStateOptions<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = Omit<ResolveStoryPathOptions<TData, TVars>, "choiceIds"> & {
  snapshot?: StoryStateSnapshot<TData, TVars>;
  defaultState?: StoryRuntimeState<TVars>;
  hooks?: StoryStateHooks<TData, TVars>;
  choose?: string;
  /** @deprecated Use snapshot plus choose instead. */
  choiceIds?: string[];
};

export function createStoryPathState<
  TData extends StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
>(
  story: StoryDocument<TData, TVars>,
  options: CreateStoryPathStateOptions<TData, TVars> = {},
): StoryPathState<TData, TVars> {
  const requestedChoiceIds = options.choiceIds ?? [];
  const path = resolveStoryPath(story, {
    ...options,
    choiceIds: requestedChoiceIds,
  });
  const choiceIds =
    options.choiceIds ?? path.history.flatMap((entry) => (entry.choiceId ? [entry.choiceId] : []));

  return {
    choiceIds,
    path,
    history: path.history,
    currentNode: path.currentNode,
    completed: path.completed,
    state: path.state,
    snapshot: path.snapshot,
  };
}

function encodeBase64Url(input: string) {
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(input, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(input)));

  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(input: string) {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  return typeof Buffer !== "undefined"
    ? Buffer.from(padded, "base64").toString("utf8")
    : decodeURIComponent(escape(atob(padded)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRuntimeState(value: unknown): value is StoryRuntimeState {
  if (!isRecord(value)) return false;

  return (
    isRecord(value.variables) &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    Array.isArray(value.inventory) &&
    value.inventory.every((item) => typeof item === "string") &&
    isRecord(value.flags) &&
    Object.values(value.flags).every((item) => typeof item === "boolean")
  );
}

function isStorySnapshot(value: unknown): value is StoryStateSnapshot {
  if (!isRecord(value)) return false;

  return (
    typeof value.nodeId === "string" &&
    Array.isArray(value.history) &&
    value.history.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.nodeId === "string" &&
        (entry.choiceId === undefined || typeof entry.choiceId === "string"),
    ) &&
    isRuntimeState(value.state)
  );
}

export function serializeStorySnapshot(
  snapshot: StoryStateSnapshot | Pick<StoryPathState, "snapshot">,
): string {
  const value = "snapshot" in snapshot ? snapshot.snapshot : snapshot;
  const params = new URLSearchParams();

  params.set("storyState", encodeBase64Url(JSON.stringify(value)));

  return params.toString();
}

export function parseStorySnapshot(input: string): StoryStateSnapshot | undefined {
  try {
    const normalizedInput = input.startsWith("?") ? input.slice(1) : input;
    const params = new URLSearchParams(normalizedInput.includes("=") ? normalizedInput : "");
    const encoded =
      params.get("storyState") ?? (!normalizedInput.includes("=") ? normalizedInput : "");

    if (!encoded) return undefined;

    const parsed = JSON.parse(decodeBase64Url(encoded)) as unknown;

    return isStorySnapshot(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** @deprecated Use serializeStorySnapshot instead. */
export function serializeStoryPath(value: string[] | Pick<StoryPathState, "choiceIds">): string {
  const choiceIds = Array.isArray(value) ? value : value.choiceIds;
  const params = new URLSearchParams();

  for (const choiceId of choiceIds) {
    params.append("choice", choiceId);
  }

  return params.toString();
}

/** @deprecated Use parseStorySnapshot instead. */
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
