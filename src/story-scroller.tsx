"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type WheelEvent,
} from "react";

import { motion, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";

import { Button, cn } from "@moritzbrantner/ui";

import { resolveStoryPath } from "./story-path";
import { StoryStageFrame } from "./story-stage-frame";
import { getStoryChoices, getStoryNode, isStoryEnding, validateStory } from "./story-validation";
import type {
  ResolvedStoryPath,
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNodeData,
  StoryRenderProps,
  StoryRendererRegistry,
} from "./story-model";
import type { StoryPathState } from "./story-state";

export type StoryScrollSceneRenderProps<TData = unknown> = {
  value: number;
  progress: number;
  scrollValue: MotionValue<number>;
  scrollProgress: MotionValue<number>;
  scene: StoryScrollScene<TData>;
  sceneIndex: number;
  sceneCount: number;
  isActive: boolean;
  scrollToScene: (index: number) => void;
};

export type StoryScrollTransition = { type: "none" } | { type: "fade"; scrollUnits: number };

export type StoryScrollAutoplayOptions = {
  enabled?: boolean;
  unitsPerSecond?: number;
};

export type StoryScrollAutoplay = boolean | StoryScrollAutoplayOptions;

export type StoryScrollScene<TData = unknown> = {
  id: string;
  title: string;
  eyebrow?: string;
  menuLabel?: string;
  className?: string;
  data?: TData;
  transitionToNext?: StoryScrollTransition;
  render: (props: StoryScrollSceneRenderProps<TData>) => ReactNode;
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
  className?: string;
  viewportClassName?: string;
  transition?: StoryScrollTransition;
  scrollInputScale?: number;
  autoplay?: StoryScrollAutoplay;
  ariaLabel?: string;
  onChoice?: (choice: StoryChoice, history: StoryHistoryEntry<TData>[]) => void;
  onPathChange?: (history: StoryHistoryEntry<TData>[]) => void;
  onChoiceIdsChange?: (choiceIds: string[], state: StoryPathState<TData>) => void;
  onActiveIndexChange?: (index: number) => void;
  onSceneProgressChange?: (value: number) => void;
};

type ScrollState = {
  activeIndex: number;
  value: number;
};

type ScrollTarget = {
  index: number;
  version: number;
};

type StoryScrollTimelineProps<TSceneData = unknown> = {
  scenes: StoryScrollScene<TSceneData>[];
  className?: string;
  viewportClassName?: string;
  transition?: StoryScrollTransition;
  scrollInputScale?: number;
  autoplay?: StoryScrollAutoplay;
  ariaLabel?: string;
  scrollTarget?: ScrollTarget;
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

function getHistoryChoiceIds<TData extends StoryNodeData>(history: StoryHistoryEntry<TData>[]) {
  return history.flatMap((entry) => (entry.choiceId ? [entry.choiceId] : []));
}

function buildPathFromHistory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  history: StoryHistoryEntry<TData>[],
): ResolvedStoryPath<TData> {
  const nodes = history.map((entry) => getStoryNode(story, entry.nodeId));
  const currentNode = nodes[nodes.length - 1] ?? getStoryNode(story, story.openingNodeId);

  return {
    nodes,
    history,
    currentNode,
    completed: isStoryEnding(story, currentNode),
  };
}

function buildStoryPathStateFromHistory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  history: StoryHistoryEntry<TData>[],
  choiceIds: string[],
): StoryPathState<TData> {
  const path = buildPathFromHistory(story, history);

  return {
    choiceIds,
    path,
    history,
    currentNode: path.currentNode,
    completed: path.completed,
  };
}

function getStoryScrollerPageId(storyId: string, sceneId: string) {
  return `story-scroller-page-${storyId}-${sceneId}`;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const DEFAULT_SCROLL_TRANSITION: StoryScrollTransition = { type: "none" };
const DEFAULT_SCROLL_INPUT_SCALE = 1;
const DEFAULT_AUTOPLAY_UNITS_PER_SECOND = 20;
const AUTOPLAY_INTERVAL_MS = 1000 / 60;
const STORY_BRANCH_REVEAL_START = 0.9;
const STORY_BRANCH_REVEAL_END = 1;

function getPrefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function resolveScrollTransition(
  sceneTransition: StoryScrollTransition | undefined,
  timelineTransition: StoryScrollTransition | undefined,
  reducedMotion: boolean,
): StoryScrollTransition {
  if (reducedMotion) {
    return DEFAULT_SCROLL_TRANSITION;
  }

  const transition = sceneTransition ?? timelineTransition ?? DEFAULT_SCROLL_TRANSITION;

  if (transition.type === "fade") {
    const scrollUnits = clamp(transition.scrollUnits, 0, 100);
    return scrollUnits > 0 ? { type: "fade", scrollUnits } : DEFAULT_SCROLL_TRANSITION;
  }

  return DEFAULT_SCROLL_TRANSITION;
}

function getNextScrollState(element: HTMLElement, sceneCount: number): ScrollState {
  if (sceneCount <= 0) {
    return { activeIndex: 0, value: 0 };
  }

  const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);
  if (maxScroll === 0) {
    return { activeIndex: 0, value: 0 };
  }

  const segmentSize = maxScroll / sceneCount;
  const rawSceneProgress = clamp(element.scrollTop / segmentSize, 0, sceneCount);
  const activeIndex = clamp(Math.floor(rawSceneProgress), 0, sceneCount - 1);
  const value = clamp((rawSceneProgress - activeIndex) * 100, 0, 100);

  return { activeIndex, value };
}

function shouldUpdateScrollState(current: ScrollState, next: ScrollState) {
  return current.activeIndex !== next.activeIndex || Math.abs(current.value - next.value) >= 0.1;
}

function resolveScrollInputScale(scale: number | undefined) {
  if (scale === undefined || !Number.isFinite(scale)) {
    return DEFAULT_SCROLL_INPUT_SCALE;
  }

  return Math.max(scale, 0);
}

function resolveStoryScrollAutoplay(autoplay: StoryScrollAutoplay | undefined) {
  if (!autoplay) {
    return {
      enabled: false,
      unitsPerSecond: DEFAULT_AUTOPLAY_UNITS_PER_SECOND,
    };
  }

  if (autoplay === true) {
    return {
      enabled: true,
      unitsPerSecond: DEFAULT_AUTOPLAY_UNITS_PER_SECOND,
    };
  }

  const unitsPerSecond =
    autoplay.unitsPerSecond === undefined || !Number.isFinite(autoplay.unitsPerSecond)
      ? DEFAULT_AUTOPLAY_UNITS_PER_SECOND
      : Math.max(autoplay.unitsPerSecond, 0);

  return {
    enabled: (autoplay.enabled ?? true) && unitsPerSecond > 0,
    unitsPerSecond,
  };
}

function getWheelScrollDelta(event: WheelEvent<HTMLElement>, element: HTMLElement) {
  const baseDelta = event.deltaY || event.deltaX;

  switch (event.deltaMode) {
    case 1:
      return baseDelta * 16;
    case 2:
      return baseDelta * element.clientHeight;
    default:
      return baseDelta;
  }
}

function StoryScrollTimeline<TSceneData = unknown>({
  scenes,
  className,
  viewportClassName = "h-[76vh] min-h-[31rem] max-h-[48rem]",
  transition,
  scrollInputScale,
  autoplay,
  ariaLabel,
  scrollTarget,
  onActiveIndexChange,
  onSceneProgressChange,
}: StoryScrollTimelineProps<TSceneData>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();
  const scrollValue = useMotionValue(0);
  const scrollProgress = useMotionValue(0);
  const previewScrollValue = useMotionValue(0);
  const previewScrollProgress = useMotionValue(0);
  const [scrollState, setScrollState] = useState<ScrollState>({ activeIndex: 0, value: 0 });
  const sceneCount = scenes.length;
  const resolvedScrollInputScale = resolveScrollInputScale(scrollInputScale);
  const resolvedAutoplay = resolveStoryScrollAutoplay(autoplay);
  const activeIndex = clamp(scrollState.activeIndex, 0, Math.max(sceneCount - 1, 0));
  const activeScene = scenes[activeIndex];
  const nextScene = scenes[activeIndex + 1];
  const activeTransition = resolveScrollTransition(
    activeScene?.transitionToNext,
    transition,
    Boolean(reducedMotion) || getPrefersReducedMotion(),
  );
  const fadeProgress =
    activeTransition.type === "fade" && nextScene
      ? clamp(
          (scrollState.value - (100 - activeTransition.scrollUnits)) / activeTransition.scrollUnits,
          0,
          1,
        )
      : 0;
  const shouldRenderFadePreview =
    activeTransition.type === "fade" && Boolean(nextScene) && fadeProgress > 0;

  const updateFromScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const nextState = getNextScrollState(element, sceneCount);

    scrollValue.set(nextState.value);
    scrollProgress.set(nextState.value / 100);
    setScrollState((current) =>
      shouldUpdateScrollState(current, nextState) ? nextState : current,
    );
  }, [sceneCount, scrollProgress, scrollValue]);

  const setScrollTop = useCallback(
    (top: number) => {
      const element = scrollRef.current;
      if (!element) return;

      const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);
      element.scrollTop = clamp(top, 0, maxScroll);
      updateFromScroll();
    },
    [updateFromScroll],
  );

  const scrollByInputDelta = useCallback(
    (delta: number) => {
      const element = scrollRef.current;
      if (!element || delta === 0) return;

      setScrollTop(element.scrollTop + delta);
    },
    [setScrollTop],
  );

  const scrollToScene = useCallback(
    (index: number) => {
      const element = scrollRef.current;
      const nextIndex = clamp(index, 0, Math.max(sceneCount - 1, 0));

      setScrollState({ activeIndex: nextIndex, value: 0 });
      scrollValue.set(0);
      scrollProgress.set(0);

      if (!element) return;

      const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);
      const segmentSize = sceneCount > 0 ? maxScroll / sceneCount : 0;

      const top = segmentSize * nextIndex;

      if (typeof element.scrollTo === "function") {
        element.scrollTo({
          top,
          behavior: reducedMotion ? "auto" : "smooth",
        });
        return;
      }

      element.scrollTop = top;
    },
    [reducedMotion, sceneCount, scrollProgress, scrollValue],
  );

  useEffect(() => {
    scrollValue.set(scrollState.value);
    scrollProgress.set(scrollState.value / 100);
  }, [scrollProgress, scrollState.value, scrollValue]);

  useEffect(() => {
    setScrollState((current) => {
      const nextState = {
        activeIndex: clamp(current.activeIndex, 0, Math.max(sceneCount - 1, 0)),
        value: current.activeIndex >= sceneCount ? 0 : current.value,
      };

      return shouldUpdateScrollState(current, nextState) ? nextState : current;
    });
  }, [sceneCount]);

  useEffect(() => {
    if (!scrollTarget) return;
    scrollToScene(scrollTarget.index);
  }, [scrollTarget, scrollToScene]);

  useEffect(() => {
    const shouldAutoplay =
      resolvedAutoplay.enabled && sceneCount > 0 && !reducedMotion && !getPrefersReducedMotion();

    if (!shouldAutoplay || typeof window === "undefined") {
      return;
    }

    const interval = window.setInterval(() => {
      const element = scrollRef.current;
      if (!element) return;

      const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);
      if (maxScroll === 0 || element.scrollTop >= maxScroll) return;

      const sceneScrollSize = maxScroll / sceneCount;
      const secondsPerTick = AUTOPLAY_INTERVAL_MS / 1000;
      const delta = (sceneScrollSize * resolvedAutoplay.unitsPerSecond * secondsPerTick) / 100;

      setScrollTop(element.scrollTop + delta);
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [
    reducedMotion,
    resolvedAutoplay.enabled,
    resolvedAutoplay.unitsPerSecond,
    sceneCount,
    setScrollTop,
  ]);

  useEffect(() => {
    onActiveIndexChange?.(activeIndex);
  }, [activeIndex, onActiveIndexChange]);

  useEffect(() => {
    onSceneProgressChange?.(scrollState.value);
  }, [onSceneProgressChange, scrollState.value]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (resolvedScrollInputScale === DEFAULT_SCROLL_INPUT_SCALE) return;

    event.preventDefault();
    scrollByInputDelta(getWheelScrollDelta(event, event.currentTarget) * resolvedScrollInputScale);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const element = scrollRef.current;
    const maxScroll = element ? Math.max(element.scrollHeight - element.clientHeight, 0) : 0;
    const sceneScrollSize = sceneCount > 0 ? maxScroll / sceneCount : 0;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        if (sceneScrollSize === 0) {
          scrollToScene(activeIndex + 1);
          return;
        }
        scrollByInputDelta(sceneScrollSize * resolvedScrollInputScale);
        return;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        if (sceneScrollSize === 0) {
          scrollToScene(activeIndex - 1);
          return;
        }
        scrollByInputDelta(-sceneScrollSize * resolvedScrollInputScale);
        return;
      case "Home":
        event.preventDefault();
        scrollToScene(0);
        return;
      case "End":
        event.preventDefault();
        scrollToScene(sceneCount - 1);
        return;
      default:
        return;
    }
  };

  if (sceneCount === 0) {
    return null;
  }

  return (
    <section
      role="region"
      aria-label={ariaLabel ?? "Story scroller"}
      className={cn("rounded-lg border bg-card p-4 md:p-6", className)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={scrollRef}
        className={cn(
          "story-steps-scrollbar-hidden relative overflow-y-auto overscroll-contain",
          viewportClassName,
        )}
        onScroll={updateFromScroll}
        onWheel={handleWheel}
        data-story-scroller-viewport
      >
        <div className="relative" style={{ height: `${Math.max(sceneCount + 1, 2) * 100}%` }}>
          {scenes.map((scene, index) => (
            <span
              key={scene.id}
              id={scene.id}
              className="absolute size-px"
              style={{ top: `${(index / Math.max(sceneCount + 1, 1)) * 100}%` }}
              aria-hidden="true"
              data-story-scroller-marker
            />
          ))}
          <div
            className={cn(
              "sticky top-0 overflow-hidden rounded-lg border bg-background",
              viewportClassName,
            )}
          >
            {activeScene ? (
              <StoryScrollMotionFrame
                key={activeScene.id}
                scene={activeScene}
                sceneIndex={activeIndex}
                sceneCount={sceneCount}
                value={scrollState.value}
                scrollValue={scrollValue}
                scrollProgress={scrollProgress}
                opacity={shouldRenderFadePreview ? 1 - fadeProgress : 1}
                isActive
                scrollToScene={scrollToScene}
              />
            ) : null}
            {shouldRenderFadePreview && nextScene ? (
              <StoryScrollMotionFrame
                key={`${nextScene.id}-preview`}
                scene={nextScene}
                sceneIndex={activeIndex + 1}
                sceneCount={sceneCount}
                value={0}
                scrollValue={previewScrollValue}
                scrollProgress={previewScrollProgress}
                opacity={fadeProgress}
                isActive={false}
                scrollToScene={scrollToScene}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

type StoryScrollMotionFrameProps<TSceneData = unknown> = {
  scene: StoryScrollScene<TSceneData>;
  sceneIndex: number;
  sceneCount: number;
  value: number;
  scrollValue: MotionValue<number>;
  scrollProgress: MotionValue<number>;
  opacity: number;
  isActive: boolean;
  scrollToScene: (index: number) => void;
};

function StoryScrollMotionFrame<TSceneData = unknown>({
  scene,
  sceneIndex,
  sceneCount,
  value,
  scrollValue,
  scrollProgress,
  opacity,
  isActive,
  scrollToScene,
}: StoryScrollMotionFrameProps<TSceneData>) {
  return (
    <motion.article
      className={cn(
        "absolute inset-0 h-full min-h-0",
        isActive ? "pointer-events-auto" : "pointer-events-none",
        scene.className,
      )}
      data-active={isActive ? "true" : "false"}
      data-story-scroller-index={sceneIndex}
      data-story-scroller-page
      aria-label={`${sceneIndex + 1}. ${scene.title}`}
      aria-hidden={!isActive}
      style={{ opacity }}
    >
      <div className="h-full min-h-0" data-story-scroller-motion-frame>
        {scene.render({
          value,
          progress: value / 100,
          scrollValue,
          scrollProgress,
          scene,
          sceneIndex,
          sceneCount,
          isActive,
          scrollToScene,
        })}
      </div>
    </motion.article>
  );
}

function StoryDocumentScroller<TData extends StoryNodeData = StoryNodeData>({
  story: input,
  registry,
  pathChoiceIds = [],
  defaultChoiceIds,
  choiceIds,
  className,
  viewportClassName,
  transition,
  scrollInputScale,
  autoplay,
  ariaLabel,
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
  const [history, setHistory] = useState<StoryHistoryEntry<TData>[]>(() => initialHistory);
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | undefined>();

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
        buildStoryPathStateFromHistory(story, nextHistory, nextChoiceIds),
      );
    },
    [history, isChoiceIdsControlled, onChoice, onChoiceIdsChange, requestScrollToScene, story],
  );

  const restart = useCallback(() => {
    const nextHistory = resolveInitialHistory(story, []);

    if (!isChoiceIdsControlled) {
      setHistory(nextHistory);
    }

    requestScrollToScene(0);
    onChoiceIdsChange?.([], buildStoryPathStateFromHistory(story, nextHistory, []));
  }, [isChoiceIdsControlled, onChoiceIdsChange, requestScrollToScene, story]);

  const scenes = useMemo<StoryScrollScene[]>(
    () =>
      history.map((entry, index) => {
        const node = getStoryNode(story, entry.nodeId);

        return {
          id: getStoryScrollerPageId(story.id, node.id),
          title: node.title,
          eyebrow: node.eyebrow,
          render: ({ progress }) => {
            const nodeHistory = history.slice(0, index + 1);
            const nodePath: ResolvedStoryPath<TData> = {
              nodes: nodeHistory.map((historyEntry) => getStoryNode(story, historyEntry.nodeId)),
              history: nodeHistory,
              currentNode: node,
              completed: isStoryEnding(story, node),
            };
            const explicitChoices = node.choices ?? [];
            const ending = isStoryEnding(story, node);
            const renderProps: StoryRenderProps<TData> = {
              story,
              node,
              history: nodeHistory,
              path: nodePath,
              currentIndex: index,
              progress,
              isEnding: ending,
              canGoBack: index > 0,
              choices: explicitChoices,
              choose: (choiceId: string) => chooseFrom(index, choiceId),
              goBack: () => requestScrollToScene(index - 1),
              restart,
            };

            return (
              <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3">
                <StoryStageFrame {...renderProps} registry={registry} className="h-full min-h-0" />
                {explicitChoices.length > 0 || ending ? (
                  <StoryChoicePanel
                    choices={explicitChoices}
                    choose={renderProps.choose}
                    ending={ending}
                    prompt={
                      node.prompt ??
                      (ending
                        ? (story.labels?.endingPrompt ?? "This branch is complete.")
                        : (story.labels?.choosePrompt ?? "Choose what happens next."))
                    }
                    completedLabel={
                      story.labels?.completedBranch ??
                      "Restart to explore another branch, or go back to choose a different path."
                    }
                    restartLabel={story.labels?.restart ?? "Restart"}
                    restart={restart}
                    progress={progress}
                  />
                ) : null}
              </div>
            );
          },
        };
      }),
    [chooseFrom, history, registry, requestScrollToScene, restart, story],
  );

  return (
    <StoryScrollTimeline
      scenes={scenes}
      className={className}
      viewportClassName={viewportClassName}
      transition={transition}
      scrollInputScale={scrollInputScale}
      autoplay={autoplay}
      ariaLabel={ariaLabel ?? story.labels?.scrollerLabel ?? story.title}
      scrollTarget={scrollTarget}
      onActiveIndexChange={onActiveIndexChange}
      onSceneProgressChange={onSceneProgressChange}
    />
  );
}

export function StoryScroller<TData extends StoryNodeData = StoryNodeData, TSceneData = unknown>({
  story,
  scenes,
  registry,
  pathChoiceIds = [],
  defaultChoiceIds,
  choiceIds,
  className,
  viewportClassName,
  transition,
  scrollInputScale,
  autoplay,
  ariaLabel,
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
      className={className}
      viewportClassName={viewportClassName}
      transition={transition}
      scrollInputScale={scrollInputScale}
      autoplay={autoplay}
      ariaLabel={ariaLabel}
      onChoice={onChoice}
      onPathChange={onPathChange}
      onChoiceIdsChange={onChoiceIdsChange}
      onActiveIndexChange={onActiveIndexChange}
      onSceneProgressChange={onSceneProgressChange}
    />
  );
}

type StoryChoicePanelProps = {
  choices: StoryChoice[];
  choose: (choiceId: string) => void;
  ending: boolean;
  prompt: string;
  completedLabel: string;
  restartLabel: string;
  restart: () => void;
  progress: number;
};

function StoryChoicePanel({
  choices,
  choose,
  ending,
  prompt,
  completedLabel,
  restartLabel,
  restart,
  progress,
}: StoryChoicePanelProps) {
  const revealProgress = clamp(
    (progress - STORY_BRANCH_REVEAL_START) / (STORY_BRANCH_REVEAL_END - STORY_BRANCH_REVEAL_START),
    0,
    1,
  );
  const isReady = progress >= STORY_BRANCH_REVEAL_END;

  if (revealProgress <= 0) {
    return null;
  }

  return (
    <motion.div
      className="rounded-lg border bg-background p-4 shadow-sm"
      style={{ opacity: revealProgress }}
      aria-hidden={!isReady}
    >
      <p className="text-sm font-medium">{prompt}</p>
      {choices.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
          {choices.map((choice) => (
            <Button
              key={choice.id}
              type="button"
              variant="outline"
              className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
              onClick={() => choose(choice.id)}
              disabled={choice.disabled || !isReady}
            >
              <span className="grid gap-1">
                <span>{choice.label}</span>
                {choice.description ? (
                  <span className="text-sm font-normal text-muted-foreground">
                    {choice.description}
                  </span>
                ) : null}
              </span>
            </Button>
          ))}
        </div>
      ) : ending ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{completedLabel}</p>
          <Button type="button" variant="secondary" onClick={restart} disabled={!isReady}>
            {restartLabel}
          </Button>
        </div>
      ) : null}
    </motion.div>
  );
}
