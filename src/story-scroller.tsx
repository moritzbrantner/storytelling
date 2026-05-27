"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
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

export type StoryScrollerProps<TData extends StoryNodeData = StoryNodeData> = {
  story?: StoryDocument<TData>;
  scenes?: StoryScrollScene[];
  registry?: StoryRendererRegistry<TData>;
  pathChoiceIds?: string[];
  className?: string;
  viewportClassName?: string;
  transition?: StoryScrollTransition;
  ariaLabel?: string;
  onChoice?: (choice: StoryChoice, history: StoryHistoryEntry<TData>[]) => void;
  onPathChange?: (history: StoryHistoryEntry<TData>[]) => void;
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

function getStoryScrollerPageId(storyId: string, sceneId: string) {
  return `story-scroller-page-${storyId}-${sceneId}`;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const DEFAULT_SCROLL_TRANSITION: StoryScrollTransition = { type: "none" };

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

function StoryScrollTimeline<TSceneData = unknown>({
  scenes,
  className,
  viewportClassName = "h-[76vh] min-h-[31rem] max-h-[48rem]",
  transition,
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
    onActiveIndexChange?.(activeIndex);
  }, [activeIndex, onActiveIndexChange]);

  useEffect(() => {
    onSceneProgressChange?.(scrollState.value);
  }, [onSceneProgressChange, scrollState.value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        scrollToScene(activeIndex + 1);
        return;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        scrollToScene(activeIndex - 1);
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
  className,
  viewportClassName,
  transition,
  ariaLabel,
  onChoice,
  onPathChange,
  onActiveIndexChange,
  onSceneProgressChange,
}: Omit<StoryScrollerProps<TData>, "story" | "scenes"> & {
  story: StoryDocument<TData>;
}) {
  const story = useMemo(() => validateStory(input), [input]);
  const initialChoiceKey = pathChoiceIds.join("|");
  const initialHistory = useMemo(
    () => resolveInitialHistory(story, pathChoiceIds),
    [initialChoiceKey, story],
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

      setHistory(nextHistory);
      requestScrollToScene(nextActiveIndex);
      onChoice?.(choice, nextHistory);
    },
    [history, onChoice, requestScrollToScene, story],
  );

  const restart = useCallback(() => {
    const nextHistory = resolveInitialHistory(story, []);

    setHistory(nextHistory);
    requestScrollToScene(0);
  }, [requestScrollToScene, story]);

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
      ariaLabel={ariaLabel ?? story.labels?.scrollerLabel ?? story.title}
      scrollTarget={scrollTarget}
      onActiveIndexChange={onActiveIndexChange}
      onSceneProgressChange={onSceneProgressChange}
    />
  );
}

export function StoryScroller<TData extends StoryNodeData = StoryNodeData>({
  story,
  scenes,
  registry,
  pathChoiceIds = [],
  className,
  viewportClassName,
  transition,
  ariaLabel,
  onChoice,
  onPathChange,
  onActiveIndexChange,
  onSceneProgressChange,
}: StoryScrollerProps<TData>) {
  if (scenes) {
    return (
      <StoryScrollTimeline
        scenes={scenes}
        className={className}
        viewportClassName={viewportClassName}
        transition={transition}
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
      className={className}
      viewportClassName={viewportClassName}
      transition={transition}
      ariaLabel={ariaLabel}
      onChoice={onChoice}
      onPathChange={onPathChange}
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
};

function StoryChoicePanel({
  choices,
  choose,
  ending,
  prompt,
  completedLabel,
  restartLabel,
  restart,
}: StoryChoicePanelProps) {
  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
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
              disabled={choice.disabled}
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
          <Button type="button" variant="secondary" onClick={restart}>
            {restartLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
