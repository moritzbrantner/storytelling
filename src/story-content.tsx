"use client";

import { Fragment } from "react";

import { cn } from "./ui";

import type { StoryChartBlock, StoryContentBlock, StoryMediaTextTrack } from "./story-model";
import type {
  StoryContentBlockMap,
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

function formatCellValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";

  return String(value);
}

function getTextAlignClass(align: "left" | "center" | "right" | undefined) {
  switch (align) {
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    default:
      return "text-left";
  }
}

function getChartSeries(block: StoryChartBlock) {
  if (block.series?.length) return block.series;
  if (block.yKey) return [{ key: block.yKey, label: block.yKey }];

  const firstRow = block.data[0];
  const numericKey = firstRow
    ? Object.entries(firstRow).find(
        ([key, value]) => key !== block.xKey && typeof value === "number",
      )?.[0]
    : undefined;

  return numericKey ? [{ key: numericKey, label: numericKey }] : [];
}

function getNumericValue(row: Record<string, string | number | null>, key: string) {
  const value = row[key];

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function renderChartSvg(block: StoryChartBlock) {
  const series = getChartSeries(block);
  const primarySeries = series[0];
  if (!primarySeries || block.data.length === 0) return null;

  const values = block.data.map((row) => getNumericValue(row, primarySeries.key));
  const max = Math.max(...values, 1);
  const width = 640;
  const height = 220;
  const padding = 28;
  const color = primarySeries.color ?? "#0a7c6f";

  if (block.chartType === "pie") {
    const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0);
    if (total <= 0) return null;

    let cursor = 0;
    const radius = 76;
    const cx = width / 2;
    const cy = height / 2;

    return (
      <svg role="img" viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        <title>{block.title ?? "Chart"}</title>
        {values.map((value, index) => {
          const start = (cursor / total) * Math.PI * 2;
          cursor += Math.max(value, 0);
          const end = (cursor / total) * Math.PI * 2;
          const largeArc = end - start > Math.PI ? 1 : 0;
          const x1 = cx + radius * Math.cos(start);
          const y1 = cy + radius * Math.sin(start);
          const x2 = cx + radius * Math.cos(end);
          const y2 = cy + radius * Math.sin(end);
          const shade = `hsl(${(index * 58) % 360} 58% 42%)`;

          return (
            <path
              key={`${primarySeries.key}-${index}`}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={shade}
            />
          );
        })}
      </svg>
    );
  }

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const points = values.map((value, index) => {
    const x =
      padding + (values.length <= 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth);
    const y = padding + innerHeight - (Math.max(value, 0) / max) * innerHeight;

    return { x, y, value };
  });
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${path} L ${points[points.length - 1]?.x ?? padding} ${height - padding} L ${
    points[0]?.x ?? padding
  } ${height - padding} Z`;

  return (
    <svg role="img" viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
      <title>{block.title ?? "Chart"}</title>
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="currentColor"
        opacity="0.2"
      />
      <line
        x1={padding}
        y1={padding}
        x2={padding}
        y2={height - padding}
        stroke="currentColor"
        opacity="0.2"
      />
      {block.chartType === "bar"
        ? points.map((point, index) => {
            const barWidth = Math.max(8, innerWidth / Math.max(points.length, 1) - 8);

            return (
              <rect
                key={`${primarySeries.key}-${index}`}
                x={point.x - barWidth / 2}
                y={point.y}
                width={barWidth}
                height={height - padding - point.y}
                rx={3}
                fill={color}
              />
            );
          })
        : null}
      {block.chartType === "area" ? <path d={areaPath} fill={color} opacity="0.18" /> : null}
      {block.chartType === "line" || block.chartType === "area" ? (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

export function createStoryContentRendererRegistry<
  TBlocks extends StoryContentBlockMap = StoryContentBlockMap,
>(registry: StoryContentRendererRegistry<TBlocks>) {
  return registry;
}

export function createStoryContentSchemaExtension(extension: Record<string, unknown>) {
  return extension;
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
  table: ({ block }) => {
    if (block.type !== "table") return null;

    return (
      <figure className="space-y-2">
        {block.caption ? (
          <figcaption className="text-sm font-medium text-foreground">{block.caption}</figcaption>
        ) : null}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {block.columns.map((column) => (
                  <th
                    key={column.id}
                    className={cn("px-3 py-2 font-semibold", getTextAlignClass(column.align))}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b last:border-b-0">
                  {block.columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn("px-3 py-2", getTextAlignClass(column.align))}
                    >
                      {formatCellValue(row[column.id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    );
  },
  code: ({ block }) => {
    if (block.type !== "code") return null;

    return (
      <figure className="overflow-hidden rounded-md border bg-muted/30">
        {block.filename || block.language ? (
          <figcaption className="flex items-center justify-between gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>{block.filename ?? "Code"}</span>
            {block.language ? <span>{block.language}</span> : null}
          </figcaption>
        ) : null}
        <pre className="m-0 overflow-x-auto p-3 text-xs leading-6">
          <code>{block.code}</code>
        </pre>
      </figure>
    );
  },
  chart: ({ block }) => {
    if (block.type !== "chart") return null;

    const svg = renderChartSvg(block);
    const columns = Array.from(new Set(block.data.flatMap((row) => Object.keys(row))));

    return (
      <figure className="space-y-3 rounded-md border p-3">
        {block.title ? (
          <figcaption className="text-sm font-semibold text-foreground">{block.title}</figcaption>
        ) : null}
        {block.description ? (
          <p className="m-0 text-sm text-muted-foreground">{block.description}</p>
        ) : null}
        {svg}
        <div className="sr-only">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td key={column}>{formatCellValue(row[column])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    );
  },
  embed: ({ block }) => {
    if (block.type !== "embed") return null;

    const aspectClass =
      block.aspectRatio === "4:3"
        ? "aspect-[4/3]"
        : block.aspectRatio === "1:1"
          ? "aspect-square"
          : block.aspectRatio === "auto"
            ? "min-h-80"
            : "aspect-video";

    return (
      <iframe
        src={block.src}
        title={block.title}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow={block.allow ?? "fullscreen; picture-in-picture"}
        className={cn("w-full rounded-md border", aspectClass)}
      />
    );
  },
  callout: ({ block }) => {
    if (block.type !== "callout") return null;

    const toneClass =
      block.tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/10"
        : block.tone === "warning"
          ? "border-amber-500/30 bg-amber-500/10"
          : block.tone === "danger"
            ? "border-rose-500/30 bg-rose-500/10"
            : block.tone === "neutral"
              ? "border-foreground/15 bg-muted/40"
              : "border-sky-500/30 bg-sky-500/10";

    return (
      <aside className={cn("rounded-md border p-3", toneClass)}>
        {block.title ? (
          <strong className="block text-sm text-foreground">{block.title}</strong>
        ) : null}
        <p className={cn("m-0 text-sm", block.title ? "mt-1" : "")}>{block.content}</p>
      </aside>
    );
  },
  markdown: ({ block }) => {
    if (block.type !== "markdown") return null;

    return (
      <div className="space-y-3 whitespace-pre-wrap rounded-md border bg-muted/20 p-3 font-mono text-sm">
        {block.markdown}
      </div>
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
  const renderer = (renderers[block.type] as StoryContentRenderer | undefined) ?? renderBlock;

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
