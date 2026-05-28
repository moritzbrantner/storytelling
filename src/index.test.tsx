import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  StoryMinimap,
  StoryPlayer,
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
  parseStoryPath,
  resolveStoryPath,
  serializeStoryPath,
  useStoryPathState,
  validateStory,
  validateStoryDocument,
  type StoryDocument,
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
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: /Answer immediately/,
        hidden: true,
      }).disabled,
    ).toBe(true);

    scrollScrollerViewport(viewport!, 100);
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

    fireEvent.keyDown(window, { key: "2" });

    expect(
      await screen.findByText("The signal comes from a cove nobody has charted in decades."),
    ).toBeTruthy();
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
