"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Button, cn } from "@moritzbrantner/ui";

import { resolveStoryPath } from "./story-path";
import { StoryProgress } from "./story-progress";
import { StoryStageFrame } from "./story-stage-frame";
import { defineStory, getStoryChoices, getStoryNode, isStoryEnding } from "./story-validation";
import type {
  ResolvedStoryPath,
  StoryChoice,
  StoryDocument,
  StoryHistoryEntry,
  StoryNodeData,
  StoryRenderProps,
  StoryRendererRegistry,
} from "./story-model";

export type StoryPlayerProps<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  registry?: StoryRendererRegistry<TData>;
  initialChoiceIds?: string[];
  className?: string;
  ariaLabel?: string;
  onChoice?: (choice: StoryChoice, history: StoryHistoryEntry<TData>[]) => void;
  onPathChange?: (history: StoryHistoryEntry<TData>[]) => void;
};

function resolveInitialHistory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  initialChoiceIds: string[],
) {
  return resolveStoryPath(story, {
    choiceIds: initialChoiceIds,
    autoAdvanceLinearNodes: initialChoiceIds.length > 0,
  }).history;
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

export function StoryPlayer<TData extends StoryNodeData = StoryNodeData>({
  story: input,
  registry,
  initialChoiceIds = [],
  className,
  ariaLabel,
  onChoice,
  onPathChange,
}: StoryPlayerProps<TData>) {
  const story = useMemo(() => defineStory(input), [input]);
  const initialChoiceKey = initialChoiceIds.join("|");
  const [history, setHistory] = useState<StoryHistoryEntry<TData>[]>(() =>
    resolveInitialHistory(story, initialChoiceIds),
  );
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const reducedMotion = useReducedMotion();
  const path = useMemo(() => buildPathFromHistory(story, history), [history, story]);
  const currentNode = path.currentNode;
  const choices = getStoryChoices(story, currentNode);
  const ending = isStoryEnding(story, currentNode);
  const canGoBack = history.length > 1;
  const progress = history.length / Math.max(story.nodes.length, 1);

  useEffect(() => {
    setHistory(resolveInitialHistory(story, initialChoiceIds));
  }, [initialChoiceKey, story]);

  useEffect(() => {
    onPathChange?.(history);
  }, [history, onPathChange]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [currentNode.id]);

  const choose = (choiceId: string) => {
    const choice = choices.find((entry) => entry.id === choiceId && !entry.disabled);
    if (!choice) return;

    const nextNode = getStoryNode(story, choice.target);
    const nextHistory = [
      ...history,
      {
        nodeId: nextNode.id,
        choiceId: choice.id,
        data: nextNode.data,
      },
    ];

    setHistory(nextHistory);
    onChoice?.(choice, nextHistory);
  };

  const goBack = () => {
    if (!canGoBack) return;
    setHistory((current) => current.slice(0, -1));
  };

  const restart = () => {
    const openingNode = getStoryNode(story, story.openingNodeId);

    setHistory([{ nodeId: openingNode.id, data: openingNode.data }]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key === "Escape" || event.key === "Backspace") && canGoBack) {
      event.preventDefault();
      goBack();
    }
  };

  const renderProps: StoryRenderProps<TData> = {
    story,
    node: currentNode,
    history,
    path,
    currentIndex: history.length - 1,
    progress,
    isEnding: ending,
    canGoBack,
    choices,
    choose,
    goBack,
    restart,
  };

  return (
    <section
      role="region"
      aria-label={ariaLabel ?? story.title}
      className={cn("overflow-hidden rounded-lg border bg-card", className)}
      onKeyDown={handleKeyDown}
    >
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-4 md:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentNode.id}
              initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
            >
              <StoryStageFrame {...renderProps} registry={registry} />
            </motion.div>
          </AnimatePresence>
        </div>

        <aside className="border-t bg-background p-5 lg:border-l lg:border-t-0 md:p-6">
          <div className="flex h-full flex-col gap-6">
            <div>
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
              {story.subtitle ? (
                <p className="mt-2 text-sm text-muted-foreground">{story.subtitle}</p>
              ) : null}
            </div>

            <StoryControls
              choices={choices}
              choose={choose}
              ending={ending}
              prompt={
                currentNode.prompt ??
                (ending
                  ? (story.labels?.endingPrompt ?? "This branch is complete.")
                  : (story.labels?.choosePrompt ?? "Choose what happens next."))
              }
              completedLabel={
                story.labels?.completedBranch ??
                "Restart to explore another branch, or go back to choose a different path."
              }
            />

            <div className="mt-auto space-y-5">
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={goBack} disabled={!canGoBack}>
                  {story.labels?.back ?? "Go back"}
                </Button>
                <Button type="button" variant="secondary" onClick={restart}>
                  {story.labels?.restart ?? "Restart"}
                </Button>
              </div>
              <StoryProgress value={progress} />
              <StoryPathTrail story={story} history={history} />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export type StoryControlsProps = {
  choices: StoryChoice[];
  choose: (choiceId: string) => void;
  ending: boolean;
  prompt: string;
  completedLabel: string;
};

export function StoryControls({
  choices,
  choose,
  ending,
  prompt,
  completedLabel,
}: StoryControlsProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{prompt}</p>
      {choices.length > 0 ? (
        <div className="grid gap-3">
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
        <p className="text-sm text-muted-foreground">{completedLabel}</p>
      ) : null}
    </div>
  );
}

export type StoryPathTrailProps<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  history: StoryHistoryEntry<TData>[];
};

export function StoryPathTrail<TData extends StoryNodeData = StoryNodeData>({
  story,
  history,
}: StoryPathTrailProps<TData>) {
  return (
    <ol className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      {history.map((entry, index) => {
        const node = getStoryNode(story, entry.nodeId);

        return (
          <li
            key={`${entry.nodeId}-${index}`}
            className={cn(
              "rounded-md border px-2.5 py-1",
              index === history.length - 1 ? "border-foreground text-foreground" : "border-border",
            )}
            aria-current={index === history.length - 1 ? "step" : undefined}
          >
            {node.title}
          </li>
        );
      })}
    </ol>
  );
}
