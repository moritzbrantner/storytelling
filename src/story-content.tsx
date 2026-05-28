"use client";

import { Fragment } from "react";

import { cn } from "@moritzbrantner/ui";

import type { StoryContentBlock, StoryMediaTextTrack } from "./story-model";
import type {
  StoryContentRenderer,
  StoryContentRendererProps,
  StoryContentRendererRegistry,
} from "./story-render-types";

export type StoryContentProps = StoryContentRendererProps & {
  className?: string;
};

function renderTrack(track: StoryMediaTextTrack) {
  return (
    <track
      key={`${track.src}-${track.label}`}
      src={track.src}
      label={track.label}
      srcLang={track.srcLang}
      kind={track.kind ?? "subtitles"}
      default={track.default}
    />
  );
}

export const defaultStoryContentRenderers: StoryContentRendererRegistry = {
  paragraph: ({ block }) => {
    if (block.type !== "paragraph") return null;

    return <p>{block.text}</p>;
  },
  heading: ({ block }) => {
    if (block.type !== "heading") return null;

    const Heading = `h${block.level ?? 3}` as "h2" | "h3" | "h4";

    return (
      <Heading className="text-xl font-semibold tracking-tight text-foreground">
        {block.text}
      </Heading>
    );
  },
  quote: ({ block }) => {
    if (block.type !== "quote") return null;

    return (
      <blockquote className="border-l-2 border-foreground/20 pl-4 text-foreground">
        <p>{block.text}</p>
        {block.cite ? (
          <cite className="mt-2 block text-sm not-italic text-muted-foreground">{block.cite}</cite>
        ) : null}
      </blockquote>
    );
  },
  list: ({ block }) => {
    if (block.type !== "list") return null;

    return (
      <ul className="list-disc space-y-2 pl-5">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  },
  image: ({ block }) => {
    if (block.type !== "image") return null;

    return (
      <figure className="space-y-2">
        <img
          src={block.src}
          alt={block.alt}
          className="aspect-video w-full rounded-md object-cover"
        />
        {block.caption ? (
          <figcaption className="text-sm text-muted-foreground">{block.caption}</figcaption>
        ) : null}
      </figure>
    );
  },
  audio: ({ block }) => {
    if (block.type !== "audio") return null;

    return (
      <figure className="space-y-2">
        {block.title ? (
          <figcaption className="text-sm font-medium text-foreground">{block.title}</figcaption>
        ) : null}
        <audio controls src={block.src} className="w-full">
          {block.tracks?.map(renderTrack)}
        </audio>
      </figure>
    );
  },
  video: ({ block }) => {
    if (block.type !== "video") return null;

    return (
      <figure className="space-y-2">
        {block.title ? (
          <figcaption className="text-sm font-medium text-foreground">{block.title}</figcaption>
        ) : null}
        <video
          controls
          src={block.src}
          poster={block.poster}
          className="aspect-video w-full rounded-md bg-black object-cover"
        >
          {block.tracks?.map(renderTrack)}
        </video>
      </figure>
    );
  },
};

function renderStoryContentBlock(
  block: StoryContentBlock,
  index: number,
  content: StoryContentBlock[],
  renderers: StoryContentRendererRegistry,
  renderBlock?: StoryContentRenderer,
) {
  const renderer = renderers[block.type] ?? renderBlock;

  return renderer?.({ block, index, content }) ?? null;
}

export function StoryContent({
  content,
  renderBlock,
  renderers,
  emptyContent,
  className,
}: StoryContentProps) {
  if (!content?.length) {
    return emptyContent ? <div className={className}>{emptyContent}</div> : null;
  }

  const resolvedRenderers = { ...defaultStoryContentRenderers, ...renderers };

  return (
    <div className={cn("space-y-4 text-sm leading-7 md:text-base", className)}>
      {content.map((block, index) => (
        <Fragment key={`${block.type}-${index}`}>
          {renderStoryContentBlock(block, index, content, resolvedRenderers, renderBlock)}
        </Fragment>
      ))}
    </div>
  );
}
