import type {
  ResolvedStoryPath,
  StoryDocument,
  StoryHistoryEntry,
  StoryNode,
  StoryNodeData,
  StoryState,
  StoryStateHooks,
  StorySnapshot,
} from "./story-model";
import { resolveStoryPath, type ResolveStoryPathOptions } from "./story-path";

export type StoryPathState<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  path: ResolvedStoryPath<TData, TState>;
  history: StoryHistoryEntry<TData, TState>[];
  currentNode: StoryNode<TData, TState>;
  completed: boolean;
  state: TState;
  snapshot: StorySnapshot<TData, TState>;
};

export type CreateStoryPathStateOptions<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = ResolveStoryPathOptions<TData, TState> & {
  snapshot?: StorySnapshot<TData, TState>;
  defaultState?: TState;
  hooks?: StoryStateHooks<TData, TState>;
  choose?: string;
  routeChoiceIds?: string[];
};

export function createStoryPathState<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(
  story: StoryDocument<TData, TState>,
  options: CreateStoryPathStateOptions<TData, TState> = {},
): StoryPathState<TData, TState> {
  const path = resolveStoryPath(story, options);

  return {
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

function isJsonValue(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);

  return false;
}

function isStoryState(value: unknown): value is StoryState {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isStorySnapshot(value: unknown): value is StorySnapshot {
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
    isStoryState(value.state)
  );
}

export function serializeStorySnapshot(
  snapshot: StorySnapshot | Pick<StoryPathState, "snapshot">,
): string {
  const value = "snapshot" in snapshot ? snapshot.snapshot : snapshot;
  const params = new URLSearchParams();

  params.set("storyState", encodeBase64Url(JSON.stringify(value)));

  return params.toString();
}

export function parseStorySnapshot(input: string): StorySnapshot | undefined {
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
