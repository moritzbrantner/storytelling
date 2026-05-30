import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  StoryContent,
  StoryMinimap,
  StoryPlayer,
  StoryScrollTimeline,
  StoryScroller,
  StoryStageFrame,
  analyzeStory,
  applyStoryPatch,
  assertStoryDocument,
  buildStoryTimeline,
  compileStory,
  createStoryRendererRegistry,
  createStoryNode,
  defineStory,
  enumerateStoryPaths,
  getStoryBranches,
  getStoryEndings,
  getStoryNodeEntries,
  parseStoryPath,
  resolveStoryPath,
  serializeStoryPath,
  storyDocumentJsonSchema,
  useStoryPathState,
  useStoryRuntime,
  validateStory,
  validateStoryDocument,
  type StoryDocument,
  type StoryContentBlock,
  type StoryPathState,
  type StoryRenderProps,
  type StoryScrollSceneRenderProps,
  type StoryScrollTransition,
} from ".";

type FixtureData = {
  tone: string;
};

const story = defineStory<FixtureData>({
  id: "signal",
  title: "Signal in the fog",
  subtitle: "A branching test fixture",
  openingNodeId: "wake",
  defaults: {
    durationInFrames: 100,
    transitionInFrames: 12,
  },
  nodes: [
    {
      id: "wake",
      title: "Wake the observatory",
      eyebrow: "Opening",
      content: [
        {
          type: "paragraph",
          text: "A low signal reaches the tower.",
        },
      ],
      prompt: "What should the operator do first?",
      data: { tone: "cold" },
      choices: [
        {
          id: "answer",
          label: "Answer immediately",
          target: "answer-node",
        },
        {
          id: "trace",
          label: "Trace the source",
          target: "trace-node",
        },
        {
          id: "locked",
          label: "Locked branch",
          target: "answer-node",
          disabled: true,
        },
      ],
    },
    {
      id: "answer-node",
      title: "A distant pilot responds",
      content: [
        {
          type: "paragraph",
          text: "The message is fragmented.",
        },
      ],
      next: "pilot-ending",
      data: { tone: "warm" },
    },
    {
      id: "pilot-ending",
      title: "The city hears the pilot",
      durationInFrames: 90,
      content: [
        {
          type: "quote",
          text: "Contact changes the route.",
        },
      ],
      data: { tone: "bright" },
    },
    {
      id: "trace-node",
      title: "The map reveals a hidden harbor",
      content: [
        {
          type: "paragraph",
          text: "The signal comes from a cove nobody has charted in decades.",
        },
      ],
      stage: {
        renderer: "custom",
      },
      data: { tone: "green" },
    },
  ],
});

const linearStory = defineStory<FixtureData>({
  id: "linear-report",
  title: "Linear report",
  openingNodeId: "draft",
  nodes: [
    {
      id: "draft",
      title: "Draft the report",
      content: [{ type: "paragraph", text: "Draft the morning brief." }],
      next: "review",
      data: { tone: "cold" },
    },
    {
      id: "review",
      title: "Review the report",
      content: [{ type: "paragraph", text: "Review the copy for sequence and clarity." }],
      next: "publish",
      data: { tone: "warm" },
    },
    {
      id: "publish",
      title: "Publish the report",
      content: [{ type: "paragraph", text: "Publish the report at noon." }],
      data: { tone: "bright" },
    },
  ],
});

const nestedStory = defineStory<FixtureData>({
  id: "nested-report",
  title: "Nested report",
  openingNodeId: "chapter",
  nodes: [
    {
      id: "chapter",
      title: "Chapter",
      content: [{ type: "paragraph", text: "Open the chapter." }],
      next: "ending",
      data: { tone: "cold" },
      children: [
        {
          id: "chapter-scene-a",
          title: "Scene A",
          content: [{ type: "paragraph", text: "First nested scene." }],
          data: { tone: "warm" },
        },
        {
          id: "chapter-scene-b",
          title: "Scene B",
          content: [{ type: "paragraph", text: "Second nested scene." }],
          data: { tone: "bright" },
        },
      ],
    },
    {
      id: "ending",
      title: "Ending",
      content: [{ type: "paragraph", text: "Finish the nested story." }],
      data: { tone: "green" },
    },
  ],
});

const longBranchStory = defineStory<FixtureData>({
  id: "long-branch-report",
  title: "Long Relay Report",
  subtitle: "A long branch-heavy story for graph assertions",
  openingNodeId: "opening",
  labels: {
    choosePrompt: "Select the next move.",
    completedBranch: "This branch is complete.",
    continue: "Continue",
    restart: "Restart",
    scrollerLabel: "Long Relay Report scroller",
  },
  defaults: {
    durationInFrames: 100,
    transitionInFrames: 12,
  },
  nodes: [
    {
      id: "opening",
      title: "Relay awakens",
      eyebrow: "Opening",
      content: [{ type: "paragraph", text: "Three independent streams activate at once." }],
      prompt: "Where should routing begin?",
      data: { tone: "cold" },
      choices: [
        {
          id: "answer-pilot",
          label: "Answer pilot",
          target: "pilot-check",
        },
        {
          id: "trace-source",
          label: "Trace source",
          target: "trace-scan",
        },
        {
          id: "archive-review",
          label: "Review archive",
          target: "archive-index",
        },
      ],
    },
    {
      id: "pilot-check",
      title: "Pilot checks in",
      content: [{ type: "paragraph", text: "A short voice ping is stable, but short-lived." }],
      next: "pilot-wave",
      data: { tone: "warm" },
    },
    {
      id: "pilot-wave",
      title: "Carrier pulse settles",
      content: [{ type: "paragraph", text: "The first line is clear, then it drifts." }],
      next: "pilot-decision",
      data: { tone: "warm" },
    },
    {
      id: "pilot-decision",
      title: "Relay route choice",
      content: [{ type: "paragraph", text: "The backup corridor is nearby." }],
      prompt: "Select route handling.",
      data: { tone: "warm" },
      choices: [
        {
          id: "stabilize-route",
          label: "Stabilize",
          target: "pilot-stabilize",
        },
        {
          id: "confirm-route",
          label: "Confirm alternate",
          target: "pilot-confirm",
        },
      ],
    },
    {
      id: "pilot-stabilize",
      title: "Pilot branch stabilizes",
      content: [{ type: "paragraph", text: "Route holds through the false corridor." }],
      next: "relay-hub",
      data: { tone: "warm" },
    },
    {
      id: "pilot-confirm",
      title: "Pilot branch confirms",
      content: [{ type: "paragraph", text: "The alternate route is safe enough." }],
      next: "relay-hub",
      data: { tone: "warm" },
    },
    {
      id: "trace-scan",
      title: "Source scan complete",
      content: [{ type: "paragraph", text: "A hidden inlet appears near a coast." }],
      next: "trace-grid",
      data: { tone: "green" },
    },
    {
      id: "trace-grid",
      title: "Source path split",
      content: [{ type: "paragraph", text: "Teams can either go local or broadcast." }],
      prompt: "Choose source handling.",
      data: { tone: "green" },
      choices: [
        {
          id: "send-team",
          label: "Send team",
          target: "trace-team",
        },
        {
          id: "broadcast-fix",
          label: "Broadcast fix",
          target: "trace-broadcast",
        },
      ],
    },
    {
      id: "trace-team",
      title: "Local team dispatch",
      content: [{ type: "paragraph", text: "A team confirms the source and relays it." }],
      next: "relay-hub",
      data: { tone: "green" },
    },
    {
      id: "trace-broadcast",
      title: "Broadcast fix applied",
      content: [{ type: "paragraph", text: "The source becomes public metadata." }],
      next: "relay-hub",
      data: { tone: "green" },
    },
    {
      id: "archive-index",
      title: "Archive search runs",
      content: [{ type: "paragraph", text: "A similar route exists in historical logs." }],
      next: "archive-decoder",
      data: { tone: "green" },
    },
    {
      id: "archive-decoder",
      title: "Archive branch split",
      content: [{ type: "paragraph", text: "Two leads remain: verify or stash." }],
      prompt: "Choose archive lead.",
      data: { tone: "green" },
      choices: [
        {
          id: "verify-archive",
          label: "Verify archive",
          target: "archive-verify",
        },
        {
          id: "archive-stash",
          label: "Use stash",
          target: "archive-stash",
        },
      ],
    },
    {
      id: "archive-verify",
      title: "Archive route verified",
      content: [{ type: "paragraph", text: "The primary note is still valid." }],
      next: "relay-hub",
      data: { tone: "green" },
    },
    {
      id: "archive-stash",
      title: "Archive stash selected",
      content: [{ type: "paragraph", text: "A secondary cache remains possible but fuzzy." }],
      next: "relay-hub",
      data: { tone: "green" },
    },
    {
      id: "relay-hub",
      title: "Relay hub merge",
      content: [{ type: "paragraph", text: "Every branch rejoins for final clearance." }],
      next: "relay-check",
      data: { tone: "green" },
    },
    {
      id: "relay-check",
      title: "Relay check begins",
      content: [{ type: "paragraph", text: "A final safety check starts." }],
      next: "network-clearance",
      data: { tone: "green" },
    },
    {
      id: "network-clearance",
      title: "Network clearance",
      content: [{ type: "paragraph", text: "Network clearance is granted." }],
      data: { tone: "green" },
    },
  ],
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

function setScrollerGeometry(viewport: HTMLElement, sceneCount: number) {
  Object.defineProperty(viewport, "scrollHeight", {
    configurable: true,
    value: (sceneCount + 1) * 100,
  });
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 100 });
}

function setScrollerTimelineGeometry(viewport: HTMLElement, scrollUnits: number) {
  Object.defineProperty(viewport, "scrollHeight", {
    configurable: true,
    value: scrollUnits + 100,
  });
  Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 100 });
}

function scrollScrollerViewport(viewport: HTMLElement, scrollTop: number) {
  viewport.scrollTop = scrollTop;
  fireEvent.scroll(viewport);
}

function renderScrollTransitionLabel(label: string) {
  return ({ value, isActive }: StoryScrollSceneRenderProps) => (
    <div>
      {label} {isActive ? "active" : "preview"} {Math.round(value)}
    </div>
  );
}

function getScrollerPage(container: HTMLElement, index: number, active: boolean) {
  return container.querySelector<HTMLElement>(
    `[data-story-scroller-index="${index}"][data-active="${active ? "true" : "false"}"]`,
  );
}

function renderTransitionScroller(transition: StoryScrollTransition) {
  const rendered = render(
    <StoryScroller
      ariaLabel="Transition scenes"
      transition={transition}
      scenes={[
        {
          id: "alpha",
          title: "Alpha",
          render: renderScrollTransitionLabel("Alpha"),
        },
        {
          id: "beta",
          title: "Beta",
          render: renderScrollTransitionLabel("Beta"),
        },
      ]}
    />,
  );
  const viewport = rendered.container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

  expect(viewport).toBeTruthy();
  setScrollerTimelineGeometry(viewport!, 220);

  return { ...rendered, viewport: viewport! };
}

function matchesJsonSchema(
  value: unknown,
  schema: Record<string, unknown> | boolean,
  rootSchema: Record<string, unknown> | boolean = schema,
): boolean {
  if (schema === true) return true;
  if (schema === false) return false;

  if (typeof schema.$ref === "string") {
    const refParts = schema.$ref.startsWith("#/")
      ? schema.$ref
          .slice(2)
          .split("/")
          .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
      : [];
    let refSchema: unknown = rootSchema;

    for (const part of refParts) {
      refSchema =
        refSchema && typeof refSchema === "object"
          ? (refSchema as Record<string, unknown>)[part]
          : undefined;
    }

    return Boolean(refSchema) && matchesJsonSchema(value, refSchema as never, rootSchema);
  }

  if ("const" in schema && value !== schema.const) return false;

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return false;
  }

  if (Array.isArray(schema.oneOf)) {
    return (
      schema.oneOf.filter((candidate) => matchesJsonSchema(value, candidate as never, rootSchema))
        .length === 1
    );
  }

  switch (schema.type) {
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;

      const record = value as Record<string, unknown>;
      const required = Array.isArray(schema.required) ? schema.required : [];
      for (const key of required) {
        if (typeof key === "string" && !(key in record)) return false;
      }

      const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          if (!(key in properties)) return false;
        }
      }

      return Object.entries(properties).every(
        ([key, childSchema]) =>
          !(key in record) || matchesJsonSchema(record[key], childSchema, rootSchema),
      );
    }
    case "array": {
      if (!Array.isArray(value)) return false;
      if (typeof schema.minItems === "number" && value.length < schema.minItems) return false;

      const itemSchema = schema.items as Record<string, unknown> | undefined;
      return itemSchema
        ? value.every((item) => matchesJsonSchema(item, itemSchema, rootSchema))
        : true;
    }
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return (
        Number.isInteger(value) &&
        (typeof schema.minimum !== "number" || (value as number) >= schema.minimum)
      );
    case "number":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (typeof schema.exclusiveMinimum !== "number" || value > (schema.exclusiveMinimum as number))
      );
    default:
      return true;
  }
}

describe("@moritzbrantner/storytelling", () => {
  test("provides server-safe core and schema entrypoints", async () => {
    const core = (await import("./core")) as Record<string, unknown>;
    const schema = await import("./schema");

    expect(typeof core.defineStory).toBe("function");
    expect(typeof core.validateStoryDocument).toBe("function");
    expect(typeof core.resolveStoryPath).toBe("function");
    expect(typeof core.analyzeStory).toBe("function");
    expect(typeof core.applyStoryPatch).toBe("function");
    expect(core.StoryPlayer).toBeUndefined();
    expect(core.StoryScroller).toBeUndefined();
    expect(schema.storyDocumentJsonSchema).toBe(storyDocumentJsonSchema);
  });

  test("exports a story document JSON schema aligned with content block variants", () => {
    expect(matchesJsonSchema(story, storyDocumentJsonSchema)).toBe(true);
    expect(matchesJsonSchema({ id: "missing" }, storyDocumentJsonSchema)).toBe(false);
    expect(
      matchesJsonSchema(
        {
          id: "empty-nodes",
          title: "Empty nodes",
          openingNodeId: "start",
          nodes: [],
        },
        storyDocumentJsonSchema,
      ),
    ).toBe(false);
    expect(
      matchesJsonSchema(
        {
          id: "bad-duration",
          title: "Bad duration",
          openingNodeId: "start",
          nodes: [{ id: "start", title: "Start", durationInFrames: 0 }],
        },
        storyDocumentJsonSchema,
      ),
    ).toBe(false);
    expect(
      matchesJsonSchema(
        {
          id: "bad-content",
          title: "Bad content",
          openingNodeId: "start",
          nodes: [{ id: "start", title: "Start", content: [{ type: "unknown" }] }],
        },
        storyDocumentJsonSchema,
      ),
    ).toBe(false);

    const contentVariants: StoryContentBlock[] = [
      { type: "paragraph", text: "Paragraph." },
      { type: "heading", text: "Heading", level: 2 },
      { type: "quote", text: "Quote.", cite: "Source" },
      { type: "list", items: ["One", "Two"] },
      { type: "image", src: "/image.png", alt: "Image", caption: "Caption" },
      {
        type: "audio",
        src: "/audio.mp3",
        title: "Audio",
        tracks: [{ src: "/audio.vtt", label: "English", kind: "captions", default: true }],
      },
      {
        type: "video",
        src: "/video.mp4",
        title: "Video",
        poster: "/poster.png",
        tracks: [{ src: "/video.vtt", label: "English", srcLang: "en" }],
      },
    ];

    expect(
      matchesJsonSchema(
        {
          id: "content-fixture",
          title: "Content fixture",
          openingNodeId: "start",
          nodes: [{ id: "start", title: "Start", content: contentVariants }],
        },
        storyDocumentJsonSchema,
      ),
    ).toBe(true);
    expect(matchesJsonSchema(nestedStory, storyDocumentJsonSchema)).toBe(true);
    expect(
      matchesJsonSchema(
        {
          ...nestedStory,
          nodes: [
            {
              id: "chapter",
              title: "Chapter",
              children: [{ id: "child", title: "Child", content: [{ type: "unknown" }] }],
            },
          ],
        },
        storyDocumentJsonSchema,
      ),
    ).toBe(false);
  });

  test("validates stories and rejects invalid graph references", () => {
    expect(() =>
      validateStory({
        id: "broken",
        title: "Broken",
        openingNodeId: "missing",
        nodes: [{ id: "start", title: "Start" }],
      }),
    ).toThrow('references missing opening node "missing"');

    expect(() =>
      validateStory({
        id: "duplicate",
        title: "Duplicate",
        openingNodeId: "start",
        nodes: [
          { id: "start", title: "Start" },
          { id: "start", title: "Again" },
        ],
      }),
    ).toThrow('Duplicate id "start"');

    expect(() =>
      validateStory({
        id: "duplicate-choice",
        title: "Duplicate choice",
        openingNodeId: "start",
        nodes: [
          {
            id: "start",
            title: "Start",
            choices: [
              { id: "go", label: "Go", target: "end" },
              { id: "go", label: "Again", target: "end" },
            ],
          },
          { id: "end", title: "End" },
        ],
      }),
    ).toThrow('Duplicate choice "go"');

    expect(() =>
      validateStory({
        id: "missing-choice",
        title: "Missing choice",
        openingNodeId: "start",
        nodes: [
          {
            id: "start",
            title: "Start",
            choices: [{ id: "go", label: "Go", target: "missing" }],
          },
        ],
      }),
    ).toThrow('points to missing node "missing"');

    expect(() =>
      validateStory({
        id: "cycle",
        title: "Cycle",
        openingNodeId: "a",
        nodes: [
          { id: "a", title: "A", next: "b" },
          { id: "b", title: "B", next: "a" },
        ],
      }),
    ).toThrow("contains a cycle");

    expect(() =>
      validateStory({
        id: "choice-cycle",
        title: "Choice cycle",
        openingNodeId: "a",
        nodes: [
          {
            id: "a",
            title: "A",
            choices: [{ id: "loop", label: "Loop", target: "a" }],
          },
        ],
      }),
    ).toThrow("contains a cycle");
  });

  test("returns structured validation diagnostics", () => {
    const issues = validateStoryDocument({
      id: "broken",
      title: "",
      openingNodeId: "missing",
      nodes: [
        {
          id: "start",
          title: "Start",
          choices: [{ id: "go", label: "Go", target: "missing" }],
        },
      ],
    });

    expect(issues.map((issue) => issue.code)).toEqual([
      "empty-story-title",
      "missing-opening-node",
      "missing-choice-target",
    ]);
    expect(() =>
      assertStoryDocument({
        id: "broken",
        title: "",
        openingNodeId: "missing",
        nodes: [{ id: "start", title: "Start" }],
      }),
    ).toThrow("must have a title");
  });

  test("validates nested story nodes with global ids and nested issue paths", () => {
    expect(validateStoryDocument(nestedStory)).toEqual([]);
    expect(validateStoryDocument(nestedStory, { mode: "strict" })).toEqual([]);
    expect(getStoryNodeEntries(nestedStory).map((entry) => [entry.nodeId, entry.depth])).toEqual([
      ["chapter", 0],
      ["chapter-scene-a", 1],
      ["chapter-scene-b", 1],
      ["ending", 0],
    ]);

    const duplicateIssues = validateStoryDocument({
      ...nestedStory,
      nodes: [
        {
          id: "chapter",
          title: "Chapter",
          children: [{ id: "chapter", title: "Duplicate" }],
        },
      ],
    });

    expect(duplicateIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate-node-id",
          path: "nodes.0.children.0.id",
        }),
      ]),
    );

    const missingIssues = validateStoryDocument({
      id: "nested-missing",
      title: "Nested missing",
      openingNodeId: "chapter",
      nodes: [
        {
          id: "chapter",
          title: "Chapter",
          children: [
            {
              id: "child",
              title: "Child",
              next: "missing",
              choices: [{ id: "go", label: "Go", target: "also-missing" }],
            },
          ],
        },
      ],
    });

    expect(missingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-choice-target",
          path: "nodes.0.children.0.choices.0.target",
        }),
        expect.objectContaining({
          code: "missing-next-target",
          path: "nodes.0.children.0.next",
        }),
      ]),
    );
  });

  test("compiles story graphs, finds branches and endings, and enumerates paths", () => {
    const compiledStory = compileStory(story);

    expect(getStoryBranches(compiledStory).map((node) => node.id)).toEqual(["wake"]);
    expect(getStoryEndings(compiledStory).map((node) => node.id)).toEqual([
      "pilot-ending",
      "trace-node",
    ]);
    expect(enumerateStoryPaths(story).map((path) => path.choiceIds)).toEqual([
      ["answer", "answer-node__continue"],
      ["trace"],
    ]);
  });

  test("compiles long branching graph fixtures and enumerates long path combinations", () => {
    const compiledStory = compileStory(longBranchStory);

    expect(getStoryBranches(compiledStory).map((node) => node.id)).toEqual([
      "opening",
      "pilot-decision",
      "trace-grid",
      "archive-decoder",
    ]);
    expect(getStoryEndings(compiledStory).map((node) => node.id)).toEqual(["network-clearance"]);
    expect(
      enumerateStoryPaths(longBranchStory).map((path) =>
        path.choiceIds.filter((choiceId) => !choiceId.endsWith("__continue")),
      ),
    ).toEqual([
      ["answer-pilot", "stabilize-route"],
      ["answer-pilot", "confirm-route"],
      ["trace-source", "send-team"],
      ["trace-source", "broadcast-fix"],
      ["archive-review", "verify-archive"],
      ["archive-review", "archive-stash"],
    ]);
  });

  test("analyzes story authoring diagnostics and metrics", () => {
    const authoringStory: StoryDocument<FixtureData> = {
      id: "authoring",
      title: "Authoring",
      openingNodeId: "start",
      nodes: [
        {
          id: "start",
          title: "Start",
          content: [{ type: "paragraph", text: "Start with a short line." }],
          choices: [
            { id: "left", label: "Left", target: "left" },
            { id: "right", label: "Right", target: "right" },
            { id: "third", label: "Third", target: "third" },
          ],
        },
        {
          id: "left",
          title: "Left",
          content: [{ type: "image", src: "/left.png", alt: "Left", caption: "A caption" }],
        },
        {
          id: "right",
          title: "Right",
          choices: [{ id: "locked", label: "Locked", target: "third", disabled: true }],
        },
        {
          id: "third",
          title: "Third",
          content: [{ type: "paragraph", text: "Third ending." }],
        },
        {
          id: "unused",
          title: "Unused",
        },
      ],
    };
    const report = analyzeStory(authoringStory, {
      maxPaths: 2,
      requireChoiceDescriptions: true,
    });

    expect(report.valid).toBe(true);
    expect(report.unreachableNodeIds).toEqual(["unused"]);
    expect(report.metrics).toMatchObject({
      nodeCount: 5,
      edgeCount: 4,
      branchCount: 1,
      endingCount: 3,
      reachableNodeCount: 4,
      unreachableNodeCount: 1,
      pathCount: 2,
      maxDepth: 2,
      minDepth: 2,
      contentBlockCount: 3,
      mediaBlockCount: 1,
    });
    expect(report.metrics.estimatedReadingMinutes).toBeGreaterThan(0);
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unreachable-node",
        "empty-content",
        "missing-choice-description",
        "disabled-only-branch",
        "path-limit-reached",
      ]),
    );
    expect(analyzeStory(authoringStory).issues.map((issue) => issue.code)).not.toContain(
      "missing-choice-description",
    );
  });

  test("analyzes nested story authoring metrics and diagnostics", () => {
    const nestedDraft: StoryDocument<FixtureData> = {
      ...nestedStory,
      nodes: [
        ...nestedStory.nodes,
        {
          id: "unused-parent",
          title: "Unused parent",
          children: [{ id: "unused-child", title: "Unused child" }],
        },
      ],
    };
    const report = analyzeStory(nestedDraft);

    expect(report.metrics).toMatchObject({
      nodeCount: 6,
      reachableNodeCount: 4,
      unreachableNodeCount: 2,
      contentBlockCount: 4,
    });
    expect(report.unreachableNodeIds).toEqual(["unused-parent", "unused-child"]);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unreachable-node",
          nodeId: "unused-child",
          path: "nodes.2.children.0.id",
        }),
      ]),
    );
  });

  test("returns validation issues from story analysis without throwing", () => {
    const report = analyzeStory({
      id: "broken-authoring",
      title: "",
      openingNodeId: "missing",
      nodes: [{ id: "start", title: "Start" }],
    });

    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["empty-story-title", "missing-opening-node"]),
    );
    expect(report.metrics.nodeCount).toBe(1);
  });

  test("returns deterministic opt-in authoring fixes for safe diagnostics", () => {
    const draft: StoryDocument = {
      id: " ",
      title: " ",
      openingNodeId: "start",
      nodes: [
        {
          id: "start",
          title: "Start",
          choices: [{ id: "go", label: "Go", target: "end", description: " " }],
        },
        {
          id: "end",
          title: " ",
          content: [{ type: "paragraph", text: "Ending." }],
        },
        {
          id: "locked",
          title: "Locked",
          choices: [{ id: "disabled", label: "Disabled", target: "end", disabled: true }],
        },
      ],
    };

    const report = analyzeStory(draft, { includeFixes: true });
    const fixesByCode = new Map(report.issues.map((issue) => [issue.code, issue.fixes ?? []]));

    expect(fixesByCode.get("blank-story-title")?.[0]?.patch).toEqual({
      type: "set-story-fields",
      fields: { title: "Untitled story" },
    });
    expect(fixesByCode.get("blank-node-title")?.[0]?.patch).toEqual({
      type: "update-node",
      nodeId: "end",
      fields: { title: "Untitled node" },
    });
    expect(fixesByCode.get("blank-choice-description")?.[0]?.patch).toEqual({
      type: "update-choice",
      nodeId: "start",
      choiceId: "go",
      fields: { description: undefined },
    });
    const reachableEmptyContent = report.issues.find(
      (issue) => issue.code === "empty-content" && issue.nodeId === "start",
    );

    expect(reachableEmptyContent?.fixes?.[0]?.patch).toEqual({
      type: "add-content-block",
      nodeId: "start",
      block: { type: "paragraph", text: "Draft content." },
    });
    expect(fixesByCode.get("unreachable-node")?.[0]?.patch).toEqual({
      type: "remove-node",
      nodeId: "locked",
    });
    expect(fixesByCode.get("disabled-only-branch")?.[0]?.patch).toEqual([
      { type: "remove-choice", nodeId: "locked", choiceId: "disabled" },
    ]);

    const missingDescription = analyzeStory(story, {
      includeFixes: true,
      requireChoiceDescriptions: true,
    }).issues.find((issue) => issue.code === "missing-choice-description");

    expect(missingDescription?.fixes).toBeUndefined();

    const suggestedPatches = report.issues.flatMap(
      (issue) => issue.fixes?.flatMap((fix) => fix.patch) ?? [],
    );
    const fixedDraft = applyStoryPatch(draft, suggestedPatches, { onMissing: "ignore" });
    const fixedReport = analyzeStory(fixedDraft);

    expect(fixedReport.issues.map((issue) => issue.code)).not.toEqual(
      expect.arrayContaining([
        "blank-story-title",
        "blank-node-title",
        "blank-choice-description",
        "empty-content",
        "unreachable-node",
        "disabled-only-branch",
      ]),
    );
    expect(fixedReport.metrics.unreachableNodeCount).toBe(0);
  });

  test("applies immutable story patches and can validate patched output", () => {
    const originalNodeCount = story.nodes.length;
    const draftNode = createStoryNode<FixtureData>({
      id: "draft-node",
      title: "Draft node",
      content: [{ type: "paragraph", text: "Draft text." }],
      data: { tone: "draft" },
    });
    const patched = applyStoryPatch(story, [
      { type: "add-node", node: draftNode, index: 1 },
      {
        type: "add-choice",
        nodeId: "answer-node",
        choice: { id: "draft", label: "Draft", target: "draft-node" },
      },
      { type: "set-next", nodeId: "draft-node", target: "pilot-ending" },
      {
        type: "update-choice",
        nodeId: "answer-node",
        choiceId: "draft",
        fields: { description: "Draft route" },
      },
    ]);

    expect(story.nodes).toHaveLength(originalNodeCount);
    expect(patched.nodes).toHaveLength(originalNodeCount + 1);
    expect(patched.nodes.find((node) => node.id === "answer-node")?.next).toBeUndefined();
    expect(patched.nodes.find((node) => node.id === "answer-node")?.choices?.[0]).toMatchObject({
      id: "draft",
      description: "Draft route",
    });
    expect(patched.nodes.find((node) => node.id === "draft-node")?.choices).toBeUndefined();

    const removed = applyStoryPatch(patched, { type: "remove-node", nodeId: "draft-node" });

    expect(removed.nodes.find((node) => node.id === "draft-node")).toBeUndefined();
    expect(removed.nodes.find((node) => node.id === "answer-node")?.choices).toBeUndefined();

    const nextOnly = applyStoryPatch(story, {
      type: "set-next",
      nodeId: "wake",
      target: "trace-node",
    });

    expect(nextOnly.nodes.find((node) => node.id === "wake")?.choices).toBeUndefined();
    expect(nextOnly.nodes.find((node) => node.id === "wake")?.next).toBe("trace-node");
    expect(() =>
      applyStoryPatch(story, { type: "set-opening-node", nodeId: "missing" }, { validate: true }),
    ).toThrow("references missing opening node");
  });

  test("moves nodes, choices, and content blocks without mutating the source story", () => {
    const reorderedNodes = applyStoryPatch(story, {
      type: "move-node",
      nodeId: "trace-node",
      index: 1,
    });

    expect(reorderedNodes.nodes.map((node) => node.id)).toEqual([
      "wake",
      "trace-node",
      "answer-node",
      "pilot-ending",
    ]);
    expect(reorderedNodes.nodes[0]?.choices?.find((choice) => choice.id === "trace")?.target).toBe(
      "trace-node",
    );
    expect(story.nodes.map((node) => node.id)).toEqual([
      "wake",
      "answer-node",
      "pilot-ending",
      "trace-node",
    ]);

    const reorderedChoices = applyStoryPatch(story, {
      type: "move-choice",
      nodeId: "wake",
      choiceId: "locked",
      index: 0,
    });

    expect(reorderedChoices.nodes[0]?.choices?.map((choice) => choice.id)).toEqual([
      "locked",
      "answer",
      "trace",
    ]);

    const contentDraft = applyStoryPatch(story, [
      {
        type: "add-content-block",
        nodeId: "trace-node",
        index: 0,
        block: { type: "heading", text: "Harbor", level: 2 },
      },
      {
        type: "add-content-block",
        nodeId: "trace-node",
        block: { type: "paragraph", text: "Second draft." },
      },
      { type: "move-content-block", nodeId: "trace-node", fromIndex: 2, toIndex: 0 },
      {
        type: "update-content-block",
        nodeId: "trace-node",
        index: 0,
        block: { type: "paragraph", text: "Updated second draft." },
      },
      { type: "remove-content-block", nodeId: "trace-node", index: 1 },
    ]);
    const traceContent = contentDraft.nodes.find((node) => node.id === "trace-node")?.content;

    expect(traceContent).toEqual([
      { type: "paragraph", text: "Updated second draft." },
      {
        type: "paragraph",
        text: "The signal comes from a cove nobody has charted in decades.",
      },
    ]);
    expect(story.nodes.find((node) => node.id === "trace-node")?.content).toHaveLength(1);

    expect(() =>
      applyStoryPatch(
        story,
        {
          type: "update-content-block",
          nodeId: "trace-node",
          index: 10,
          block: { type: "paragraph", text: "Nope." },
        },
        { onMissing: "ignore" },
      ),
    ).toThrow("Story content block index 10 is out of range");
  });

  test("applies story patches to nested nodes and protects recursive moves", () => {
    const withChild = applyStoryPatch(nestedStory, {
      type: "add-node",
      parentNodeId: "chapter",
      node: {
        id: "chapter-scene-c",
        title: "Scene C",
        content: [{ type: "paragraph", text: "Third nested scene." }],
        data: { tone: "green" },
      },
    });

    expect(getStoryNodeEntries(withChild).map((entry) => entry.nodeId)).toEqual([
      "chapter",
      "chapter-scene-a",
      "chapter-scene-b",
      "chapter-scene-c",
      "ending",
    ]);

    const renamed = applyStoryPatch(withChild, {
      type: "rename-node",
      nodeId: "chapter-scene-c",
      nextNodeId: "chapter-scene-final",
    });

    expect(getStoryNodeEntries(renamed).map((entry) => entry.nodeId)).toContain(
      "chapter-scene-final",
    );

    const moved = applyStoryPatch(renamed, {
      type: "move-node",
      nodeId: "chapter-scene-final",
      parentNodeId: undefined,
      index: 1,
    });

    expect(moved.nodes.map((node) => node.id)).toEqual([
      "chapter",
      "chapter-scene-final",
      "ending",
    ]);

    const removedParent = applyStoryPatch(withChild, {
      type: "remove-node",
      nodeId: "chapter",
      nextOpeningNodeId: "ending",
    });

    expect(getStoryNodeEntries(removedParent).map((entry) => entry.nodeId)).toEqual(["ending"]);
    expect(removedParent.openingNodeId).toBe("ending");
    expect(() =>
      applyStoryPatch(withChild, {
        type: "move-node",
        nodeId: "chapter",
        parentNodeId: "chapter-scene-a",
        index: 0,
      }),
    ).toThrow("Cannot move story node");
  });

  test("serializes and parses story path choice ids", () => {
    const serialized = serializeStoryPath(["answer", "trace/with spaces"]);

    expect(serialized).toBe("choice=answer&choice=trace%2Fwith+spaces");
    expect(parseStoryPath(`?${serialized}`)).toEqual(["answer", "trace/with spaces"]);
    expect(parseStoryPath("answer,trace")).toEqual(["answer", "trace"]);
  });

  test("resolves branching, linear auto-advance, disabled choices, stopAt, and maxSteps", () => {
    expect(resolveStoryPath(story, { choiceIds: ["trace"] }).nodes.map((node) => node.id)).toEqual([
      "wake",
      "trace-node",
    ]);

    expect(
      resolveStoryPath(story, {
        choiceIds: ["answer"],
        autoAdvanceLinearNodes: true,
      }).nodes.map((node) => node.id),
    ).toEqual(["wake", "answer-node", "pilot-ending"]);

    const disabled = resolveStoryPath(story, { choiceIds: ["locked"] });
    expect(disabled.completed).toBe(false);
    expect(disabled.currentNode.id).toBe("wake");

    const stopped = resolveStoryPath(story, {
      choiceIds: ["answer"],
      autoAdvanceLinearNodes: true,
      stopAt: "answer-node",
    });
    expect(stopped.stoppedAt).toBe("answer-node");
    expect(stopped.nodes.map((node) => node.id)).toEqual(["wake", "answer-node"]);

    const maxSteps = resolveStoryPath(story, {
      choiceIds: ["answer"],
      autoAdvanceLinearNodes: true,
      maxSteps: 1,
    });
    expect(maxSteps.stoppedReason).toBe("max-steps");
    expect(maxSteps.completed).toBe(false);
  });

  test("resolves long branching story paths with intermediate sequence nodes and control points", () => {
    const stabilize = resolveStoryPath(longBranchStory, {
      choiceIds: ["answer-pilot", "stabilize-route"],
      autoAdvanceLinearNodes: true,
    });

    expect(stabilize.nodes.map((node) => node.id)).toEqual([
      "opening",
      "pilot-check",
      "pilot-wave",
      "pilot-decision",
      "pilot-stabilize",
      "relay-hub",
      "relay-check",
      "network-clearance",
    ]);

    const traceRoute = resolveStoryPath(longBranchStory, {
      choiceIds: ["trace-source", "send-team"],
      autoAdvanceLinearNodes: true,
    });
    expect(traceRoute.nodes.map((node) => node.id)).toEqual([
      "opening",
      "trace-scan",
      "trace-grid",
      "trace-team",
      "relay-hub",
      "relay-check",
      "network-clearance",
    ]);

    const stopped = resolveStoryPath(longBranchStory, {
      choiceIds: ["answer-pilot", "stabilize-route"],
      autoAdvanceLinearNodes: true,
      stopAt: "pilot-decision",
    });
    expect(stopped.stoppedReason).toBe("stop-at");
    expect(stopped.nodes.map((node) => node.id)).toEqual([
      "opening",
      "pilot-check",
      "pilot-wave",
      "pilot-decision",
    ]);

    const maxSteps = resolveStoryPath(longBranchStory, {
      choiceIds: ["answer-pilot", "stabilize-route"],
      autoAdvanceLinearNodes: true,
      maxSteps: 3,
    });
    expect(maxSteps.stoppedReason).toBe("max-steps");
    expect(maxSteps.nodes.map((node) => node.id)).toEqual([
      "opening",
      "pilot-check",
      "pilot-wave",
      "pilot-decision",
    ]);
  });

  test("resolves nested story paths depth-first with subtree exits and overrides", () => {
    expect(
      resolveStoryPath(nestedStory, { autoAdvanceLinearNodes: true }).nodes.map((node) => node.id),
    ).toEqual(["chapter", "chapter-scene-a", "chapter-scene-b", "ending"]);

    const stopped = resolveStoryPath(nestedStory, {
      autoAdvanceLinearNodes: true,
      stopAt: "chapter-scene-b",
    });

    expect(stopped.stoppedAt).toBe("chapter-scene-b");
    expect(stopped.nodes.map((node) => node.id)).toEqual([
      "chapter",
      "chapter-scene-a",
      "chapter-scene-b",
    ]);

    const childOverrideStory: StoryDocument<FixtureData> = {
      ...nestedStory,
      nodes: [
        {
          id: "chapter",
          title: "Chapter",
          next: "ending",
          children: [
            { id: "chapter-scene-a", title: "Scene A", next: "ending" },
            { id: "chapter-scene-b", title: "Scene B" },
          ],
        },
        { id: "ending", title: "Ending", data: { tone: "green" } },
      ],
    };

    expect(
      resolveStoryPath(childOverrideStory, { autoAdvanceLinearNodes: true }).nodes.map(
        (node) => node.id,
      ),
    ).toEqual(["chapter", "chapter-scene-a", "ending"]);

    const choiceParentStory: StoryDocument<FixtureData> = {
      ...nestedStory,
      nodes: [
        {
          id: "chapter",
          title: "Chapter",
          choices: [{ id: "skip", label: "Skip", target: "ending" }],
          children: [{ id: "nested-child", title: "Nested child" }],
        },
        { id: "ending", title: "Ending", data: { tone: "green" } },
      ],
    };

    expect(
      resolveStoryPath(choiceParentStory, { autoAdvanceLinearNodes: true }).nodes.map(
        (node) => node.id,
      ),
    ).toEqual(["chapter"]);
    expect(
      resolveStoryPath(choiceParentStory, {
        choiceIds: ["skip"],
        autoAdvanceLinearNodes: true,
      }).nodes.map((node) => node.id),
    ).toEqual(["chapter", "ending"]);
    expect(() =>
      validateStory({
        id: "nested-cycle",
        title: "Nested cycle",
        openingNodeId: "parent",
        nodes: [
          {
            id: "parent",
            title: "Parent",
            next: "parent",
            children: [{ id: "child", title: "Child" }],
          },
        ],
      }),
    ).toThrow("contains a cycle");
  });

  test("builds deterministic timelines with starts, ends, transitions, and total duration", () => {
    const timeline = buildStoryTimeline(story, {
      choiceIds: ["answer"],
      defaultDurationInFrames: 100,
      transitionInFrames: 10,
    });

    expect(timeline.totalFrames).toBe(290);
    expect(timeline.scenes.map((scene) => scene.startFrame)).toEqual([0, 100, 200]);
    expect(timeline.scenes.map((scene) => scene.endFrame)).toEqual([100, 200, 290]);
    expect(timeline.scenes.map((scene) => scene.transitionInFrames)).toEqual([10, 10, 10]);
    expect(timeline.scenes[2]?.history.map((entry) => entry.nodeId)).toEqual([
      "wake",
      "answer-node",
      "pilot-ending",
    ]);
  });

  test("builds long branching timelines while preserving sequence order and frame layout", () => {
    const timeline = buildStoryTimeline(longBranchStory, {
      choiceIds: ["answer-pilot", "stabilize-route"],
      defaultDurationInFrames: 100,
      transitionInFrames: 12,
    });

    expect(timeline.scenes.map((scene) => scene.node.id)).toEqual([
      "opening",
      "pilot-check",
      "pilot-wave",
      "pilot-decision",
      "pilot-stabilize",
      "relay-hub",
      "relay-check",
      "network-clearance",
    ]);
    expect(timeline.scenes.map((scene) => scene.pathIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(timeline.scenes.map((scene) => scene.startFrame)).toEqual([
      0, 100, 200, 300, 400, 500, 600, 700,
    ]);
    expect(timeline.totalFrames).toBe(800);
    expect(timeline.scenes.map((scene) => scene.transitionInFrames)).toEqual([
      12, 12, 12, 12, 12, 12, 12, 12,
    ]);
  });

  test("builds nested timelines with flattened path indexes and hierarchy metadata", () => {
    const timeline = buildStoryTimeline(nestedStory, {
      defaultDurationInFrames: 100,
      transitionInFrames: 10,
    });

    expect(timeline.scenes.map((scene) => scene.node.id)).toEqual([
      "chapter",
      "chapter-scene-a",
      "chapter-scene-b",
      "ending",
    ]);
    expect(timeline.scenes.map((scene) => scene.pathIndex)).toEqual([0, 1, 2, 3]);
    expect(timeline.scenes.map((scene) => scene.nodeEntry?.depth)).toEqual([0, 1, 1, 0]);
    expect(timeline.totalFrames).toBe(400);
  });

  test("renders StoryPlayer content, advances, goes back, restarts, restores focus, and calls callbacks", async () => {
    const onChoice = vi.fn();
    const onPathChange = vi.fn();

    render(<StoryPlayer story={story} onChoice={onChoice} onPathChange={onPathChange} />);

    expect(screen.getByText("A low signal reaches the tower.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Trace the source/ }));

    expect(
      await screen.findByText("The signal comes from a cove nobody has charted in decades."),
    ).toBeTruthy();
    expect(onChoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: "trace" }),
      expect.arrayContaining([expect.objectContaining({ nodeId: "trace-node" })]),
    );
    expect(document.activeElement?.textContent).toContain("The map reveals a hidden harbor");

    fireEvent.keyDown(screen.getByRole("region", { name: "Signal in the fog" }), {
      key: "Escape",
    });
    expect(await screen.findByText("A low signal reaches the tower.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Trace the source/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Restart" }));
    expect((await screen.findAllByText("Wake the observatory")).length).toBeGreaterThan(0);
    expect(onPathChange).toHaveBeenCalled();
  });

  test("renders linear StoryPlayer stories one continue step at a time", async () => {
    render(<StoryPlayer story={linearStory} />);

    expect(screen.getByText("Draft the morning brief.")).toBeTruthy();
    expect(screen.queryByText("Publish the report at noon.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Review the copy for sequence and clarity.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Publish the report at noon.")).toBeTruthy();
  });

  test("renders nested StoryPlayer stories as continueable child scenes", async () => {
    render(<StoryPlayer story={nestedStory} />);

    expect(screen.getByText("Open the chapter.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("First nested scene.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Second nested scene.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Finish the nested story.")).toBeTruthy();
  });

  test("supports controlled StoryPlayer choice ids", async () => {
    const onChoiceIdsChange = vi.fn();
    const { rerender } = render(
      <StoryPlayer story={story} choiceIds={[]} onChoiceIdsChange={onChoiceIdsChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Trace the source/ }));

    expect(onChoiceIdsChange).toHaveBeenCalledWith(
      ["trace"],
      expect.objectContaining({
        choiceIds: ["trace"],
        currentNode: expect.objectContaining({ id: "trace-node" }),
      }),
    );
    expect(screen.getByText("A low signal reaches the tower.")).toBeTruthy();

    rerender(<StoryPlayer story={story} choiceIds={["trace"]} />);

    expect(
      await screen.findByText("The signal comes from a cove nobody has charted in decades."),
    ).toBeTruthy();
  });

  test("provides reusable StoryPlayer runtime state", async () => {
    const onChoice = vi.fn();

    function RuntimeProbe() {
      const runtime = useStoryRuntime(story, { onChoice });

      return (
        <div>
          <p>Runtime node {runtime.renderProps.node.id}</p>
          <p>Runtime progress {Math.round(runtime.progress * 100)}</p>
          <button type="button" onClick={() => runtime.choose("trace")}>
            Runtime choose trace
          </button>
          <button type="button" onClick={runtime.goBack}>
            Runtime go back
          </button>
          <button type="button" onClick={runtime.restart}>
            Runtime restart
          </button>
        </div>
      );
    }

    render(<RuntimeProbe />);

    expect(screen.getByText("Runtime node wake")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Runtime choose trace" }));
    expect(await screen.findByText("Runtime node trace-node")).toBeTruthy();
    expect(onChoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: "trace" }),
      expect.arrayContaining([expect.objectContaining({ nodeId: "trace-node" })]),
    );

    fireEvent.click(screen.getByRole("button", { name: "Runtime go back" }));
    expect(await screen.findByText("Runtime node wake")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Runtime choose trace" }));
    fireEvent.click(await screen.findByRole("button", { name: "Runtime restart" }));
    expect(await screen.findByText("Runtime node wake")).toBeTruthy();
  });

  test("renders StoryPlayer slot content with render props", async () => {
    render(
      <StoryPlayer
        story={story}
        renderStage={(props) => <div>Slot stage {props.node.id}</div>}
        renderHeader={(props) => <div>Slot header {props.currentIndex}</div>}
        renderControls={(props) => (
          <button type="button" onClick={() => props.choose("trace")}>
            Slot choose {props.choices.length}
          </button>
        )}
        renderActions={(props) => <div>Slot actions {String(props.canGoBack)}</div>}
        renderProgress={(props) => <div>Slot progress {Math.round(props.progress * 100)}</div>}
        renderTrail={(props) => <div>Slot trail {props.history.length}</div>}
      />,
    );

    expect(screen.getByText("Slot stage wake")).toBeTruthy();
    expect(screen.getByText("Slot header 0")).toBeTruthy();
    expect(screen.getByText("Slot choose 3")).toBeTruthy();
    expect(screen.getByText("Slot actions false")).toBeTruthy();
    expect(screen.getByText("Slot progress 25")).toBeTruthy();
    expect(screen.getByText("Slot trail 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Slot choose 3" }));
    expect(await screen.findByText("Slot stage trace-node")).toBeTruthy();
  });

  test("renders StoryPlayer grouped slots with render props", async () => {
    render(
      <StoryPlayer
        story={story}
        slots={{
          stage: (props) => <div>Grouped stage {props.node.id}</div>,
          header: (props) => <div>Grouped header {props.currentIndex}</div>,
          controls: (props) => (
            <button type="button" onClick={() => props.choose("trace")}>
              Grouped choose {props.choices.length}
            </button>
          ),
          actions: (props) => <div>Grouped actions {String(props.canGoBack)}</div>,
          progress: (props) => <div>Grouped progress {Math.round(props.progress * 100)}</div>,
          trail: (props) => <div>Grouped trail {props.history.length}</div>,
        }}
      />,
    );

    expect(screen.getByText("Grouped stage wake")).toBeTruthy();
    expect(screen.getByText("Grouped header 0")).toBeTruthy();
    expect(screen.getByText("Grouped choose 3")).toBeTruthy();
    expect(screen.getByText("Grouped actions false")).toBeTruthy();
    expect(screen.getByText("Grouped progress 25")).toBeTruthy();
    expect(screen.getByText("Grouped trail 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Grouped choose 3" }));
    expect(await screen.findByText("Grouped stage trace-node")).toBeTruthy();
  });

  test("lets StoryPlayer direct render props win over grouped slots", () => {
    render(
      <StoryPlayer
        story={story}
        renderHeader={() => <div>Direct header</div>}
        slots={{ header: () => <div>Grouped header</div> }}
      />,
    );

    expect(screen.getByText("Direct header")).toBeTruthy();
    expect(screen.queryByText("Grouped header")).toBeNull();
  });

  test("disables StoryPlayer modules without mounting their slots", () => {
    const controlsSlot = vi.fn(() => <div>Disabled controls</div>);
    const { container } = render(
      <StoryPlayer
        story={story}
        modules={{
          header: false,
          controls: false,
          actions: false,
          progress: false,
          trail: false,
        }}
        slots={{ controls: controlsSlot }}
      />,
    );

    expect(screen.getByText("A low signal reaches the tower.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Trace the source/ })).toBeNull();
    expect(screen.queryByText("Disabled controls")).toBeNull();
    expect(controlsSlot).not.toHaveBeenCalled();
    expect(container.querySelector("aside")).toBeNull();
  });

  test("keeps StoryPlayer stage-only layout independent from module flags", () => {
    const { container } = render(
      <StoryPlayer
        story={story}
        layout="stage-only"
        modules={{ header: true, controls: true, actions: true, progress: true, trail: true }}
      />,
    );

    expect(screen.getByText("A low signal reaches the tower.")).toBeTruthy();
    expect(container.querySelector("aside")).toBeNull();
  });

  test("provides headless story path state for custom editor controls", async () => {
    function PathStateProbe({
      choiceIds,
      defaultChoiceIds,
      onChoiceIdsChange,
    }: {
      choiceIds?: string[];
      defaultChoiceIds?: string[];
      onChoiceIdsChange?: (choiceIds: string[], state: StoryPathState<FixtureData>) => void;
    }) {
      const state = useStoryPathState(story, {
        choiceIds,
        defaultChoiceIds,
        onChoiceIdsChange,
      });

      return (
        <div>
          <p>Node {state.currentNode.id}</p>
          <p>Choice ids {state.choiceIds.join(",") || "none"}</p>
          <button type="button" onClick={() => state.choose("trace")}>
            Choose trace
          </button>
          <button type="button" onClick={() => state.choose("locked")}>
            Choose locked
          </button>
          <button type="button" onClick={state.goBack}>
            Go back
          </button>
          <button type="button" onClick={state.restart}>
            Restart
          </button>
          <button type="button" onClick={() => state.setChoiceIds(["answer"])}>
            Set answer
          </button>
        </div>
      );
    }

    const onChoiceIdsChange = vi.fn();
    const { unmount } = render(<PathStateProbe defaultChoiceIds={["trace"]} />);

    expect(screen.getByText("Node trace-node")).toBeTruthy();
    expect(screen.getByText("Choice ids trace")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(await screen.findByText("Node wake")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Choose locked" }));
    expect(await screen.findByText("Choice ids none")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Set answer" }));
    expect(await screen.findByText("Node answer-node")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(await screen.findByText("Node wake")).toBeTruthy();

    unmount();
    const controlled = render(
      <PathStateProbe choiceIds={[]} onChoiceIdsChange={onChoiceIdsChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose trace" }));

    expect(onChoiceIdsChange).toHaveBeenCalledWith(
      ["trace"],
      expect.objectContaining({
        choiceIds: ["trace"],
        currentNode: expect.objectContaining({ id: "trace-node" }),
      }),
    );
    expect(screen.getByText("Node wake")).toBeTruthy();

    controlled.rerender(
      <PathStateProbe choiceIds={["trace"]} onChoiceIdsChange={onChoiceIdsChange} />,
    );
    expect(await screen.findByText("Node trace-node")).toBeTruthy();
  });

  test("renders StoryScroller story branches as scene-progress pages", async () => {
    const { container } = render(<StoryScroller story={story} />);
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(screen.queryByRole("navigation", { name: "Story graph" })).toBeNull();
    expect(screen.queryByText("The city hears the pilot")).toBeNull();
    expect(screen.queryByText(/Scene 1 \//)).toBeNull();
    expect(viewport).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Answer immediately/ })).toBeNull();

    setScrollerGeometry(viewport!, 1);
    scrollScrollerViewport(viewport!, 95);
    fireEvent.click(screen.getByRole("button", { name: /Answer immediately/ }));

    expect(await screen.findByText("The message is fragmented.")).toBeTruthy();
    expect(screen.queryByText("Contact changes the route.")).toBeNull();

    setScrollerGeometry(viewport!, 3);
    scrollScrollerViewport(viewport!, 200);
    expect(await screen.findByText("Contact changes the route.")).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("region", { name: "Signal in the fog" }), {
      key: "Home",
    });
    expect(await screen.findByText("A low signal reaches the tower.")).toBeTruthy();
  });

  test("renders StoryScroller branch choices as an overlay with numeric hotkeys", async () => {
    const { container } = render(<StoryScroller story={story} />);
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 1);
    scrollScrollerViewport(viewport!, 100);

    expect(screen.getByRole("button", { name: /Answer immediately/ })).toBeTruthy();
    expect(
      screen.getByText("What should the operator do first?").closest(".absolute"),
    ).toBeTruthy();

    screen.getByRole("region", { name: "Signal in the fog" }).focus();
    fireEvent.keyDown(window, { key: "2" });

    expect(
      await screen.findByText("The signal comes from a cove nobody has charted in decades."),
    ).toBeTruthy();
  });

  test("allows StoryScroller branch reselection by default after scrolling back", async () => {
    const { container } = render(<StoryScroller story={story} pathChoiceIds={["answer"]} />);
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 3);
    scrollScrollerViewport(viewport!, 95);

    const traceChoice = screen.getByRole<HTMLButtonElement>("button", { name: /Trace the source/ });
    expect(traceChoice.disabled).toBe(false);
    fireEvent.click(traceChoice);

    expect(
      await screen.findByText("The signal comes from a cove nobody has charted in decades."),
    ).toBeTruthy();
  });

  test("can disable StoryScroller branch reselection after scrolling back", async () => {
    const onChoiceIdsChange = vi.fn();
    const { container } = render(
      <StoryScroller
        story={story}
        pathChoiceIds={["answer"]}
        allowBranchReselection={false}
        onChoiceIdsChange={onChoiceIdsChange}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 3);
    scrollScrollerViewport(viewport!, 95);

    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /Answer immediately/ }).disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /Trace the source/ }).disabled,
    ).toBe(true);

    screen.getByRole("region", { name: "Signal in the fog" }).focus();
    fireEvent.keyDown(window, { key: "2" });

    expect(onChoiceIdsChange).not.toHaveBeenCalled();
    expect(
      screen.queryByText("The signal comes from a cove nobody has charted in decades."),
    ).toBeNull();
  });

  test("renders linear StoryScroller stories from the opening node", async () => {
    render(<StoryScroller story={linearStory} />);

    expect(screen.getByText("Draft the morning brief.")).toBeTruthy();
    expect(screen.queryByText("Review the copy for sequence and clarity.")).toBeNull();
    expect(screen.queryByText("Publish the report at noon.")).toBeNull();

    fireEvent.keyDown(screen.getByRole("region", { name: "Linear report" }), {
      key: "ArrowRight",
    });
    expect(await screen.findByText("Review the copy for sequence and clarity.")).toBeTruthy();
  });

  test("renders nested StoryScroller scenes with hierarchy metadata", async () => {
    render(
      <StoryScroller
        story={nestedStory}
        renderScene={(props) => (
          <div>
            Nested scene {props.node.id} depth {props.nodeEntry?.depth ?? -1}
          </div>
        )}
        renderMinimap={(props) => (
          <nav aria-label="Nested minimap">
            {props.items.map((item, index) => (
              <button key={item.id} type="button" onClick={() => props.scrollToScene(index)}>
                {item.title} depth {item.depth ?? -1}
              </button>
            ))}
          </nav>
        )}
      />,
    );

    expect(screen.getByText("Nested scene chapter depth 0")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scene A depth 1" })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("region", { name: "Nested report" }), {
      key: "ArrowRight",
    });
    expect(await screen.findByText("Nested scene chapter-scene-a depth 1")).toBeTruthy();
  });

  test("supports controlled StoryScroller choice ids", async () => {
    const onChoiceIdsChange = vi.fn();

    const { container } = render(
      <StoryScroller story={story} choiceIds={[]} onChoiceIdsChange={onChoiceIdsChange} />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 1);
    scrollScrollerViewport(viewport!, 100);

    fireEvent.click(screen.getByRole("button", { name: /Answer immediately/ }));

    expect(onChoiceIdsChange).toHaveBeenCalledWith(
      ["answer"],
      expect.objectContaining({
        choiceIds: ["answer"],
        currentNode: expect.objectContaining({ id: "pilot-ending" }),
      }),
    );
  });

  test("renders custom StoryScroller scene, choice panel, and minimap slots", async () => {
    const { container } = render(
      <StoryScroller
        story={story}
        renderScene={(props) => (
          <div>
            Custom scene {props.node.id} {Math.round(props.value)}
            {props.choices.length > 0 ? (
              <button type="button" onClick={() => props.choose("trace")}>
                Custom choose trace
              </button>
            ) : null}
          </div>
        )}
        renderMinimap={(props) => (
          <nav aria-label="Custom minimap">
            {props.items.map((item, index) => (
              <button key={item.id} type="button" onClick={() => props.scrollToScene(index)}>
                {item.title}
              </button>
            ))}
          </nav>
        )}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Custom minimap" })).toBeTruthy();
    expect(screen.getByText("Custom scene wake 0")).toBeTruthy();

    setScrollerGeometry(viewport!, 1);
    scrollScrollerViewport(viewport!, 100);
    fireEvent.click(screen.getByRole("button", { name: "Custom choose trace" }));

    expect(await screen.findByText(/Custom scene trace-node/)).toBeTruthy();
  });

  test("renders StoryScroller grouped scene and minimap slots", async () => {
    const { container } = render(
      <StoryScroller
        story={nestedStory}
        slots={{
          scene: (props) => (
            <div>
              Grouped scene {props.node.id} depth {props.nodeEntry?.depth ?? -1}
            </div>
          ),
          minimap: (props) => (
            <nav aria-label="Grouped minimap">
              <p>
                Grouped minimap story {props.story.id} active {props.activeIndex} history{" "}
                {props.history.length}
              </p>
              {props.items.map((item, index) => (
                <button key={item.id} type="button" onClick={() => props.scrollToScene(index)}>
                  {item.title} depth {item.depth ?? -1}
                </button>
              ))}
            </nav>
          ),
        }}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 4);
    expect(screen.getByText("Grouped scene chapter depth 0")).toBeTruthy();
    expect(screen.getByText("Grouped minimap story nested-report active 0 history 4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scene A depth 1" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Scene A depth 1" }));
    expect(await screen.findByText("Grouped scene chapter-scene-a depth 1")).toBeTruthy();
  });

  test("renders a grouped StoryScroller choice panel slot", async () => {
    const { container } = render(
      <StoryScroller
        story={story}
        slots={{
          choicePanel: (props) => (
            <button type="button" onClick={() => props.choose("trace")}>
              Grouped panel {props.prompt}
            </button>
          ),
        }}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 1);
    scrollScrollerViewport(viewport!, 100);

    fireEvent.click(
      screen.getByRole("button", { name: "Grouped panel What should the operator do first?" }),
    );
    expect(
      await screen.findByText("The signal comes from a cove nobody has charted in decades."),
    ).toBeTruthy();
  });

  test("lets StoryScroller direct render props win over grouped slots", () => {
    render(
      <StoryScroller
        story={story}
        renderScene={(props) => <div>Direct scroller scene {props.node.id}</div>}
        renderMinimap={() => <nav aria-label="Direct scroller minimap">Direct minimap</nav>}
        slots={{
          scene: () => <div>Grouped scroller scene</div>,
          minimap: () => <nav aria-label="Grouped scroller minimap">Grouped minimap</nav>,
        }}
      />,
    );

    expect(screen.getByText("Direct scroller scene wake")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Direct scroller minimap" })).toBeTruthy();
    expect(screen.queryByText("Grouped scroller scene")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Grouped scroller minimap" })).toBeNull();
  });

  test("disables the default StoryScroller choice panel module", async () => {
    const choicePanelSlot = vi.fn(() => <button type="button">Disabled panel</button>);
    const { container } = render(
      <StoryScroller
        story={story}
        modules={{ choicePanel: false }}
        slots={{ choicePanel: choicePanelSlot }}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 1);
    scrollScrollerViewport(viewport!, 100);

    expect(screen.queryByRole("button", { name: /Answer immediately/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Disabled panel" })).toBeNull();
    expect(choicePanelSlot).not.toHaveBeenCalled();
  });

  test("renders the opt-in default StoryScroller minimap and scrolls to scenes", async () => {
    const { container } = render(<StoryScroller story={linearStory} modules={{ minimap: true }} />);
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 3);
    expect(screen.getByRole("navigation", { name: "Story minimap" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Go to scene 2: Review the report" }));
    expect(await screen.findByText("Review the copy for sequence and clarity.")).toBeTruthy();
  });

  test("passes options to the default StoryScroller minimap module", () => {
    render(
      <StoryScroller
        story={linearStory}
        modules={{
          minimap: {
            collapsible: true,
            defaultCollapsed: true,
            ariaLabel: "Collapsed story map",
            className: "custom-minimap",
          },
        }}
      />,
    );

    const minimap = screen.getByRole("navigation", { name: "Collapsed story map" });

    expect(minimap.className).toContain("custom-minimap");
    expect(screen.getByRole("button", { name: "Show minimap" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Go to scene 2: Review the report" })).toBeNull();
  });

  test("renders a custom StoryScroller choice panel slot", async () => {
    const { container } = render(
      <StoryScroller
        story={story}
        renderChoicePanel={(props) => (
          <button type="button" onClick={() => props.choose("trace")}>
            Custom panel {props.prompt}
          </button>
        )}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 1);
    scrollScrollerViewport(viewport!, 100);

    fireEvent.click(
      screen.getByRole("button", { name: "Custom panel What should the operator do first?" }),
    );
    expect(
      await screen.findByText("The signal comes from a cove nobody has charted in decades."),
    ).toBeTruthy();
  });

  test("renders StoryScrollTimeline directly without a story document", async () => {
    const { container } = render(
      <StoryScrollTimeline
        ariaLabel="Direct scroll timeline"
        scenes={[
          { id: "one", title: "One", render: ({ value }) => <div>One {Math.round(value)}</div> },
          { id: "two", title: "Two", render: ({ value }) => <div>Two {Math.round(value)}</div> },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    expect(screen.getByRole("region", { name: "Direct scroll timeline" })).toBeTruthy();
    expect(screen.getByText("One 0")).toBeTruthy();

    setScrollerGeometry(viewport!, 2);
    scrollScrollerViewport(viewport!, 200);
    expect(await screen.findByText("Two 100")).toBeTruthy();
  });

  test("renders custom StoryContent block renderers", () => {
    render(
      <StoryContent
        content={[
          { type: "paragraph", text: "Built in paragraph." },
          { type: "chart", title: "Revenue" } as never,
        ]}
        renderers={{
          chart: ({ block }) => <figure>Custom block {(block as { title: string }).title}</figure>,
        }}
      />,
    );

    expect(screen.getByText("Built in paragraph.")).toBeTruthy();
    expect(screen.getByText("Custom block Revenue")).toBeTruthy();
  });

  test("passes a normalized 0-100 scroll value to custom StoryScroller scenes", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Scroll value scenes"
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            render: ({ value, scrollProgress }) => (
              <div>
                Alpha {Math.round(value)} / Motion {Math.round(scrollProgress.get() * 100)}
              </div>
            ),
          },
          {
            id: "beta",
            title: "Beta",
            render: ({ value }) => <div>Beta {Math.round(value)}</div>,
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    expect(screen.getByText("Alpha 0 / Motion 0")).toBeTruthy();

    Object.defineProperty(viewport!, "scrollHeight", { configurable: true, value: 300 });
    Object.defineProperty(viewport!, "clientHeight", { configurable: true, value: 100 });

    viewport!.scrollTop = 50;
    fireEvent.scroll(viewport!);
    expect(await screen.findByText("Alpha 50 / Motion 50")).toBeTruthy();

    viewport!.scrollTop = 100;
    fireEvent.scroll(viewport!);
    expect(await screen.findByText("Beta 0")).toBeTruthy();
  });

  test("supports slower custom StoryScroller scenes with longer scroll units", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Slow scene units"
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            scrollUnits: 200,
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerTimelineGeometry(viewport!, 300);

    scrollScrollerViewport(viewport!, 100);
    expect(await screen.findByText("Alpha active 50")).toBeTruthy();

    scrollScrollerViewport(viewport!, 200);
    expect(await screen.findByText("Beta active 0")).toBeTruthy();
  });

  test("supports faster custom StoryScroller scenes with shorter scroll units", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Fast scene units"
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            scrollUnits: 50,
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerTimelineGeometry(viewport!, 150);

    scrollScrollerViewport(viewport!, 25);
    expect(await screen.findByText("Alpha active 50")).toBeTruthy();

    scrollScrollerViewport(viewport!, 50);
    expect(await screen.findByText("Beta active 0")).toBeTruthy();
  });

  test("runs transitions after custom scene scroll units", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Long scene transition units"
        transition={{ type: "slide", scrollUnits: 20, direction: "up" }}
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            scrollUnits: 200,
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerTimelineGeometry(viewport!, 320);

    scrollScrollerViewport(viewport!, 200);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport!, 210);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.getByText("Beta preview 0")).toBeTruthy();
    expect(getScrollerPage(container, 1, false)?.style.transform).toBe("translateY(50%)");

    scrollScrollerViewport(viewport!, 220);
    expect(await screen.findByText("Beta active 0")).toBeTruthy();
  });

  test("uses StoryNode scroll units for story-backed StoryScroller scenes", async () => {
    const onSceneProgressChange = vi.fn();
    const storyWithScrollUnits: StoryDocument<FixtureData> = {
      ...linearStory,
      nodes: linearStory.nodes.map((node) =>
        node.id === "draft" ? Object.assign({}, node, { scrollUnits: 200 }) : node,
      ),
    };
    const { container } = render(
      <StoryScroller story={storyWithScrollUnits} onSceneProgressChange={onSceneProgressChange} />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerTimelineGeometry(viewport!, 400);

    scrollScrollerViewport(viewport!, 100);
    expect(await screen.findByText("Draft the morning brief.")).toBeTruthy();
    expect(onSceneProgressChange).toHaveBeenLastCalledWith(50);

    scrollScrollerViewport(viewport!, 200);
    expect(await screen.findByText("Review the copy for sequence and clarity.")).toBeTruthy();
  });

  test("scales StoryScroller wheel input", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Scaled wheel scenes"
        scrollInputScale={0.5}
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 2);

    fireEvent.wheel(viewport!, { deltaY: 100 });

    expect(await screen.findByText("Alpha active 50")).toBeTruthy();
    expect(viewport!.scrollTop).toBe(50);
  });

  test("scales StoryScroller vertical arrow-key scroll input", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Scaled arrow scenes"
        scrollInputScale={0.5}
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");
    const region = screen.getByRole("region", { name: "Scaled arrow scenes" });

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 2);

    fireEvent.keyDown(region, { key: "ArrowDown" });
    expect(viewport!.scrollTop).toBe(0);
    fireEvent.keyUp(region, { key: "ArrowDown" });
    expect(await screen.findByText("Alpha active 5")).toBeTruthy();
    expect(viewport!.scrollTop).toBe(5);

    fireEvent.keyDown(region, { key: "ArrowDown" });
    expect(viewport!.scrollTop).toBe(5);
    fireEvent.keyUp(region, { key: "ArrowDown" });
    expect(await screen.findByText("Alpha active 10")).toBeTruthy();
    expect(viewport!.scrollTop).toBe(10);

    fireEvent.keyDown(region, { key: "ArrowUp" });
    expect(viewport!.scrollTop).toBe(10);
    fireEvent.keyUp(region, { key: "ArrowUp" });
    expect(await screen.findByText("Alpha active 5")).toBeTruthy();
    expect(viewport!.scrollTop).toBe(5);
  });

  test("scrolls StoryScroller vertical arrow-key input smoothly and slowly while held", async () => {
    vi.useFakeTimers();

    const { container } = render(
      <StoryScroller
        ariaLabel="Held arrow scenes"
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");
    const region = screen.getByRole("region", { name: "Held arrow scenes" });

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 2);

    fireEvent.keyDown(region, { key: "ArrowDown" });
    expect(viewport!.scrollTop).toBe(0);

    fireEvent.keyDown(region, { key: "ArrowDown", repeat: true });
    expect(viewport!.scrollTop).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(viewport!.scrollTop).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(201);
    });
    expect(viewport!.scrollTop).toBeGreaterThan(3);
    expect(viewport!.scrollTop).toBeLessThan(5);

    fireEvent.keyUp(region, { key: "ArrowDown" });
    const stoppedTop = viewport!.scrollTop;

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(viewport!.scrollTop).toBe(stoppedTop);
  });

  test("uses horizontal arrow-key input for adjacent scene navigation", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Horizontal arrow scenes"
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");
    const region = screen.getByRole("region", { name: "Horizontal arrow scenes" });

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 2);

    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(await screen.findByText("Beta active 0")).toBeTruthy();

    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(await screen.findByText("Alpha active 0")).toBeTruthy();
  });

  test("advances StoryScroller horizontal arrow-key navigation through boundary transitions", async () => {
    const { viewport } = renderTransitionScroller({
      type: "slide",
      scrollUnits: 20,
      direction: "up",
    });
    const region = screen.getByRole("region", { name: "Transition scenes" });

    fireEvent.keyDown(region, { key: "ArrowRight" });

    expect(await screen.findByText("Beta active 0")).toBeTruthy();
    expect(viewport.scrollTop).toBeCloseTo(120);
  });

  test("autoplays StoryScroller at the configured scene pace", async () => {
    vi.useFakeTimers();

    const { container } = render(
      <StoryScroller
        ariaLabel="Autoplay scenes"
        autoplay={{ unitsPerSecond: 50 }}
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 2);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(viewport!.scrollTop).toBeGreaterThan(45);
    expect(viewport!.scrollTop).toBeLessThan(55);
    expect(screen.getByText(/Alpha active \d+/)).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(viewport!.scrollTop).toBeGreaterThan(95);
    expect(viewport!.scrollTop).toBeLessThan(105);
    expect(screen.getByText(/Beta active \d+/)).toBeTruthy();
  });

  test("autoplays StoryScroller through custom scene scroll units", async () => {
    vi.useFakeTimers();

    const { container } = render(
      <StoryScroller
        ariaLabel="Autoplay custom units"
        autoplay={{ unitsPerSecond: 100 }}
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            scrollUnits: 200,
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerTimelineGeometry(viewport!, 300);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(viewport!.scrollTop).toBeGreaterThan(95);
    expect(viewport!.scrollTop).toBeLessThan(105);
    expect(screen.getByText(/Alpha active 5\d/)).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(viewport!.scrollTop).toBeGreaterThan(195);
    expect(viewport!.scrollTop).toBeLessThan(215);
    expect(screen.getByText(/Beta active \d+/)).toBeTruthy();
  });

  test("does not autoplay StoryScroller for reduced motion users", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(
      <StoryScroller
        ariaLabel="Reduced autoplay scenes"
        autoplay
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 2);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(viewport!.scrollTop).toBe(0);
    expect(screen.getByText("Alpha active 0")).toBeTruthy();
  });

  test("switches StoryScroller scenes directly by default without transition previews", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Direct scenes"
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 2);

    scrollScrollerViewport(viewport!, 99);
    expect(await screen.findByText("Alpha active 99")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport!, 100);
    expect(await screen.findByText("Beta active 0")).toBeTruthy();
    expect(screen.queryByText(/Alpha/)).toBeNull();
  });

  test("crossfades StoryScroller scenes during the configured global transition window", async () => {
    const { container, viewport } = renderTransitionScroller({ type: "fade", scrollUnits: 20 });

    scrollScrollerViewport(viewport, 99);
    expect(await screen.findByText("Alpha active 99")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport, 100);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport, 110);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.getByText("Beta preview 0")).toBeTruthy();
    expect(getScrollerPage(container, 0, true)?.style.opacity).toBe("0.5");
    expect(getScrollerPage(container, 1, false)?.style.opacity).toBe("0.5");

    scrollScrollerViewport(viewport, 120);
    expect(await screen.findByText("Beta active 0")).toBeTruthy();
    expect(screen.queryByText(/Alpha/)).toBeNull();
  });

  test("slides StoryScroller scene previews during the configured transition window", async () => {
    const { container, viewport } = renderTransitionScroller({
      type: "slide",
      scrollUnits: 20,
      direction: "up",
    });

    scrollScrollerViewport(viewport, 99);
    expect(await screen.findByText("Alpha active 99")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport, 100);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport, 110);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.getByText("Beta preview 0")).toBeTruthy();
    expect(getScrollerPage(container, 0, true)?.style.transform).toBe("");
    expect(getScrollerPage(container, 1, false)?.style.transform).toBe("translateY(50%)");

    scrollScrollerViewport(viewport, 120);
    expect(await screen.findByText("Beta active 0")).toBeTruthy();
    expect(screen.queryByText(/Alpha/)).toBeNull();
  });

  test("pushes StoryScroller scenes during the configured transition window", async () => {
    const { container, viewport } = renderTransitionScroller({
      type: "push",
      scrollUnits: 20,
      direction: "left",
    });

    scrollScrollerViewport(viewport, 100);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport, 110);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.getByText("Beta preview 0")).toBeTruthy();
    expect(getScrollerPage(container, 0, true)?.style.transform).toBe("translateX(-50%)");
    expect(getScrollerPage(container, 1, false)?.style.transform).toBe("translateX(50%)");

    scrollScrollerViewport(viewport, 120);
    expect(await screen.findByText("Beta active 0")).toBeTruthy();
    expect(screen.queryByText(/Alpha/)).toBeNull();
  });

  test("wipes StoryScroller scene previews during the configured transition window", async () => {
    const { container, viewport } = renderTransitionScroller({
      type: "wipe",
      scrollUnits: 20,
      direction: "right",
    });

    scrollScrollerViewport(viewport, 100);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport, 110);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.getByText("Beta preview 0")).toBeTruthy();
    expect(getScrollerPage(container, 1, false)?.style.clipPath).toBe("inset(0 50% 0 0)");
  });

  test("zooms StoryScroller scene previews during the configured transition window", async () => {
    const { container, viewport } = renderTransitionScroller({ type: "zoom", scrollUnits: 20 });

    scrollScrollerViewport(viewport, 100);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport, 110);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.getByText("Beta preview 0")).toBeTruthy();
    expect(getScrollerPage(container, 0, true)?.style.transform).toBe("scale(1.03)");
    expect(getScrollerPage(container, 1, false)?.style.transform).toBe("scale(0.96)");
  });

  test("blurs StoryScroller scene previews during the configured transition window", async () => {
    const { container, viewport } = renderTransitionScroller({ type: "blur", scrollUnits: 20 });

    scrollScrollerViewport(viewport, 100);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport, 110);
    expect(await screen.findByText("Alpha active 100")).toBeTruthy();
    expect(screen.getByText("Beta preview 0")).toBeTruthy();
    expect(getScrollerPage(container, 0, true)?.style.filter).toBe("blur(8px)");
    expect(getScrollerPage(container, 1, false)?.style.filter).toBe("blur(8px)");
  });

  test("lets StoryScroller scene transitions override the global transition", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Override scenes"
        transition={{ type: "push", scrollUnits: 20, direction: "left" }}
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            transitionToNext: { type: "none" },
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 2);

    scrollScrollerViewport(viewport!, 90);
    expect(await screen.findByText("Alpha active 90")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();
  });

  test("treats zero-unit StoryScroller animated transitions as direct scene changes", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Zero transition scenes"
        transition={{ type: "slide", scrollUnits: 0 }}
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 2);

    scrollScrollerViewport(viewport!, 99);
    expect(await screen.findByText("Alpha active 99")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();
  });

  test("disables StoryScroller animated previews for reduced motion users", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(
      <StoryScroller
        ariaLabel="Reduced motion scenes"
        transition={{ type: "push", scrollUnits: 20, direction: "left" }}
        scenes={[
          {
            id: "alpha",
            title: "Alpha",
            render: renderScrollTransitionLabel("Alpha"),
          },
          {
            id: "beta",
            title: "Beta",
            render: renderScrollTransitionLabel("Beta"),
          },
        ]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 2);

    scrollScrollerViewport(viewport!, 90);
    expect(await screen.findByText("Alpha active 90")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();
  });

  test("minimizes and restores StoryMinimap items", () => {
    render(
      <StoryMinimap
        collapsible
        items={[
          { id: "draft", title: "Draft the report" },
          { id: "review", title: "Review the report" },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Go to scene 2: Review the report" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Minimize minimap" }));
    expect(screen.queryByRole("button", { name: "Go to scene 2: Review the report" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show minimap" }));
    expect(screen.getByRole("button", { name: "Go to scene 2: Review the report" })).toBeTruthy();
  });

  test("uses registry stages and falls back to the default stage", () => {
    function CustomStage(props: StoryRenderProps<FixtureData>) {
      return <div>Custom stage for {props.node.title}</div>;
    }

    const registry = createStoryRendererRegistry<FixtureData>({
      web: {
        custom: CustomStage,
      },
    });
    const path = resolveStoryPath(story, { choiceIds: ["trace"] });
    const traceNode = path.currentNode;
    const renderProps: StoryRenderProps<FixtureData> = {
      story,
      node: traceNode,
      history: path.history,
      path,
      currentIndex: 1,
      progress: 0.5,
      isEnding: true,
      canGoBack: true,
      choices: [],
      choose: () => {},
      goBack: () => {},
      restart: () => {},
    };

    const { rerender } = render(<StoryStageFrame {...renderProps} registry={registry} />);
    expect(screen.getByText("Custom stage for The map reveals a hidden harbor")).toBeTruthy();

    rerender(<StoryStageFrame {...renderProps} registry={createStoryRendererRegistry()} />);
    expect(
      screen.getByText("The signal comes from a cove nobody has charted in decades."),
    ).toBeTruthy();
  });

  test("imports subpath entrypoints without browser-only setup", async () => {
    await expect(import("./remotion")).resolves.toHaveProperty("StoryRemotionComposition");
    await expect(import("./three")).resolves.toHaveProperty("StoryCanvasStage");
    await expect(import("./media")).resolves.toHaveProperty("StoryVideoFile");
    await expect(import("./workflow")).resolves.toHaveProperty("storyToWorkflowDocument");
    await expect(import("./timeline")).resolves.toHaveProperty("storyToTimelineEditorDocument");
  });

  test("converts stories to workflow and timeline documents", async () => {
    const { storyToWorkflowDocument, workflowDocumentToStory } = await import("./workflow");
    const { applyTimelineTimingsToStory, storyToTimelineEditorDocument } =
      await import("./timeline");
    const workflowDocument = storyToWorkflowDocument(story);
    const timelineDocument = storyToTimelineEditorDocument(story, { choiceIds: ["answer"] });
    const nestedWorkflowDocument = storyToWorkflowDocument(nestedStory);
    const nestedTimelineDocument = storyToTimelineEditorDocument(nestedStory);

    expect(workflowDocument.nodes.map((node) => node.id)).toContain("wake");
    expect(workflowDocument.edges.map((edge) => edge.data.choiceId)).toContain("answer");
    expect(workflowDocumentToStory(workflowDocument, { id: "roundtrip" }).nodes).toHaveLength(
      story.nodes.length,
    );
    expect(timelineDocument.tracks[0]?.items.map((item) => item.data?.nodeId)).toEqual([
      "wake",
      "answer-node",
      "pilot-ending",
    ]);
    expect(nestedWorkflowDocument.nodes.map((node) => node.id)).toEqual([
      "chapter",
      "chapter-scene-a",
      "chapter-scene-b",
      "ending",
    ]);
    expect(
      nestedWorkflowDocument.nodes.find((node) => node.id === "chapter-scene-a"),
    ).toMatchObject({
      categoryPath: ["Story", "Chapter"],
    });
    expect(nestedTimelineDocument.tracks[0]?.items.map((item) => item.data?.nodeId)).toEqual([
      "chapter",
      "chapter-scene-a",
      "chapter-scene-b",
      "ending",
    ]);
    expect(nestedTimelineDocument.tracks[0]?.items[1]?.data?.nodeEntry?.depth).toBe(1);

    const positionedWorkflowDocument = storyToWorkflowDocument(story, {
      positions: { wake: { x: 11, y: 22 } },
    });
    const verticalWorkflowDocument = storyToWorkflowDocument(story, { direction: "vertical" });
    const workflowWithDiagnostics = storyToWorkflowDocument(
      {
        ...story,
        nodes: [...story.nodes, { id: "unused", title: "Unused" }],
      },
      { includeDiagnostics: true },
    );
    const branchTimelineDocument = storyToTimelineEditorDocument(story, {
      choiceIds: ["answer"],
      includeBranchMarkers: true,
    });
    const defaultTimelineDocument = storyToTimelineEditorDocument(story, { choiceIds: ["answer"] });

    expect(positionedWorkflowDocument.nodes.find((node) => node.id === "wake")).toMatchObject({
      x: 11,
      y: 22,
    });
    expect(verticalWorkflowDocument.nodes.find((node) => node.id === "answer-node")).toMatchObject({
      x: 0,
      y: 180,
    });
    expect(
      workflowWithDiagnostics.nodes
        .find((node) => node.id === "unused")
        ?.data.diagnostics?.map((issue) => issue.code),
    ).toEqual(expect.arrayContaining(["unreachable-node", "empty-content"]));
    expect(branchTimelineDocument.markers?.map((marker) => marker.label)).toEqual(
      expect.arrayContaining(["Branch: Wake the observatory", "Ending: The city hears the pilot"]),
    );
    expect(defaultTimelineDocument.markers?.map((marker) => marker.label)).not.toContain(
      "Branch: Wake the observatory",
    );
    expect(
      applyTimelineTimingsToStory(story, {
        tracks: [
          {
            id: "story-scenes",
            label: "Story scenes",
            items: [
              {
                id: "story-scene-wake",
                trackId: "story-scenes",
                label: "Wake",
                startMs: 0,
                durationMs: 2000,
                data: { nodeId: "wake", storyNode: story.nodes[0]!, pathIndex: 0 },
              },
            ],
          },
        ],
      }).nodes[0]?.durationInFrames,
    ).toBe(60);
    expect(
      applyTimelineTimingsToStory(nestedStory, {
        tracks: [
          {
            id: "story-scenes",
            label: "Story scenes",
            items: [
              {
                id: "story-scene-a",
                trackId: "story-scenes",
                label: "Scene A",
                startMs: 0,
                durationMs: 3000,
                data: {
                  nodeId: "chapter-scene-a",
                  storyNode: nestedStory.nodes[0]!.children![0]!,
                  pathIndex: 1,
                },
              },
            ],
          },
        ],
      }).nodes[0]?.children?.[0]?.durationInFrames,
    ).toBe(90);
  });

  test("computes Remotion composition props", async () => {
    const { getStoryCompositionProps } = await import("./remotion");
    const composition = getStoryCompositionProps(story, {
      id: "signal-answer",
      choiceIds: ["answer"],
      fps: 24,
      width: 1280,
      height: 720,
    });
    const nestedComposition = getStoryCompositionProps(nestedStory, {
      fps: 30,
    });

    expect(composition).toMatchObject({
      id: "signal-answer",
      fps: 24,
      width: 1280,
      height: 720,
      durationInFrames: 290,
    });
    expect(composition.defaultProps.choiceIds).toEqual(["answer"]);
    expect(nestedComposition.durationInFrames).toBe(480);
  });

  test("keeps Remotion composition registration props serializable", async () => {
    const { isValidElement } = await import("react");
    const { Composition } = await import("remotion");
    const { StoryRemotionComposition, getStoryCompositionProps } = await import("./remotion");
    const composition = getStoryCompositionProps(story, {
      id: "signal-video",
      choiceIds: ["answer"],
      fps: 30,
      width: 1920,
      height: 1080,
    });
    const registry = createStoryRendererRegistry<FixtureData>({
      remotion: {
        custom: () => <div>Custom Remotion scene</div>,
      },
    });

    const element = <Composition {...composition} component={StoryRemotionComposition} />;

    expect(isValidElement(element)).toBe(true);
    expect(composition.defaultProps).toEqual({
      story,
      choiceIds: ["answer"],
      layout: { fps: 30, width: 1920, height: 1080 },
    });
    expect("registry" in composition.defaultProps).toBe(false);
    expect(registry.remotion?.custom).toEqual(expect.any(Function));
  });

  test("passes Remotion frame, progress, history, and node data into custom renderers", async () => {
    vi.doMock("remotion", () => ({
      AbsoluteFill: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Sequence: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      interpolate: () => 1,
      useCurrentFrame: () => 130,
    }));

    const { StoryRemotionComposition } = await import("./remotion");
    const capture = vi.fn();
    const remotionNodes = [...story.nodes];
    const traceNodeIndex = remotionNodes.findIndex((node) => node.id === "trace-node");

    if (traceNodeIndex >= 0) {
      remotionNodes[traceNodeIndex] = {
        ...remotionNodes[traceNodeIndex]!,
        stage: { renderer: "capture" },
      };
    }

    const remotionStory: StoryDocument<FixtureData> = {
      ...story,
      nodes: remotionNodes,
    };
    const registry = createStoryRendererRegistry<FixtureData>({
      remotion: {
        capture: (props) => {
          capture(props);
          return <div>Captured {props.node.title}</div>;
        },
      },
    });

    render(
      <StoryRemotionComposition
        story={remotionStory}
        choiceIds={["trace"]}
        registry={registry}
        layout={{ fps: 24 }}
      />,
    );

    expect(screen.getByText("Captured The map reveals a hidden harbor")).toBeTruthy();
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        absoluteFrame: 130,
        frame: 30,
        durationInFrames: 100,
        fps: 24,
        sceneProgress: 0.3,
        currentIndex: 1,
        history: expect.arrayContaining([
          expect.objectContaining({ nodeId: "trace-node", data: { tone: "green" } }),
        ]),
        node: expect.objectContaining({ data: { tone: "green" } }),
      }),
    );
  });
});
