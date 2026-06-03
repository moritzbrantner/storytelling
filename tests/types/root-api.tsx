import type { ReactNode } from "react";

import {
  StoryPlayer,
  StoryScroller,
  defineStory,
  useStoryScroller,
  useStoryScrollerController,
  useStoryScrollerScene,
  type StoryChoicePanelRenderProps,
  type StoryContentBlock,
  type StoryScrollerController,
  type StoryScrollerSceneItem,
  type StoryDocument,
  type StoryRenderProps,
  type StoryScrollSceneRenderProps,
} from "@moritzbrantner/storytelling";

type SceneData = {
  tone: "quiet" | "urgent";
};

const story = defineStory<SceneData>({
  id: "types-root",
  title: "Types Root",
  openingNodeId: "start",
  nodes: [
    {
      id: "start",
      title: "Start",
      data: { tone: "quiet" },
      choices: [{ id: "go", label: "Go", target: "end" }],
    },
    {
      id: "end",
      title: "End",
      data: { tone: "urgent" },
    },
  ],
});

const assignedStory: StoryDocument<SceneData> = story;

function renderStage(props: StoryRenderProps<SceneData>): ReactNode {
  const tone: "quiet" | "urgent" | undefined = props.node.data?.tone;

  return <div>{tone}</div>;
}

function renderChoicePanel(props: StoryChoicePanelRenderProps<SceneData>): ReactNode {
  props.choose(props.choices[0]?.id ?? "go");

  return <div>{props.node.data?.tone}</div>;
}

function renderControls(props: StoryRenderProps<SceneData>): ReactNode {
  return <div>{props.choices.map((choice) => choice.label).join(",")}</div>;
}

function renderScrollerScene(
  props: StoryRenderProps<SceneData> & StoryScrollSceneRenderProps,
): ReactNode {
  const progress: number = props.progress;

  return <div>{progress + (props.node.data?.tone === "urgent" ? 1 : 0)}</div>;
}

function ScrollerProbe() {
  const scroller = useStoryScroller<SceneData>();
  const firstItem: StoryScrollerSceneItem<SceneData> | undefined = scroller.items[0];

  return <p>{firstItem?.title ?? scroller.mode}</p>;
}

function SceneProbe() {
  const scene = useStoryScrollerScene<SceneData>();

  return <p>{scene.storyRenderProps?.node.data?.tone}</p>;
}

function CompoundScrollerFixture() {
  const controller: StoryScrollerController<SceneData> = useStoryScrollerController<SceneData>({
    story,
  });

  return (
    <StoryScroller.Root controller={controller}>
      <StoryScroller.Layout className="grid">
        <ScrollerProbe />
        <StoryScroller.Canvas>
          <StoryScroller.Stage render={renderScrollerScene} />
          <StoryScroller.Overlays renderChoicePanel={renderChoicePanel} />
          <SceneProbe />
        </StoryScroller.Canvas>
        <StoryScroller.Menu />
        <StoryScroller.Minimap />
      </StoryScroller.Layout>
    </StoryScroller.Root>
  );
}

function renderBlock(block: StoryContentBlock): ReactNode {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "quote":
      return block.text;
    case "list":
      return block.items.join(",");
    case "image":
      return block.alt;
    case "audio":
    case "video":
      return block.src;
  }
}

export function RootApiFixture() {
  return (
    <>
      <StoryPlayer
        story={assignedStory}
        renderStage={renderStage}
        slots={{ controls: renderControls }}
      />
      <StoryScroller
        story={story}
        renderScene={renderScrollerScene}
        renderChoicePanel={renderChoicePanel}
      />
      <CompoundScrollerFixture />
      {renderBlock({ type: "paragraph", text: "hello" })}
    </>
  );
}
