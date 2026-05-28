"use client";

import { useEffect, useMemo, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@moritzbrantner/ui";

import type { StoryMediaTextTrack, StoryNodeData } from "./story-model";
import type { StoryRenderProps, StoryStageComponent } from "./story-render-types";

export type { StoryMediaTextTrack } from "./story-model";

export type StorySubtitleCue = {
  id: string;
  startTimeInSeconds: number;
  endTimeInSeconds: number;
  text: string;
};

export type StorySubtitleFileProps = {
  src?: string;
  content?: string;
  title?: ReactNode;
  description?: ReactNode;
  languageLabel?: ReactNode;
  format?: "auto" | "srt" | "vtt";
  showTimestamps?: boolean;
  className?: string;
  listClassName?: string;
  loadingLabel?: ReactNode;
  emptyLabel?: ReactNode;
  errorLabel?: ReactNode;
};

export type StoryAudioFileProps = Omit<ComponentPropsWithoutRef<"audio">, "children"> & {
  title?: ReactNode;
  description?: ReactNode;
  artworkSrc?: string;
  className?: string;
  playerClassName?: string;
  tracks?: StoryMediaTextTrack[];
};

export type StoryVideoFileProps = Omit<ComponentPropsWithoutRef<"video">, "children"> & {
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  playerClassName?: string;
  tracks?: StoryMediaTextTrack[];
};

function extractFileName(src?: string) {
  if (!src) {
    return null;
  }

  const [path] = src.split(/[?#]/, 1);
  const segments = path.split("/").filter(Boolean);

  return segments[segments.length - 1] ?? src;
}

function inferSubtitleFormat(input: string, format: StorySubtitleFileProps["format"]) {
  if (format && format !== "auto") {
    return format;
  }

  const normalized = input.trim().toLowerCase();

  if (normalized.startsWith("webvtt") || normalized.endsWith(".vtt")) {
    return "vtt";
  }

  return "srt";
}

function parseSubtitleTimestamp(input: string) {
  const normalized = input.trim().replace(",", ".");
  const segments = normalized.split(":");

  if (segments.length < 2 || segments.length > 3) {
    return null;
  }

  const secondsWithMillis = Number(segments[segments.length - 1]);
  const minutes = Number(segments[segments.length - 2]);
  const hours = segments.length === 3 ? Number(segments[0]) : 0;

  if (Number.isNaN(secondsWithMillis) || Number.isNaN(minutes) || Number.isNaN(hours)) {
    return null;
  }

  return hours * 3600 + minutes * 60 + secondsWithMillis;
}

export function parseSubtitleText(
  input: string,
  format: StorySubtitleFileProps["format"] = "auto",
) {
  const normalized = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!normalized) {
    return [] as StorySubtitleCue[];
  }

  const resolvedFormat = inferSubtitleFormat(normalized, format);
  const withoutHeader =
    resolvedFormat === "vtt" ? normalized.replace(/^WEBVTT[^\n]*\n+/, "") : normalized;
  const blocks = withoutHeader
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const cues: StorySubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean);

    if (lines.length === 0) {
      continue;
    }

    if (
      resolvedFormat === "vtt" &&
      (lines[0]?.startsWith("NOTE") ||
        lines[0]?.startsWith("STYLE") ||
        lines[0]?.startsWith("REGION") ||
        lines[0]?.startsWith("X-TIMESTAMP-MAP"))
    ) {
      continue;
    }

    let timingLineIndex = 0;

    if (!lines[0]?.includes("-->")) {
      timingLineIndex = 1;
    }

    const timingLine = lines[timingLineIndex];

    if (!timingLine || !timingLine.includes("-->")) {
      continue;
    }

    const [rawStart, rawEndAndSettings] = timingLine.split("-->");
    const rawEnd = rawEndAndSettings?.trim().split(/\s+/, 1)[0];
    const startTimeInSeconds = parseSubtitleTimestamp(rawStart ?? "");
    const endTimeInSeconds = parseSubtitleTimestamp(rawEnd ?? "");

    if (
      startTimeInSeconds === null ||
      endTimeInSeconds === null ||
      endTimeInSeconds <= startTimeInSeconds
    ) {
      continue;
    }

    const text = lines
      .slice(timingLineIndex + 1)
      .join("\n")
      .trim();

    if (!text) {
      continue;
    }

    cues.push({
      id: `${cues.length}-${startTimeInSeconds}-${endTimeInSeconds}`,
      startTimeInSeconds,
      endTimeInSeconds,
      text,
    });
  }

  return cues;
}

export function formatSubtitleTime(seconds: number) {
  const totalSeconds = Math.max(seconds, 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const secondsLabel = remainingSeconds.toFixed(3).padStart(6, "0");

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${secondsLabel}`;
  }

  return `${String(minutes).padStart(2, "0")}:${secondsLabel}`;
}

function StoryMediaHeader({
  label,
  title,
  description,
  badge,
}: {
  label: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
        <h4 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h4>
        {description ? (
          <div className="mt-3 text-sm leading-6 text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {badge ? (
        <div className="rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {badge}
        </div>
      ) : null}
    </div>
  );
}

function StoryMediaTrackElements({ tracks }: { tracks?: StoryMediaTextTrack[] }) {
  return tracks?.map((track) => (
    <track
      key={`${track.kind ?? "subtitles"}-${track.label}-${track.src}`}
      default={track.default}
      kind={track.kind}
      label={track.label}
      src={track.src}
      srcLang={track.srcLang}
    />
  ));
}

export function StorySubtitleFile({
  src,
  content,
  title,
  description,
  languageLabel = "Subtitle file",
  format = "auto",
  showTimestamps = true,
  className,
  listClassName,
  loadingLabel = "Loading subtitle cues...",
  emptyLabel = "No subtitle cues available.",
  errorLabel = "Unable to load subtitle file.",
}: StorySubtitleFileProps) {
  const [resolvedContent, setResolvedContent] = useState(content ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    content ? "ready" : src ? "loading" : "idle",
  );

  useEffect(() => {
    if (content !== undefined) {
      setResolvedContent(content);
      setStatus("ready");
      return;
    }

    if (!src) {
      setResolvedContent("");
      setStatus("idle");
      return;
    }

    let cancelled = false;

    setStatus("loading");

    void fetch(src)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load subtitle file: ${response.status}`);
        }

        return response.text();
      })
      .then((nextContent) => {
        if (cancelled) {
          return;
        }

        setResolvedContent(nextContent);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setResolvedContent("");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [content, src]);

  const cues = useMemo(() => parseSubtitleText(resolvedContent, format), [format, resolvedContent]);
  const fileName = title ?? extractFileName(src) ?? "Inline subtitles";
  const badge = src
    ? inferSubtitleFormat(src, format).toUpperCase()
    : inferSubtitleFormat(resolvedContent, format).toUpperCase();

  return (
    <section
      className={cn(
        "relative min-h-[24rem] overflow-hidden rounded-[2rem] border bg-card text-card-foreground shadow-2xl shadow-black/10",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_42%),linear-gradient(180deg,rgba(14,23,38,0.95),rgba(3,7,18,1))]" />
      <div className="relative z-10 flex h-full flex-col p-6 md:p-8">
        <StoryMediaHeader
          label={languageLabel}
          title={fileName}
          description={description}
          badge={badge}
        />
        <div
          className={cn(
            "mt-6 flex-1 rounded-[1.5rem] border border-white/10 bg-black/25 p-4",
            listClassName,
          )}
        >
          {status === "loading" ? <p className="text-sm text-white/72">{loadingLabel}</p> : null}
          {status === "error" ? <p className="text-sm text-white/72">{errorLabel}</p> : null}
          {status !== "loading" && status !== "error" && cues.length === 0 ? (
            <p className="text-sm text-white/72">{emptyLabel}</p>
          ) : null}
          {cues.length > 0 ? (
            <ol className="space-y-3 overflow-y-auto pr-2">
              {cues.map((cue) => (
                <li
                  key={cue.id}
                  className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4"
                >
                  {showTimestamps ? (
                    <p className="text-xs uppercase tracking-[0.22em] text-white/60">
                      {formatSubtitleTime(cue.startTimeInSeconds)} -{" "}
                      {formatSubtitleTime(cue.endTimeInSeconds)}
                    </p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/88 md:text-base">
                    {cue.text}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function StoryAudioFile({
  title,
  description,
  artworkSrc,
  className,
  playerClassName,
  tracks,
  controls = true,
  preload = "metadata",
  src,
  ...props
}: StoryAudioFileProps) {
  const fileName = title ?? extractFileName(src) ?? "Audio track";

  return (
    <figure
      className={cn(
        "relative min-h-[24rem] overflow-hidden rounded-[2rem] border bg-card text-card-foreground shadow-2xl shadow-black/10",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.18),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))]" />
      <div className="relative z-10 flex h-full flex-col justify-between gap-6 p-6 md:p-8">
        <StoryMediaHeader
          label="Audio file"
          title={fileName}
          description={description}
          badge={src ? extractFileName(src)?.split(".").pop() : undefined}
        />
        <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-end">
          <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5">
            {artworkSrc ? (
              <img src={artworkSrc} alt="" className="h-full min-h-[180px] w-full object-cover" />
            ) : (
              <div className="flex min-h-[180px] items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-6 text-center text-sm uppercase tracking-[0.28em] text-white/65">
                Audio
              </div>
            )}
          </div>
          <audio
            {...props}
            controls={controls}
            preload={preload}
            src={src}
            className={cn("w-full", playerClassName)}
          >
            <StoryMediaTrackElements tracks={tracks} />
          </audio>
        </div>
      </div>
    </figure>
  );
}

export function StoryVideoFile({
  title,
  description,
  className,
  playerClassName,
  tracks,
  controls = true,
  preload = "metadata",
  playsInline = true,
  src,
  ...props
}: StoryVideoFileProps) {
  const fileName = title ?? extractFileName(src) ?? "Video clip";

  return (
    <figure
      className={cn(
        "relative min-h-[24rem] overflow-hidden rounded-[2rem] border bg-card text-card-foreground shadow-2xl shadow-black/10",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,1))]" />
      <div className="relative z-10 flex h-full flex-col gap-6 p-6 md:p-8">
        <StoryMediaHeader
          label="Video file"
          title={fileName}
          description={description}
          badge={src ? extractFileName(src)?.split(".").pop() : undefined}
        />
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40">
          <video
            {...props}
            controls={controls}
            preload={preload}
            playsInline={playsInline}
            src={src}
            className={cn("aspect-video w-full bg-black object-cover", playerClassName)}
          >
            <StoryMediaTrackElements tracks={tracks} />
          </video>
        </div>
      </div>
    </figure>
  );
}

export function createSubtitleStoryScene<TData extends StoryNodeData = StoryNodeData>(
  props: StorySubtitleFileProps,
): StoryStageComponent<TData> {
  function SubtitleStoryScene(_renderProps: StoryRenderProps<TData>) {
    return <StorySubtitleFile {...props} />;
  }

  SubtitleStoryScene.displayName = "SubtitleStoryScene";

  return SubtitleStoryScene;
}

export function createAudioStoryScene<TData extends StoryNodeData = StoryNodeData>(
  props: StoryAudioFileProps,
): StoryStageComponent<TData> {
  function AudioStoryScene(_renderProps: StoryRenderProps<TData>) {
    return <StoryAudioFile {...props} />;
  }

  AudioStoryScene.displayName = "AudioStoryScene";

  return AudioStoryScene;
}

export function createVideoStoryScene<TData extends StoryNodeData = StoryNodeData>(
  props: StoryVideoFileProps,
): StoryStageComponent<TData> {
  function VideoStoryScene(_renderProps: StoryRenderProps<TData>) {
    return <StoryVideoFile {...props} />;
  }

  VideoStoryScene.displayName = "VideoStoryScene";

  return VideoStoryScene;
}
