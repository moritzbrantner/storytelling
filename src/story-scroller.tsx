"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button, cn } from "@moritzbrantner/ui";

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
  type StoryRuntimeLabels,
} from "./story-runtime";
import { StoryMinimap as StoryMinimapView } from "./story-minimap";
import { resolveStoryPath } from "./story-path";
import { createStoryNodeEntryLookup } from "./story-node-tree";
import { getStoryChoices, getStoryNode, isStoryEnding, validateStory } from "./story-validation";
import type {
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNodeData,
  StoryNodeTreeEntry,
  StoryState,
  StoryStateHooks,
  StorySnapshot,
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

export type StoryScrollerMode = "story" | "scenes";

export type StoryScrollerSceneItem<_TData extends StoryNodeData = StoryNodeData> = {
  id: string;
  title: string;
  eyebrow?: string;
  menuLabel?: string;
  index: number;
  nodeId?: string;
  parentNodeId?: string;
  ancestorNodeIds?: string[];
  depth?: number;
  indexPath?: number[];
};

export type StoryScrollerSceneRenderProps<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> = StoryRenderProps<TData> & StoryScrollSceneRenderProps<TSceneData>;

export type StoryScrollerChoicePanelRenderProps<TData extends StoryNodeData = StoryNodeData> =
  StoryChoicePanelRenderProps<TData>;

export type StoryScrollerMinimapRenderProps<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  items: StoryScrollerSceneItem<TData>[];
  activeIndex: number;
  scrollToScene: (index: number) => void;
  history: StoryHistoryEntry<TData>[];
};

export type StoryScrollerController<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> = {
  mode: StoryScrollerMode;
  story?: StoryDocument<TData>;
  registry?: StoryRendererRegistry<TData>;
  scenes: StoryScrollScene<TSceneData>[];
  items: StoryScrollerSceneItem<TData>[];
  history: StoryHistoryEntry<TData>[];
  activeIndex: number;
  sceneProgress: number;
  scrollTarget?: StoryScrollTarget;
  labels: StoryRuntimeLabels;
  allowBranchReselection?: boolean;
  scrollToScene: (index: number) => void;
  chooseFromScene: (index: number, choiceId: string) => void;
  restart: () => void;
  setActiveIndex: (index: number) => void;
  setSceneProgress: (value: number) => void;
};

export type StoryScrollerSlots<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> = {
  scene?: (props: StoryScrollerSceneRenderProps<TData, TSceneData>) => ReactNode;
  choicePanel?: (props: StoryScrollerChoicePanelRenderProps<TData>) => ReactNode;
  minimap?: (props: StoryScrollerMinimapRenderProps<TData>) => ReactNode;
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

export type StoryScrollerStoryRootProps<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  scenes?: never;
  registry?: StoryRendererRegistry<TData>;
  snapshot?: StorySnapshot<TData>;
  defaultSnapshot?: StorySnapshot<TData>;
  defaultState?: StoryState;
  hooks?: StoryStateHooks<TData>;
  allowBranchReselection?: boolean;
  children?: ReactNode;
  onChoice?: (choice: StoryChoice, history: StoryHistoryEntry<TData>[]) => void;
  onPathChange?: (history: StoryHistoryEntry<TData>[]) => void;
  onSnapshotChange?: (snapshot: StorySnapshot<TData>, state: StoryPathState<TData>) => void;
  onActiveIndexChange?: (index: number) => void;
  onSceneProgressChange?: (value: number) => void;
};

export type StoryScrollerScenesRootProps<TSceneData = unknown> = {
  story?: never;
  scenes: StoryScrollScene<TSceneData>[];
  registry?: never;
  snapshot?: never;
  defaultSnapshot?: never;
  defaultState?: never;
  hooks?: never;
  allowBranchReselection?: never;
  children?: ReactNode;
  onChoice?: never;
  onPathChange?: never;
  onSnapshotChange?: never;
  onActiveIndexChange?: (index: number) => void;
  onSceneProgressChange?: (value: number) => void;
};

export type StoryScrollerControlledRootProps<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> = {
  controller: StoryScrollerController<TData, TSceneData>;
  children?: ReactNode;
};

export type StoryScrollerRootProps<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> =
  | StoryScrollerStoryRootProps<TData>
  | StoryScrollerScenesRootProps<TSceneData>
  | StoryScrollerControlledRootProps<TData, TSceneData>;

export type StoryScrollerCanvasProps<_TSceneData = unknown> = {
  className?: string;
  viewportClassName?: string;
  transition?: StoryScrollTransition;
  scrollInputScale?: number;
  autoplay?: StoryScrollAutoplay;
  ariaLabel?: string;
  children?: ReactNode;
};

export type StoryScrollerStageProps<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> = {
  className?: string;
  render?: (props: StoryScrollerSceneRenderProps<TData, TSceneData>) => ReactNode;
};

export type StoryScrollerOverlaysProps<TData extends StoryNodeData = StoryNodeData> = {
  className?: string;
  choicePanel?: boolean;
  renderChoicePanel?: (props: StoryScrollerChoicePanelRenderProps<TData>) => ReactNode;
};

export type StoryScrollerMenuProps<TData extends StoryNodeData = StoryNodeData> = {
  className?: string;
  ariaLabel?: string;
  orientation?: "vertical" | "horizontal";
  renderItem?: (item: StoryScrollerSceneItem<TData>, state: { active: boolean }) => ReactNode;
};

export type StoryScrollerMinimapProps<TData extends StoryNodeData = StoryNodeData> = {
  className?: string;
  ariaLabel?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  renderItem?: (item: StoryScrollerSceneItem<TData>, state: { active: boolean }) => ReactNode;
};

export type StoryScrollerProps<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> = {
  story?: StoryDocument<TData>;
  scenes?: StoryScrollScene<TSceneData>[];
  registry?: StoryRendererRegistry<TData>;
  snapshot?: StorySnapshot<TData>;
  defaultSnapshot?: StorySnapshot<TData>;
  defaultState?: StoryState;
  hooks?: StoryStateHooks<TData>;
  allowBranchReselection?: boolean;
  className?: string;
  viewportClassName?: string;
  transition?: StoryScrollTransition;
  scrollInputScale?: number;
  autoplay?: StoryScrollAutoplay;
  ariaLabel?: string;
  renderScene?: (props: StoryScrollerSceneRenderProps<TData, TSceneData>) => ReactNode;
  renderChoicePanel?: (props: StoryScrollerChoicePanelRenderProps<TData>) => ReactNode;
  renderMinimap?: (props: StoryScrollerMinimapRenderProps<TData>) => ReactNode;
  slots?: StoryScrollerSlots<TData, TSceneData>;
  modules?: StoryScrollerModules;
  onChoice?: (choice: StoryChoice, history: StoryHistoryEntry<TData>[]) => void;
  onPathChange?: (history: StoryHistoryEntry<TData>[]) => void;
  onSnapshotChange?: (snapshot: StorySnapshot<TData>, state: StoryPathState<TData>) => void;
  onActiveIndexChange?: (index: number) => void;
  onSceneProgressChange?: (value: number) => void;
};

type StoryScrollerSceneContextValue<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
> = {
  isStoryScene: boolean;
  item: StoryScrollerSceneItem<TData>;
  scene: StoryScrollScene<TSceneData>;
  scroll: StoryScrollSceneRenderProps<TSceneData>;
  storyRenderProps?: StoryScrollerSceneRenderProps<TData, TSceneData>;
  choicePanelProps?: StoryScrollerChoicePanelRenderProps<TData>;
};

const StoryScrollerContext = createContext<StoryScrollerController | undefined>(undefined);
const StoryScrollerSceneContext = createContext<StoryScrollerSceneContextValue | undefined>(
  undefined,
);

function resolveInitialHistory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  snapshot?: StorySnapshot<TData>,
  defaultState?: StoryState,
  hooks?: StoryStateHooks<TData>,
) {
  if (snapshot) {
    return snapshot.history;
  }

  return resolveStoryPath(story, {
    defaultState,
    hooks,
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

function resolveStoryScrollerLabels(labels: StoryDocument["labels"]): StoryRuntimeLabels {
  return {
    back: labels?.back ?? "Go back",
    restart: labels?.restart ?? "Restart",
    choosePrompt: labels?.choosePrompt ?? "Choose what happens next.",
    endingPrompt: labels?.endingPrompt ?? "This branch is complete.",
    completedBranch:
      labels?.completedBranch ??
      "Restart to explore another branch, or go back to choose a different path.",
  };
}

function createSceneItemsFromStory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  scenes: StoryScrollScene[],
  history: StoryHistoryEntry<TData>[],
  nodeEntryLookup: Map<string, StoryNodeTreeEntry<TData>>,
): StoryScrollerSceneItem<TData>[] {
  return scenes.map((scene, index) => {
    const nodeEntry = history[index]?.nodeId
      ? nodeEntryLookup.get(history[index]!.nodeId)
      : undefined;

    return {
      id: scene.id,
      title: scene.title,
      eyebrow: scene.eyebrow,
      menuLabel: scene.menuLabel,
      index,
      nodeId: nodeEntry?.nodeId,
      parentNodeId: nodeEntry?.parentNodeId,
      ancestorNodeIds: nodeEntry?.ancestorNodeIds,
      depth: nodeEntry?.depth,
      indexPath: nodeEntry?.indexPath,
    };
  });
}

function createSceneItemsFromScenes<TSceneData>(
  scenes: StoryScrollScene<TSceneData>[],
): StoryScrollerSceneItem[] {
  return scenes.map((scene, index) => ({
    id: scene.id,
    title: scene.title,
    eyebrow: scene.eyebrow,
    menuLabel: scene.menuLabel,
    index,
  }));
}

export function useStoryScrollerController<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
>(
  options: StoryScrollerStoryRootProps<TData> | StoryScrollerScenesRootProps<TSceneData>,
): StoryScrollerController<TData, TSceneData> {
  if ("scenes" in options && options.scenes) {
    return useCustomSceneScrollerController(options) as StoryScrollerController<TData, TSceneData>;
  }

  return useStoryDocumentScrollerController(options) as StoryScrollerController<TData, TSceneData>;
}

function useCustomSceneScrollerController<TSceneData>(
  options: StoryScrollerScenesRootProps<TSceneData>,
): StoryScrollerController<StoryNodeData, TSceneData> {
  const [scrollTarget, setScrollTarget] = useState<StoryScrollTarget | undefined>();
  const [activeIndex, setActiveIndexState] = useState(0);
  const [sceneProgress, setSceneProgressState] = useState(0);
  const items = useMemo(() => createSceneItemsFromScenes(options.scenes), [options.scenes]);

  const scrollToScene = useCallback((index: number) => {
    setScrollTarget((current) => ({ index, version: (current?.version ?? 0) + 1 }));
  }, []);

  const setActiveIndex = useCallback(
    (index: number) => {
      setActiveIndexState(index);
      options.onActiveIndexChange?.(index);
    },
    [options],
  );

  const setSceneProgress = useCallback(
    (value: number) => {
      setSceneProgressState(value);
      options.onSceneProgressChange?.(value);
    },
    [options],
  );

  return {
    mode: "scenes",
    scenes: options.scenes,
    items,
    history: [],
    activeIndex,
    sceneProgress,
    scrollTarget,
    labels: resolveStoryScrollerLabels(undefined),
    allowBranchReselection: true,
    scrollToScene,
    chooseFromScene: () => {},
    restart: () => scrollToScene(0),
    setActiveIndex,
    setSceneProgress,
  };
}

function useStoryDocumentScrollerController<TData extends StoryNodeData>(
  options: StoryScrollerStoryRootProps<TData>,
): StoryScrollerController<TData, unknown> {
  const {
    story: input,
    registry,
    snapshot,
    defaultSnapshot,
    defaultState,
    hooks,
    allowBranchReselection = true,
    onChoice,
    onPathChange,
    onSnapshotChange,
    onActiveIndexChange,
    onSceneProgressChange,
  } = options;
  const story = useMemo(() => validateStory(input), [input]);
  const labels = useMemo(() => resolveStoryScrollerLabels(story.labels), [story.labels]);
  const defaultSnapshotRef = useRef(defaultSnapshot);
  const isSnapshotControlled = snapshot !== undefined;
  const initialHistory = useMemo(
    () => resolveInitialHistory(story, snapshot ?? defaultSnapshotRef.current, defaultState, hooks),
    [defaultState, hooks, snapshot, story],
  );
  const nodeEntryLookup = useMemo(() => createStoryNodeEntryLookup(story), [story]);
  const [history, setHistory] = useState<StoryHistoryEntry<TData>[]>(() => initialHistory);
  const [scrollTarget, setScrollTarget] = useState<StoryScrollTarget | undefined>();
  const [activeIndex, setActiveIndexState] = useState(0);
  const [sceneProgress, setSceneProgressState] = useState(0);

  useEffect(() => {
    setHistory(initialHistory);
    setScrollTarget((current) => ({ index: 0, version: (current?.version ?? 0) + 1 }));
  }, [initialHistory]);

  useEffect(() => {
    onPathChange?.(history);
  }, [history, onPathChange]);

  const scrollToScene = useCallback((index: number) => {
    setScrollTarget((current) => ({ index, version: (current?.version ?? 0) + 1 }));
  }, []);

  const chooseFromScene = useCallback(
    (index: number, choiceId: string) => {
      const entry = history[index];
      if (!entry) return;
      if (!allowBranchReselection && getSelectedBranchChoiceId(story, history, index)) return;

      const node = getStoryNode(story, entry.nodeId);
      const choice = getStoryChoices(story, node).find(
        (candidate) => candidate.id === choiceId && !candidate.disabled,
      );
      if (!choice) return;

      const nextPath = resolveStoryPath(story, {
        snapshot: createStoryPathStateFromHistory(story, history.slice(0, index + 1)).snapshot,
        choose: choice.id,
        defaultState,
        hooks,
        autoAdvanceLinearNodes: true,
      });
      const nextHistory = nextPath.history;
      const nextActiveIndex = Math.min(index + 1, nextHistory.length - 1);

      if (!isSnapshotControlled) {
        setHistory(nextHistory);
      }

      scrollToScene(nextActiveIndex);
      onChoice?.(choice, nextHistory);
      onSnapshotChange?.(nextPath.snapshot, createStoryPathStateFromHistory(story, nextHistory));
    },
    [
      allowBranchReselection,
      defaultState,
      hooks,
      history,
      isSnapshotControlled,
      onChoice,
      onSnapshotChange,
      scrollToScene,
      story,
    ],
  );

  const restart = useCallback(() => {
    const nextPath = resolveStoryPath(story, {
      defaultState,
      hooks,
      autoAdvanceLinearNodes: true,
    });
    const nextHistory = nextPath.history;

    if (!isSnapshotControlled) {
      setHistory(nextHistory);
    }

    scrollToScene(0);
    onSnapshotChange?.(nextPath.snapshot, createStoryPathStateFromHistory(story, nextHistory));
  }, [defaultState, hooks, isSnapshotControlled, onSnapshotChange, scrollToScene, story]);

  const scenes = useMemo<StoryScrollScene[]>(
    () =>
      history.map((entry) => {
        const node = getStoryNode(story, entry.nodeId);

        return {
          id: getStoryScrollerPageId(story.id, node.id),
          title: node.title,
          eyebrow: node.eyebrow,
          scrollUnits: node.scrollUnits,
          render: () => null,
        };
      }),
    [history, story],
  );
  const items = useMemo(
    () => createSceneItemsFromStory(story, scenes, history, nodeEntryLookup),
    [history, nodeEntryLookup, scenes, story],
  );

  const setActiveIndex = useCallback(
    (index: number) => {
      setActiveIndexState(index);
      onActiveIndexChange?.(index);
    },
    [onActiveIndexChange],
  );

  const setSceneProgress = useCallback(
    (value: number) => {
      setSceneProgressState(value);
      onSceneProgressChange?.(value);
    },
    [onSceneProgressChange],
  );

  return {
    mode: "story",
    story,
    registry,
    scenes: scenes as StoryScrollScene<unknown>[],
    items,
    history,
    activeIndex,
    sceneProgress,
    scrollTarget,
    labels,
    allowBranchReselection,
    scrollToScene,
    chooseFromScene,
    restart,
    setActiveIndex,
    setSceneProgress,
  };
}

export function useStoryScroller<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
>() {
  const controller = useContext(StoryScrollerContext);

  if (!controller) {
    throw new Error("useStoryScroller must be used within StoryScroller.Root.");
  }

  return controller as StoryScrollerController<TData, TSceneData>;
}

export function useStoryScrollerScene<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
>() {
  const scene = useContext(StoryScrollerSceneContext);

  if (!scene) {
    throw new Error("useStoryScrollerScene must be used within StoryScroller.Canvas.");
  }

  return scene as StoryScrollerSceneContextValue<TData, TSceneData>;
}

function createStoryScrollerSceneContext<TData extends StoryNodeData, TSceneData>(
  controller: StoryScrollerController<TData, TSceneData>,
  scene: StoryScrollScene<TSceneData>,
  scrollProps: StoryScrollSceneRenderProps<TSceneData>,
): StoryScrollerSceneContextValue<TData, TSceneData> {
  const item =
    controller.items[scrollProps.sceneIndex] ??
    ({
      id: scene.id,
      title: scene.title,
      eyebrow: scene.eyebrow,
      menuLabel: scene.menuLabel,
      index: scrollProps.sceneIndex,
    } satisfies StoryScrollerSceneItem<TData>);

  if (controller.mode !== "story" || !controller.story) {
    return {
      isStoryScene: false,
      item,
      scene,
      scroll: scrollProps,
    };
  }

  const entry = controller.history[scrollProps.sceneIndex];
  const node = entry ? getStoryNode(controller.story, entry.nodeId) : undefined;

  if (!entry || !node) {
    return {
      isStoryScene: true,
      item,
      scene,
      scroll: scrollProps,
    };
  }

  const nodeHistory = controller.history.slice(0, scrollProps.sceneIndex + 1);
  const nodePath = buildPathFromHistory(controller.story, nodeHistory);
  const explicitChoices = node.choices ?? [];
  const ending = isStoryEnding(controller.story, node);
  const lockedChoiceId = controller.allowBranchReselection
    ? undefined
    : getSelectedBranchChoiceId(controller.story, controller.history, scrollProps.sceneIndex);
  const renderProps = createStoryRenderProps({
    story: controller.story,
    path: { ...nodePath, currentNode: node, completed: ending },
    nodeEntry: item.nodeId
      ? createStoryNodeEntryLookup(controller.story).get(item.nodeId)
      : undefined,
    history: nodeHistory,
    currentIndex: scrollProps.sceneIndex,
    progress: scrollProps.progress,
    choices: explicitChoices,
    canGoBack: scrollProps.sceneIndex > 0,
    choose: (choiceId: string) => controller.chooseFromScene(scrollProps.sceneIndex, choiceId),
    goBack: () => controller.scrollToScene(scrollProps.sceneIndex - 1),
    restart: controller.restart,
  });
  const prompt =
    node.prompt ?? (ending ? controller.labels.endingPrompt : controller.labels.choosePrompt);
  const revealProgress = getChoicePanelRevealProgress(scrollProps.progress);
  const choicePanelProps: StoryScrollerChoicePanelRenderProps<TData> = {
    ...renderProps,
    prompt,
    completedLabel: controller.labels.completedBranch,
    restartLabel: controller.labels.restart,
    lockedChoiceId,
    revealProgress,
    isReady: revealProgress > 0,
  };

  return {
    isStoryScene: true,
    item,
    scene,
    scroll: scrollProps,
    storyRenderProps: { ...renderProps, ...scrollProps },
    choicePanelProps,
  };
}

function StoryScrollerContextProvider<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
>({ controller, children }: StoryScrollerControlledRootProps<TData, TSceneData>) {
  return (
    <StoryScrollerContext.Provider value={controller as StoryScrollerController}>
      {children}
    </StoryScrollerContext.Provider>
  );
}

function StoryScrollerManagedRoot<
  TData extends StoryNodeData = StoryNodeData,
  TSceneData = unknown,
>(props: StoryScrollerStoryRootProps<TData> | StoryScrollerScenesRootProps<TSceneData>) {
  const controller = useStoryScrollerController(props);

  return (
    <StoryScrollerContextProvider controller={controller}>
      {props.children}
    </StoryScrollerContextProvider>
  );
}

function StoryScrollerRoot<TData extends StoryNodeData = StoryNodeData, TSceneData = unknown>(
  props: StoryScrollerRootProps<TData, TSceneData>,
) {
  if ("controller" in props) {
    return (
      <StoryScrollerContextProvider controller={props.controller}>
        {props.children}
      </StoryScrollerContextProvider>
    );
  }

  return <StoryScrollerManagedRoot {...props}>{props.children}</StoryScrollerManagedRoot>;
}

function StoryScrollerCanvas<TSceneData = unknown>({
  className,
  viewportClassName,
  transition,
  scrollInputScale,
  autoplay,
  ariaLabel,
  children,
}: StoryScrollerCanvasProps<TSceneData>) {
  const controller = useStoryScroller<StoryNodeData, TSceneData>();
  const content = children ?? (
    <>
      <StoryScrollerStage />
      <StoryScrollerOverlays />
    </>
  );
  const timelineScenes = useMemo<StoryScrollScene<TSceneData>[]>(
    () =>
      controller.scenes.map((scene) => ({
        ...scene,
        render: (scrollProps) => {
          const sceneContext = createStoryScrollerSceneContext(controller, scene, scrollProps);

          return (
            <StoryScrollerSceneContext.Provider
              value={sceneContext as StoryScrollerSceneContextValue}
            >
              {content}
            </StoryScrollerSceneContext.Provider>
          );
        },
      })),
    [content, controller],
  );

  return (
    <StoryScrollTimeline
      scenes={timelineScenes}
      className={className}
      viewportClassName={viewportClassName}
      transition={transition}
      scrollInputScale={scrollInputScale}
      autoplay={autoplay}
      ariaLabel={ariaLabel ?? controller.story?.labels?.scrollerLabel ?? controller.story?.title}
      scrollTarget={controller.scrollTarget}
      onActiveIndexChange={controller.setActiveIndex}
      onSceneProgressChange={controller.setSceneProgress}
    />
  );
}

function StoryScrollerStage<TData extends StoryNodeData = StoryNodeData, TSceneData = unknown>({
  className,
  render,
}: StoryScrollerStageProps<TData, TSceneData>) {
  const controller = useStoryScroller<TData, TSceneData>();
  const scene = useStoryScrollerScene<TData, TSceneData>();

  if (scene.isStoryScene && scene.storyRenderProps) {
    return render ? (
      render(scene.storyRenderProps)
    ) : (
      <StoryStageFrame
        {...scene.storyRenderProps}
        registry={controller.registry}
        className={cn("h-full min-h-0", className)}
      />
    );
  }

  if (render) {
    return render(
      (scene.storyRenderProps ?? scene.scroll) as StoryScrollerSceneRenderProps<TData, TSceneData>,
    );
  }

  return <>{scene.scene.render(scene.scroll)}</>;
}

function StoryScrollerChoicePanel<TData extends StoryNodeData = StoryNodeData>({
  className,
  renderChoicePanel,
}: Pick<StoryScrollerOverlaysProps<TData>, "className" | "renderChoicePanel">) {
  const scene = useContext(StoryScrollerSceneContext) as
    | StoryScrollerSceneContextValue<TData>
    | undefined;

  if (!scene) {
    return null;
  }

  const props = scene.choicePanelProps;

  if (!scene.isStoryScene || !props) {
    return null;
  }

  const explicitChoices = props.node.choices ?? [];
  const ending = props.isEnding;
  const panel = renderChoicePanel ? (
    renderChoicePanel(props)
  ) : (
    <StoryChoicePanel
      choices={explicitChoices}
      onChoose={props.choose}
      isEnding={ending}
      prompt={props.prompt}
      completedLabel={props.completedLabel}
      restartLabel={props.restartLabel}
      restart={props.restart}
      progress={scene.scroll.progress}
      lockedChoiceId={props.lockedChoiceId}
    />
  );

  return className ? <div className={className}>{panel}</div> : <>{panel}</>;
}

function StoryScrollerOverlays<TData extends StoryNodeData = StoryNodeData>({
  className,
  choicePanel = true,
  renderChoicePanel,
}: StoryScrollerOverlaysProps<TData>) {
  if (!choicePanel) {
    return null;
  }

  return <StoryScrollerChoicePanel className={className} renderChoicePanel={renderChoicePanel} />;
}

function StoryScrollerMenu<TData extends StoryNodeData = StoryNodeData>({
  className,
  ariaLabel = "Story menu",
  orientation = "vertical",
  renderItem,
}: StoryScrollerMenuProps<TData>) {
  const controller = useStoryScroller<TData>();

  if (controller.items.length < 2) {
    return null;
  }

  return (
    <nav className={cn("rounded-lg border bg-background p-3", className)} aria-label={ariaLabel}>
      <ol
        className={cn(
          "story-steps-scrollbar-hidden gap-2",
          orientation === "horizontal" ? "flex overflow-x-auto pb-1" : "grid",
        )}
      >
        {controller.items.map((item, index) => {
          const isActive = index === controller.activeIndex;

          return (
            <li key={item.id} className={orientation === "horizontal" ? "shrink-0" : undefined}>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "flex h-auto w-full min-w-[10rem] items-start justify-start gap-3 whitespace-normal rounded-md border px-3 py-3 text-left",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground",
                )}
                onClick={() => controller.scrollToScene(index)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Go to scene ${index + 1}: ${item.title}`}
              >
                {renderItem ? (
                  renderItem(item, { active: isActive })
                ) : (
                  <>
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold",
                        isActive
                          ? "border-background/30 text-background"
                          : "border-border text-muted-foreground",
                      )}
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-xs uppercase tracking-[0.14em]",
                          isActive ? "text-background/75" : "text-muted-foreground",
                        )}
                      >
                        {item.menuLabel ?? item.eyebrow ?? `Scene ${index + 1}`}
                      </span>
                      <span className="mt-1 block text-sm font-medium leading-5">{item.title}</span>
                    </span>
                  </>
                )}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StoryScrollerMinimap<TData extends StoryNodeData = StoryNodeData>({
  className,
  ariaLabel,
  collapsible,
  defaultCollapsed,
  collapsed,
  onCollapsedChange,
  renderItem,
}: StoryScrollerMinimapProps<TData>) {
  const controller = useStoryScroller<TData>();

  if (controller.items.length < 2) {
    return null;
  }

  if (renderItem) {
    return (
      <nav
        className={cn("rounded-lg border bg-background p-3", className)}
        aria-label={ariaLabel ?? "Story minimap"}
      >
        <ol className="story-steps-scrollbar-hidden flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {controller.items.map((item, index) => {
            const isActive = index === controller.activeIndex;

            return (
              <li key={item.id} className="shrink-0 lg:shrink">
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "flex h-auto min-w-[10rem] items-start justify-start gap-3 whitespace-normal rounded-md border px-3 py-3 text-left lg:min-w-0 lg:w-full",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground",
                  )}
                  onClick={() => controller.scrollToScene(index)}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Go to scene ${index + 1}: ${item.title}`}
                >
                  {renderItem(item, { active: isActive })}
                </Button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <StoryMinimapView
      items={controller.items}
      activeIndex={controller.activeIndex}
      onSelect={controller.scrollToScene}
      collapsible={collapsible}
      defaultCollapsed={defaultCollapsed}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}

function StoryScrollerLayout({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return <div className={className}>{children}</div>;
}

function CompatibilityMinimap<TData extends StoryNodeData = StoryNodeData>({
  render,
  options,
}: {
  render?: (props: StoryScrollerMinimapRenderProps<TData>) => ReactNode;
  options?: StoryScrollerMinimapModuleOptions;
}) {
  const controller = useStoryScroller<TData>();

  if (render && controller.story) {
    return (
      <>
        {render({
          story: controller.story,
          items: controller.items,
          activeIndex: controller.activeIndex,
          scrollToScene: controller.scrollToScene,
          history: controller.history,
        })}
      </>
    );
  }

  return (
    <StoryScrollerMinimap
      collapsible={options?.collapsible}
      defaultCollapsed={options?.defaultCollapsed}
      className={options?.className}
      ariaLabel={options?.ariaLabel}
    />
  );
}

function StoryScrollerFacade<TData extends StoryNodeData = StoryNodeData, TSceneData = unknown>({
  story,
  scenes,
  registry,
  snapshot,
  defaultSnapshot,
  defaultState,
  hooks,
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
  onSnapshotChange,
  onActiveIndexChange,
  onSceneProgressChange,
}: StoryScrollerProps<TData, TSceneData>) {
  const minimapSlot = renderMinimap ?? slots?.minimap;
  const minimapOptions = typeof modules?.minimap === "object" ? modules.minimap : undefined;
  const showDefaultMinimap =
    modules?.minimap === true || (Boolean(minimapOptions) && minimapOptions?.enabled !== false);
  const choicePanelEnabled = modules?.choicePanel !== false;

  if (scenes) {
    return (
      <StoryScrollerRoot
        scenes={scenes}
        onActiveIndexChange={onActiveIndexChange}
        onSceneProgressChange={onSceneProgressChange}
      >
        {showDefaultMinimap ? <CompatibilityMinimap options={minimapOptions} /> : null}
        <StoryScrollerCanvas
          className={className}
          viewportClassName={viewportClassName}
          transition={transition}
          scrollInputScale={scrollInputScale}
          autoplay={autoplay}
          ariaLabel={ariaLabel}
        />
      </StoryScrollerRoot>
    );
  }

  if (!story) {
    throw new Error("StoryScroller requires either a story or a scenes array.");
  }

  return (
    <StoryScrollerRoot
      story={story}
      registry={registry}
      snapshot={snapshot}
      defaultSnapshot={defaultSnapshot}
      defaultState={defaultState}
      hooks={hooks}
      allowBranchReselection={allowBranchReselection}
      onChoice={onChoice}
      onPathChange={onPathChange}
      onSnapshotChange={onSnapshotChange}
      onActiveIndexChange={onActiveIndexChange}
      onSceneProgressChange={onSceneProgressChange}
    >
      {minimapSlot || showDefaultMinimap ? (
        <CompatibilityMinimap render={minimapSlot} options={minimapOptions} />
      ) : null}
      <StoryScrollerCanvas
        className={className}
        viewportClassName={viewportClassName}
        transition={transition}
        scrollInputScale={scrollInputScale}
        autoplay={autoplay}
        ariaLabel={ariaLabel}
      >
        <div className="relative h-full min-h-0">
          <StoryScrollerStage render={renderScene ?? slots?.scene} />
          <StoryScrollerOverlays
            choicePanel={choicePanelEnabled}
            renderChoicePanel={renderChoicePanel ?? slots?.choicePanel}
          />
        </div>
      </StoryScrollerCanvas>
    </StoryScrollerRoot>
  );
}

export const StoryScroller = Object.assign(StoryScrollerFacade, {
  Root: StoryScrollerRoot,
  Canvas: StoryScrollerCanvas,
  Stage: StoryScrollerStage,
  Overlays: StoryScrollerOverlays,
  ChoicePanel: StoryScrollerChoicePanel,
  Minimap: StoryScrollerMinimap,
  Menu: StoryScrollerMenu,
  Layout: StoryScrollerLayout,
});

export type { StoryScrollTimelineProps };
