import type { StoryChoice, StoryDocument, StoryNode, StoryNodeData } from "./story-model";

const isDevelopment = process.env.NODE_ENV !== "production";

export type StoryValidationIssueCode =
  | "empty-story-id"
  | "empty-story-title"
  | "empty-node-list"
  | "empty-opening-node-id"
  | "missing-opening-node"
  | "empty-node-id"
  | "duplicate-node-id"
  | "empty-node-title"
  | "empty-choice-id"
  | "duplicate-choice-id"
  | "empty-choice-label"
  | "missing-choice-target"
  | "missing-next-target"
  | "story-cycle";

export type StoryValidationIssue = {
  code: StoryValidationIssueCode;
  message: string;
  path: string;
  storyId?: string;
  nodeId?: string;
  choiceId?: string;
  target?: string;
  trail?: string[];
};

export class StoryValidationError extends Error {
  readonly issues: StoryValidationIssue[];

  constructor(issues: StoryValidationIssue[]) {
    super(issues[0]?.message ?? "Story document is invalid.");
    this.name = "StoryValidationError";
    this.issues = issues;
  }
}

function getStoryId<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  return story.id || "(unknown)";
}

function addIssue(
  issues: StoryValidationIssue[],
  issue: Omit<StoryValidationIssue, "storyId"> & { storyId?: string },
) {
  issues.push(issue);
}

export function createStoryNodeLookup<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  return new Map(story.nodes.map((node) => [node.id, node] as const));
}

export function getStoryNode<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  nodeId: string,
) {
  const node = createStoryNodeLookup(story).get(nodeId);

  if (!node) {
    throw new Error(`Story "${story.id}" does not contain node "${nodeId}".`);
  }

  return node;
}

export function getStoryChoices<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  node: StoryNode<TData>,
): StoryChoice[] {
  if (node.choices && node.choices.length > 0) {
    return node.choices;
  }

  if (!node.next) {
    return [];
  }

  return [
    {
      id: `${node.id}__continue`,
      label: story.labels?.continue ?? "Continue",
      target: node.next,
    },
  ];
}

export function isStoryEnding<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  node: StoryNode<TData>,
) {
  return getStoryChoices(story, node).length === 0;
}

export function validateStoryDocument<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  const issues: StoryValidationIssue[] = [];
  const storyId = getStoryId(story);

  if (story.id.length === 0) {
    addIssue(issues, {
      code: "empty-story-id",
      message: "Story id must be non-empty.",
      path: "id",
    });
  }

  if (story.title.length === 0) {
    addIssue(issues, {
      code: "empty-story-title",
      message: `Story "${storyId}" must have a title.`,
      path: "title",
      storyId,
    });
  }

  if (story.openingNodeId.length === 0) {
    addIssue(issues, {
      code: "empty-opening-node-id",
      message: `Story "${storyId}" must declare a non-empty opening node id.`,
      path: "openingNodeId",
      storyId,
    });
  }

  if (story.nodes.length === 0) {
    addIssue(issues, {
      code: "empty-node-list",
      message: `Story "${storyId}" must declare at least one node.`,
      path: "nodes",
      storyId,
    });
  }

  const nodeIds = new Set<string>();

  story.nodes.forEach((node, nodeIndex) => {
    const nodePath = `nodes.${nodeIndex}`;

    if (node.id.length === 0) {
      addIssue(issues, {
        code: "empty-node-id",
        message: "Story nodes must have a non-empty id.",
        path: `${nodePath}.id`,
        storyId,
      });
    } else if (nodeIds.has(node.id)) {
      addIssue(issues, {
        code: "duplicate-node-id",
        message: `Story node ids must be unique. Duplicate id "${node.id}" found.`,
        path: `${nodePath}.id`,
        storyId,
        nodeId: node.id,
      });
    } else {
      nodeIds.add(node.id);
    }

    if (node.title.length === 0) {
      addIssue(issues, {
        code: "empty-node-title",
        message: `Story node "${node.id}" must have a title.`,
        path: `${nodePath}.title`,
        storyId,
        nodeId: node.id,
      });
    }

    const choiceIds = new Set<string>();
    for (const [choiceIndex, choice] of (node.choices ?? []).entries()) {
      const choicePath = `${nodePath}.choices.${choiceIndex}`;

      if (choice.id.length === 0) {
        addIssue(issues, {
          code: "empty-choice-id",
          message: `Choice ids must be non-empty on node "${node.id}".`,
          path: `${choicePath}.id`,
          storyId,
          nodeId: node.id,
        });
      } else if (choiceIds.has(choice.id)) {
        addIssue(issues, {
          code: "duplicate-choice-id",
          message: `Choice ids must be unique per node. Duplicate choice "${choice.id}" found on "${node.id}".`,
          path: `${choicePath}.id`,
          storyId,
          nodeId: node.id,
          choiceId: choice.id,
        });
      } else {
        choiceIds.add(choice.id);
      }

      if (choice.label.length === 0) {
        addIssue(issues, {
          code: "empty-choice-label",
          message: `Choice "${choice.id}" on "${node.id}" must have a label.`,
          path: `${choicePath}.label`,
          storyId,
          nodeId: node.id,
          choiceId: choice.id,
        });
      }
    }
  });

  if (!nodeIds.has(story.openingNodeId)) {
    addIssue(issues, {
      code: "missing-opening-node",
      message: `Story "${storyId}" references missing opening node "${story.openingNodeId}".`,
      path: "openingNodeId",
      storyId,
      target: story.openingNodeId,
    });
  }

  story.nodes.forEach((node, nodeIndex) => {
    for (const [choiceIndex, choice] of (node.choices ?? []).entries()) {
      if (!nodeIds.has(choice.target)) {
        addIssue(issues, {
          code: "missing-choice-target",
          message: `Choice "${choice.id}" on "${node.id}" points to missing node "${choice.target}".`,
          path: `nodes.${nodeIndex}.choices.${choiceIndex}.target`,
          storyId,
          nodeId: node.id,
          choiceId: choice.id,
          target: choice.target,
        });
      }
    }

    if (node.next && !nodeIds.has(node.next)) {
      addIssue(issues, {
        code: "missing-next-target",
        message: `Node "${node.id}" points to missing next node "${node.next}".`,
        path: `nodes.${nodeIndex}.next`,
        storyId,
        nodeId: node.id,
        target: node.next,
      });
    }
  });

  collectStoryGraphCycles(story, issues);

  return issues;
}

export function assertStoryDocument<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  const issues = validateStoryDocument(story);

  if (issues.length > 0) {
    throw new StoryValidationError(issues);
  }

  return story;
}

export function validateStory<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  return assertStoryDocument(story);
}

export function defineStory<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  return validateStory(story);
}

function collectStoryGraphCycles<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  issues: StoryValidationIssue[],
) {
  const nodeLookup = createStoryNodeLookup(story);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleKeys = new Set<string>();

  const visit = (nodeId: string, trail: string[]) => {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      const cycleTrail = [...trail, nodeId];
      const cycleKey = cycleTrail.join(" -> ");

      if (!cycleKeys.has(cycleKey)) {
        cycleKeys.add(cycleKey);
        addIssue(issues, {
          code: "story-cycle",
          message: `Story "${getStoryId(story)}" contains a cycle: ${cycleKey}.`,
          path: "nodes",
          storyId: getStoryId(story),
          nodeId,
          trail: cycleTrail,
        });
      }

      return;
    }

    const node = nodeLookup.get(nodeId);
    if (!node) {
      visited.add(nodeId);
      return;
    }

    visiting.add(nodeId);

    for (const choice of node.choices ?? []) {
      visit(choice.target, [...trail, nodeId]);
    }

    if (node.next) {
      visit(node.next, [...trail, nodeId]);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const node of story.nodes) {
    visit(node.id, []);
  }
}

export function maybeValidateStory<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  if (isDevelopment) {
    assertStoryDocument(story);
  }

  return story;
}
