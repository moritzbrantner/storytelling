import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { StoryDocument, StoryNode } from "./story-model";
import type { StoryRenderProps } from "./story-render-types";

type FixtureData = { tone: string };

const story: StoryDocument<FixtureData> = {
  id: "three-story",
  title: "Three story",
  openingNodeId: "start",
  nodes: [{ id: "start", title: "Start", data: { tone: "cold" } }],
};

let frameCallbacks: Array<(state: { clock: { elapsedTime: number } }) => void> = [];
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const originalConsoleError = console.error;

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ camera, children }: { camera: unknown; children?: ReactNode }) => (
    <div data-testid="canvas" data-camera={JSON.stringify(camera)}>
      {children}
    </div>
  ),
  useFrame: (callback: (state: { clock: { elapsedTime: number } }) => void) => {
    frameCallbacks.push(callback);
    callback({ clock: { elapsedTime: 2 } });
  },
}));

beforeEach(() => {
  cleanup();
  vi.resetModules();
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const [message] = args;
    if (
      typeof message === "string" &&
      (message.includes("is unrecognized in this browser") ||
        message.includes("is using incorrect casing") ||
        message.includes("React does not recognize") ||
        message.includes("Received `%s` for a non-boolean attribute `%s`"))
    ) {
      return;
    }

    originalConsoleError(...args);
  });
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  frameCallbacks = [];
});

function createRenderProps(node: StoryNode<FixtureData>): StoryRenderProps<FixtureData> {
  return {
    story,
    node,
    history: [{ nodeId: node.id, data: node.data }],
    path: {
      nodes: [node],
      history: [{ nodeId: node.id, data: node.data }],
      currentNode: node,
      completed: true,
      state: {},
      snapshot: {
        nodeId: node.id,
        history: [{ nodeId: node.id, data: node.data }],
        state: {},
      },
    },
    state: {},
    snapshot: {
      nodeId: node.id,
      history: [{ nodeId: node.id, data: node.data }],
      state: {},
    },
    currentIndex: 2,
    progress: 0.5,
    isEnding: true,
    canGoBack: false,
    choices: [],
    visibleChoices: [],
    choose: vi.fn(),
    goBack: vi.fn(),
    restart: vi.fn(),
  };
}

describe("StoryCanvasStage", () => {
  test("renders the default Three scene inside a mocked canvas", async () => {
    const { StoryCanvasStage } = await import("./three");
    const node = story.nodes[0]!;
    const { container } = render(<StoryCanvasStage {...createRenderProps(node)} />);
    const canvas = screen.getByTestId("canvas");

    expect(JSON.parse(canvas.dataset.camera ?? "{}")).toEqual({ position: [0, 0, 6], fov: 42 });
    expect(container.querySelector("mesh")).toBeTruthy();
    expect(container.querySelector("ambientLight")).toBeTruthy();
    expect(container.querySelector("pointLight")).toBeTruthy();
    expect(frameCallbacks).toHaveLength(1);
  });

  test("passes custom camera positions to the mocked canvas", async () => {
    const { StoryCanvasStage } = await import("./three");
    const node = story.nodes[0]!;

    render(<StoryCanvasStage {...createRenderProps(node)} cameraPosition={[1, 2, 3]} />);

    expect(JSON.parse(screen.getByTestId("canvas").dataset.camera ?? "{}")).toEqual({
      position: [1, 2, 3],
      fov: 42,
    });
  });

  test("selects custom Three renderers by renderer key and passes stage props", async () => {
    const { StoryCanvasStage } = await import("./three");
    const capture = vi.fn(() => <div>Custom Three scene</div>);
    const node: StoryNode<FixtureData> = {
      id: "custom",
      title: "Custom",
      data: { tone: "warm" },
      stage: { renderer: "custom", props: { mood: "calm" } },
    };

    render(
      <StoryCanvasStage
        {...createRenderProps(node)}
        registry={{ three: { custom: capture } }}
        className="custom-stage"
      />,
    );

    expect(screen.getByText("Custom Three scene")).toBeTruthy();
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        node,
        currentIndex: 2,
        progress: 0.5,
        stageProps: { mood: "calm" },
      }),
      undefined,
    );
    expect(screen.getByText("Custom Three scene").closest(".custom-stage")).toBeTruthy();
    expect(frameCallbacks).toHaveLength(0);
  });

  test("selects custom Three renderers by stage variant", async () => {
    const { StoryCanvasStage } = await import("./three");
    const capture = vi.fn(() => <div>Variant Three scene</div>);
    const node: StoryNode<FixtureData> = {
      id: "variant",
      title: "Variant",
      data: { tone: "green" },
      stage: { variant: "media", props: { speed: 2 } },
    };

    render(
      <StoryCanvasStage {...createRenderProps(node)} registry={{ three: { media: capture } }} />,
    );

    expect(screen.getByText("Variant Three scene")).toBeTruthy();
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        node,
        stageProps: { speed: 2 },
      }),
      undefined,
    );
  });
});
