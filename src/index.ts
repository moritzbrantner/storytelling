"use client";

export {
  buildStoryTimeline,
  resolveStoryPath,
  type BuildStoryTimelineOptions,
  type ResolveStoryPathOptions,
} from "./story-path";
export {
  createStoryRendererRegistry,
  getStoryRendererKey,
  getStoryStageProps,
} from "./story-render-registry";
export {
  assertStoryDocument,
  defineStory,
  getStoryChoices,
  getStoryNode,
  isStoryEnding,
  validateStory,
  validateStoryDocument,
  StoryValidationError,
  type StoryValidationIssue,
  type StoryValidationIssueCode,
} from "./story-validation";
export {
  compileStory,
  enumerateStoryPaths,
  getStoryBranches,
  getStoryEndings,
  type CompiledStory,
  type CompiledStoryNode,
  type EnumerateStoryPathsOptions,
  type EnumeratedStoryPath,
  type StoryGraphEdge,
} from "./story-graph";
export {
  createStoryPathState,
  parseStoryPath,
  serializeStoryPath,
  type CreateStoryPathStateOptions,
  type StoryPathState,
} from "./story-state";
export {
  analyzeStory,
  getStoryReachability,
  type AnalyzeStoryOptions,
  type StoryAuthoringIssue,
  type StoryAuthoringIssueCode,
  type StoryAuthoringMetrics,
  type StoryAuthoringReport,
  type StoryAuthoringSeverity,
} from "./story-authoring";
export {
  applyStoryPatch,
  createStoryNode,
  type ApplyStoryPatchOptions,
  type StoryPatch,
} from "./story-edit";
export {
  useStoryPathState,
  type UseStoryPathStateOptions,
  type UseStoryPathStateResult,
} from "./use-story-path-state";
export { defaultStoryTheme, type StoryTheme } from "./story-theme";
export { StoryContent, type StoryContentProps } from "./story-content";
export {
  StoryControls,
  StoryPathTrail,
  StoryPlayer,
  type StoryControlsProps,
  type StoryPathTrailProps,
  type StoryPlayerProps,
} from "./story-player";
export { StoryProgress, type StoryProgressProps } from "./story-progress";
export {
  StoryScroller,
  type StoryScrollAutoplay,
  type StoryScrollAutoplayOptions,
  type StoryScrollScene,
  type StoryScrollSceneRenderProps,
  type StoryScrollTransition,
  type StoryScrollerProps,
} from "./story-scroller";
export { StoryStageFrame, type StoryStageFrameProps } from "./story-stage-frame";
export { StoryMinimap, type StoryMinimapItem, type StoryMinimapProps } from "./story-minimap";
export type {
  ResolvedStoryPath,
  StoryChoice,
  StoryContentBlock,
  StoryContentRendererProps,
  StoryDefaults,
  StoryDocument,
  StoryHistoryEntry,
  StoryLabels,
  StoryMediaTextTrack,
  StoryNode,
  StoryNodeData,
  StoryRendererRegistry,
  StoryRenderProps,
  StoryRemotionSceneComponent,
  StoryRemotionSceneProps,
  StoryStageComponent,
  StoryStageDescriptor,
  StoryThreeSceneComponent,
  StoryThreeSceneProps,
  StoryTimeline,
  StoryTimelineScene,
  StoryTransition,
} from "./story-model";
