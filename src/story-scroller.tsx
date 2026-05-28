"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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

const isDevelopment = process.env.NODE_ENV !== "production";

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

export type StoryScrollDirection = "up" | "down" | "left" | "right";

export type StoryScrollTransition =
  | { type: "none" }
  | { type: "fade"; scrollUnits: number }
  | { type: "slide"; scrollUnits: number; direction?: StoryScrollDirection }
  | { type: "push"; scrollUnits: number; direction?: StoryScrollDirection }
  | { type: "wipe"; scrollUnits: number; direction?: StoryScrollDirection }
  | { type: "zoom"; scrollUnits: number; fromScale?: number; toScale?: number }
  | { type: "blur"; scrollUnits: number; maxBlur?: number };

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
  scrollUnits?: number;
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
  allowBranchReselection?: boolean;
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
  unit: number;
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

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const DEFAULT_SCROLL_TRANSITION: StoryScrollTransition = { type: "none" };
const DEFAULT_SCROLL_INPUT_SCALE = 1;
const DEFAULT_SCENE_SCROLL_UNITS = 100;
const DEFAULT_KEYBOARD_SCROLL_UNITS = 10;
const KEYBOARD_SCROLL_TAP_MS = 300;
const KEYBOARD_SCROLL_HOLD_UNITS_PER_SECOND = 20;
const KEYBOARD_SCROLL_HOLD_INTERVAL_MS = 1000 / 60;
const DEFAULT_AUTOPLAY_UNITS_PER_SECOND = 20;
const AUTOPLAY_INTERVAL_MS = 1000 / 60;
const SCROLL_UNIT_PRECISION = 1_000_000;
const STORY_BRANCH_REVEAL_START = 0.9;
const STORY_BRANCH_REVEAL_END = 1;
const DEFAULT_SCROLL_TRANSITION_DIRECTION: StoryScrollDirection = "up";
const DEFAULT_SCROLL_TRANSITION_FROM_SCALE = 0.92;
const DEFAULT_SCROLL_TRANSITION_TO_SCALE = 1.06;
const DEFAULT_SCROLL_TRANSITION_MAX_BLUR = 16;
const MIN_SCROLL_TRANSITION_SCALE = 0.1;
const MAX_SCROLL_TRANSITION_SCALE = 4;
const MAX_SCROLL_TRANSITION_BLUR = 64;

function validateStoryScrollScenes<TSceneData>(scenes: StoryScrollScene<TSceneData>[]) {
  if (!isDevelopment) return;

  const sceneIds = new Set<string>();

  for (const [index, scene] of scenes.entries()) {
    const scenePath = `scenes.${index}`;

    if (scene.id.trim().length === 0) {
      throw new Error(`StoryScroller ${scenePath}.id must not be blank.`);
    }

    if (sceneIds.has(scene.id)) {
      throw new Error(`StoryScroller scene ids must be unique. Duplicate id "${scene.id}" found.`);
    }

    sceneIds.add(scene.id);

    if (scene.title.trim().length === 0) {
      throw new Error(`StoryScroller ${scenePath}.title must not be blank.`);
    }
  }
}

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

  if (transition.type === "none") {
    return DEFAULT_SCROLL_TRANSITION;
  }

  const scrollUnits = clamp(transition.scrollUnits, 0, 100);

  if (scrollUnits <= 0) {
    return DEFAULT_SCROLL_TRANSITION;
  }

  return { ...transition, scrollUnits };
}

function resolveSceneScrollUnits(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_SCENE_SCROLL_UNITS;
  }

  return value;
}

type StoryScrollTimelineEntry<TSceneData = unknown> = {
  scene: StoryScrollScene<TSceneData>;
  sceneIndex: number;
  startUnit: number;
  bodyEndUnit: number;
  endUnit: number;
  scrollUnits: number;
  transition: StoryScrollTransition;
};

function buildScrollTimeline<TSceneData>(
  scenes: StoryScrollScene<TSceneData>[],
  transition: StoryScrollTransition | undefined,
  reducedMotion: boolean,
): StoryScrollTimelineEntry<TSceneData>[] {
  let cursor = 0;

  return scenes.map((scene, sceneIndex) => {
    const scrollUnits = resolveSceneScrollUnits(scene.scrollUnits);
    const startUnit = cursor;
    const bodyEndUnit = startUnit + scrollUnits;
    const resolvedTransition = resolveScrollTransition(
      scene.transitionToNext,
      transition,
      reducedMotion,
    );
    const hasNextScene = sceneIndex < scenes.length - 1;
    const transitionUnits =
      hasNextScene && resolvedTransition.type !== "none" ? resolvedTransition.scrollUnits : 0;
    const entry: StoryScrollTimelineEntry<TSceneData> = {
      scene,
      sceneIndex,
      startUnit,
      bodyEndUnit,
      endUnit: bodyEndUnit + transitionUnits,
      scrollUnits,
      transition: hasNextScene ? resolvedTransition : DEFAULT_SCROLL_TRANSITION,
    };

    cursor = entry.endUnit;
    return entry;
  });
}

type StoryScrollTransitionStyles = {
  activeStyle: CSSProperties;
  previewStyle: CSSProperties;
};

function getDirectionalPreviewTransform(direction: StoryScrollDirection, progress: number) {
  const distance = (1 - progress) * 100;

  switch (direction) {
    case "down":
      return `translateY(${-distance}%)`;
    case "left":
      return `translateX(${distance}%)`;
    case "right":
      return `translateX(${-distance}%)`;
    case "up":
    default:
      return `translateY(${distance}%)`;
  }
}

function getDirectionalActiveTransform(direction: StoryScrollDirection, progress: number) {
  const distance = progress * 100;

  switch (direction) {
    case "down":
      return `translateY(${distance}%)`;
    case "left":
      return `translateX(${-distance}%)`;
    case "right":
      return `translateX(${distance}%)`;
    case "up":
    default:
      return `translateY(${-distance}%)`;
  }
}

function getDirectionalClipPath(direction: StoryScrollDirection, progress: number) {
  const hidden = 100 - progress * 100;

  switch (direction) {
    case "down":
      return `inset(0 0 ${hidden}% 0)`;
    case "left":
      return `inset(0 0 0 ${hidden}%)`;
    case "right":
      return `inset(0 ${hidden}% 0 0)`;
    case "up":
    default:
      return `inset(${hidden}% 0 0 0)`;
  }
}

function getScrollTransitionStyles(
  transition: StoryScrollTransition,
  progress: number,
): StoryScrollTransitionStyles {
  const normalizedProgress = clamp(progress, 0, 1);
  const baseActiveStyle: CSSProperties = { opacity: 1, zIndex: 1 };
  const basePreviewStyle: CSSProperties = { opacity: 1, zIndex: 2 };

  switch (transition.type) {
    case "fade":
      return {
        activeStyle: { ...baseActiveStyle, opacity: 1 - normalizedProgress },
        previewStyle: { ...basePreviewStyle, opacity: normalizedProgress },
      };
    case "slide": {
      const direction = transition.direction ?? DEFAULT_SCROLL_TRANSITION_DIRECTION;

      return {
        activeStyle: baseActiveStyle,
        previewStyle: {
          ...basePreviewStyle,
          transform: getDirectionalPreviewTransform(direction, normalizedProgress),
          willChange: "transform",
        },
      };
    }
    case "push": {
      const direction = transition.direction ?? DEFAULT_SCROLL_TRANSITION_DIRECTION;

      return {
        activeStyle: {
          ...baseActiveStyle,
          transform: getDirectionalActiveTransform(direction, normalizedProgress),
          willChange: "transform",
        },
        previewStyle: {
          ...basePreviewStyle,
          transform: getDirectionalPreviewTransform(direction, normalizedProgress),
          willChange: "transform",
        },
      };
    }
    case "wipe": {
      const direction = transition.direction ?? DEFAULT_SCROLL_TRANSITION_DIRECTION;

      return {
        activeStyle: baseActiveStyle,
        previewStyle: {
          ...basePreviewStyle,
          clipPath: getDirectionalClipPath(direction, normalizedProgress),
          willChange: "clip-path",
        },
      };
    }
    case "zoom": {
      const fromScale =
        transition.fromScale === undefined || !Number.isFinite(transition.fromScale)
          ? DEFAULT_SCROLL_TRANSITION_FROM_SCALE
          : clamp(transition.fromScale, MIN_SCROLL_TRANSITION_SCALE, MAX_SCROLL_TRANSITION_SCALE);
      const toScale =
        transition.toScale === undefined || !Number.isFinite(transition.toScale)
          ? DEFAULT_SCROLL_TRANSITION_TO_SCALE
          : clamp(transition.toScale, MIN_SCROLL_TRANSITION_SCALE, MAX_SCROLL_TRANSITION_SCALE);
      const activeScale = 1 + (toScale - 1) * normalizedProgress;
      const previewScale = fromScale + (1 - fromScale) * normalizedProgress;

      return {
        activeStyle: {
          ...baseActiveStyle,
          opacity: 1 - normalizedProgress * 0.45,
          transform: `scale(${activeScale})`,
          willChange: "opacity, transform",
        },
        previewStyle: {
          ...basePreviewStyle,
          opacity: normalizedProgress,
          transform: `scale(${previewScale})`,
          willChange: "opacity, transform",
        },
      };
    }
    case "blur": {
      const maxBlur =
        transition.maxBlur === undefined || !Number.isFinite(transition.maxBlur)
          ? DEFAULT_SCROLL_TRANSITION_MAX_BLUR
          : clamp(transition.maxBlur, 0, MAX_SCROLL_TRANSITION_BLUR);

      return {
        activeStyle: {
          ...baseActiveStyle,
          opacity: 1 - normalizedProgress,
          filter: `blur(${maxBlur * normalizedProgress}px)`,
          willChange: "filter, opacity",
        },
        previewStyle: {
          ...basePreviewStyle,
          opacity: normalizedProgress,
          filter: `blur(${maxBlur * (1 - normalizedProgress)}px)`,
          willChange: "filter, opacity",
        },
      };
    }
    case "none":
    default:
      return {
        activeStyle: baseActiveStyle,
        previewStyle: { ...basePreviewStyle, opacity: 0 },
      };
  }
}

function getTotalScrollUnits<TSceneData>(timeline: StoryScrollTimelineEntry<TSceneData>[]) {
  return timeline[timeline.length - 1]?.endUnit ?? 0;
}

function getTimelineEntryForIndex<TSceneData>(
  timeline: StoryScrollTimelineEntry<TSceneData>[],
  index: number,
) {
  return timeline[clamp(index, 0, Math.max(timeline.length - 1, 0))];
}

function getScrollTopForUnit(element: HTMLElement, unit: number, totalUnits: number) {
  const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);

  if (maxScroll === 0 || totalUnits <= 0) {
    return 0;
  }

  return (clamp(unit, 0, totalUnits) / totalUnits) * maxScroll;
}

function getNextScrollState<TSceneData>(
  element: HTMLElement,
  timeline: StoryScrollTimelineEntry<TSceneData>[],
): ScrollState {
  if (timeline.length === 0) {
    return { activeIndex: 0, value: 0, unit: 0 };
  }

  const totalUnits = getTotalScrollUnits(timeline);
  const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);
  const rawUnit =
    maxScroll === 0 || totalUnits <= 0
      ? 0
      : clamp((element.scrollTop / maxScroll) * totalUnits, 0, totalUnits);
  const unit = Math.round(rawUnit * SCROLL_UNIT_PRECISION) / SCROLL_UNIT_PRECISION;

  for (const entry of timeline) {
    const isLastEntry = entry.sceneIndex === timeline.length - 1;
    const hasTransitionRange = entry.endUnit > entry.bodyEndUnit;
    const isSceneBody =
      unit < entry.bodyEndUnit ||
      (unit === entry.bodyEndUnit && (hasTransitionRange || isLastEntry));

    if (isSceneBody) {
      const value =
        unit >= entry.bodyEndUnit
          ? 100
          : clamp(((unit - entry.startUnit) / entry.scrollUnits) * 100, 0, 100);

      return { activeIndex: entry.sceneIndex, value, unit };
    }

    if (unit < entry.endUnit) {
      return { activeIndex: entry.sceneIndex, value: 100, unit };
    }
  }

  const lastEntry = timeline[timeline.length - 1]!;

  return { activeIndex: lastEntry.sceneIndex, value: 100, unit: totalUnits };
}

function shouldUpdateScrollState(current: ScrollState, next: ScrollState) {
  return (
    current.activeIndex !== next.activeIndex ||
    Math.abs(current.value - next.value) >= 0.1 ||
    Math.abs(current.unit - next.unit) >= 0.1
  );
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
  const keyboardScrollHoldDelayRef = useRef<number | undefined>(undefined);
  const keyboardScrollHoldIntervalRef = useRef<number | undefined>(undefined);
  const keyboardScrollHoldStartedRef = useRef(false);
  const keyboardScrollHoldKeyRef = useRef<"ArrowDown" | "ArrowUp" | undefined>(undefined);
  const handledScrollTargetVersionRef = useRef<number | undefined>(undefined);
  const lastActiveIndexRef = useRef<number | undefined>(undefined);
  const reducedMotion = useReducedMotion();
  const scrollValue = useMotionValue(0);
  const scrollProgress = useMotionValue(0);
  const previewScrollValue = useMotionValue(0);
  const previewScrollProgress = useMotionValue(0);
  const [scrollState, setScrollState] = useState<ScrollState>({
    activeIndex: 0,
    value: 0,
    unit: 0,
  });
  const sceneCount = scenes.length;
  validateStoryScrollScenes(scenes);
  const resolvedScrollInputScale = resolveScrollInputScale(scrollInputScale);
  const resolvedAutoplay = resolveStoryScrollAutoplay(autoplay);
  const reducedMotionEnabled = Boolean(reducedMotion) || getPrefersReducedMotion();
  const timeline = useMemo(
    () => buildScrollTimeline(scenes, transition, reducedMotionEnabled),
    [reducedMotionEnabled, scenes, transition],
  );
  const totalUnits = getTotalScrollUnits(timeline);
  const activeIndex = clamp(scrollState.activeIndex, 0, Math.max(sceneCount - 1, 0));
  const activeEntry = getTimelineEntryForIndex(timeline, activeIndex);
  const activeScene = activeEntry?.scene;
  const nextScene = scenes[activeIndex + 1];
  const activeTransition = activeEntry?.transition ?? DEFAULT_SCROLL_TRANSITION;
  const transitionProgress =
    activeEntry && activeTransition.type !== "none" && nextScene
      ? clamp((scrollState.unit - activeEntry.bodyEndUnit) / activeTransition.scrollUnits, 0, 1)
      : 0;
  const shouldRenderTransitionPreview =
    activeTransition.type !== "none" && Boolean(nextScene) && transitionProgress > 0;
  const transitionStyles = getScrollTransitionStyles(activeTransition, transitionProgress);

  const updateFromScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const nextState = getNextScrollState(element, timeline);

    scrollValue.set(nextState.value);
    scrollProgress.set(nextState.value / 100);
    setScrollState((current) =>
      shouldUpdateScrollState(current, nextState) ? nextState : current,
    );
  }, [scrollProgress, scrollValue, timeline]);

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

  const scrollByTimelineUnits = useCallback(
    (deltaUnits: number) => {
      const element = scrollRef.current;
      if (!element || deltaUnits === 0 || totalUnits <= 0) return;

      const currentState = getNextScrollState(element, timeline);
      const nextTop = getScrollTopForUnit(element, currentState.unit + deltaUnits, totalUnits);

      setScrollTop(nextTop);
    },
    [setScrollTop, timeline, totalUnits],
  );

  const stopKeyboardScrollHold = useCallback((key?: "ArrowDown" | "ArrowUp") => {
    if (key && keyboardScrollHoldKeyRef.current !== key) return;

    if (typeof window !== "undefined") {
      if (keyboardScrollHoldDelayRef.current !== undefined) {
        window.clearTimeout(keyboardScrollHoldDelayRef.current);
      }

      if (keyboardScrollHoldIntervalRef.current !== undefined) {
        window.clearInterval(keyboardScrollHoldIntervalRef.current);
      }
    }

    keyboardScrollHoldDelayRef.current = undefined;
    keyboardScrollHoldIntervalRef.current = undefined;
    keyboardScrollHoldStartedRef.current = false;
    keyboardScrollHoldKeyRef.current = undefined;
  }, []);

  const startKeyboardScrollHold = useCallback(
    (key: "ArrowDown" | "ArrowUp") => {
      const direction = key === "ArrowDown" ? 1 : -1;
      stopKeyboardScrollHold();

      if (typeof window === "undefined") return;

      keyboardScrollHoldKeyRef.current = key;
      keyboardScrollHoldDelayRef.current = window.setTimeout(() => {
        keyboardScrollHoldStartedRef.current = true;
        keyboardScrollHoldDelayRef.current = undefined;
        keyboardScrollHoldIntervalRef.current = window.setInterval(() => {
          scrollByTimelineUnits(
            direction *
              KEYBOARD_SCROLL_HOLD_UNITS_PER_SECOND *
              resolvedScrollInputScale *
              (KEYBOARD_SCROLL_HOLD_INTERVAL_MS / 1000),
          );
        }, KEYBOARD_SCROLL_HOLD_INTERVAL_MS);
      }, KEYBOARD_SCROLL_TAP_MS);
    },
    [resolvedScrollInputScale, scrollByTimelineUnits, stopKeyboardScrollHold],
  );

  const finishKeyboardScrollPress = useCallback(
    (key: "ArrowDown" | "ArrowUp") => {
      if (keyboardScrollHoldKeyRef.current !== key) return;

      const shouldApplyTap = !keyboardScrollHoldStartedRef.current;
      const direction = key === "ArrowDown" ? 1 : -1;

      stopKeyboardScrollHold(key);

      if (shouldApplyTap) {
        scrollByTimelineUnits(direction * DEFAULT_KEYBOARD_SCROLL_UNITS * resolvedScrollInputScale);
      }
    },
    [resolvedScrollInputScale, scrollByTimelineUnits, stopKeyboardScrollHold],
  );

  const scrollToScene = useCallback(
    (index: number) => {
      const element = scrollRef.current;
      const nextIndex = clamp(index, 0, Math.max(sceneCount - 1, 0));
      const targetEntry = getTimelineEntryForIndex(timeline, nextIndex);
      const targetUnit = targetEntry?.startUnit ?? 0;

      setScrollState({ activeIndex: nextIndex, value: 0, unit: targetUnit });
      scrollValue.set(0);
      scrollProgress.set(0);

      if (!element) return;

      const top = getScrollTopForUnit(element, targetUnit, totalUnits);
      const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);

      if (maxScroll > 0) {
        setScrollTop(top);
      }
    },
    [sceneCount, scrollProgress, scrollValue, setScrollTop, timeline, totalUnits],
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
        unit: clamp(current.unit, 0, totalUnits),
      };

      return shouldUpdateScrollState(current, nextState) ? nextState : current;
    });
  }, [sceneCount, totalUnits]);

  useEffect(() => {
    if (!scrollTarget) return;
    if (handledScrollTargetVersionRef.current === scrollTarget.version) return;

    handledScrollTargetVersionRef.current = scrollTarget.version;
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

      const secondsPerTick = AUTOPLAY_INTERVAL_MS / 1000;
      const delta =
        totalUnits > 0
          ? (maxScroll * resolvedAutoplay.unitsPerSecond * secondsPerTick) / totalUnits
          : 0;

      setScrollTop(element.scrollTop + delta);
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [
    reducedMotion,
    resolvedAutoplay.enabled,
    resolvedAutoplay.unitsPerSecond,
    sceneCount,
    setScrollTop,
    totalUnits,
  ]);

  useEffect(() => {
    if (lastActiveIndexRef.current === activeIndex) {
      return;
    }

    lastActiveIndexRef.current = activeIndex;
    onActiveIndexChange?.(activeIndex);
  }, [activeIndex, onActiveIndexChange]);

  useEffect(() => {
    onSceneProgressChange?.(scrollState.value);
  }, [onSceneProgressChange, scrollState.value]);

  useEffect(() => stopKeyboardScrollHold, [stopKeyboardScrollHold]);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (resolvedScrollInputScale === DEFAULT_SCROLL_INPUT_SCALE) return;

    event.preventDefault();
    scrollByInputDelta(getWheelScrollDelta(event, event.currentTarget) * resolvedScrollInputScale);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!event.repeat) {
          startKeyboardScrollHold("ArrowDown");
        }
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!event.repeat) {
          startKeyboardScrollHold("ArrowUp");
        }
        return;
      case "ArrowRight":
        event.preventDefault();
        stopKeyboardScrollHold();
        scrollToScene(activeIndex + 1);
        return;
      case "ArrowLeft":
        event.preventDefault();
        stopKeyboardScrollHold();
        scrollToScene(activeIndex - 1);
        return;
      case "Home":
        event.preventDefault();
        stopKeyboardScrollHold();
        scrollToScene(0);
        return;
      case "End":
        event.preventDefault();
        stopKeyboardScrollHold();
        scrollToScene(sceneCount - 1);
        return;
      default:
        return;
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        finishKeyboardScrollPress(event.key);
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
      onKeyUp={handleKeyUp}
      onBlur={() => stopKeyboardScrollHold()}
      data-story-scroller-root
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
        <div className="relative" style={{ height: `${Math.max(totalUnits / 100 + 1, 2) * 100}%` }}>
          {timeline.map((entry) => (
            <span
              key={entry.scene.id}
              id={entry.scene.id}
              className="absolute size-px"
              style={{ top: `${(entry.startUnit / Math.max(totalUnits + 100, 1)) * 100}%` }}
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
                style={
                  shouldRenderTransitionPreview
                    ? transitionStyles.activeStyle
                    : { opacity: 1, zIndex: 1 }
                }
                isActive
                scrollToScene={scrollToScene}
              />
            ) : null}
            {shouldRenderTransitionPreview && nextScene ? (
              <StoryScrollMotionFrame
                key={`${nextScene.id}-preview`}
                scene={nextScene}
                sceneIndex={activeIndex + 1}
                sceneCount={sceneCount}
                value={0}
                scrollValue={previewScrollValue}
                scrollProgress={previewScrollProgress}
                style={transitionStyles.previewStyle}
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
  style: CSSProperties;
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
  style,
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
      style={style}
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
  allowBranchReselection = true,
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
        buildStoryPathStateFromHistory(story, nextHistory, nextChoiceIds),
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
          scrollUnits: node.scrollUnits,
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
            const lockedChoiceId = allowBranchReselection
              ? undefined
              : getSelectedBranchChoiceId(story, history, index);
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
              <div className="relative h-full min-h-0">
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
                    lockedChoiceId={lockedChoiceId}
                  />
                ) : null}
              </div>
            );
          },
        };
      }),
    [allowBranchReselection, chooseFrom, history, registry, requestScrollToScene, restart, story],
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
  allowBranchReselection,
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
      allowBranchReselection={allowBranchReselection}
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
  lockedChoiceId?: string;
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
  lockedChoiceId,
}: StoryChoicePanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const revealProgress = clamp(
    (progress - STORY_BRANCH_REVEAL_START) / (STORY_BRANCH_REVEAL_END - STORY_BRANCH_REVEAL_START),
    0,
    1,
  );
  const isReady = revealProgress > 0;
  const isLocked = lockedChoiceId !== undefined;

  useEffect(() => {
    if (!isReady || isLocked || choices.length === 0 || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const scrollerRoot = panelRef.current?.closest("[data-story-scroller-root]");
      const activeElement = document.activeElement;

      if (
        !scrollerRoot ||
        !(activeElement instanceof HTMLElement) ||
        !scrollerRoot.contains(activeElement)
      ) {
        return;
      }

      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const choiceIndex = Number(event.key) - 1;
      const choice = choices[choiceIndex];

      if (!choice || choice.disabled) return;

      event.preventDefault();
      choose(choice.id);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [choose, choices, isLocked, isReady]);

  if (revealProgress <= 0) {
    return null;
  }

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 md:p-5"
      style={{
        opacity: revealProgress,
        transform: `translateY(${(1 - revealProgress) * 1.25}rem)`,
      }}
      aria-hidden={!isReady}
    >
      <div
        ref={panelRef}
        className="pointer-events-auto rounded-lg border border-white/20 bg-background/92 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-md"
      >
        <p className="text-sm font-medium">{prompt}</p>
        {choices.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
            {choices.map((choice, index) => (
              <Button
                key={choice.id}
                type="button"
                variant="outline"
                className={cn(
                  "h-auto justify-start whitespace-normal px-4 py-3 text-left",
                  lockedChoiceId === choice.id ? "border-foreground/40 bg-muted/70" : "",
                )}
                onClick={() => choose(choice.id)}
                disabled={choice.disabled || isLocked || !isReady}
              >
                <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                  <kbd className="row-span-2 inline-flex size-6 items-center justify-center rounded border bg-muted text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </kbd>
                  <span className="font-medium">{choice.label}</span>
                  {choice.description ? (
                    <span className="col-start-2 text-sm font-normal text-muted-foreground">
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
      </div>
    </motion.div>
  );
}
