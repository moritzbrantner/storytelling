"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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
    autoAdvanceLinearNodes: choiceIds.length > 0,
  }).history;
}

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
}: StoryScrollerProps<TData>) {
  const story = useMemo(() => validateStory(input), [input]);
  const initialChoiceKey = pathChoiceIds.join("|");
  const [history, setHistory] = useState<StoryHistoryEntry<TData>[]>(() =>
    resolveInitialHistory(story, pathChoiceIds),
  );
  const [activeIndex, setActiveIndex] = useState(() => Math.max(history.length - 1, 0));
  const reducedMotion = useReducedMotion();
  const stageHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const activeEntry = history[activeIndex] ?? history[history.length - 1];
  const activeNode = activeEntry
    ? getStoryNode(story, activeEntry.nodeId)
    : getStoryNode(story, story.openingNodeId);
  const activeHistory = history.slice(0, activeIndex + 1);
  const choices = getStoryChoices(story, activeNode);
  const ending = isStoryEnding(story, activeNode);
  const progress = (activeIndex + 1) / Math.max(history.length, 1);
  const graph = useMemo(
    () => buildRevealedStoryGraph(story, history, activeNode.id),
    [activeNode.id, history, story],
  );

  const goToScene = useCallback(
    (index: number) => {
      setActiveIndex(Math.max(0, Math.min(index, history.length - 1)));
    },
    [history.length],
  );

  useEffect(() => {
    const nextHistory = resolveInitialHistory(story, pathChoiceIds);

    setHistory(nextHistory);
    setActiveIndex(Math.max(nextHistory.length - 1, 0));
  }, [initialChoiceKey, story]);

  useEffect(() => {
    setActiveIndex((current) => Math.max(0, Math.min(current, history.length - 1)));
  }, [history.length]);

  useEffect(() => {
    stageHeadingRef.current?.focus({ preventScroll: true });
  }, [activeNode.id]);

  const choose = (choiceId: string) => {
    const choice = choices.find((entry) => entry.id === choiceId && !entry.disabled);
    if (!choice) return;

    const nextNode = getStoryNode(story, choice.target);
    const nextHistory = [
      ...activeHistory,
      {
        nodeId: nextNode.id,
        choiceId: choice.id,
        data: nextNode.data,
      },
    ];

    setHistory(nextHistory);
    setActiveIndex(nextHistory.length - 1);
  };

  const restart = () => {
    const openingNode = getStoryNode(story, story.openingNodeId);

    setHistory([{ nodeId: openingNode.id, data: openingNode.data }]);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        goToScene(activeIndex + 1);
        return;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        goToScene(activeIndex - 1);
        return;
      case "Home":
        event.preventDefault();
        goToScene(0);
        return;
      case "End":
        event.preventDefault();
        goToScene(history.length - 1);
        return;
      default:
        return;
    }
  };

  const renderPath: ResolvedStoryPath<TData> = {
    nodes: activeHistory.map((entry) => getStoryNode(story, entry.nodeId)),
    history: activeHistory,
    currentNode: activeNode,
    completed: ending,
  };
  const renderProps: StoryRenderProps<TData> = {
    story,
    node: activeNode,
    history: activeHistory,
    path: renderPath,
    currentIndex: activeIndex,
    progress,
    isEnding: ending,
    canGoBack: activeIndex > 0,
    choices,
    choose,
    goBack: () => goToScene(activeIndex - 1),
    restart,
  };

  return (
    <section
      role="region"
      aria-label={ariaLabel ?? story.labels?.scrollerLabel ?? story.title}
      className={cn("rounded-lg border bg-card p-4 md:p-6", className)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="grid gap-5 lg:grid-cols-[14rem_1fr]">
        <StoryRevealedGraph graph={graph} onSelect={goToScene} />

        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeNode.id}
              initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
            >
              <div className="relative">
                <h2 ref={stageHeadingRef} tabIndex={-1} className="sr-only">
                  {activeNode.title}
                </h2>
                <StoryStageFrame {...renderProps} registry={registry} />
                <StoryChoiceOverlay
                  choices={choices}
                  choose={choose}
                  ending={ending}
                  prompt={
                    activeNode.prompt ??
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
              </div>
            </motion.div>
          </AnimatePresence>
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
