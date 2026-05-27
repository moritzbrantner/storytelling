"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useReducedMotion } from "motion/react";

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

export type StoryScrollerProps<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  registry?: StoryRendererRegistry<TData>;
  pathChoiceIds?: string[];
  className?: string;
  ariaLabel?: string;
  onChoice?: (choice: StoryChoice, history: StoryHistoryEntry<TData>[]) => void;
  onPathChange?: (history: StoryHistoryEntry<TData>[]) => void;
  onActiveIndexChange?: (index: number) => void;
};

type RevealedStoryGraphNode = {
  id: string;
  title: string;
  eyebrow?: string;
  state: "active" | "visited" | "available";
  historyIndex?: number;
};

type RevealedStoryGraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
};

type RevealedStoryGraph = {
  nodes: RevealedStoryGraphNode[];
  edges: RevealedStoryGraphEdge[];
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

function getInitialActiveIndex<TData extends StoryNodeData>(
  history: StoryHistoryEntry<TData>[],
  choiceIds: string[],
) {
  return choiceIds.length > 0 ? Math.max(history.length - 1, 0) : 0;
}

function getHistoryChoiceIds<TData extends StoryNodeData>(history: StoryHistoryEntry<TData>[]) {
  return history.flatMap((entry) => (entry.choiceId ? [entry.choiceId] : []));
}

function getStoryScrollerPageId(storyId: string, nodeId: string) {
  return `story-scroller-page-${storyId}-${nodeId}`;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function buildSelectedEdgeLookup<TData extends StoryNodeData>(history: StoryHistoryEntry<TData>[]) {
  const selectedEdges = new Set<string>();

  for (let index = 0; index < history.length - 1; index += 1) {
    const source = history[index];
    const target = history[index + 1];

    if (source?.nodeId && target?.choiceId) {
      selectedEdges.add(`${source.nodeId}:${target.choiceId}`);
    }
  }

  return selectedEdges;
}

function buildRevealedStoryGraph<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  history: StoryHistoryEntry<TData>[],
  activeNodeId: string,
): RevealedStoryGraph {
  const historyIndexByNodeId = new Map<string, number>();
  const visitedNodeIds = new Set<string>();
  const selectedEdges = buildSelectedEdgeLookup(history);
  const nodeOrder: string[] = [];
  const revealedNodeIds = new Set<string>();
  const edges = new Map<string, RevealedStoryGraphEdge>();

  const revealNode = (nodeId: string) => {
    if (revealedNodeIds.has(nodeId)) return;

    revealedNodeIds.add(nodeId);
    nodeOrder.push(nodeId);
  };

  history.forEach((entry, index) => {
    visitedNodeIds.add(entry.nodeId);
    if (!historyIndexByNodeId.has(entry.nodeId)) {
      historyIndexByNodeId.set(entry.nodeId, index);
    }
  });

  for (const entry of history) {
    const node = getStoryNode(story, entry.nodeId);

    revealNode(node.id);

    for (const choice of getStoryChoices(story, node)) {
      revealNode(choice.target);

      const edgeId = `${node.id}:${choice.id}`;
      edges.set(edgeId, {
        id: edgeId,
        source: node.id,
        target: choice.target,
        label: choice.label,
        selected: selectedEdges.has(edgeId),
        disabled: choice.disabled,
      });
    }
  }

  return {
    nodes: nodeOrder.map((nodeId) => {
      const node = getStoryNode(story, nodeId);
      const historyIndex = historyIndexByNodeId.get(nodeId);

      return {
        id: node.id,
        title: node.title,
        eyebrow: node.eyebrow,
        state:
          node.id === activeNodeId
            ? "active"
            : visitedNodeIds.has(node.id)
              ? "visited"
              : "available",
        historyIndex,
      };
    }),
    edges: [...edges.values()],
  };
}

export function StoryScroller<TData extends StoryNodeData = StoryNodeData>({
  story: input,
  registry,
  pathChoiceIds = [],
  className,
  ariaLabel,
  onChoice,
  onPathChange,
  onActiveIndexChange,
}: StoryScrollerProps<TData>) {
  const story = useMemo(() => validateStory(input), [input]);
  const initialChoiceKey = pathChoiceIds.join("|");
  const initialHistory = useMemo(
    () => resolveInitialHistory(story, pathChoiceIds),
    // `initialChoiceKey` keeps this stable when callers pass a fresh array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialChoiceKey, story],
  );
  const initialActiveIndex = useMemo(
    () => getInitialActiveIndex(initialHistory, pathChoiceIds),
    // `initialChoiceKey` keeps this stable when callers pass a fresh array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialChoiceKey, initialHistory],
  );
  const [history, setHistory] = useState<StoryHistoryEntry<TData>[]>(() => initialHistory);
  const [activeIndex, setActiveIndex] = useState(() => initialActiveIndex);
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollIndexRef = useRef<number | null>(
    initialActiveIndex > 0 ? initialActiveIndex : null,
  );
  const activeEntry = history[activeIndex] ?? history[history.length - 1];
  const activeNode = activeEntry
    ? getStoryNode(story, activeEntry.nodeId)
    : getStoryNode(story, story.openingNodeId);
  const graph = useMemo(
    () => buildRevealedStoryGraph(story, history, activeNode.id),
    [activeNode.id, history, story],
  );
  const showGraph = graph.nodes.length > 1;

  const scrollToScene = useCallback(
    (index: number) => {
      const nextIndex = clamp(index, 0, Math.max(history.length - 1, 0));

      setActiveIndex(nextIndex);

      const target = scrollRef.current?.querySelector<HTMLElement>(
        `[data-story-scroller-index="${nextIndex}"]`,
      );

      target?.scrollIntoView?.({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    },
    [history.length, reducedMotion],
  );

  useEffect(() => {
    const nextHistory = initialHistory;
    const nextActiveIndex = initialActiveIndex;

    setHistory(nextHistory);
    setActiveIndex(nextActiveIndex);
    pendingScrollIndexRef.current = nextActiveIndex > 0 ? nextActiveIndex : null;
  }, [initialActiveIndex, initialHistory]);

  useEffect(() => {
    setActiveIndex((current) => Math.max(0, Math.min(current, history.length - 1)));
  }, [history.length]);

  useEffect(() => {
    onPathChange?.(history);
  }, [history, onPathChange]);

  useEffect(() => {
    onActiveIndexChange?.(activeIndex);
  }, [activeIndex, onActiveIndexChange]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const nextIndex = Number(
          (activeEntry?.target as HTMLElement | undefined)?.dataset.storyScrollerIndex,
        );

        if (Number.isFinite(nextIndex)) {
          setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
        }
      },
      {
        root: scrollElement,
        threshold: [0.45, 0.6, 0.75],
      },
    );

    const pages = scrollElement.querySelectorAll<HTMLElement>("[data-story-scroller-page]");
    pages.forEach((page) => observer.observe(page));

    return () => observer.disconnect();
  }, [history]);

  useEffect(() => {
    const pendingIndex = pendingScrollIndexRef.current;
    if (pendingIndex === null) return;

    pendingScrollIndexRef.current = null;

    const scroll = () => scrollToScene(pendingIndex);

    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      scroll();
      return;
    }

    const animationFrame = window.requestAnimationFrame(scroll);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [history, scrollToScene]);

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

      pendingScrollIndexRef.current = nextActiveIndex;
      setHistory(nextHistory);
      setActiveIndex(nextActiveIndex);
      onChoice?.(choice, nextHistory);
    },
    [history, onChoice, story],
  );

  const restart = useCallback(() => {
    const nextHistory = resolveInitialHistory(story, []);

    pendingScrollIndexRef.current = 0;
    setHistory(nextHistory);
    setActiveIndex(0);
  }, [story]);

  const buildRenderProps = (entry: StoryHistoryEntry<TData>, index: number) => {
    const node = getStoryNode(story, entry.nodeId);
    const nodeHistory = history.slice(0, index + 1);
    const nodePath: ResolvedStoryPath<TData> = {
      nodes: nodeHistory.map((historyEntry) => getStoryNode(story, historyEntry.nodeId)),
      history: nodeHistory,
      currentNode: node,
      completed: isStoryEnding(story, node),
    };
    const choices = getStoryChoices(story, node);

    return {
      story,
      node,
      history: nodeHistory,
      path: nodePath,
      currentIndex: index,
      progress: (index + 1) / Math.max(history.length, 1),
      isEnding: isStoryEnding(story, node),
      canGoBack: index > 0,
      choices,
      choose: (choiceId: string) => chooseFrom(index, choiceId),
      goBack: () => scrollToScene(index - 1),
      restart,
    } satisfies StoryRenderProps<TData>;
  };

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
        scrollToScene(history.length - 1);
        return;
      default:
        return;
    }
  };

  return (
    <section
      role="region"
      aria-label={ariaLabel ?? story.labels?.scrollerLabel ?? story.title}
      className={cn("rounded-lg border bg-card p-4 md:p-6", className)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className={cn("grid gap-5", showGraph ? "lg:grid-cols-[14rem_minmax(0,1fr)]" : "")}>
        {showGraph ? <StoryRevealedGraph graph={graph} onSelect={scrollToScene} /> : null}

        <div className="min-w-0">
          <div
            ref={scrollRef}
            className="story-steps-scrollbar-hidden grid h-[76vh] min-h-[31rem] max-h-[48rem] snap-y snap-mandatory gap-4 overflow-y-auto overscroll-contain pr-1"
          >
            {history.map((entry, index) => {
              const renderProps = buildRenderProps(entry, index);
              const { node, choices, isEnding } = renderProps;
              const isActive = index === activeIndex;

              return (
                <article
                  key={`${entry.nodeId}-${index}`}
                  id={getStoryScrollerPageId(story.id, node.id)}
                  className="relative min-h-full snap-start scroll-mt-0"
                  data-active={isActive}
                  data-story-scroller-index={index}
                  data-story-scroller-page
                  aria-label={`${index + 1}. ${node.title}`}
                >
                  <StoryStageFrame
                    {...renderProps}
                    registry={registry}
                    className="min-h-[inherit]"
                  />
                  {isActive ? (
                    <StoryChoiceOverlay
                      choices={choices}
                      choose={renderProps.choose}
                      ending={isEnding}
                      prompt={
                        node.prompt ??
                        (isEnding
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
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

type StoryRevealedGraphProps = {
  graph: RevealedStoryGraph;
  onSelect?: (index: number) => void;
};

function StoryRevealedGraph({ graph, onSelect }: StoryRevealedGraphProps) {
  if (graph.nodes.length < 2) {
    return null;
  }

  const edgesBySource = graph.edges.reduce<Record<string, RevealedStoryGraphEdge[]>>(
    (lookup, edge) => {
      lookup[edge.source] = [...(lookup[edge.source] ?? []), edge];
      return lookup;
    },
    {},
  );
  const nodeLookup = new Map(graph.nodes.map((node) => [node.id, node] as const));

  return (
    <nav className="rounded-lg border bg-background p-3" aria-label="Story graph">
      <div className="mb-3 px-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Story graph
        </p>
      </div>

      <ol className="story-steps-scrollbar-hidden flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {graph.nodes.map((node) => {
          const isSelectable = typeof node.historyIndex === "number";
          const edges = edgesBySource[node.id] ?? [];

          return (
            <li key={node.id} className="min-w-[11rem] shrink-0 lg:min-w-0 lg:shrink">
              <Button
                type="button"
                variant="ghost"
                disabled={!isSelectable}
                className={cn(
                  "flex h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-md border px-3 py-3 text-left disabled:opacity-100",
                  node.state === "active"
                    ? "border-foreground bg-foreground text-background"
                    : node.state === "visited"
                      ? "border-border text-foreground hover:bg-muted/70"
                      : "border-dashed border-border text-muted-foreground",
                )}
                onClick={() => {
                  if (typeof node.historyIndex === "number") {
                    onSelect?.(node.historyIndex);
                  }
                }}
                aria-current={node.state === "active" ? "step" : undefined}
              >
                <span
                  className={cn(
                    "mt-0.5 size-2.5 shrink-0 rounded-full",
                    node.state === "active"
                      ? "bg-background"
                      : node.state === "visited"
                        ? "bg-foreground"
                        : "bg-muted-foreground/40",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-xs uppercase tracking-[0.14em]",
                      node.state === "active" ? "text-background/75" : "text-muted-foreground",
                    )}
                  >
                    {node.state}
                  </span>
                  <span className="mt-1 block text-sm font-medium leading-5">{node.title}</span>
                </span>
              </Button>

              {edges.length > 0 ? (
                <ul className="ml-4 mt-2 space-y-1 border-l border-border pl-3 text-xs text-muted-foreground">
                  {edges.map((edge) => {
                    const target = nodeLookup.get(edge.target);

                    return (
                      <li
                        key={edge.id}
                        className={cn(
                          "leading-5",
                          edge.selected ? "font-medium text-foreground" : "",
                          edge.disabled ? "opacity-50" : "",
                        )}
                      >
                        <span aria-hidden="true">→</span> {edge.label}
                        {target ? <span className="sr-only"> to {target.title}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type StoryChoiceOverlayProps = {
  choices: StoryChoice[];
  choose: (choiceId: string) => void;
  ending: boolean;
  prompt: string;
  completedLabel: string;
  restartLabel: string;
  restart: () => void;
};

function StoryChoiceOverlay({
  choices,
  choose,
  ending,
  prompt,
  completedLabel,
  restartLabel,
  restart,
}: StoryChoiceOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 md:p-6">
      <div className="pointer-events-auto max-h-[70%] overflow-y-auto rounded-lg border bg-background/95 p-4 shadow-xl shadow-black/10 backdrop-blur md:p-5">
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
    </div>
  );
}
