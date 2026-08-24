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

import { Button, cn } from "@moritzbrantner/ui";

import type {
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNodeData,
  StoryState,
  StoryStateHooks,
  StorySnapshot,
} from "./story-model";
import {
  StoryActionBar,
  StoryControls,
  StoryPathTrail,
  StoryPlayer as StoryPlayerFacade,
  type StoryPlayerLayout,
} from "./story-player";
import { StoryProgress as StoryProgressView } from "./story-progress";
import type { StoryRendererRegistry, StoryRenderProps } from "./story-render-types";
import {
  createStoryPathStateFromHistory,
  useStoryRuntime,
  type UseStoryRuntimeResult,
} from "./story-runtime";
import { StoryStageFrame } from "./story-stage-frame";
import type { StoryPathState } from "./story-state";
import { getStoryNode } from "./story-validation";

const DEFAULT_AUTOPLAY_INTERVAL_MS = 3000;

export type StoryPlayerAutoplayOptions = {
  enabled?: boolean;
  intervalMs?: number;
};

export type StoryPlayerAutoplay = boolean | StoryPlayerAutoplayOptions;

export type StoryPlayerRootProps<
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
  children?: ReactNode;
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

export type StoryPlayerController<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = UseStoryRuntimeResult<TData, TState> & {
  registry?: StoryRendererRegistry<TData, TState>;
  isPlaying: boolean;
  canGoNext: boolean;
  autoplayIntervalMs: number;
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
  render?: (props: StoryRenderProps<TData, TState>) => ReactNode;
};

export type StoryPlayerAsideProps = {
  layout?: StoryPlayerLayout;
  className?: string;
  children?: ReactNode;
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

const StoryPlayerContext = createContext<unknown>(undefined);

function resolveAutoplay(autoplay: StoryPlayerAutoplay | undefined) {
  const options = typeof autoplay === "object" ? autoplay : undefined;
  const intervalMs = options?.intervalMs;

  return {
    enabled: typeof autoplay === "boolean" ? autoplay : (options?.enabled ?? false),
    intervalMs:
      intervalMs !== undefined && Number.isFinite(intervalMs) && intervalMs > 0
        ? intervalMs
        : DEFAULT_AUTOPLAY_INTERVAL_MS,
  };
}

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
  story,
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
  const runtime = useStoryRuntime(story, {
    snapshot,
    defaultSnapshot,
    defaultState,
    hooks,
    onChoice,
    onPathChange,
    onSnapshotChange,
  });
  const autoplayOptions = useMemo(() => resolveAutoplay(autoplay), [autoplay]);
  const [isPlaying, setPlaying] = useState(autoplayOptions.enabled);
  const canGoNext = runtime.choices.length === 1 && !runtime.renderProps.isEnding;

  useEffect(() => {
    setPlaying(autoplayOptions.enabled);
  }, [autoplayOptions.enabled]);

  const goNext = useCallback(() => {
    const choice = runtime.choices[0];
    if (!canGoNext || !choice) return;

    runtime.choose(choice.id);
  }, [canGoNext, runtime]);

  const togglePlaying = useCallback(() => {
    setPlaying((current) => !current);
  }, []);

  const goToHistoryIndex = useCallback(
    (index: number) => {
      const history = runtime.renderProps.history.slice(0, index + 1);
      if (history.length === 0) return;

      const pathState = createStoryPathStateFromHistory(runtime.story, history);
      runtime.setSnapshot(pathState.snapshot);
    },
    [runtime],
  );

  useEffect(() => {
    if (!isPlaying || !canGoNext || typeof window === "undefined") return;

    const timeout = window.setTimeout(goNext, autoplayOptions.intervalMs);
    return () => window.clearTimeout(timeout);
  }, [autoplayOptions.intervalMs, canGoNext, goNext, isPlaying, runtime.renderProps.node.id]);

  useEffect(() => {
    if (runtime.renderProps.isEnding) setPlaying(false);
  }, [runtime.renderProps.isEnding]);

  const controller = useMemo<StoryPlayerController<TData, TState>>(
    () => ({
      ...runtime,
      registry,
      isPlaying,
      canGoNext,
      autoplayIntervalMs: autoplayOptions.intervalMs,
      setPlaying,
      togglePlaying,
      goNext,
      goToHistoryIndex,
    }),
    [
      autoplayOptions.intervalMs,
      canGoNext,
      goNext,
      goToHistoryIndex,
      isPlaying,
      registry,
      runtime,
      togglePlaying,
    ],
  );

  return <StoryPlayerContext.Provider value={controller}>{children}</StoryPlayerContext.Provider>;
}

function StoryPlayerLayoutPart({
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
        {children}
      </div>
    </section>
  );
}

function StoryPlayerStage<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({ className, render }: StoryPlayerStageProps<TData, TState>) {
  const player = useStoryPlayer<TData, TState>();
  const content = render ? (
    render(player.renderProps)
  ) : (
    <StoryStageFrame {...player.renderProps} registry={player.registry} />
  );

  return <div className={cn("p-4 md:p-6", className)}>{content}</div>;
}

function StoryPlayerAside({
  layout = "split",
  className,
  children,
}: StoryPlayerAsideProps) {
  if (layout === "stage-only") return null;

  return (
    <aside
      className={cn(
        "border-t bg-background p-5 md:p-6",
        layout === "split" ? "lg:border-l lg:border-t-0" : "",
        className,
      )}
    >
      <div className="flex h-full flex-col gap-6">{children}</div>
    </aside>
  );
}

function StoryPlayerHeader() {
  const player = useStoryPlayer();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const node = player.renderProps.node;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [node.id]);

  return (
    <div>
      {node.eyebrow ? (
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{node.eyebrow}</p>
      ) : null}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-2xl font-semibold tracking-tight outline-none"
      >
        {node.title}
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
  const node = player.renderProps.node;
  const prompt =
    node.prompt ??
    (player.renderProps.isEnding ? player.labels.endingPrompt : player.labels.choosePrompt);

  if (render) return <>{render(player.renderProps)}</>;

  return (
    <div className={className}>
      <StoryControls
        choices={player.choices}
        onChoose={player.choose}
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
  if (render) return <>{render(player.renderProps)}</>;

  return (
    <StoryActionBar
      canGoBack={player.canGoBack}
      goBack={player.goBack}
      restart={player.restart}
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
  if (render) return <>{render(player.renderProps)}</>;

  return <StoryProgressView value={player.progress} className={className} />;
}

function StoryPlayerTrail<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>({ className, render }: StoryPlayerPartProps<TData, TState>) {
  const player = useStoryPlayer<TData, TState>();
  if (render) return <>{render(player.renderProps)}</>;

  return (
    <div className={className}>
      <StoryPathTrail story={player.story} history={player.renderProps.history} />
    </div>
  );
}

function StoryPlayerPrevious({
  className,
  children = "Previous",
  ariaLabel,
}: StoryPlayerButtonProps) {
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

function StoryPlayerNext({
  className,
  children = "Next",
  ariaLabel,
}: StoryPlayerButtonProps) {
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

  if (history.length < 2) return null;

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

export const StoryPlayer = Object.assign(StoryPlayerFacade, {
  Root: StoryPlayerRoot,
  Layout: StoryPlayerLayoutPart,
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
