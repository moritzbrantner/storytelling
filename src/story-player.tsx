"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@moritzbrantner/ui";

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
import { StoryProgress } from "./story-progress";
import { StoryStageFrame } from "./story-stage-frame";
import { useStoryRuntime } from "./story-runtime";
import type { StoryChoice, StoryDocument, StoryHistoryEntry, StoryNodeData } from "./story-model";
import type { StoryRendererRegistry, StoryRenderProps } from "./story-render-types";
import type { StoryPathState } from "./story-state";

export type StoryPlayerLayout = "split" | "stacked" | "stage-only";

export type StoryPlayerSlots<TData extends StoryNodeData = StoryNodeData> = {
  stage?: (props: StoryRenderProps<TData>) => ReactNode;
  header?: (props: StoryRenderProps<TData>) => ReactNode;
  controls?: (props: StoryRenderProps<TData>) => ReactNode;
  actions?: (props: StoryRenderProps<TData>) => ReactNode;
  progress?: (props: StoryRenderProps<TData>) => ReactNode;
  trail?: (props: StoryRenderProps<TData>) => ReactNode;
};

export type StoryPlayerModules = {
  header?: boolean;
  controls?: boolean;
  actions?: boolean;
  progress?: boolean;
  trail?: boolean;
};

export type StoryPlayerProps<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  registry?: StoryRendererRegistry<TData>;
  initialChoiceIds?: string[];
  defaultChoiceIds?: string[];
  choiceIds?: string[];
  layout?: StoryPlayerLayout;
  className?: string;
  ariaLabel?: string;
  renderStage?: (props: StoryRenderProps<TData>) => ReactNode;
  renderHeader?: (props: StoryRenderProps<TData>) => ReactNode;
  renderControls?: (props: StoryRenderProps<TData>) => ReactNode;
  renderActions?: (props: StoryRenderProps<TData>) => ReactNode;
  renderProgress?: (props: StoryRenderProps<TData>) => ReactNode;
  renderTrail?: (props: StoryRenderProps<TData>) => ReactNode;
  slots?: StoryPlayerSlots<TData>;
  modules?: StoryPlayerModules;
  onChoice?: (choice: StoryChoice, history: StoryHistoryEntry<TData>[]) => void;
  onPathChange?: (history: StoryHistoryEntry<TData>[]) => void;
  onChoiceIdsChange?: (choiceIds: string[], state: StoryPathState<TData>) => void;
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

export function StoryPlayer<TData extends StoryNodeData = StoryNodeData>({
  story: input,
  registry,
  initialChoiceIds = [],
  defaultChoiceIds,
  choiceIds,
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
  onChoiceIdsChange,
}: StoryPlayerProps<TData>) {
  const runtime = useStoryRuntime(input, {
    initialChoiceIds,
    defaultChoiceIds,
    choiceIds,
    autoAdvanceLinearNodes:
      choiceIds === undefined ? (defaultChoiceIds ?? initialChoiceIds).length > 0 : false,
    onChoice,
    onPathChange,
    onChoiceIdsChange,
  });
  const { story, renderProps, labels } = runtime;
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const reducedMotion = useReducedMotion();
  const currentNode = renderProps.node;
  const prompt =
    currentNode.prompt ?? (renderProps.isEnding ? labels.endingPrompt : labels.choosePrompt);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [currentNode.id]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key === "Escape" || event.key === "Backspace") && renderProps.canGoBack) {
      event.preventDefault();
      renderProps.goBack();
    }
  };

  const stage = renderStage ? (
    renderStage(renderProps)
  ) : slots?.stage ? (
    slots.stage(renderProps)
  ) : (
    <StoryStageFrame {...renderProps} registry={registry} />
  );
  const showHeader = modules?.header !== false;
  const showControls = modules?.controls !== false;
  const showActions = modules?.actions !== false;
  const showProgress = modules?.progress !== false;
  const showTrail = modules?.trail !== false;
  const showUtilityModules = showActions || showProgress || showTrail;
  const showAside = layout !== "stage-only" && (showHeader || showControls || showUtilityModules);
  const header = !showHeader ? null : renderHeader ? (
    renderHeader(renderProps)
  ) : slots?.header ? (
    slots.header(renderProps)
  ) : (
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
  );
  const controls = !showControls ? null : renderControls ? (
    renderControls(renderProps)
  ) : slots?.controls ? (
    slots.controls(renderProps)
  ) : (
    <StoryControls
      choices={renderProps.choices}
      onChoose={renderProps.choose}
      isEnding={renderProps.isEnding}
      prompt={prompt}
      completedLabel={labels.completedBranch}
    />
  );
  const actions = !showActions ? null : renderActions ? (
    renderActions(renderProps)
  ) : slots?.actions ? (
    slots.actions(renderProps)
  ) : (
    <StoryActionBar
      canGoBack={renderProps.canGoBack}
      goBack={renderProps.goBack}
      restart={renderProps.restart}
      backLabel={labels.back}
      restartLabel={labels.restart}
    />
  );
  const progress = !showProgress ? null : renderProgress ? (
    renderProgress(renderProps)
  ) : slots?.progress ? (
    slots.progress(renderProps)
  ) : (
    <StoryProgress value={renderProps.progress} />
  );
  const trail = !showTrail ? null : renderTrail ? (
    renderTrail(renderProps)
  ) : slots?.trail ? (
    slots.trail(renderProps)
  ) : (
    <StoryPathTrail story={story} history={renderProps.history} />
  );

  return (
    <section
      role="region"
      aria-label={ariaLabel ?? story.title}
      className={cn("overflow-hidden rounded-lg border bg-card", className)}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          "grid gap-0",
          layout === "split" ? "lg:grid-cols-[1.1fr_0.9fr]" : "",
          layout === "stage-only" ? "block" : "",
        )}
      >
        <div className="p-4 md:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentNode.id}
              initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
            >
              {stage}
            </motion.div>
          </AnimatePresence>
        </div>

        {showAside ? (
          <aside
            className={cn(
              "border-t bg-background p-5 md:p-6",
              layout === "split" ? "lg:border-l lg:border-t-0" : "",
            )}
          >
            <div className="flex h-full flex-col gap-6">
              {header}
              {controls}

              {showUtilityModules ? (
                <div className="mt-auto space-y-5">
                  {actions}
                  {progress}
                  {trail}
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
