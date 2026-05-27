import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  StoryMinimap,
  StoryPlayer,
  StoryScroller,
  StoryStageFrame,
  buildStoryTimeline,
  createStoryRendererRegistry,
  defineStory,
  resolveStoryPath,
  validateStory,
  type StoryDocument,
  type StoryRenderProps,
  type StoryScrollSceneRenderProps,
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

afterEach(() => {
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

describe("@moritzbrantner/storytelling", () => {
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

    expect(() =>
      resolveStoryPath(story, {
        choiceIds: ["answer"],
        autoAdvanceLinearNodes: true,
        maxSteps: 1,
      }),
    ).toThrow("exceeded 1 steps");
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

  test("renders StoryScroller story branches as scene-progress pages", async () => {
    render(<StoryScroller story={story} />);

    expect(screen.queryByRole("navigation", { name: "Story graph" })).toBeNull();
    expect(screen.queryByText("The city hears the pilot")).toBeNull();
    expect(screen.queryByText(/Scene 1 \//)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Answer immediately/ }));

    expect(await screen.findByText("The message is fragmented.")).toBeTruthy();
    expect(screen.queryByText("Contact changes the route.")).toBeNull();

    fireEvent.keyDown(screen.getByRole("region", { name: "Signal in the fog" }), {
      key: "ArrowDown",
    });
    expect(await screen.findByText("Contact changes the route.")).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("region", { name: "Signal in the fog" }), {
      key: "Home",
    });
    expect(await screen.findByText("A low signal reaches the tower.")).toBeTruthy();
  });

  test("renders linear StoryScroller stories from the opening node", async () => {
    render(<StoryScroller story={linearStory} />);

    expect(screen.getByText("Draft the morning brief.")).toBeTruthy();
    expect(screen.queryByText("Review the copy for sequence and clarity.")).toBeNull();
    expect(screen.queryByText("Publish the report at noon.")).toBeNull();

    fireEvent.keyDown(screen.getByRole("region", { name: "Linear report" }), {
      key: "ArrowDown",
    });
    expect(await screen.findByText("Review the copy for sequence and clarity.")).toBeTruthy();
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
    const { container } = render(
      <StoryScroller
        ariaLabel="Fade scenes"
        transition={{ type: "fade", scrollUnits: 20 }}
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

    scrollScrollerViewport(viewport!, 79);
    expect(await screen.findByText("Alpha active 79")).toBeTruthy();
    expect(screen.queryByText(/Beta/)).toBeNull();

    scrollScrollerViewport(viewport!, 90);
    expect(await screen.findByText("Alpha active 90")).toBeTruthy();
    expect(screen.getByText("Beta preview 0")).toBeTruthy();

    scrollScrollerViewport(viewport!, 100);
    expect(await screen.findByText("Beta active 0")).toBeTruthy();
    expect(screen.queryByText(/Alpha/)).toBeNull();
  });

  test("lets StoryScroller scene transitions override the global transition", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Override scenes"
        transition={{ type: "fade", scrollUnits: 20 }}
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

  test("treats zero-unit StoryScroller fade transitions as direct scene changes", async () => {
    const { container } = render(
      <StoryScroller
        ariaLabel="Zero fade scenes"
        transition={{ type: "fade", scrollUnits: 0 }}
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

  test("disables StoryScroller fade previews for reduced motion users", async () => {
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
        transition={{ type: "fade", scrollUnits: 20 }}
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

  test("imports remotion and three entrypoints without browser-only setup", async () => {
    await expect(import("./remotion")).resolves.toHaveProperty("StoryRemotionComposition");
    await expect(import("./three")).resolves.toHaveProperty("StoryCanvasStage");
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

    expect(composition).toMatchObject({
      id: "signal-answer",
      fps: 24,
      width: 1280,
      height: 720,
      durationInFrames: 290,
    });
    expect(composition.defaultProps.choiceIds).toEqual(["answer"]);
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
    const remotionStory: StoryDocument<FixtureData> = {
      ...story,
      nodes: story.nodes.map((node) =>
        node.id === "trace-node" ? { ...node, stage: { renderer: "capture" } } : node,
      ),
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
      <StoryRemotionComposition story={remotionStory} choiceIds={["trace"]} registry={registry} />,
    );

    expect(screen.getByText("Captured The map reveals a hidden harbor")).toBeTruthy();
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        absoluteFrame: 130,
        frame: 30,
        durationInFrames: 100,
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
