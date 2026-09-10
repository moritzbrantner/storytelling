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

import { cn } from "./ui";

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

type ScrollState = {
  activeIndex: number;
  value: number;
  unit: number;
};

export type StoryScrollTarget = {
  index: number;
  version: number;
};

export type StoryScrollTimelineProps<TSceneData = unknown> = {
  scenes: StoryScrollScene<TSceneData>[];
  className?: string;
  viewportClassName?: string;
  transition?: StoryScrollTransition;
  scrollInputScale?: number;
  autoplay?: StoryScrollAutoplay;
  ariaLabel?: string;
  scrollTarget?: StoryScrollTarget;
  onActiveIndexChange?: (index: number) => void;
  onSceneProgressChange?: (value: number) => void;
};

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
const DEFAULT_SCROLL_TRANSITION_DIRECTION: StoryScrollDirection = "up";
const DEFAULT_SCROLL_TRANSITION_FROM_SCALE = 0.92;
const DEFAULT_SCROLL_TRANSITION_TO_SCALE = 1.06;
const DEFAULT_SCROLL_TRANSITION_MAX_BLUR = 16;
const MIN_SCROLL_TRANSITION_SCALE = 0.1;
const MAX_SCROLL_TRANSITION_SCALE = 4;
const MAX_SCROLL_TRANSITION_BLUR = 64;
const SCROLL_UNIT_SNAP_EPSILON = 0.000001;

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

export type StoryScrollTimelineEntry<TSceneData = unknown> = {
  scene: StoryScrollScene<TSceneData>;
  sceneIndex: number;
  startUnit: number;
  bodyEndUnit: number;
  endUnit: number;
  scrollUnits: number;
  transition: StoryScrollTransition;
};

export function buildScrollTimeline<TSceneData>(
  scenes: StoryScrollScene<TSceneData>[],
  transition: StoryScrollTransition | undefined,
  reducedMotion = false,
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

export type StoryScrollTransitionStyles = {
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

export function getScrollTransitionStyles(
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

function getScrollUnitSnapTolerance(totalUnits: number, maxScroll: number) {
  if (maxScroll <= 0 || totalUnits <= 0) {
    return 0;
  }

  return totalUnits / maxScroll + SCROLL_UNIT_SNAP_EPSILON;
}

function snapUnitToTargetSceneStart(
  unit: number,
  targetUnit: number | undefined,
  tolerance: number,
) {
  if (targetUnit === undefined || tolerance <= 0) {
    return unit;
  }

  if (Math.abs(unit - targetUnit) <= tolerance) {
    return targetUnit;
  }

  return unit;
}

function getNextScrollState<TSceneData>(
  element: HTMLElement,
  timeline: StoryScrollTimelineEntry<TSceneData>[],
  targetStartUnit?: number,
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
  const roundedUnit = Math.round(rawUnit * SCROLL_UNIT_PRECISION) / SCROLL_UNIT_PRECISION;
  const unit = snapUnitToTargetSceneStart(
    roundedUnit,
    targetStartUnit,
    getScrollUnitSnapTolerance(totalUnits, maxScroll),
  );

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

export type UseStoryScrollTimelineOptions<TSceneData = unknown> = {
  scenes: StoryScrollScene<TSceneData>[];
  transition?: StoryScrollTransition;
  reducedMotion?: boolean;
};

export type UseStoryScrollTimelineResult<TSceneData = unknown> = {
  timeline: StoryScrollTimelineEntry<TSceneData>[];
  totalUnits: number;
  reducedMotion: boolean;
};

export function useStoryScrollTimeline<TSceneData = unknown>({
  scenes,
  transition,
  reducedMotion,
}: UseStoryScrollTimelineOptions<TSceneData>): UseStoryScrollTimelineResult<TSceneData> {
  const systemReducedMotion = useReducedMotion();
  const resolvedReducedMotion =
    reducedMotion ?? (Boolean(systemReducedMotion) || getPrefersReducedMotion());
  const timeline = useMemo(
    () => buildScrollTimeline(scenes, transition, resolvedReducedMotion),
    [resolvedReducedMotion, scenes, transition],
  );

  return {
    timeline,
    totalUnits: getTotalScrollUnits(timeline),
    reducedMotion: resolvedReducedMotion,
  };
}

export function StoryScrollTimeline<TSceneData = unknown>({
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
  const targetSceneStartUnitRef = useRef<number | undefined>(undefined);
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
  const {
    timeline,
    totalUnits,
    reducedMotion: reducedMotionEnabled,
  } = useStoryScrollTimeline({
    scenes,
    transition,
  });
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

    const nextState = getNextScrollState(element, timeline, targetSceneStartUnitRef.current);
    const targetStartUnit = targetSceneStartUnitRef.current;

    if (targetStartUnit !== undefined) {
      const maxScroll = Math.max(element.scrollHeight - element.clientHeight, 0);
      const targetTolerance = getScrollUnitSnapTolerance(getTotalScrollUnits(timeline), maxScroll);

      if (Math.abs(nextState.unit - targetStartUnit) > targetTolerance) {
        targetSceneStartUnitRef.current = undefined;
      }
    }

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

      targetSceneStartUnitRef.current = targetUnit;
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
    const shouldAutoplay = resolvedAutoplay.enabled && sceneCount > 0 && !reducedMotionEnabled;

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
    reducedMotionEnabled,
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

export type StoryScrollFrameProps<TSceneData = unknown> = {
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
}: StoryScrollFrameProps<TSceneData>) {
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
