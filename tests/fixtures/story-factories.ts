import type { StoryDocument, StoryNode, StoryNodeData } from "../../src/story-model";

export type FixtureData = {
  index: number;
  group?: string;
};

function contentFor(id: string) {
  return [{ type: "paragraph" as const, text: `Content for ${id}.` }];
}

function nodeFor(id: string, index: number, fields: Partial<StoryNode<FixtureData>> = {}) {
  return {
    id,
    title: `Node ${id}`,
    content: contentFor(id),
    data: { index },
    ...fields,
  } satisfies StoryNode<FixtureData>;
}

export function createLinearStory({ count }: { count: number }): StoryDocument<FixtureData> {
  const safeCount = Math.max(1, Math.floor(count));

  return {
    id: `linear-${safeCount}`,
    title: `Linear ${safeCount}`,
    openingNodeId: "node-0",
    nodes: Array.from({ length: safeCount }, (_, index) =>
      nodeFor(
        `node-${index}`,
        index,
        index < safeCount - 1 ? { next: `node-${index + 1}` } : undefined,
      ),
    ),
  };
}

export function createBranchingStory({
  depth,
  fanout,
  includeDisabledChoices = false,
}: {
  depth: number;
  fanout: number;
  includeDisabledChoices?: boolean;
}): StoryDocument<FixtureData> {
  const nodes: Array<StoryNode<FixtureData>> = [];
  let index = 0;
  const safeDepth = Math.max(0, Math.floor(depth));
  const safeFanout = Math.max(1, Math.floor(fanout));

  function addNode(id: string, level: number) {
    const currentIndex = index;
    index += 1;

    if (level >= safeDepth) {
      nodes.push(nodeFor(id, currentIndex, { data: { index: currentIndex, group: "ending" } }));
      return;
    }

    const choices = Array.from({ length: safeFanout }, (_, choiceIndex) => ({
      id: `choice-${level}-${choiceIndex}`,
      label: `Choice ${level}.${choiceIndex}`,
      target: `${id}-${choiceIndex}`,
      disabled: includeDisabledChoices && choiceIndex === safeFanout - 1,
    }));

    nodes.push(
      nodeFor(id, currentIndex, { choices, data: { index: currentIndex, group: "branch" } }),
    );

    for (let choiceIndex = 0; choiceIndex < safeFanout; choiceIndex += 1) {
      addNode(`${id}-${choiceIndex}`, level + 1);
    }
  }

  addNode("root", 0);

  return {
    id: `branch-${safeDepth}-${safeFanout}`,
    title: `Branch ${safeDepth} x ${safeFanout}`,
    openingNodeId: "root",
    nodes,
  };
}

function createNestedChildren({
  parentId,
  depth,
  breadth,
  startIndex,
}: {
  parentId: string;
  depth: number;
  breadth: number;
  startIndex: number;
}): { nodes: Array<StoryNode<FixtureData>>; nextIndex: number } {
  let index = startIndex;

  if (depth <= 0) {
    return { nodes: [], nextIndex: index };
  }

  const nodes = Array.from({ length: breadth }, (_, childIndex) => {
    const id = `${parentId}-${childIndex}`;
    const currentIndex = index;
    index += 1;
    const childResult = createNestedChildren({
      parentId: id,
      depth: depth - 1,
      breadth,
      startIndex: index,
    });

    index = childResult.nextIndex;

    return nodeFor(id, currentIndex, {
      children: childResult.nodes.length > 0 ? childResult.nodes : undefined,
      data: { index: currentIndex, group: "nested" },
    });
  });

  return { nodes, nextIndex: index };
}

export function createNestedStory({
  depth,
  breadth,
}: {
  depth: number;
  breadth: number;
}): StoryDocument<FixtureData> {
  const safeDepth = Math.max(1, Math.floor(depth));
  const safeBreadth = Math.max(1, Math.floor(breadth));
  const children = createNestedChildren({
    parentId: "chapter",
    depth: safeDepth,
    breadth: safeBreadth,
    startIndex: 1,
  }).nodes;

  return {
    id: `nested-${safeDepth}-${safeBreadth}`,
    title: `Nested ${safeDepth} x ${safeBreadth}`,
    openingNodeId: "chapter",
    nodes: [
      nodeFor("chapter", 0, {
        next: "ending",
        children,
        data: { index: 0, group: "chapter" },
      }),
      nodeFor("ending", 10_000, { data: { index: 10_000, group: "ending" } }),
    ],
  };
}

export function createDraftStory({
  count,
  unreachableRatio,
  disabledRatio,
}: {
  count: number;
  unreachableRatio: number;
  disabledRatio: number;
}): StoryDocument<FixtureData> {
  const safeCount = Math.max(3, Math.floor(count));
  const reachableCount = Math.max(2, Math.floor(safeCount * (1 - unreachableRatio)));
  const disabledStart = Math.floor(reachableCount * (1 - disabledRatio));
  const nodes: Array<StoryNode<FixtureData>> = [];

  for (let index = 0; index < safeCount; index += 1) {
    const reachable = index < reachableCount;
    const isLastReachable = index === reachableCount - 1;
    const id = reachable ? `node-${index}` : `unreachable-${index}`;

    nodes.push(
      nodeFor(id, index, {
        content: index % 4 === 0 ? undefined : contentFor(id),
        next: reachable && !isLastReachable ? `node-${index + 1}` : undefined,
        choices:
          reachable && index >= disabledStart && !isLastReachable
            ? [
                {
                  id: `disabled-${index}`,
                  label: `Disabled ${index}`,
                  target: `node-${index + 1}`,
                  disabled: true,
                },
              ]
            : undefined,
      }),
    );
  }

  return {
    id: `draft-${safeCount}`,
    title: `Draft ${safeCount}`,
    openingNodeId: "node-0",
    nodes,
  };
}

export function createInvalidStoryCase(
  kind:
    | "cycle"
    | "duplicate-nested-id"
    | "next-and-choices"
    | "missing-target"
    | "blank-strict-field",
): StoryDocument<StoryNodeData> {
  switch (kind) {
    case "cycle":
      return {
        id: "cycle",
        title: "Cycle",
        openingNodeId: "a",
        nodes: [
          { id: "a", title: "A", next: "b" },
          { id: "b", title: "B", next: "a" },
        ],
      };
    case "duplicate-nested-id":
      return {
        id: "duplicate",
        title: "Duplicate",
        openingNodeId: "parent",
        nodes: [
          {
            id: "parent",
            title: "Parent",
            children: [{ id: "duplicate-child", title: "Nested" }],
          },
          { id: "duplicate-child", title: "Top-level duplicate" },
        ],
      };
    case "next-and-choices":
      return {
        id: "mixed",
        title: "Mixed",
        openingNodeId: "start",
        nodes: [
          {
            id: "start",
            title: "Start",
            next: "end",
            choices: [{ id: "go", label: "Go", target: "end" }],
          },
          { id: "end", title: "End" },
        ],
      };
    case "missing-target":
      return {
        id: "missing",
        title: "Missing",
        openingNodeId: "start",
        nodes: [{ id: "start", title: "Start", choices: [{ id: "go", label: "Go", target: "x" }] }],
      };
    case "blank-strict-field":
      return {
        id: " ",
        title: " ",
        openingNodeId: "start",
        nodes: [
          { id: "start", title: " ", choices: [{ id: "go now", label: " ", target: "end" }] },
        ],
      };
  }
}
