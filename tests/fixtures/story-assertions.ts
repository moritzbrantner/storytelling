import { expect } from "vitest";

import { getStoryChoices, validateStoryDocument } from "../../src/story-validation";
import { getStoryNodeEntries } from "../../src/story-node-tree";
import type { StoryDocument, StoryNodeData } from "../../src/story-model";

export function expectValidStory<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  expect(validateStoryDocument(story)).toEqual([]);
}

export function countStoryEdges<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  return getStoryNodeEntries(story).reduce(
    (count, entry) => count + getStoryChoices(story, entry.node).length,
    0,
  );
}

export function collectNodeIds<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  return getStoryNodeEntries(story).map((entry) => entry.nodeId);
}

export function cloneStory<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  return structuredClone(story) as StoryDocument<TData>;
}
