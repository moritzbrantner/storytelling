"use client";

import { cn } from "@moritzbrantner/ui";

import { StoryContent } from "./story-content";
import { getStoryRendererKey } from "./story-render-registry";
import type { StoryNodeData, StoryVariables } from "./story-model";
import type {
  StoryRendererRegistry,
  StoryRenderProps,
  StoryStageComponent,
} from "./story-render-types";

export type StoryStageFrameProps<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = StoryRenderProps<TData, TVars> & {
  registry?: StoryRendererRegistry<TData, TVars>;
  className?: string;
};

export function StoryStageFrame<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
>(props: StoryStageFrameProps<TData, TVars>) {
  const { node, registry, className } = props;
  const rendererKey = getStoryRendererKey(node);
  const CustomStage = registry?.web?.[rendererKey] as StoryStageComponent<TData, TVars> | undefined;

  if (CustomStage) {
    return <CustomStage {...props} />;
  }

  return (
    <section
      className={cn(
        "relative flex min-h-[20rem] flex-col justify-between overflow-hidden rounded-lg border bg-background p-6 text-foreground md:min-h-[24rem] md:p-8",
        node.stage?.variant === "fullscreen" ? "min-h-[32rem]" : "",
        className,
      )}
      data-story-stage={rendererKey}
    >
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-muted/80 to-transparent" />
      <div className="relative">
        {node.eyebrow ? (
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {node.eyebrow}
          </p>
        ) : null}
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
          {node.title}
        </h2>
      </div>
      <StoryContent
        content={node.content}
        className="relative mt-8 max-w-2xl text-muted-foreground"
      />
    </section>
  );
}
