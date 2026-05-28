"use client";

import { useEffect, useRef } from "react";

import { motion } from "motion/react";

import { Button, cn } from "@moritzbrantner/ui";

import type { StoryChoice, StoryDocument, StoryHistoryEntry, StoryNodeData } from "./story-model";
import type { StoryRenderProps } from "./story-render-types";
import { getStoryNode } from "./story-validation";

const STORY_BRANCH_REVEAL_START = 0.9;
const STORY_BRANCH_REVEAL_END = 1;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export type StoryChoiceListProps = {
  choices: StoryChoice[];
  onChoose: (choiceId: string) => void;
  lockedChoiceId?: string;
  disabled?: boolean;
  showHotkeys?: boolean;
  className?: string;
};

export function StoryChoiceList({
  choices,
  onChoose,
  lockedChoiceId,
  disabled = false,
  showHotkeys = false,
  className,
}: StoryChoiceListProps) {
  const isLocked = lockedChoiceId !== undefined;

  return (
    <div
      className={cn(
        showHotkeys ? "grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]" : "grid gap-3",
        className,
      )}
    >
      {choices.map((choice, index) => (
        <Button
          key={choice.id}
          type="button"
          variant="outline"
          className={cn(
            "h-auto justify-start whitespace-normal px-4 py-3 text-left",
            lockedChoiceId === choice.id ? "border-foreground/40 bg-muted/70" : "",
          )}
          onClick={() => onChoose(choice.id)}
          disabled={choice.disabled || disabled || isLocked}
        >
          {showHotkeys ? (
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
          ) : (
            <span className="grid gap-1">
              <span>{choice.label}</span>
              {choice.description ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {choice.description}
                </span>
              ) : null}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}

export type StoryControlsProps = {
  choices: StoryChoice[];
  onChoose?: (choiceId: string) => void;
  choose?: (choiceId: string) => void;
  isEnding?: boolean;
  ending?: boolean;
  prompt: string;
  completedLabel: string;
};

export function StoryControls({
  choices,
  onChoose,
  choose,
  isEnding,
  ending,
  prompt,
  completedLabel,
}: StoryControlsProps) {
  const handleChoose = onChoose ?? choose ?? (() => {});
  const resolvedEnding = isEnding ?? ending ?? false;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{prompt}</p>
      {choices.length > 0 ? (
        <StoryChoiceList choices={choices} onChoose={handleChoose} />
      ) : resolvedEnding ? (
        <p className="text-sm text-muted-foreground">{completedLabel}</p>
      ) : null}
    </div>
  );
}

export type StoryActionBarProps = {
  canGoBack: boolean;
  goBack: () => void;
  restart: () => void;
  backLabel?: string;
  restartLabel?: string;
  className?: string;
};

export function StoryActionBar({
  canGoBack,
  goBack,
  restart,
  backLabel = "Go back",
  restartLabel = "Restart",
  className,
}: StoryActionBarProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <Button type="button" variant="outline" onClick={goBack} disabled={!canGoBack}>
        {backLabel}
      </Button>
      <Button type="button" variant="secondary" onClick={restart}>
        {restartLabel}
      </Button>
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

export type StoryChoicePanelRenderProps<TData extends StoryNodeData = StoryNodeData> =
  StoryRenderProps<TData> & {
    prompt: string;
    completedLabel: string;
    restartLabel: string;
    lockedChoiceId?: string;
    revealProgress: number;
    isReady: boolean;
  };

export type StoryChoicePanelProps = {
  choices: StoryChoice[];
  onChoose?: (choiceId: string) => void;
  choose?: (choiceId: string) => void;
  isEnding?: boolean;
  ending?: boolean;
  prompt: string;
  completedLabel: string;
  restartLabel: string;
  restart: () => void;
  progress: number;
  lockedChoiceId?: string;
};

export function StoryChoicePanel({
  choices,
  onChoose,
  choose,
  isEnding,
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
  const handleChoose = onChoose ?? choose ?? (() => {});
  const resolvedEnding = isEnding ?? ending ?? false;

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
      handleChoose(choice.id);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleChoose, choices, isLocked, isReady]);

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
      data-story-choice-panel
    >
      <div
        ref={panelRef}
        className="pointer-events-auto rounded-lg border border-white/20 bg-background/92 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.24)] backdrop-blur-md"
      >
        <p className="text-sm font-medium">{prompt}</p>
        {choices.length > 0 ? (
          <StoryChoiceList
            choices={choices}
            onChoose={handleChoose}
            lockedChoiceId={lockedChoiceId}
            disabled={!isReady}
            showHotkeys
            className="mt-4"
          />
        ) : resolvedEnding ? (
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
