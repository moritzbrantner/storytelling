import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  StoryProgress,
  buildPathFromHistory,
  createDefaultStoryState,
  createStoryRenderProps,
  createStoryRendererRegistry,
  defineStory,
  getStoryRendererKey,
  getStoryStageProps,
  useStoryRuntime,
  type StoryDocument,
  type StoryRendererRegistry,
} from ".";

type FixtureData = { tone: string };
type Vars = { route: string };

const helperStory: StoryDocument<FixtureData, Vars> = defineStory<FixtureData, Vars>({
  id: "helper-story",
  title: "Helper story",
  openingNodeId: "start",
  labels: {
    back: "Back label",
    restart: "Restart label",
    choosePrompt: "Choose label",
    endingPrompt: "Ending label",
    completedBranch: "Completed label",
  },
  initialState: createDefaultStoryState<Vars>({ route: "initial" }),
  nodes: [
    {
      id: "start",
      title: "Start",
      data: { tone: "cold" },
      choices: [{ id: "finish", label: "Finish", target: "end" }],
    },
    { id: "end", title: "End", data: { tone: "warm" } },
  ],
});

afterEach(() => {
  cleanup();
});

describe("story helper coverage", () => {
  test("creates renderer registries and resolves renderer keys and stage props", () => {
    const registry: StoryRendererRegistry<FixtureData> = {
      web: {
        custom: () => <div>Custom</div>,
      },
    };

    expect(createStoryRendererRegistry()).toEqual({});
    expect(createStoryRendererRegistry(registry)).toBe(registry);
    expect(getStoryRendererKey({ id: "node", title: "Node", stage: { renderer: "custom" } })).toBe(
      "custom",
    );
    expect(getStoryRendererKey({ id: "node", title: "Node", stage: { variant: "media" } })).toBe(
      "media",
    );
    expect(getStoryRendererKey({ id: "node", title: "Node" })).toBe("default");
    expect(
      getStoryStageProps({ id: "node", title: "Node", stage: { props: { mood: "calm" } } }),
    ).toEqual({ mood: "calm" });
    expect(getStoryStageProps({ id: "node", title: "Node" })).toEqual({});
  });

  test("renders clamped story progress with and without labels", () => {
    const { rerender } = render(<StoryProgress value={0.42} label="Progress" />);
    const progress = screen.getByRole("progressbar");

    expect(progress.getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText("Progress")).toBeTruthy();
    expect(screen.getByText("42%")).toBeTruthy();

    rerender(<StoryProgress value={-1} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(screen.queryByText("Progress")).toBeNull();

    rerender(<StoryProgress value={2} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });

  test("builds paths and render props from history defaults", () => {
    const emptyPath = buildPathFromHistory(helperStory, []);
    const explicitState = createDefaultStoryState<Vars>({ route: "history" });
    const historyPath = buildPathFromHistory(helperStory, [
      { nodeId: "start", state: helperStory.initialState },
      { nodeId: "end", choiceId: "finish", state: explicitState },
    ]);
    const renderProps = createStoryRenderProps({ story: helperStory, path: historyPath });

    expect(emptyPath.currentNode.id).toBe("start");
    expect(emptyPath.state.route).toBe("initial");
    expect(historyPath.currentNode.id).toBe("end");
    expect(historyPath.state.route).toBe("history");
    expect(renderProps.node.id).toBe("end");
    expect(renderProps.nodeEntry?.nodeId).toBe("end");
    expect(renderProps.currentIndex).toBe(1);
    expect(renderProps.progress).toBe(1);
    expect(renderProps.choices).toEqual([]);
    expect(renderProps.visibleChoices).toEqual([]);
    expect(() => renderProps.choose("missing")).not.toThrow();
    expect(() => renderProps.goBack()).not.toThrow();
    expect(() => renderProps.restart()).not.toThrow();
  });

  test("uses custom runtime labels and progress callbacks", () => {
    const progress = vi.fn(() => 0.75);

    function RuntimeProbe() {
      const runtime = useStoryRuntime(helperStory, { progress });

      return (
        <div>
          <p>Back {runtime.labels.back}</p>
          <p>Restart {runtime.labels.restart}</p>
          <p>Choose {runtime.labels.choosePrompt}</p>
          <p>Ending {runtime.labels.endingPrompt}</p>
          <p>Completed {runtime.labels.completedBranch}</p>
          <p>Progress {runtime.progress}</p>
        </div>
      );
    }

    render(<RuntimeProbe />);

    expect(screen.getByText("Back Back label")).toBeTruthy();
    expect(screen.getByText("Restart Restart label")).toBeTruthy();
    expect(screen.getByText("Choose Choose label")).toBeTruthy();
    expect(screen.getByText("Ending Ending label")).toBeTruthy();
    expect(screen.getByText("Completed Completed label")).toBeTruthy();
    expect(screen.getByText("Progress 0.75")).toBeTruthy();
    expect(progress).toHaveBeenCalled();
  });
});
