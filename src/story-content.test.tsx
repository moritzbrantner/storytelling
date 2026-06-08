import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  StoryContent,
  createStoryContentRendererRegistry,
  createStoryContentSchemaExtension,
  defaultStoryContentRenderers,
} from "./story-content";
import type { StoryContentBlock } from "./story-model";
import type { StoryContentRenderer } from "./story-render-types";

afterEach(() => {
  cleanup();
});

describe("StoryContent", () => {
  test("renders empty content fallbacks and null empty output", () => {
    const { container, rerender } = render(
      <StoryContent content={[]} emptyContent="Empty" className="empty-shell" />,
    );

    expect(screen.getByText("Empty")).toBeTruthy();
    expect(container.querySelector(".empty-shell")).toBeTruthy();

    rerender(<StoryContent />);
    expect(container.textContent).toBe("");
  });

  test("renders built-in text, media, table, code, embed, callout, and markdown blocks", () => {
    const { container } = render(
      <StoryContent
        content={[
          { type: "paragraph", text: "Paragraph copy" },
          { type: "heading", level: 2, text: "Heading two" },
          { type: "heading", text: "Heading default" },
          { type: "heading", level: 4, text: "Heading four" },
          { type: "quote", text: "Quoted copy", cite: "Quoted source" },
          { type: "quote", text: "Uncited quote" },
          { type: "list", items: ["First item", "Second item"] },
          { type: "image", src: "/image.png", alt: "Image alt", caption: "Image caption" },
          { type: "image", src: "/image-plain.png", alt: "Plain image" },
          {
            type: "audio",
            src: "/audio.mp3",
            title: "Audio title",
            tracks: [{ src: "/audio.vtt", label: "Audio captions", default: true }],
          },
          {
            type: "video",
            src: "/video.mp4",
            title: "Video title",
            poster: "/poster.png",
            tracks: [{ src: "/video.vtt", label: "Video captions", kind: "captions" }],
          },
          {
            type: "table",
            caption: "Results table",
            columns: [
              { id: "left", header: "Left", align: "left" },
              { id: "center", header: "Center", align: "center" },
              { id: "right", header: "Right", align: "right" },
              { id: "missing", header: "Missing" },
            ],
            rows: [
              { left: "String", center: 12, right: true, missing: null },
              { left: "Second", center: 0, right: false },
            ],
          },
          { type: "code", code: "const value = 1;", language: "ts", filename: "value.ts" },
          { type: "code", code: "plain code" },
          { type: "embed", src: "https://example.com/default", title: "Default embed" },
          {
            type: "embed",
            src: "https://example.com/four-three",
            title: "Four three embed",
            aspectRatio: "4:3",
            allow: "fullscreen",
          },
          {
            type: "embed",
            src: "https://example.com/square",
            title: "Square embed",
            aspectRatio: "1:1",
          },
          {
            type: "embed",
            src: "https://example.com/auto",
            title: "Auto embed",
            aspectRatio: "auto",
          },
          { type: "callout", content: "Info callout" },
          { type: "callout", tone: "success", title: "Success", content: "Success callout" },
          { type: "callout", tone: "warning", title: "Warning", content: "Warning callout" },
          { type: "callout", tone: "danger", title: "Danger", content: "Danger callout" },
          { type: "callout", tone: "neutral", title: "Neutral", content: "Neutral callout" },
          { type: "markdown", markdown: "## Markdown\n\nBody" },
        ]}
      />,
    );

    expect(screen.getByText("Paragraph copy")).toBeTruthy();
    expect(screen.getByText("Heading two")).toBeTruthy();
    expect(screen.getByText("Heading default")).toBeTruthy();
    expect(screen.getByText("Heading four")).toBeTruthy();
    expect(screen.getByText("Quoted source")).toBeTruthy();
    expect(screen.getByText("Uncited quote")).toBeTruthy();
    expect(screen.getByText("First item")).toBeTruthy();
    expect(screen.getByAltText("Image alt")).toBeTruthy();
    expect(screen.getByText("Image caption")).toBeTruthy();
    expect(screen.getByAltText("Plain image")).toBeTruthy();
    expect(screen.getByText("Audio title")).toBeTruthy();
    expect(screen.getByText("Video title")).toBeTruthy();
    expect(screen.getByText("Results table")).toBeTruthy();
    expect(screen.getByText("String")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("true")).toBeTruthy();
    expect(screen.getByText("false")).toBeTruthy();
    expect(screen.getByText("value.ts")).toBeTruthy();
    expect(screen.getByText("ts")).toBeTruthy();
    expect(screen.getByText("plain code")).toBeTruthy();
    expect(screen.getByTitle("Default embed").getAttribute("allow")).toBe(
      "fullscreen; picture-in-picture",
    );
    expect(screen.getByTitle("Four three embed").className).toContain("aspect-[4/3]");
    expect(screen.getByTitle("Four three embed").getAttribute("allow")).toBe("fullscreen");
    expect(screen.getByTitle("Square embed").className).toContain("aspect-square");
    expect(screen.getByTitle("Auto embed").className).toContain("min-h-80");
    expect(screen.getByText("Info callout")).toBeTruthy();
    expect(screen.getByText("Success")).toBeTruthy();
    expect(screen.getByText("Warning")).toBeTruthy();
    expect(screen.getByText("Danger")).toBeTruthy();
    expect(screen.getByText("Neutral")).toBeTruthy();
    expect(screen.getByText(/Markdown/)).toBeTruthy();
    expect(container.querySelector('track[label="Audio captions"]')).toBeTruthy();
    expect(container.querySelector('track[label="Video captions"]')).toBeTruthy();
    expect(container.querySelectorAll("td")[3]?.textContent).toBe("");
    expect(container.querySelectorAll("td")[7]?.textContent).toBe("");
  });

  test("renders built-in chart variants and accessible data tables", () => {
    const charts: StoryContentBlock[] = [
      {
        type: "chart",
        chartType: "bar",
        title: "Bar chart",
        description: "Bar description",
        data: [{ label: "A", value: 3 }],
        series: [{ key: "value", label: "Value", color: "#123456" }],
      },
      {
        type: "chart",
        chartType: "line",
        title: "Line chart",
        data: [{ label: "A", amount: 4 }],
        yKey: "amount",
      },
      {
        type: "chart",
        chartType: "area",
        title: "Area chart",
        data: [{ label: "A", total: 5 }],
      },
      {
        type: "chart",
        chartType: "pie",
        title: "Pie chart",
        data: [
          { label: "A", value: 2 },
          { label: "B", value: 3 },
        ],
        yKey: "value",
      },
    ];

    const { container, rerender } = render(<StoryContent content={charts} />);

    expect(screen.getAllByText("Bar chart").length).toBeGreaterThan(0);
    expect(screen.getByText("Bar description")).toBeTruthy();
    expect(screen.getAllByText("Line chart").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Area chart").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pie chart").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("svg[role='img']")).toHaveLength(4);
    expect(screen.getAllByText("label").length).toBeGreaterThan(0);
    expect(screen.getAllByText("value").length).toBeGreaterThan(0);

    rerender(
      <StoryContent
        content={[
          { type: "chart", chartType: "bar", title: "No series", data: [{ label: "A" }] },
          {
            type: "chart",
            chartType: "pie",
            title: "Zero pie",
            data: [{ label: "A", value: 0 }],
            yKey: "value",
          },
        ]}
      />,
    );

    expect(screen.getByText("No series")).toBeTruthy();
    expect(screen.getByText("Zero pie")).toBeTruthy();
    expect(container.querySelectorAll("svg[role='img']")).toHaveLength(0);
  });

  test("uses custom renderers and renderBlock fallback without overriding built-ins", () => {
    const fallback = vi.fn(({ block }) => <p>Fallback {(block as { type: string }).type}</p>);
    const renderers = createStoryContentRendererRegistry({
      chart: ({ block }) => <figure>Custom chart {block.title}</figure>,
    });

    render(
      <StoryContent
        content={[
          { type: "paragraph", text: "Built-in paragraph" },
          { type: "chart", chartType: "bar", title: "Revenue", data: [{ label: "Q1", value: 10 }] },
          { type: "custom-block", value: 1 } as unknown as StoryContentBlock,
        ]}
        renderers={renderers}
        renderBlock={fallback}
      />,
    );

    expect(screen.getByText("Built-in paragraph")).toBeTruthy();
    expect(screen.getByText("Custom chart Revenue")).toBeTruthy();
    expect(screen.getByText("Fallback custom-block")).toBeTruthy();
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  test("returns null from mismatched built-in renderers and returns schema extensions unchanged", () => {
    const paragraph = { type: "paragraph", text: "Paragraph" } as StoryContentBlock;
    const chart = {
      type: "chart",
      chartType: "bar",
      data: [{ label: "A", value: 1 }],
    } as StoryContentBlock;

    expect(
      (defaultStoryContentRenderers.paragraph as StoryContentRenderer)?.({
        block: chart,
        index: 0,
        content: [],
      }),
    ).toBe(null);

    for (const [type, renderer] of Object.entries(defaultStoryContentRenderers)) {
      if (type === "paragraph") continue;
      expect(
        (renderer as StoryContentRenderer)?.({ block: paragraph, index: 0, content: [] }),
      ).toBe(null);
    }

    const extension = { markdown: { type: "object" } };

    expect(createStoryContentSchemaExtension(extension)).toBe(extension);
  });
});
