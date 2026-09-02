import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { StoryContentBlock, StoryDocument } from "./story-model";
import type { StoryRemotionSceneProps } from "./story-render-types";

type FixtureData = { tone: string };

const remotionStory: StoryDocument<FixtureData> = {
  id: "remotion-story",
  title: "Remotion story",
  openingNodeId: "start",
  defaults: { durationInFrames: 90, transitionInFrames: 12 },
  nodes: [
    {
      id: "start",
      title: "Start scene",
      eyebrow: "Opening",
      content: [{ type: "paragraph", text: "Opening copy" }],
      data: { tone: "cold" },
      choices: [
        { id: "left", label: "Left", target: "left" },
        { id: "right", label: "Right", target: "right" },
      ],
    },
    {
      id: "left",
      title: "Left scene",
      content: [{ type: "paragraph", text: "Left copy" }],
      data: { tone: "warm" },
    },
    {
      id: "right",
      title: "Right scene",
      stage: { renderer: "missing" },
      content: [{ type: "paragraph", text: "Right copy" }],
      data: { tone: "green" },
    },
  ],
};

let currentFrame = 0;
let interpolateMock = vi.fn((..._args: unknown[]) => 1);

function mockRemotion() {
  vi.doMock("remotion", () => ({
    AbsoluteFill: ({
      children,
      style,
    }: {
      children?: ReactNode;
      style?: Record<string, unknown>;
    }) => (
      <div data-testid="absolute-fill" style={style}>
        {children}
      </div>
    ),
    Sequence: ({
      children,
      from,
      durationInFrames,
    }: {
      children?: ReactNode;
      from: number;
      durationInFrames: number;
    }) => (
      <div data-testid="sequence" data-from={from} data-duration={durationInFrames}>
        {children}
      </div>
    ),
    interpolate: (...args: unknown[]) => interpolateMock(...args),
    useCurrentFrame: () => currentFrame,
  }));
}

afterEach(() => {
  cleanup();
  vi.doUnmock("remotion");
  vi.resetModules();
  currentFrame = 0;
  interpolateMock = vi.fn((..._args: unknown[]) => 1);
});

describe("Remotion story helpers", () => {
  test("computes default composition props and rejects invalid fps values", async () => {
    mockRemotion();
    const { getStoryCompositionProps } = await import("./remotion");

    expect(getStoryCompositionProps(remotionStory)).toMatchObject({
      id: "remotion-story-default",
      width: 1920,
      height: 1080,
      defaultProps: {
        story: remotionStory,
        routeChoiceIds: [],
        layout: { width: 1920, height: 1080 },
      },
    });
    expect(getStoryCompositionProps(remotionStory, { routeChoiceIds: ["left"] }).id).toBe(
      "remotion-story-left",
    );
    expect(getStoryCompositionProps(remotionStory, { fps: undefined }).fps).toBeGreaterThan(0);

    for (const fps of [0, -1, Infinity, Number.NaN]) {
      expect(() => getStoryCompositionProps(remotionStory, { fps })).toThrow("fps");
    }
  });

  test("renders supported Remotion content and ignores unsupported rich blocks", async () => {
    mockRemotion();
    const { StoryRemotionContent } = await import("./remotion");
    const supportedContent: StoryContentBlock[] = [
      { type: "paragraph", text: "Paragraph" },
      { type: "heading", level: 2, text: "Heading two" },
      { type: "heading", text: "Heading default" },
      { type: "heading", level: 4, text: "Heading four" },
      { type: "quote", text: "Quote", cite: "Citation" },
      { type: "list", items: ["One", "Two"] },
      { type: "image", src: "/image.png", alt: "Image", caption: "Caption" },
      { type: "audio", src: "/audio.mp3", title: "Audio title" },
      { type: "video", src: "/video.mp4" },
    ];
    const unsupportedContent: StoryContentBlock[] = [
      { type: "table", columns: [{ id: "a", header: "A" }], rows: [{ a: "A" }] },
      { type: "chart", chartType: "bar", data: [{ label: "A", value: 1 }] },
      { type: "embed", src: "https://example.com", title: "Embed" },
      { type: "callout", content: "Callout" },
      { type: "markdown", markdown: "Markdown" },
    ];
    const { container, rerender } = render(<StoryRemotionContent />);

    expect(container.textContent).toBe("");

    rerender(<StoryRemotionContent content={[]} />);
    expect(container.textContent).toBe("");

    rerender(<StoryRemotionContent content={supportedContent} color="red" />);
    expect(screen.getByText("Paragraph")).toBeTruthy();
    expect(screen.getByText("Heading two")).toBeTruthy();
    expect(screen.getByText("Heading default")).toBeTruthy();
    expect(screen.getByText("Heading four")).toBeTruthy();
    expect(screen.getByText("Quote")).toBeTruthy();
    expect(screen.getByText("Citation")).toBeTruthy();
    expect(screen.getByText("One")).toBeTruthy();
    expect(screen.getByAltText("Image")).toBeTruthy();
    expect(screen.getByText("Caption")).toBeTruthy();
    expect(screen.getByText("Audio title")).toBeTruthy();
    expect(screen.getByText("/video.mp4")).toBeTruthy();

    rerender(<StoryRemotionContent content={unsupportedContent} />);
    expect(container.textContent).toBe("");
  });

  test("clamps Remotion progress labels", async () => {
    mockRemotion();
    const { StoryRemotionProgress } = await import("./remotion");
    const { container, rerender } = render(<StoryRemotionProgress progress={-1} label="Scene" />);

    expect(screen.getByText("Scene")).toBeTruthy();
    expect(container.querySelectorAll("div")[2]?.style.width).toBe("0%");

    rerender(<StoryRemotionProgress progress={2} label="Scene" />);
    expect(container.querySelectorAll("div")[2]?.style.width).toBe("100%");
  });

  test("handles Remotion transitions with and without interpolation", async () => {
    mockRemotion();
    const { StoryRemotionTransition } = await import("./remotion");
    const { rerender } = render(
      <StoryRemotionTransition frame={0} durationInFrames={10} transitionInFrames={0}>
        No transition
      </StoryRemotionTransition>,
    );

    expect(screen.getByText("No transition")).toBeTruthy();
    expect(interpolateMock).not.toHaveBeenCalled();

    rerender(
      <StoryRemotionTransition frame={2} durationInFrames={6} transitionInFrames={10}>
        With transition
      </StoryRemotionTransition>,
    );

    expect(screen.getByText("With transition")).toBeTruthy();
    expect(interpolateMock).toHaveBeenCalledTimes(2);
    expect(interpolateMock).toHaveBeenNthCalledWith(1, 2, [0, 3, 3, 6], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    expect(interpolateMock).toHaveBeenNthCalledWith(2, 2, [0, 3, 6], [36, 0, -24], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  });

  test("renders default Remotion scene frames with theme, accent, content, and progress", async () => {
    mockRemotion();
    const { StoryRemotionSceneFrame } = await import("./remotion");
    const baseProps = {
      story: remotionStory,
      node: {
        id: "scene",
        title: "Scene title",
        content: [{ type: "paragraph", text: "Scene copy" }],
      },
      history: [],
      path: {} as never,
      state: {},
      snapshot: {} as never,
      currentIndex: 1,
      progress: 0.5,
      isEnding: false,
      canGoBack: false,
      choices: [],
      visibleChoices: [],
      choose: vi.fn(),
      goBack: vi.fn(),
      restart: vi.fn(),
      frame: 0,
      absoluteFrame: 0,
      durationInFrames: 20,
      fps: 30,
      sceneProgress: 0,
      timelineScene: { transitionInFrames: 0 },
    } as unknown as StoryRemotionSceneProps<FixtureData>;
    const { rerender } = render(<StoryRemotionSceneFrame {...baseProps} />);

    expect(screen.getByText("Scene title")).toBeTruthy();
    expect(screen.getByText("Scene copy")).toBeTruthy();
    expect(screen.getByText("Scene 2")).toBeTruthy();
    expect(screen.queryByText("Opening")).toBeNull();

    rerender(
      <StoryRemotionSceneFrame
        {...{
          ...baseProps,
          node: {
            ...baseProps.node,
            eyebrow: "Opening",
            stage: { props: { accent: "#123456" } },
          },
          theme: { accent: "#abcdef", fontFamily: "Test Sans" },
        }}
      />,
    );

    const accentProbe = document.createElement("div");
    accentProbe.style.backgroundColor = "#123456";

    expect(screen.getByText("Opening")).toBeTruthy();
    expect(screen.getAllByTestId("absolute-fill").at(-1)?.style.background).toContain(
      accentProbe.style.backgroundColor,
    );
    expect(screen.getAllByTestId("absolute-fill").at(-1)?.style.fontFamily).toBe("Test Sans");
  });

  test("renders Remotion compositions through default and registry-miss paths", async () => {
    currentFrame = 120;
    mockRemotion();
    const { StoryRemotionComposition } = await import("./remotion");
    const { rerender } = render(
      <StoryRemotionComposition
        story={remotionStory}
        routeChoiceIds={["left"]}
        layout={{ fps: undefined }}
      />,
    );

    expect(screen.getByText("Start scene")).toBeTruthy();
    expect(screen.getByText("Left scene")).toBeTruthy();
    expect(screen.getAllByTestId("sequence")[0]?.dataset.from).toBe("0");
    expect(screen.getAllByTestId("sequence")[0]?.dataset.duration).toBe("90");

    rerender(
      <StoryRemotionComposition
        story={remotionStory}
        routeChoiceIds={["right"]}
        registry={{ remotion: { other: () => <div>Other renderer</div> } }}
      />,
    );

    expect(screen.getByText("Right scene")).toBeTruthy();
    expect(screen.queryByText("Other renderer")).toBeNull();
  });
});
