"use client";

import { cn } from "@moritzbrantner/ui";

import type { StoryContentRendererProps, StoryMediaTextTrack } from "./story-model";

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

export function StoryContent({ content, emptyContent, className }: StoryContentProps) {
  if (!content?.length) {
    return emptyContent ? <div className={className}>{emptyContent}</div> : null;
  }

  return (
    <div className={cn("space-y-4 text-sm leading-7 md:text-base", className)}>
      {content.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case "paragraph":
            return <p key={key}>{block.text}</p>;
          case "heading": {
            const Heading = `h${block.level ?? 3}` as "h2" | "h3" | "h4";

            return (
              <Heading key={key} className="text-xl font-semibold tracking-tight text-foreground">
                {block.text}
              </Heading>
            );
          }
          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-2 border-foreground/20 pl-4 text-foreground"
              >
                <p>{block.text}</p>
                {block.cite ? (
                  <cite className="mt-2 block text-sm not-italic text-muted-foreground">
                    {block.cite}
                  </cite>
                ) : null}
              </blockquote>
            );
          case "list":
            return (
              <ul key={key} className="list-disc space-y-2 pl-5">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "image":
            return (
              <figure key={key} className="space-y-2">
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
          case "audio":
            return (
              <figure key={key} className="space-y-2">
                {block.title ? (
                  <figcaption className="text-sm font-medium text-foreground">
                    {block.title}
                  </figcaption>
                ) : null}
                <audio controls src={block.src} className="w-full">
                  {block.tracks?.map(renderTrack)}
                </audio>
              </figure>
            );
          case "video":
            return (
              <figure key={key} className="space-y-2">
                {block.title ? (
                  <figcaption className="text-sm font-medium text-foreground">
                    {block.title}
                  </figcaption>
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
          default:
            return null;
        }
      })}
    </div>
  );
}
