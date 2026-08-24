"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Button, cn } from "@moritzbrantner/ui";

import {
  StoryActionBar,
  StoryChoiceList,
  StoryChoicePanel,
  StoryControls,
  StoryPathTrail,
  type StoryActionBarProps,
  type StoryChoiceListProps,
  type StoryChoicePanelProps,
  type StoryChoicePanelRenderProps,
  type StoryControlsProps,
  type StoryPathTrailProps,
} from "./story-choice";
import { StoryProgress as StoryProgressView } from "./story-progress";
import { StoryStageFrame } from "./story-stage-frame";
import {
  createStoryPathStateFromHistory,
  useStoryRuntime,
  type UseStoryRuntimeResult,
} from "./story-runtime";
import { getStoryNode } from "./story-validation";
import type {
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNodeData,
  StoryState,
  StoryStateHooks,
  StorySnapshot,
} from "./story-model";
import type { StoryRendererRegistry, StoryRenderProps } from "./story-render-types";
import type { StoryPathState } from "./story-state";

const DEFAULT_STORY_PLAYER_AUTOPLAY_INTERVAL_MS = 3000;

export type StoryPlayerLayout = "split" | "stacked" | "stage-only";

export type StoryPlayerAutoplayOptions = {
  enabled?: boolean;
  intervalMs?: number;
};

export type StoryPlayerAutoplay = boolean | StoryPlayerAutoplayOptions;

export type StoryPlayerSlots<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  stage?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  header?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  controls?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  actions?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  progress?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  trail?: (props: StoryRenderProps<TData, TState>) => ReactNode;
};

export type StoryPlayerModules = {
  header?: boolean;
  controls?: boolean;
  actions?: boolean;
  progress?: boolean;
  trail?: boolean;
  transport?: boolean;
  menu?: boolean;
};

export type StoryPlayerRuntimeProps<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  story: StoryDocument<TData, TState>;
  registry?: StoryRendererRegistry<TData, TState>;
  snapshot?: StorySnapshot<TData, TState>;
  defaultSnapshot?: StorySnapshot<TData, TState>;
  defaultState?: TState;
  hooks?: StoryStateHooks<TData, TState>;
  autoplay?: StoryPlayerAutoplay;
  onChoice?: (
    choice: StoryChoice<TData, TState>,
    history: StoryHistoryEntry<TData, TState>[],
  ) => void;
  onPathChange?: (history: StoryHistoryEntry<TData, TState>[]) => void;
  onSnapshotChange?: (
    snapshot: StorySnapshot<TData, TState>,
    state: StoryPathState<TData, TState>,
  ) => void;
};

export type StoryPlayerRootProps<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = StoryPlayerRuntimeProps<TData, TState> & {
  children?: ReactNode;
};

export type StoryPlayerProps<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = StoryPlayerRuntimeProps<TData, TState> & {
  layout?: StoryPlayerLayout;
  className?: string;
  ariaLabel?: string;
  renderStage?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  renderHeader?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  renderControls?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  renderActions?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  renderProgress?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  renderTrail?: (props: StoryRenderProps<TData, TState>) => ReactNode;
  slots?: StoryPlayerSlots<TData, TState>;
  modules?: StoryPlayerModules;
};

export type StoryPlayerController<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = UseStoryRuntimeResult<TData, TState> & {
  registry?: StoryRendererRegistry<TData, TState>;
  isPlaying: boolean;
  autoplayIntervalMs: number;
  canGoNext: boolean;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  goNext: () => void;
  goToHistoryIndex: (index: number) => void;
};

export type StoryPlayerLayoutProps = {
  layout?: StoryPlayerLayout;
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
};

export type StoryPlayerStageProps<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  className?: string;
  animate?: boolean;
  render?: (props: StoryRenderProps<TData, TState>) => ReactNode;
};

export type StoryPlayerAsideProps = {
  layout?: StoryPlayerLayout;
  className?: string;
  children?: ReactNode;
};

export type StoryPlayerHeaderProps<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  className?: string;
  render?: (props: StoryRenderProps<TData, TState>) => ReactNode;
};

export type StoryPlayerPartProps<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  className?: string;
  render?: (props: StoryRenderProps<TData, TState>) => ReactNode;
};

export type StoryPlayerTransportProps = {
  className?: string;
  children?: ReactNode;
};

export type StoryPlayerButtonProps = {
  className?: string;
  children?: ReactNode;
  ariaLabel?: string;
};

export type StoryPlayerPlayPauseProps = StoryPlayerButtonProps & {
  playLabel?: ReactNode;
  pauseLabel?: ReactNode;
};

export type StoryPlayerMenuProps<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  className?: string;
  ariaLabel?: string;
  renderItem?: (
    entry: StoryHistoryEntry<TData, TState>,
    state: { active: boolean; index: number; title: string },
  ) => ReactNode;
};

export {
  StoryActionBar,
  StoryChoiceList,
  StoryChoicePanel,
  StoryControls,
  StoryPathTrail,
  type StoryActionBarProps,
  type StoryChoiceListProps,
  type StoryChoicePanelProps,
  type StoryChoicePanelRenderProps,
  type StoryControlsProps,
  type StoryPathTrailProps,
};

function resolveStoryPlayerAutoplay(autoplay: StoryPlayerAutoplay | undefined) {
  if (!autoplay) {
    return {
      enabled: false,
      intervalMs: DEFAULT_STORY_PLAYER_AUTOPLAY_INTERVAL_MS,
    };
  }

  if (autoplay === true) {
    return {
      enabled: true,
      intervalMs: DEFAULT_STORY_PLAYER_AUTOPLAY_INTERVAL_MS,
    };
  }

  const intervalMs =
    autoplay.intervalMs === undefined ||
    !Number.isFinite(autoplay.intervalMs) ||
    autoplay.intervalMs <= 0
      ? DEFAULT_STORY_PLAYER_AUTOPLAY_INTERVAL_MS
      : autoplay.intervalMs;

  return {
    enabled: autoplay.enabled ?? true,
    intervalMs,
  };
}

const StoryPlayerContext = createContext<StoryPlayerController | undefined>(undefined);

export function useStoryPlayer<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>() {
  const controller = useContext(StoryPlayerContext);

  if (!controller) {
    throw new Error("useStoryPlayer must be used within StoryPlayer.Root.");
  }

  return controller as StoryPlayerController<TData, TState>;
}

function StoryPlayerRoot<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({
  story: input,
  registry,
  snapshot,
  defaultSnapshot,
  defaultState,
  hooks,
  autoplay,
  children,
  onChoice,
  onPathChange,
  onSnapshotChange,
}: StoryPlayerRootProps<TData, TState>) {
  const runtime = useStoryRuntime(input, {
    snapshot,
    defaultSnapshot,
    defaultState,
    hooks,
    onChoice,
    onPathChange,
    onSnapshotChange,
  });
  const resolvedAutoplay = useMemo(() => resolveStoryPlayerAutoplay(autoplay), [autoplay]);
  const [isPlaying, setPlaying] = useState(resolvedAutoplay.enabled);
  const canGoNext = runtime.choices.length === 1 && !runtime.renderProps.isEnding;

  useEffect(() => {
    setPlaying(resolvedAutoplay.enabled);
  }, [resolvedAutoplay.enabled]);

  const goNext = useCallback(() => {
    const choice = runtime.choices.length === 1 ? runtime.choices[0] : undefined;
    if (!choice || runtime.renderProps.isEnding) return;

    runtime.choose(choice.id);
  }, [runtime]);

  const togglePlaying = useCallback(() => {
    setPlaying((current) => !current);
  }, []);

  const goToHistoryIndex = useCallback(
    (index: number) => {
      const history = runtime.renderProps.history.slice(0, index + 1);
      if (history.length === 0) return;

      runtime.setSnapshot(createStoryPathStateFromHistory(runtime.story, history).snapshot);
    },
    [runtime],
  );

  useEffect(() => {
    if (!isPlaying || !canGoNext || typeof window === "undefined") {
      return;
    }

    const timeout = window.setTimeout(goNext, resolvedAutoplay.intervalMs);
    return () => window.clearTimeout(timeout);
  }, [canGoNext, goNext, isPlaying, resolvedAutoplay.intervalMs, runtime.renderProps.node.id]);

  useEffect(() => {
    if (runtime.renderProps.isEnding) {
      setPlaying(false);
    }
  }, [runtime.renderProps.isEnding]);

  const controller = useMemo<StoryPlayerController<TData, TState>>(
    () => ({
      ...runtime,
      registry,
      isPlaying,
      autoplayIntervalMs: resolvedAutoplay.intervalMs,
      canGoNext,
      setPlaying,
      togglePlaying,
      goNext,
      goToHistoryIndex,
    }),
    [
      canGoNext,
      goNext,
      goToHistoryIndex,
      isPlaying,
      registry,
      resolvedAutoplay.intervalMs,
      runtime,
      togglePlaying,
    ],
  );

  return (
    <StoryPlayerContext.Provider value={controller as StoryPlayerController}>
      {children}
    </StoryPlayerContext.Provider>
  );
}

function StoryPlayerLayout({
  layout = "split",
  className,
  ariaLabel,
  children,
}: StoryPlayerLayoutProps) {
  const player = useStoryPlayer();

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key === "Escape" || event.key === "Backspace") && player.canGoBack) {
      event.preventDefault();
      player.goBack();
    }
  };

  return (
    <section
      role="region"
      aria-label={ariaLabel ?? player.story.title}
      className={cn("overflow-hidden rounded-lg border bg-card", className)}
      onKeyDown={handleKeyDown}
      data-story-player-root
    >
      <div
        className={cn(
          "grid gap-0",
          layout === "split" ? "lg:grid-cols-[1.1fr_0.9fr]" : "",
          layout === "stage-only" ? "block" : "",
        )}
      >
        {children ?? (
          <>
            <StoryPlayerStage />
            {layout !== "stage-only" ? <StoryPlayerAside layout={layout} /> : null}
          </>
        )}
      </div>
    </section>
  );
}

function StoryPlayerStage<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({ className, animate = true, render }: StoryPlayerStageProps<TData, TState>) {
  const player = useStoryPlayer<TData, TState>();
  const reducedMotion = useReducedMotion();
  const stage = render ? (
    render(player.renderProps)
  ) : (
    <StoryStageFrame {...player.renderProps} registry={player.registry} />
  );

  if (!animate) {
    return <div className={cn("p-4 md:p-6", className)}>{stage}</div>;
  }

  return (
    <div className={cn("p-4 md:p-6", className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={player.renderProps.node.id}
          initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
        >
          {stage}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StoryPlayerAside({
  layout = "split",
  className,
  children,
}: StoryPlayerAsideProps) {
  if (layout === "stage-only") {
    return null;
  }

  return (
    <aside
      className={cn(
        "border-t bg-background p-5 md:p-6",
        layout === "split" ? "lg:border-l lg:border-t-0" : "",
        className,
      )}
    >
      <div className="flex h-full flex-col gap-6">
        {children ?? (
          <>
            <StoryPlayerHeader />
            <StoryPlayerControls />
            <div className="mt-auto space-y-5">
              <StoryPlayerActions />
              <StoryPlayerProgress />
              <StoryPlayerTrail />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function StoryPlayerHeader<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({ className, render }: StoryPlayerHeaderProps<TData, TState>) {
  const player = useStoryPlayer<TData, TState>();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const currentNode = player.renderProps.node;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [currentNode.id]);

  if (render) {
    return <>{render(player.renderProps)}</>;
  }

  return (
    <div className={className}>
      {currentNode.eyebrow ? (
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          {currentNode.eyebrow}
        </p>
      ) : null}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-2xl font-semibold tracking-tight outline-none"
      >
        {currentNode.title}
      </h2>
      {player.story.subtitle ? (
        <p className="mt-2 text-sm text-muted-foreground">{player.story.subtitle}</p>
      ) : null}
    </div>
  );
}

function StoryPlayerControlsPart<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({ className, render }: StoryPlayerPartProps<TData, TState>) {
  const player = useStoryPlayer<TData, TState>();
  const currentNode = player.renderProps.node;
  const prompt =
    currentNode.prompt ??
    (player.renderProps.isEnding ? player.labels.endingPrompt : player.labels.choosePrompt);

  if (render) {
    return <>{render(player.renderProps)}</>;
  }

  return (
    <div className={className}>
      <StoryControls
        choices={player.renderProps.choices}
        onChoose={player.renderProps.choose}
        isEnding={player.renderProps.isEnding}
        prompt={prompt}
        completedLabel={player.labels.completedBranch}
      />
    </div>
  );
}

function StoryPlayerActions<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({ className, render }: StoryPlayerPartProps<TData, TState>) {
  const player = useStoryPlayer<TData, TState>();

  if (render) {
    return <>{render(player.renderProps)}</>;
  }

  return (
    <StoryActionBar
      canGoBack={player.renderProps.canGoBack}
      goBack={player.renderProps.goBack}
      restart={player.renderProps.restart}
      backLabel={player.labels.back}
      restartLabel={player.labels.restart}
      className={className}
    />
  );
}

function StoryPlayerProgress<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({ className, render }: StoryPlayerPartProps<TData, TState>) {
  const player = useStoryPlayer<TData, TState>();

  if (render) {
    return <>{render(player.renderProps)}</>;
  }

  return <StoryProgressView value={player.renderProps.progress} className={className} />;
}

function StoryPlayerTrail<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({ className, render }: StoryPlayerPartProps<TData, TState>) {
  const player = useStoryPlayer<TData, TState>();

  if (render) {
    return <>{render(player.renderProps)}</>;
  }

  return (
    <div className={className}>
      <StoryPathTrail story={player.story} history={player.renderProps.history} />
    </div>
  );
}

function StoryPlayerPrevious({ className, children = "Previous", ariaLabel }: StoryPlayerButtonProps) {
  const player = useStoryPlayer();

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={player.goBack}
      disabled={!player.canGoBack}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}

function StoryPlayerPlayPause({
  className,
  children,
  ariaLabel,
  playLabel = "Play",
  pauseLabel = "Pause",
}: StoryPlayerPlayPauseProps) {
  const player = useStoryPlayer();
  const label = player.isPlaying ? pauseLabel : playLabel;

  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      onClick={player.togglePlaying}
      disabled={player.renderProps.isEnding}
      aria-label={ariaLabel}
      aria-pressed={player.isPlaying}
    >
      {children ?? label}
    </Button>
  );
}

function StoryPlayerNext({ className, children = "Next", ariaLabel }: StoryPlayerButtonProps) {
  const player = useStoryPlayer();

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={player.goNext}
      disabled={!player.canGoNext}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}

function StoryPlayerTransport({ className, children }: StoryPlayerTransportProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {children ?? (
        <>
          <StoryPlayerPrevious />
          <StoryPlayerPlayPause />
          <StoryPlayerNext />
        </>
      )}
    </div>
  );
}

function StoryPlayerMenu<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({ className, ariaLabel = "Story menu", renderItem }: StoryPlayerMenuProps<TData, TState>) {
  const player = useStoryPlayer<TData, TState>();
  const history = player.renderProps.history;

  if (history.length < 2) {
    return null;
  }

  return (
    <nav className={cn("rounded-lg border bg-background p-3", className)} aria-label={ariaLabel}>
      <ol className="grid gap-2">
        {history.map((entry, index) => {
          const active = index === history.length - 1;
          const title = getStoryNode(player.story, entry.nodeId).title;

          return (
            <li key={`${entry.nodeId}-${index}`}>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start whitespace-normal border px-3 py-2 text-left",
                  active ? "border-foreground bg-muted/70" : "border-transparent",
                )}
                onClick={() => player.goToHistoryIndex(index)}
                aria-current={active ? "step" : undefined}
              >
                {renderItem ? renderItem(entry, { active, index, title }) : title}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StoryPlayerFacade<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({
  story,
  registry,
  snapshot,
  defaultSnapshot,
  defaultState,
  hooks,
  autoplay,
  layout = "split",
  className,
  ariaLabel,
  renderStage,
  renderHeader,
  renderControls,
  renderActions,
  renderProgress,
  renderTrail,
  slots,
  modules,
  onChoice,
  onPathChange,
  onSnapshotChange,
}: StoryPlayerProps<TData, TState>) {
  const showHeader = modules?.header !== false;
  const showControls = modules?.controls !== false;
  const showActions = modules?.actions !== false;
  const showProgress = modules?.progress !== false;
  const showTrail = modules?.trail !== false;
  const showTransport = modules?.transport === true || autoplay !== undefined;
  const showMenu = modules?.menu === true;
  const showUtilityModules = showActions || showProgress || showTrail || showTransport || showMenu;
  const showAside = layout !== "stage-only" && (showHeader || showControls || showUtilityModules);

  return (
    <StoryPlayerRoot
      story={story}
      registry={registry}
      snapshot={snapshot}
      defaultSnapshot={defaultSnapshot}
      defaultState={defaultState}
      hooks={hooks}
      autoplay={autoplay}
      onChoice={onChoice}
      onPathChange={onPathChange}
      onSnapshotChange={onSnapshotChange}
    >
      <StoryPlayerLayout layout={layout} className={className} ariaLabel={ariaLabel}>
        <StoryPlayerStage render={renderStage ?? slots?.stage} />

        {showAside ? (
          <StoryPlayerAside layout={layout}>
            {showHeader ? <StoryPlayerHeader render={renderHeader ?? slots?.header} /> : null}
            {showControls ? (
              <StoryPlayerControlsPart render={renderControls ?? slots?.controls} />
            ) : null}

            {showUtilityModules ? (
              <div className="mt-auto space-y-5">
                {showTransport ? <StoryPlayerTransport /> : null}
                {showActions ? (
                  <StoryPlayerActions render={renderActions ?? slots?.actions} />
                ) : null}
                {showProgress ? (
                  <StoryPlayerProgress render={renderProgress ?? slots?.progress} />
                ) : null}
                {showTrail ? <StoryPlayerTrail render={renderTrail ?? slots?.trail} /> : null}
                {showMenu ? <StoryPlayerMenu /> : null}
              </div>
            ) : null}
          </StoryPlayerAside>
        ) : null}
      </StoryPlayerLayout>
    </StoryPlayerRoot>
  );
}

export const StoryPlayer = Object.assign(StoryPlayerFacade, {
  Root: StoryPlayerRoot,
  Layout: StoryPlayerLayout,
  Stage: StoryPlayerStage,
  Aside: StoryPlayerAside,
  Header: StoryPlayerHeader,
  Controls: StoryPlayerControlsPart,
  Actions: StoryPlayerActions,
  Progress: StoryPlayerProgress,
  Trail: StoryPlayerTrail,
  Transport: StoryPlayerTransport,
  Previous: StoryPlayerPrevious,
  PlayPause: StoryPlayerPlayPause,
  Next: StoryPlayerNext,
  Menu: StoryPlayerMenu,
});
