"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { StoryChoicePanel, type StoryChoicePanelRenderProps } from "./story-choice";
import {
  StoryScrollTimeline,
  type StoryScrollAutoplay,
  type StoryScrollAutoplayOptions,
  type StoryScrollDirection,
  type StoryScrollScene,
  type StoryScrollSceneRenderProps,
  type StoryScrollTarget,
  type StoryScrollTimelineProps,
  type StoryScrollTransition,
} from "./story-scroll-timeline";
import { StoryStageFrame } from "./story-stage-frame";
import {
  buildPathFromHistory,
  createStoryPathStateFromHistory,
  createStoryRenderProps,
  getHistoryChoiceIds,
} from "./story-runtime";
import { StoryMinimap } from "./story-minimap";
import { resolveStoryPath } from "./story-path";
import { createStoryNodeEntryLookup } from "./story-node-tree";
import { getStoryChoices, getStoryNode, isStoryEnding, validateStory } from "./story-validation";
import type {
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNodeData,
  StoryNodeTreeEntry,
} from "./story-model";
import type { StoryRendererRegistry, StoryRenderProps } from "./story-render-types";
import type { StoryPathState } from "./story-state";

const STORY_BRANCH_REVEAL_START = 0.9;
const STORY_BRANCH_REVEAL_END = 1;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export type {
  StoryScrollAutoplay,
  StoryScrollAutoplayOptions,
  StoryScrollDirection,
  StoryScrollScene,
  StoryScrollSceneRenderProps,
  StoryScrollTransition,
};

export type StoryScrollerSceneRenderProps<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> = StoryRenderProps<TData> & StoryScrollSceneRenderProps<TSceneData>;

export type StoryScrollerChoicePanelRenderProps<TData extends StoryNodeData = StoryNodeData> =
  StoryChoicePanelRenderProps<TData>;

export type StoryScrollerMinimapProps<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  items: Array<
    { id: string; title: string; eyebrow?: string; menuLabel?: string } & Partial<
      Pick<
        StoryNodeTreeEntry<TData>,
        "nodeId" | "parentNodeId" | "ancestorNodeIds" | "depth" | "indexPath"
      >
    >
  >;
  activeIndex: number;
  scrollToScene: (index: number) => void;
  history: StoryHistoryEntry<TData>[];
};

export type StoryScrollerSlots<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> = {
  scene?: (props: StoryScrollerSceneRenderProps<TData, TSceneData>) => ReactNode;
  choicePanel?: (props: StoryScrollerChoicePanelRenderProps<TData>) => ReactNode;
  minimap?: (props: StoryScrollerMinimapProps<TData>) => ReactNode;
};

export type StoryScrollerMinimapModuleOptions = {
  enabled?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
  ariaLabel?: string;
};

export type StoryScrollerModules = {
  choicePanel?: boolean;
  minimap?: boolean | StoryScrollerMinimapModuleOptions;
};

export type StoryScrollerProps<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> = {
  story?: StoryDocument<TData>;
  scenes?: StoryScrollScene<TSceneData>[];
  registry?: StoryRendererRegistry<TData>;
  pathChoiceIds?: string[];
  defaultChoiceIds?: string[];
  choiceIds?: string[];
  allowBranchReselection?: boolean;
  className?: string;
  viewportClassName?: string;
  transition?: StoryScrollTransition;
  scrollInputScale?: number;
  autoplay?: StoryScrollAutoplay;
  ariaLabel?: string;
  renderScene?: (props: StoryScrollerSceneRenderProps<TData, TSceneData>) => ReactNode;
  renderChoicePanel?: (props: StoryScrollerChoicePanelRenderProps<TData>) => ReactNode;
  renderMinimap?: (props: StoryScrollerMinimapProps<TData>) => ReactNode;
  slots?: StoryScrollerSlots<TData, TSceneData>;
  modules?: StoryScrollerModules;
  onChoice?: (choice: StoryChoice, history: StoryHistoryEntry<TData>[]) => void;
  onPathChange?: (history: StoryHistoryEntry<TData>[]) => void;
  onChoiceIdsChange?: (choiceIds: string[], state: StoryPathState<TData>) => void;
  onActiveIndexChange?: (index: number) => void;
  onSceneProgressChange?: (value: number) => void;
};

function resolveInitialHistory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  choiceIds: string[],
) {
  return resolveStoryPath(story, {
    choiceIds,
    autoAdvanceLinearNodes: true,
  }).history;
}

function getSelectedBranchChoiceId<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  history: StoryHistoryEntry<TData>[],
  index: number,
) {
  const entry = history[index];
  const nextEntry = history[index + 1];
  if (!entry || !nextEntry?.choiceId) return undefined;

  const node = getStoryNode(story, entry.nodeId);
  const explicitChoices = node.choices ?? [];

  return explicitChoices.some((choice) => choice.id === nextEntry.choiceId)
    ? nextEntry.choiceId
    : undefined;
}

function getStoryScrollerPageId(storyId: string, sceneId: string) {
  return `story-scroller-page-${storyId}-${sceneId}`;
}

function getChoicePanelRevealProgress(progress: number) {
  return clamp(
    (progress - STORY_BRANCH_REVEAL_START) / (STORY_BRANCH_REVEAL_END - STORY_BRANCH_REVEAL_START),
    0,
    1,
  );
}

function StoryDocumentScroller<TData extends StoryNodeData = StoryNodeData>({
  story: input,
  registry,
  pathChoiceIds = [],
  defaultChoiceIds,
  choiceIds,
  allowBranchReselection = true,
  className,
  viewportClassName,
  transition,
  scrollInputScale,
  autoplay,
  ariaLabel,
  renderScene,
  renderChoicePanel,
  renderMinimap,
  slots,
  modules,
  onChoice,
  onPathChange,
  onChoiceIdsChange,
  onActiveIndexChange,
  onSceneProgressChange,
}: Omit<StoryScrollerProps<TData, unknown>, "story" | "scenes"> & {
  story: StoryDocument<TData>;
}) {
  const story = useMemo(() => validateStory(input), [input]);
  const resolvedDefaultChoiceIds = defaultChoiceIds ?? pathChoiceIds;
  const defaultChoiceKey = resolvedDefaultChoiceIds.join("|");
  const controlledChoiceKey = choiceIds?.join("|") ?? "";
  const isChoiceIdsControlled = choiceIds !== undefined;
  const initialHistory = useMemo(
    () => resolveInitialHistory(story, choiceIds ?? resolvedDefaultChoiceIds),
    [controlledChoiceKey, defaultChoiceKey, isChoiceIdsControlled, story],
  );
  const nodeEntryLookup = useMemo(() => createStoryNodeEntryLookup(story), [story]);
  const [history, setHistory] = useState<StoryHistoryEntry<TData>[]>(() => initialHistory);
  const [scrollTarget, setScrollTarget] = useState<StoryScrollTarget | undefined>();
  const [activeIndex, setActiveIndex] = useState(0);
  const choicePanelEnabled = modules?.choicePanel !== false;

  useEffect(() => {
    setHistory(initialHistory);
    setScrollTarget((current) => ({ index: 0, version: (current?.version ?? 0) + 1 }));
  }, [initialHistory]);

  useEffect(() => {
    onPathChange?.(history);
  }, [history, onPathChange]);

  const requestScrollToScene = useCallback((index: number) => {
    setScrollTarget((current) => ({ index, version: (current?.version ?? 0) + 1 }));
  }, []);

  const chooseFrom = useCallback(
    (index: number, choiceId: string) => {
      const entry = history[index];
      if (!entry) return;
      if (!allowBranchReselection && getSelectedBranchChoiceId(story, history, index)) return;

      const node = getStoryNode(story, entry.nodeId);
      const choice = getStoryChoices(story, node).find(
        (candidate) => candidate.id === choiceId && !candidate.disabled,
      );
      if (!choice) return;

      const nextChoiceIds = [...getHistoryChoiceIds(history.slice(0, index + 1)), choice.id];
      const nextHistory = resolveInitialHistory(story, nextChoiceIds);
      const nextActiveIndex = Math.min(index + 1, nextHistory.length - 1);

      if (!isChoiceIdsControlled) {
        setHistory(nextHistory);
      }

      requestScrollToScene(nextActiveIndex);
      onChoice?.(choice, nextHistory);
      onChoiceIdsChange?.(
        nextChoiceIds,
        createStoryPathStateFromHistory(story, nextHistory, nextChoiceIds),
      );
    },
    [
      allowBranchReselection,
      history,
      isChoiceIdsControlled,
      onChoice,
      onChoiceIdsChange,
      requestScrollToScene,
      story,
    ],
  );

  const restart = useCallback(() => {
    const nextHistory = resolveInitialHistory(story, []);

    if (!isChoiceIdsControlled) {
      setHistory(nextHistory);
    }

    requestScrollToScene(0);
    onChoiceIdsChange?.([], createStoryPathStateFromHistory(story, nextHistory, []));
  }, [isChoiceIdsControlled, onChoiceIdsChange, requestScrollToScene, story]);

  const scenes = useMemo<StoryScrollScene[]>(
    () =>
      history.map((entry, index) => {
        const node = getStoryNode(story, entry.nodeId);
        const nodeEntry = nodeEntryLookup.get(node.id);

        return {
          id: getStoryScrollerPageId(story.id, node.id),
          title: node.title,
          eyebrow: node.eyebrow,
          scrollUnits: node.scrollUnits,
          render: (scrollProps) => {
            const nodeHistory = history.slice(0, index + 1);
            const nodePath = buildPathFromHistory(story, nodeHistory);
            const explicitChoices = node.choices ?? [];
            const ending = isStoryEnding(story, node);
            const lockedChoiceId = allowBranchReselection
              ? undefined
              : getSelectedBranchChoiceId(story, history, index);
            const renderProps = createStoryRenderProps({
              story,
              path: { ...nodePath, currentNode: node, completed: ending },
              nodeEntry,
              history: nodeHistory,
              currentIndex: index,
              progress: scrollProps.progress,
              choices: explicitChoices,
              canGoBack: index > 0,
              choose: (choiceId: string) => chooseFrom(index, choiceId),
              goBack: () => requestScrollToScene(index - 1),
              restart,
            });
            const prompt =
              node.prompt ??
              (ending
                ? (story.labels?.endingPrompt ?? "This branch is complete.")
                : (story.labels?.choosePrompt ?? "Choose what happens next."));
            const completedLabel =
              story.labels?.completedBranch ??
              "Restart to explore another branch, or go back to choose a different path.";
            const restartLabel = story.labels?.restart ?? "Restart";
            const revealProgress = getChoicePanelRevealProgress(scrollProps.progress);
            const choicePanelProps: StoryScrollerChoicePanelRenderProps<TData> = {
              ...renderProps,
              prompt,
              completedLabel,
              restartLabel,
              lockedChoiceId,
              revealProgress,
              isReady: revealProgress > 0,
            };
            const shouldRenderChoicePanel =
              choicePanelEnabled && (explicitChoices.length > 0 || ending);
            const defaultScene = (
              <div className="relative h-full min-h-0">
                <StoryStageFrame {...renderProps} registry={registry} className="h-full min-h-0" />
                {shouldRenderChoicePanel ? (
                  renderChoicePanel ? (
                    renderChoicePanel(choicePanelProps)
                  ) : slots?.choicePanel ? (
                    slots.choicePanel(choicePanelProps)
                  ) : (
                    <StoryChoicePanel
                      choices={explicitChoices}
                      onChoose={renderProps.choose}
                      isEnding={ending}
                      prompt={prompt}
                      completedLabel={completedLabel}
                      restartLabel={restartLabel}
                      restart={restart}
                      progress={scrollProps.progress}
                      lockedChoiceId={lockedChoiceId}
                    />
                  )
                ) : null}
              </div>
            );
            const sceneSlot = renderScene ?? slots?.scene;

            return sceneSlot ? sceneSlot({ ...renderProps, ...scrollProps }) : defaultScene;
          },
        };
      }),
    [
      allowBranchReselection,
      chooseFrom,
      choicePanelEnabled,
      history,
      nodeEntryLookup,
      registry,
      renderChoicePanel,
      renderScene,
      requestScrollToScene,
      restart,
      slots,
      story,
    ],
  );

  const handleActiveIndexChange = useCallback(
    (index: number) => {
      setActiveIndex(index);
      onActiveIndexChange?.(index);
    },
    [onActiveIndexChange],
  );

  const minimapProps: StoryScrollerMinimapProps<TData> = {
    story,
    items: scenes.map((scene, index) => {
      const nodeEntry = history[index]?.nodeId
        ? nodeEntryLookup.get(history[index]!.nodeId)
        : undefined;

      return {
        id: scene.id,
        title: scene.title,
        eyebrow: scene.eyebrow,
        menuLabel: scene.menuLabel,
        nodeId: nodeEntry?.nodeId,
        parentNodeId: nodeEntry?.parentNodeId,
        ancestorNodeIds: nodeEntry?.ancestorNodeIds,
        depth: nodeEntry?.depth,
        indexPath: nodeEntry?.indexPath,
      };
    }),
    activeIndex,
    scrollToScene: requestScrollToScene,
    history,
  };
  const minimapSlot = renderMinimap ?? slots?.minimap;
  const minimapOptions = typeof modules?.minimap === "object" ? modules.minimap : undefined;
  const showDefaultMinimap =
    modules?.minimap === true || (Boolean(minimapOptions) && minimapOptions?.enabled !== false);
  const minimap = minimapSlot ? (
    minimapSlot(minimapProps)
  ) : showDefaultMinimap ? (
    <StoryMinimap
      items={minimapProps.items}
      activeIndex={minimapProps.activeIndex}
      onSelect={minimapProps.scrollToScene}
      collapsible={minimapOptions?.collapsible}
      defaultCollapsed={minimapOptions?.defaultCollapsed}
      className={minimapOptions?.className}
      ariaLabel={minimapOptions?.ariaLabel}
    />
  ) : null;

  return (
    <>
      {minimap}
      <StoryScrollTimeline
        scenes={scenes}
        className={className}
        viewportClassName={viewportClassName}
        transition={transition}
        scrollInputScale={scrollInputScale}
        autoplay={autoplay}
        ariaLabel={ariaLabel ?? story.labels?.scrollerLabel ?? story.title}
        scrollTarget={scrollTarget}
        onActiveIndexChange={handleActiveIndexChange}
        onSceneProgressChange={onSceneProgressChange}
      />
    </>
  );
}

export function StoryScroller<TData extends StoryNodeData = StoryNodeData, TSceneData = unknown>({
  story,
  scenes,
  registry,
  pathChoiceIds = [],
  defaultChoiceIds,
  choiceIds,
  allowBranchReselection,
  className,
  viewportClassName,
  transition,
  scrollInputScale,
  autoplay,
  ariaLabel,
  renderScene,
  renderChoicePanel,
  renderMinimap,
  slots,
  modules,
  onChoice,
  onPathChange,
  onChoiceIdsChange,
  onActiveIndexChange,
  onSceneProgressChange,
}: StoryScrollerProps<TData, TSceneData>) {
  if (scenes) {
    return (
      <StoryScrollTimeline
        scenes={scenes}
        className={className}
        viewportClassName={viewportClassName}
        transition={transition}
        scrollInputScale={scrollInputScale}
        autoplay={autoplay}
        ariaLabel={ariaLabel}
        onActiveIndexChange={onActiveIndexChange}
        onSceneProgressChange={onSceneProgressChange}
      />
    );
  }

  if (!story) {
    throw new Error("StoryScroller requires either a story or a scenes array.");
  }

  return (
    <StoryDocumentScroller
      story={story}
      registry={registry}
      pathChoiceIds={pathChoiceIds}
      defaultChoiceIds={defaultChoiceIds}
      choiceIds={choiceIds}
      allowBranchReselection={allowBranchReselection}
      className={className}
      viewportClassName={viewportClassName}
      transition={transition}
      scrollInputScale={scrollInputScale}
      autoplay={autoplay}
      ariaLabel={ariaLabel}
      renderScene={renderScene as StoryScrollerProps<TData, unknown>["renderScene"]}
      renderChoicePanel={renderChoicePanel}
      renderMinimap={renderMinimap}
      slots={slots as StoryScrollerProps<TData, unknown>["slots"]}
      modules={modules}
      onChoice={onChoice}
      onPathChange={onPathChange}
      onChoiceIdsChange={onChoiceIdsChange}
      onActiveIndexChange={onActiveIndexChange}
      onSceneProgressChange={onSceneProgressChange}
    />
  );
}

export type { StoryScrollTimelineProps };
