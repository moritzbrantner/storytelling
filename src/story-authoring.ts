import type { StoryChoice, StoryDocument, StoryNode, StoryNodeData } from "./story-model";
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
  type StoryValidationIssueCode,
} from "./story-validation";

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
  return story.nodes.reduce(
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
  const contentBlockCount = story.nodes.reduce(
    (count, node) => count + (node.content?.length ?? 0),
    0,
  );

  return {
    nodeCount: story.nodes.length,
    edgeCount: 0,
    branchCount: 0,
    endingCount: 0,
    reachableNodeCount: 0,
    unreachableNodeCount: story.nodes.length,
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
    unreachableNodeIds: story.nodes
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
  const validationIssues = validateStoryDocument(story);
  const issues: StoryAuthoringIssue[] = validationIssues.map((issue) => ({
    code: issue.code,
    severity: "error",
    message: issue.message,
    path: issue.path,
    nodeId: issue.nodeId,
    choiceId: issue.choiceId,
    target: issue.target,
  }));
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
    branches = story.nodes.filter(
      (node) => (node.choices ?? []).filter((choice) => !choice.disabled).length > 1,
    );
    endings = story.nodes.filter((node) => getStoryChoices(story, node).length === 0);
  }

  const reachableNodeSet = new Set(reachability.reachableNodeIds);

  for (const [nodeIndex, node] of story.nodes.entries()) {
    const nodePath = `nodes.${nodeIndex}`;

    if (node.id && !reachableNodeSet.has(node.id)) {
      issues.push({
        code: "unreachable-node",
        severity: "warning",
        message: `Node "${node.id}" is not reachable from the opening node.`,
        path: `${nodePath}.id`,
        nodeId: node.id,
      });
    }

    if (!node.content?.length && !node.stage?.renderer) {
      issues.push({
        code: "empty-content",
        severity: "warning",
        message: `Node "${node.id}" has no content or custom stage renderer.`,
        path: nodePath,
        nodeId: node.id,
      });
    }

    if ((node.choices?.length ?? 0) > 0 && node.choices?.every((choice) => choice.disabled)) {
      issues.push({
        code: "disabled-only-branch",
        severity: "warning",
        message: `Node "${node.id}" only has disabled outgoing choices.`,
        path: `${nodePath}.choices`,
        nodeId: node.id,
      });
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

  const contentBlockCount = story.nodes.reduce(
    (count, node) => count + (node.content?.length ?? 0),
    0,
  );
  const wordCount = story.nodes.reduce((count, node) => count + getContentWordCount(node), 0);
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
