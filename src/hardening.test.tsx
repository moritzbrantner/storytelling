import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  StoryScroller,
  analyzeStory,
  applyStoryPatch,
  defineStory,
  resolveStoryPath,
  useStoryPathState,
  validateStoryDocument,
  type StoryDocument,
} from ".";
import { parseSubtitleText } from "./media";

const branchStory = defineStory({
  id: "branch",
  title: "Branch",
  openingNodeId: "start",
  nodes: [
    {
      id: "start",
      title: "Start",
      content: [{ type: "paragraph", text: "Start content." }],
      choices: [
        { id: "go", label: "Go", target: "end" },
        { id: "other", label: "Other", target: "other-end" },
      ],
    },
    { id: "end", title: "End", content: [{ type: "paragraph", text: "End content." }] },
    {
      id: "other-end",
      title: "Other end",
      content: [{ type: "paragraph", text: "Other content." }],
    },
  ],
});

const linearStory = defineStory({
  id: "linear-hardening",
  title: "Linear hardening",
  openingNodeId: "a",
  nodes: [
    { id: "a", title: "A", next: "b" },
    { id: "b", title: "B", next: "c" },
    { id: "c", title: "C" },
  ],
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("repository hardening", () => {
  test("reports strict validation issues by default", () => {
    const strictDraft: StoryDocument = {
      id: " ",
      title: " ",
      openingNodeId: "start",
      nodes: [
        {
          id: "bad id",
          title: " ",
          content: [{ type: "paragraph", text: "Draft." }],
        },
        {
          id: "start",
          title: "Start",
          next: "end",
          durationInFrames: 0,
          scrollUnits: -1,
          transition: { durationInFrames: -1 },
          choices: [{ id: "go now", label: " ", target: "end" }],
        },
        { id: "end", title: "End" },
      ],
    };

    expect(validateStoryDocument(strictDraft).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "blank-story-id",
        "blank-story-title",
        "invalid-node-id",
        "blank-node-title",
        "node-has-next-and-choices",
        "invalid-node-duration",
        "invalid-node-scroll-units",
        "invalid-transition-duration",
        "invalid-choice-id",
        "blank-choice-label",
      ]),
    );
    expect(
      validateStoryDocument(strictDraft, { mode: "compat" }).map((issue) => issue.code),
    ).not.toContain("blank-story-id");
    expect(() => defineStory(strictDraft)).toThrow("must not be blank");

    const report = analyzeStory(strictDraft);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "node-has-next-and-choices", severity: "error" }),
      ]),
    );
    expect(analyzeStory(strictDraft, { validationMode: "strict" }).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "node-has-next-and-choices", severity: "error" }),
      ]),
    );
  });

  test("rejects invalid content blocks in strict validation", () => {
    const invalidContentStory = {
      ...branchStory,
      nodes: [
        {
          id: "start",
          title: "Start",
          content: [{ type: "unknown" }],
        },
      ],
    } as unknown as StoryDocument;

    expect(
      validateStoryDocument(invalidContentStory, { mode: "strict" }).map((issue) => issue.code),
    ).toContain("invalid-content-block");
  });

  test("hardens story patches against silent data loss", () => {
    const renamed = applyStoryPatch(branchStory, {
      type: "rename-node",
      nodeId: "end",
      nextNodeId: "renamed-end",
    });

    expect(renamed.nodes.find((node) => node.id === "renamed-end")).toBeTruthy();
    expect(renamed.nodes[0]?.choices?.[0]?.target).toBe("renamed-end");
    expect(() =>
      applyStoryPatch(branchStory, {
        type: "update-node",
        nodeId: "start",
        fields: { id: "renamed" },
      }),
    ).toThrow('Use the "rename-node" patch');
    expect(() => applyStoryPatch(branchStory, { type: "remove-node", nodeId: "start" })).toThrow(
      "requires nextOpeningNodeId",
    );
    expect(() => applyStoryPatch(branchStory, { type: "set-next", nodeId: "missing" })).toThrow(
      'does not contain node "missing"',
    );
    expect(
      applyStoryPatch(
        branchStory,
        { type: "set-next", nodeId: "missing" },
        { onMissing: "ignore" },
      ),
    ).toStrictEqual(branchStory);
  });

  test("records consumed, unconsumed, and invalid path choice ids", () => {
    const resolved = resolveStoryPath(branchStory, { routeChoiceIds: ["go", "unused"] });

    expect(resolved.consumedChoiceIds).toEqual(["go"]);
    expect(resolved.unconsumedChoiceIds).toEqual(["unused"]);
    expect(resolved.stoppedReason).toBe("invalid-choice");

    const invalid = resolveStoryPath(branchStory, { routeChoiceIds: ["missing"] });
    expect(invalid.consumedChoiceIds).toEqual([]);
    expect(invalid.unconsumedChoiceIds).toEqual(["missing"]);
    expect(invalid.stoppedReason).toBe("invalid-choice");
  });

  test("lets headless state go back through auto-advanced linear nodes and honor stopAt", async () => {
    function LinearProbe() {
      const state = useStoryPathState(linearStory, { autoAdvanceLinearNodes: true });

      return (
        <div>
          <p>Node {state.currentNode.id}</p>
          <p>Stop {state.stopAt ?? "none"}</p>
          <button type="button" onClick={state.goBack}>
            Go back
          </button>
        </div>
      );
    }

    function StopAtProbe() {
      const state = useStoryPathState(branchStory, {
        defaultSnapshot: resolveStoryPath(branchStory, { routeChoiceIds: ["go"] }).snapshot,
        stopAt: "end",
      });

      return <p>Stopped {state.currentNode.id}</p>;
    }

    const linear = render(<LinearProbe />);
    expect(screen.getByText("Node c")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(await screen.findByText("Node b")).toBeTruthy();
    expect(screen.getByText("Stop b")).toBeTruthy();
    linear.unmount();

    render(<StopAtProbe />);
    expect(screen.getByText("Stopped end")).toBeTruthy();
  });

  test("validates custom scroller scenes and avoids duplicate active-index notifications", () => {
    expect(() =>
      render(
        <StoryScroller
          scenes={[
            { id: "same", title: "Same", render: () => <div>One</div> },
            { id: "same", title: "Same again", render: () => <div>Two</div> },
          ]}
        />,
      ),
    ).toThrow("scene ids must be unique");

    const onActiveIndexChange = vi.fn();
    const { container } = render(
      <StoryScroller
        onActiveIndexChange={onActiveIndexChange}
        scenes={[{ id: "only", title: "Only", render: () => <div>Only</div> }]}
      />,
    );
    const viewport = container.querySelector<HTMLElement>("[data-story-scroller-viewport]");

    expect(viewport).toBeTruthy();
    setScrollerGeometry(viewport!, 1);
    scrollScrollerViewport(viewport!, 0);
    expect(onActiveIndexChange).toHaveBeenCalledTimes(1);
  });

  test("scopes story scroller numeric hotkeys to the focused scroller", async () => {
    const firstStory = defineStory({
      ...branchStory,
      id: "first",
      title: "First",
      nodes: [
        {
          id: "start",
          title: "First start",
          choices: [
            { id: "go", label: "Go", target: "end" },
            { id: "other", label: "Other", target: "other-end" },
          ],
        },
        { id: "end", title: "First end", content: [{ type: "paragraph", text: "First go." }] },
        {
          id: "other-end",
          title: "First other",
          content: [{ type: "paragraph", text: "First other." }],
        },
      ],
    });
    const secondStory = defineStory({
      ...branchStory,
      id: "second",
      title: "Second",
      nodes: [
        {
          id: "start",
          title: "Second start",
          choices: [
            { id: "go", label: "Go", target: "end" },
            { id: "other", label: "Other", target: "other-end" },
          ],
        },
        { id: "end", title: "Second end", content: [{ type: "paragraph", text: "Second go." }] },
        {
          id: "other-end",
          title: "Second other",
          content: [{ type: "paragraph", text: "Second other." }],
        },
      ],
    });
    const { container } = render(
      <>
        <StoryScroller story={firstStory} />
        <StoryScroller story={secondStory} />
      </>,
    );
    const viewports = container.querySelectorAll<HTMLElement>("[data-story-scroller-viewport]");

    for (const viewport of viewports) {
      setScrollerGeometry(viewport, 1);
      scrollScrollerViewport(viewport, 100);
    }

    screen.getByRole("region", { name: "Second" }).focus();
    fireEvent.keyDown(window, { key: "2" });

    expect(await screen.findByText("Second other.")).toBeTruthy();
    expect(screen.queryByText("First other.")).toBeNull();
  });

  test("hardens adapters and subtitle parsing edge cases", async () => {
    vi.doMock("remotion", () => ({
      AbsoluteFill: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      Sequence: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
      interpolate: vi.fn(() => {
        throw new Error("interpolate should not be called");
      }),
      useCurrentFrame: () => 999,
    }));

    const { StoryRemotionTransition, getStoryCompositionProps } = await import("./remotion");
    const { storyToTimelineEditorDocument, applyTimelineTimingsToStory } =
      await import("./timeline");
    const { storyToWorkflowDocument } = await import("./workflow");

    render(
      <StoryRemotionTransition frame={0} durationInFrames={1} transitionInFrames={0}>
        No transition
      </StoryRemotionTransition>,
    );
    expect(screen.getByText("No transition")).toBeTruthy();
    expect(() => getStoryCompositionProps(branchStory, { fps: 0 })).toThrow("fps");
    expect(() => storyToTimelineEditorDocument(branchStory, { fps: 0 })).toThrow("fps");

    const timedStory = applyTimelineTimingsToStory(branchStory, {
      tracks: [
        {
          id: "track",
          label: "Track",
          items: [
            {
              id: "first",
              trackId: "track",
              label: "First",
              startMs: 0,
              durationMs: -20,
              data: { nodeId: "start", storyNode: branchStory.nodes[0]!, pathIndex: 0 },
            },
            {
              id: "last",
              trackId: "track",
              label: "Last",
              startMs: 0,
              durationMs: 2000,
              data: { nodeId: "start", storyNode: branchStory.nodes[0]!, pathIndex: 0 },
            },
          ],
        },
      ],
    });

    expect(timedStory.nodes[0]?.durationInFrames).toBe(60);

    const invalidWorkflowStory: StoryDocument = {
      id: "workflow-draft",
      title: "Workflow draft",
      openingNodeId: "missing",
      nodes: [{ id: "start", title: "Start", next: "missing" }],
    };
    const workflowDocument = storyToWorkflowDocument(invalidWorkflowStory, {
      includeDiagnostics: true,
      allowInvalid: true,
    });

    expect(workflowDocument.nodes).toHaveLength(1);
    expect(workflowDocument.nodes[0]?.data.diagnostics?.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing-opening-node", "missing-next-target"]),
    );

    expect(
      parseSubtitleText(
        "\uFEFFWEBVTT\n\nNOTE ignored\n\n00:00:02.000 --> 00:00:01.000\nBad\n\n00:00:01.000 --> 00:00:02.000 align:start\nGood",
      ).map((cue) => cue.text),
    ).toEqual(["Good"]);
    expect(
      parseSubtitleText(
        "1\n00:00:00,000 --> 00:00:01,000\nDuplicate\n\n2\n00:00:01,000 --> 00:00:02,000\nDuplicate",
      ),
    ).toHaveLength(2);
  });
});
