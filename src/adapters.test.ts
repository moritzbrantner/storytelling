import { describe, expect, test } from "vitest";

import { createChartContentRenderer } from "./adapters-charts";
import { createMarkdownContentRenderer } from "./adapters-markdown";

describe("optional content adapters", () => {
  test("creates markdown renderer placeholders with actionable errors", () => {
    const renderer = createMarkdownContentRenderer();

    expect(renderer).toEqual(expect.any(Function));
    expect(() =>
      renderer({ block: { type: "markdown", markdown: "# Title" }, index: 0, content: [] }),
    ).toThrow(/Markdown content rendering is optional/);
    expect(() =>
      renderer({ block: { type: "markdown", markdown: "# Title" }, index: 0, content: [] }),
    ).toThrow(/a markdown renderer such as react-markdown/);
    expect(() =>
      renderer({ block: { type: "markdown", markdown: "# Title" }, index: 0, content: [] }),
    ).toThrow(/StoryContent renderers/);

    const custom = createMarkdownContentRenderer({ packageName: "react-markdown" });

    expect(() =>
      custom({ block: { type: "markdown", markdown: "# Title" }, index: 0, content: [] }),
    ).toThrow(/react-markdown/);
  });

  test("creates chart renderer placeholders with actionable errors", () => {
    const renderer = createChartContentRenderer();

    expect(renderer).toEqual(expect.any(Function));
    expect(() =>
      renderer({
        block: { type: "chart", chartType: "bar", data: [{ label: "A", value: 1 }] },
        index: 0,
        content: [],
      }),
    ).toThrow(/Chart content rendering is optional/);
    expect(() =>
      renderer({
        block: { type: "chart", chartType: "bar", data: [{ label: "A", value: 1 }] },
        index: 0,
        content: [],
      }),
    ).toThrow(/a chart renderer such as recharts/);
    expect(() =>
      renderer({
        block: { type: "chart", chartType: "bar", data: [{ label: "A", value: 1 }] },
        index: 0,
        content: [],
      }),
    ).toThrow(/StoryContent renderers/);

    const custom = createChartContentRenderer({ packageName: "@visx/xychart" });

    expect(() =>
      custom({
        block: { type: "chart", chartType: "bar", data: [{ label: "A", value: 1 }] },
        index: 0,
        content: [],
      }),
    ).toThrow(/@visx\/xychart/);
  });
});
