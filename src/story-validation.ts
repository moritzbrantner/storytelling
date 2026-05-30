import type { StoryChoice, StoryDocument, StoryNode, StoryNodeData } from "./story-model";
import {
  createStoryNodeLookup as createTreeStoryNodeLookup,
  getImplicitStoryContinuationTarget,
  getStoryNodeEntries,
} from "./story-node-tree";

const isDevelopment = process.env.NODE_ENV !== "production";

export type StoryValidationIssueCode =
  | "empty-story-id"
  | "blank-story-id"
  | "empty-story-title"
  | "blank-story-title"
  | "empty-node-list"
  | "empty-opening-node-id"
  | "missing-opening-node"
  | "empty-node-id"
  | "blank-node-id"
  | "invalid-node-id"
  | "duplicate-node-id"
  | "empty-node-title"
  | "blank-node-title"
  | "empty-choice-id"
  | "blank-choice-id"
  | "invalid-choice-id"
  | "duplicate-choice-id"
  | "empty-choice-label"
  | "blank-choice-label"
  | "blank-choice-description"
  | "blank-choice-target"
  | "node-has-next-and-choices"
  | "invalid-node-duration"
  | "invalid-node-scroll-units"
  | "invalid-transition-duration"
  | "invalid-content-block"
  | "missing-choice-target"
  | "missing-next-target"
  | "story-cycle";

export type StoryValidationMode = "compat" | "strict";

export type StoryValidationOptions = {
  mode?: StoryValidationMode;
};

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

const STRICT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function isStrictMode(options: StoryValidationOptions | undefined) {
  return options?.mode === "strict";
}

function isBlankString(value: string) {
  return value.length > 0 && value.trim().length === 0;
}

function isStrictId(value: string) {
  return STRICT_ID_PATTERN.test(value);
}

function isValidFrameDuration(value: number | undefined, min: number) {
  return value === undefined || (Number.isFinite(value) && Number.isInteger(value) && value >= min);
}

function isValidContentBlock(block: unknown) {
  if (!block || typeof block !== "object") {
    return false;
  }

  const record = block as Record<string, unknown>;

  switch (record.type) {
    case "paragraph":
    case "heading":
    case "quote":
      return typeof record.text === "string";
    case "list":
      return Array.isArray(record.items) && record.items.every((item) => typeof item === "string");
    case "image":
      return typeof record.src === "string" && typeof record.alt === "string";
    case "audio":
    case "video":
      return typeof record.src === "string";
    default:
      return false;
  }
}

export function createStoryNodeLookup<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  return createTreeStoryNodeLookup(story);
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

  const target = getImplicitStoryContinuationTarget(story, node);

  if (!target) {
    return [];
  }

  return [
    {
      id: `${node.id}__continue`,
      label: story.labels?.continue ?? "Continue",
      target,
    },
  ];
}

export function isStoryEnding<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  node: StoryNode<TData>,
) {
  return getStoryChoices(story, node).length === 0;
}

export function validateStoryDocument<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: StoryValidationOptions = {},
) {
  const issues: StoryValidationIssue[] = [];
  const storyId = getStoryId(story);
  const strict = isStrictMode(options);

  if (story.id.length === 0) {
    addIssue(issues, {
      code: "empty-story-id",
      message: "Story id must be non-empty.",
      path: "id",
    });
  } else if (strict && isBlankString(story.id)) {
    addIssue(issues, {
      code: "blank-story-id",
      message: "Story id must not be blank.",
      path: "id",
      storyId,
    });
  }

  if (story.title.length === 0) {
    addIssue(issues, {
      code: "empty-story-title",
      message: `Story "${storyId}" must have a title.`,
      path: "title",
      storyId,
    });
  } else if (strict && isBlankString(story.title)) {
    addIssue(issues, {
      code: "blank-story-title",
      message: `Story "${storyId}" title must not be blank.`,
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

  const nodeEntries = getStoryNodeEntries(story);
  const nodeIds = new Set<string>();

  nodeEntries.forEach(({ node, path: nodePath }) => {
    if (node.id.length === 0) {
      addIssue(issues, {
        code: "empty-node-id",
        message: "Story nodes must have a non-empty id.",
        path: `${nodePath}.id`,
        storyId,
      });
    } else if (strict && isBlankString(node.id)) {
      addIssue(issues, {
        code: "blank-node-id",
        message: "Story node ids must not be blank.",
        path: `${nodePath}.id`,
        storyId,
        nodeId: node.id,
      });
    } else if (strict && !isStrictId(node.id)) {
      addIssue(issues, {
        code: "invalid-node-id",
        message: `Story node id "${node.id}" must match ${STRICT_ID_PATTERN}.`,
        path: `${nodePath}.id`,
        storyId,
        nodeId: node.id,
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
    } else if (strict && isBlankString(node.title)) {
      addIssue(issues, {
        code: "blank-node-title",
        message: `Story node "${node.id}" title must not be blank.`,
        path: `${nodePath}.title`,
        storyId,
        nodeId: node.id,
      });
    }

    if (strict && node.next && (node.choices?.length ?? 0) > 0) {
      addIssue(issues, {
        code: "node-has-next-and-choices",
        message: `Story node "${node.id}" must not declare both next and choices.`,
        path: nodePath,
        storyId,
        nodeId: node.id,
      });
    }

    if (strict && !isValidFrameDuration(node.durationInFrames, 1)) {
      addIssue(issues, {
        code: "invalid-node-duration",
        message: `Story node "${node.id}" durationInFrames must be a finite integer greater than or equal to 1.`,
        path: `${nodePath}.durationInFrames`,
        storyId,
        nodeId: node.id,
      });
    }

    if (
      strict &&
      node.scrollUnits !== undefined &&
      (!Number.isFinite(node.scrollUnits) || node.scrollUnits <= 0)
    ) {
      addIssue(issues, {
        code: "invalid-node-scroll-units",
        message: `Story node "${node.id}" scrollUnits must be finite and greater than 0.`,
        path: `${nodePath}.scrollUnits`,
        storyId,
        nodeId: node.id,
      });
    }

    if (strict && !isValidFrameDuration(node.transition?.durationInFrames, 0)) {
      addIssue(issues, {
        code: "invalid-transition-duration",
        message: `Story node "${node.id}" transition durationInFrames must be a finite integer greater than or equal to 0.`,
        path: `${nodePath}.transition.durationInFrames`,
        storyId,
        nodeId: node.id,
      });
    }

    if (strict) {
      for (const [contentIndex, block] of (node.content ?? []).entries()) {
        if (!isValidContentBlock(block)) {
          addIssue(issues, {
            code: "invalid-content-block",
            message: `Story node "${node.id}" has an invalid content block.`,
            path: `${nodePath}.content.${contentIndex}`,
            storyId,
            nodeId: node.id,
          });
        }
      }
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
      } else if (strict && isBlankString(choice.id)) {
        addIssue(issues, {
          code: "blank-choice-id",
          message: `Choice ids must not be blank on node "${node.id}".`,
          path: `${choicePath}.id`,
          storyId,
          nodeId: node.id,
          choiceId: choice.id,
        });
      } else if (strict && !isStrictId(choice.id)) {
        addIssue(issues, {
          code: "invalid-choice-id",
          message: `Choice id "${choice.id}" on "${node.id}" must match ${STRICT_ID_PATTERN}.`,
          path: `${choicePath}.id`,
          storyId,
          nodeId: node.id,
          choiceId: choice.id,
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
      } else if (strict && isBlankString(choice.label)) {
        addIssue(issues, {
          code: "blank-choice-label",
          message: `Choice "${choice.id}" on "${node.id}" label must not be blank.`,
          path: `${choicePath}.label`,
          storyId,
          nodeId: node.id,
          choiceId: choice.id,
        });
      }

      if (strict && isBlankString(choice.target)) {
        addIssue(issues, {
          code: "blank-choice-target",
          message: `Choice "${choice.id}" on "${node.id}" target must not be blank.`,
          path: `${choicePath}.target`,
          storyId,
          nodeId: node.id,
          choiceId: choice.id,
          target: choice.target,
        });
      }

      if (strict && choice.description !== undefined && isBlankString(choice.description)) {
        addIssue(issues, {
          code: "blank-choice-description",
          message: `Choice "${choice.id}" on "${node.id}" description must not be blank.`,
          path: `${choicePath}.description`,
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

  nodeEntries.forEach(({ node, path: nodePath }) => {
    for (const [choiceIndex, choice] of (node.choices ?? []).entries()) {
      if (!nodeIds.has(choice.target)) {
        addIssue(issues, {
          code: "missing-choice-target",
          message: `Choice "${choice.id}" on "${node.id}" points to missing node "${choice.target}".`,
          path: `${nodePath}.choices.${choiceIndex}.target`,
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
        path: `${nodePath}.next`,
        storyId,
        nodeId: node.id,
        target: node.next,
      });
    }
  });

  collectStoryGraphCycles(story, issues);

  return issues;
}

export function assertStoryDocument<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: StoryValidationOptions = {},
) {
  const issues = validateStoryDocument(story, options);

  if (issues.length > 0) {
    throw new StoryValidationError(issues);
  }

  return story;
}

export function validateStory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: StoryValidationOptions = {},
) {
  return assertStoryDocument(story, options);
}

export function defineStory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: StoryValidationOptions = {},
) {
  return validateStory(story, options);
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

    for (const choice of getStoryChoices(story, node)) {
      visit(choice.target, [...trail, nodeId]);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const { node } of getStoryNodeEntries(story)) {
    visit(node.id, []);
  }
}

export function maybeValidateStory<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  if (isDevelopment) {
    assertStoryDocument(story);
  }

  return story;
}
