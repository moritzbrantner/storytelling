import type { StoryChoice, StoryDocument, StoryNode, StoryNodeData } from "./story-model";
import type { StoryPatch } from "./story-edit";
import {
  compileStory,
  enumerateStoryPaths,
  getStoryBranches,
  getStoryEndings,
} from "./story-graph";
import {
  createStoryNodeLookup,
  getStoryChoices,
  validateStoryDocument,
  type StoryValidationIssue,
  type StoryValidationIssueCode,
  type StoryValidationMode,
} from "./story-validation";
import { getStoryNodeEntries, getStoryNodes } from "./story-node-tree";

export type StoryAuthoringSeverity = "info" | "warning" | "error";

export type StoryAuthoringIssueCode =
  | StoryValidationIssueCode
  | "unreachable-node"
  | "orphan-ending"
  | "empty-content"
  | "missing-choice-description"
  | "disabled-only-branch"
  | "path-limit-reached";

export type StoryAuthoringIssue = {
  code: StoryAuthoringIssueCode;
  severity: StoryAuthoringSeverity;
  message: string;
  path: string;
  nodeId?: string;
  choiceId?: string;
  target?: string;
  fixes?: StoryIssueFix[];
};

export type StoryIssueFix<TData extends StoryNodeData = StoryNodeData> = {
  label: string;
  patch: StoryPatch<TData> | StoryPatch<TData>[];
};

export type StoryAuthoringMetrics = {
  nodeCount: number;
  edgeCount: number;
  branchCount: number;
  endingCount: number;
  reachableNodeCount: number;
  unreachableNodeCount: number;
  pathCount: number;
  maxDepth: number;
  minDepth: number;
  contentBlockCount: number;
  mediaBlockCount: number;
  estimatedReadingMinutes: number;
};

export type AnalyzeStoryOptions = {
  maxPaths?: number;
  wordsPerMinute?: number;
  requireChoiceDescriptions?: boolean;
  validationMode?: StoryValidationMode;
  includeFixes?: boolean;
};

export type StoryAuthoringReport<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  valid: boolean;
  metrics: StoryAuthoringMetrics;
  issues: StoryAuthoringIssue[];
  reachableNodeIds: string[];
  unreachableNodeIds: string[];
  endings: StoryNode<TData>[];
  branches: StoryNode<TData>[];
};

const DEFAULT_MAX_PATHS = 1000;
const DEFAULT_WORDS_PER_MINUTE = 220;

function getIssueKey(issue: Pick<StoryValidationIssue, "code" | "path" | "nodeId" | "choiceId">) {
  return [issue.code, issue.path, issue.nodeId ?? "", issue.choiceId ?? ""].join("\0");
}

function mapValidationIssue(issue: StoryValidationIssue, severity: StoryAuthoringSeverity) {
  return {
    code: issue.code,
    severity,
    message: issue.message,
    path: issue.path,
    nodeId: issue.nodeId,
    choiceId: issue.choiceId,
    target: issue.target,
  } satisfies StoryAuthoringIssue;
}

function getUniqueFallbackId(existingIds: ReadonlySet<string>, prefix: string) {
  for (let index = 1; index < 1000; index += 1) {
    const id = `${prefix}-${index}`;
    if (!existingIds.has(id)) {
      return id;
    }
  }

  return null;
}

function getValidationFixes<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  issue: StoryValidationIssue,
): StoryIssueFix<TData>[] | undefined {
  switch (issue.code) {
    case "blank-story-id":
      return [
        {
          label: 'Set story id to "story"',
          patch: { type: "set-story-fields", fields: { id: "story" } },
        },
      ];
    case "blank-story-title":
      return [
        {
          label: 'Set story title to "Untitled story"',
          patch: { type: "set-story-fields", fields: { title: "Untitled story" } },
        },
      ];
    case "blank-node-title":
      return issue.nodeId
        ? [
            {
              label: 'Set node title to "Untitled node"',
              patch: {
                type: "update-node",
                nodeId: issue.nodeId,
                fields: { title: "Untitled node" },
              },
            },
          ]
        : undefined;
    case "blank-node-id": {
      if (!issue.nodeId) return undefined;

      const storyNodes = getStoryNodes(story);
      const matchingNodes = storyNodes.filter((node) => node.id === issue.nodeId);
      if (matchingNodes.length !== 1) return undefined;

      const existingIds = new Set(storyNodes.map((node) => node.id));
      const nextNodeId = getUniqueFallbackId(existingIds, "node");
      if (!nextNodeId) return undefined;

      return [
        {
          label: `Rename blank node id to "${nextNodeId}"`,
          patch: { type: "rename-node", nodeId: issue.nodeId, nextNodeId },
        },
      ];
    }
    case "blank-choice-id": {
      if (!issue.nodeId || issue.choiceId === undefined) return undefined;

      const node = getStoryNodes(story).find((candidate) => candidate.id === issue.nodeId);
      if (!node) return undefined;

      const matchingChoices = (node.choices ?? []).filter((choice) => choice.id === issue.choiceId);
      if (matchingChoices.length !== 1) return undefined;

      const existingChoiceIds = new Set((node.choices ?? []).map((choice) => choice.id));
      const nextChoiceId = getUniqueFallbackId(existingChoiceIds, "choice");
      if (!nextChoiceId) return undefined;

      return [
        {
          label: `Rename blank choice id to "${nextChoiceId}"`,
          patch: {
            type: "update-choice",
            nodeId: issue.nodeId,
            choiceId: issue.choiceId,
            fields: { id: nextChoiceId },
          },
        },
      ];
    }
    case "blank-choice-label":
      return issue.nodeId && issue.choiceId !== undefined
        ? [
            {
              label: 'Set choice label to "Untitled choice"',
              patch: {
                type: "update-choice",
                nodeId: issue.nodeId,
                choiceId: issue.choiceId,
                fields: { label: "Untitled choice" },
              },
            },
          ]
        : undefined;
    case "blank-choice-description":
      return issue.nodeId && issue.choiceId !== undefined
        ? [
            {
              label: "Remove blank choice description",
              patch: {
                type: "update-choice",
                nodeId: issue.nodeId,
                choiceId: issue.choiceId,
                fields: { description: undefined },
              },
            },
          ]
        : undefined;
    default:
      return undefined;
  }
}

function withFixes<TData extends StoryNodeData>(
  issue: StoryAuthoringIssue,
  fixes: StoryIssueFix<TData>[] | undefined,
) {
  return fixes && fixes.length > 0 ? { ...issue, fixes } : issue;
}

function getChoiceTarget(choice: StoryChoice) {
  return choice.target;
}

function collectReachableNodeIds<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  const nodeLookup = createStoryNodeLookup(story);
  const reachableNodeIds: string[] = [];
  const seen = new Set<string>();
  const queue = story.openingNodeId ? [story.openingNodeId] : [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;

    if (seen.has(nodeId)) continue;

    const node = nodeLookup.get(nodeId);
    if (!node) continue;

    seen.add(nodeId);
    reachableNodeIds.push(nodeId);

    for (const choice of getStoryChoices(story, node)) {
      if (!choice.disabled) {
        queue.push(getChoiceTarget(choice));
      }
    }
  }

  return reachableNodeIds;
}

function getTextWordCount(input: string) {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

function getContentWordCount(node: StoryNode) {
  return (node.content ?? []).reduce((count, block) => {
    switch (block.type) {
      case "paragraph":
      case "heading":
      case "quote":
        return (
          count +
          getTextWordCount(block.text) +
          (block.type === "quote" ? getTextWordCount(block.cite ?? "") : 0)
        );
      case "list":
        return (
          count + block.items.reduce((itemCount, item) => itemCount + getTextWordCount(item), 0)
        );
      case "image":
        return count + getTextWordCount(block.caption ?? "");
      case "audio":
      case "video":
        return count + getTextWordCount(block.title ?? "");
      default:
        return count;
    }
  }, 0);
}

function getMediaBlockCount<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  return getStoryNodes(story).reduce(
    (count, node) =>
      count +
      (node.content ?? []).filter(
        (block) => block.type === "image" || block.type === "audio" || block.type === "video",
      ).length,
    0,
  );
}

function createEmptyMetrics<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
): StoryAuthoringMetrics {
  const storyNodes = getStoryNodes(story);
  const contentBlockCount = storyNodes.reduce(
    (count, node) => count + (node.content?.length ?? 0),
    0,
  );

  return {
    nodeCount: storyNodes.length,
    edgeCount: 0,
    branchCount: 0,
    endingCount: 0,
    reachableNodeCount: 0,
    unreachableNodeCount: storyNodes.length,
    pathCount: 0,
    maxDepth: 0,
    minDepth: 0,
    contentBlockCount,
    mediaBlockCount: getMediaBlockCount(story),
    estimatedReadingMinutes: 0,
  };
}

export function getStoryReachability<TData extends StoryNodeData>(story: StoryDocument<TData>) {
  const reachableNodeIds = collectReachableNodeIds(story);
  const reachableNodeSet = new Set(reachableNodeIds);

  return {
    reachableNodeIds,
    unreachableNodeIds: getStoryNodes(story)
      .map((node) => node.id)
      .filter((nodeId) => nodeId && !reachableNodeSet.has(nodeId)),
  };
}

export function analyzeStory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: AnalyzeStoryOptions = {},
): StoryAuthoringReport<TData> {
  const maxPaths = options.maxPaths ?? DEFAULT_MAX_PATHS;
  const wordsPerMinute = options.wordsPerMinute ?? DEFAULT_WORDS_PER_MINUTE;
  const validationMode = options.validationMode ?? "compat";
  const validationIssues = validateStoryDocument(story, { mode: validationMode });
  const issues: StoryAuthoringIssue[] = validationIssues.map((issue) =>
    withFixes(
      mapValidationIssue(issue, "error"),
      options.includeFixes ? getValidationFixes(story, issue) : undefined,
    ),
  );

  if (!options.validationMode) {
    const validationIssueKeys = new Set(validationIssues.map(getIssueKey));
    const strictWarnings = validateStoryDocument(story, { mode: "strict" }).filter(
      (issue) => !validationIssueKeys.has(getIssueKey(issue)),
    );

    issues.push(
      ...strictWarnings.map((issue) =>
        withFixes(
          mapValidationIssue(issue, "warning"),
          options.includeFixes ? getValidationFixes(story, issue) : undefined,
        ),
      ),
    );
  }
  const reachability = getStoryReachability(story);
  let branches: StoryNode<TData>[] = [];
  let endings: StoryNode<TData>[] = [];
  let edgeCount = 0;
  let pathCount = 0;
  let maxDepth = 0;
  let minDepth = 0;

  try {
    const compiledStory = compileStory(story);
    const paths = enumerateStoryPaths(story, { maxPaths });

    branches = getStoryBranches(compiledStory);
    endings = getStoryEndings(compiledStory);
    edgeCount = compiledStory.edges.length;
    pathCount = paths.length;
    maxDepth = paths.reduce((depth, path) => Math.max(depth, path.nodes.length), 0);
    minDepth = paths.length
      ? paths.reduce((depth, path) => Math.min(depth, path.nodes.length), Number.POSITIVE_INFINITY)
      : 0;

    if (paths.length >= maxPaths) {
      issues.push({
        code: "path-limit-reached",
        severity: "warning",
        message: `Story path enumeration reached the configured limit of ${maxPaths} paths.`,
        path: "nodes",
      });
    }
  } catch {
    const storyNodes = getStoryNodes(story);
    branches = storyNodes.filter(
      (node) => (node.choices ?? []).filter((choice) => !choice.disabled).length > 1,
    );
    endings = storyNodes.filter((node) => getStoryChoices(story, node).length === 0);
  }

  const reachableNodeSet = new Set(reachability.reachableNodeIds);

  for (const { node, path: nodePath } of getStoryNodeEntries(story)) {
    if (node.id && !reachableNodeSet.has(node.id)) {
      issues.push(
        withFixes(
          {
            code: "unreachable-node",
            severity: "warning",
            message: `Node "${node.id}" is not reachable from the opening node.`,
            path: `${nodePath}.id`,
            nodeId: node.id,
          },
          options.includeFixes && node.id !== story.openingNodeId
            ? [
                {
                  label: `Remove unreachable node "${node.id}"`,
                  patch: { type: "remove-node", nodeId: node.id },
                },
              ]
            : undefined,
        ),
      );
    }

    const isReachable = !node.id || reachableNodeSet.has(node.id);

    if (!node.content?.length && !node.stage?.renderer) {
      issues.push(
        withFixes(
          {
            code: "empty-content",
            severity: "warning",
            message: `Node "${node.id}" has no content or custom stage renderer.`,
            path: nodePath,
            nodeId: node.id,
          },
          options.includeFixes && isReachable
            ? [
                {
                  label: "Add placeholder paragraph content",
                  patch: {
                    type: "add-content-block",
                    nodeId: node.id,
                    block: { type: "paragraph", text: "Draft content." },
                  },
                },
              ]
            : undefined,
        ),
      );
    }

    if ((node.choices?.length ?? 0) > 0 && node.choices?.every((choice) => choice.disabled)) {
      issues.push(
        withFixes(
          {
            code: "disabled-only-branch",
            severity: "warning",
            message: `Node "${node.id}" only has disabled outgoing choices.`,
            path: `${nodePath}.choices`,
            nodeId: node.id,
          },
          options.includeFixes && !node.content?.length && !node.stage?.renderer
            ? [
                {
                  label: "Remove disabled choices",
                  patch: (node.choices ?? []).map((choice) => ({
                    type: "remove-choice",
                    nodeId: node.id,
                    choiceId: choice.id,
                  })),
                },
              ]
            : undefined,
        ),
      );
    }

    if (options.requireChoiceDescriptions) {
      for (const [choiceIndex, choice] of (node.choices ?? []).entries()) {
        if (!choice.description) {
          issues.push({
            code: "missing-choice-description",
            severity: "warning",
            message: `Choice "${choice.id}" on node "${node.id}" has no description.`,
            path: `${nodePath}.choices.${choiceIndex}.description`,
            nodeId: node.id,
            choiceId: choice.id,
            target: choice.target,
          });
        }
      }
    }
  }

  const storyNodes = getStoryNodes(story);
  const contentBlockCount = storyNodes.reduce(
    (count, node) => count + (node.content?.length ?? 0),
    0,
  );
  const wordCount = storyNodes.reduce((count, node) => count + getContentWordCount(node), 0);
  const metrics = createEmptyMetrics(story);

  metrics.edgeCount = edgeCount;
  metrics.branchCount = branches.length;
  metrics.endingCount = endings.length;
  metrics.reachableNodeCount = reachability.reachableNodeIds.length;
  metrics.unreachableNodeCount = reachability.unreachableNodeIds.length;
  metrics.pathCount = pathCount;
  metrics.maxDepth = maxDepth;
  metrics.minDepth = minDepth === Number.POSITIVE_INFINITY ? 0 : minDepth;
  metrics.contentBlockCount = contentBlockCount;
  metrics.mediaBlockCount = getMediaBlockCount(story);
  metrics.estimatedReadingMinutes = wordsPerMinute > 0 ? wordCount / wordsPerMinute : 0;

  return {
    story,
    valid: validationIssues.length === 0,
    metrics,
    issues,
    reachableNodeIds: reachability.reachableNodeIds,
    unreachableNodeIds: reachability.unreachableNodeIds,
    endings,
    branches,
  };
}
