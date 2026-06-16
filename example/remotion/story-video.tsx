import {
  createStoryRendererRegistry,
  type StoryRendererRegistry,
} from "@moritzbrantner/storytelling";
import {
  StoryRemotionSceneFrame,
  type StoryRemotionSceneProps,
} from "@moritzbrantner/storytelling/remotion";

import { signalStory, type SignalStoryData } from "../src/story";

function SignalRemotionScene(props: StoryRemotionSceneProps<SignalStoryData>) {
  const accent = props.node.stage?.props?.accent;
  const theme =
    typeof accent === "string"
      ? { accent, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }
      : { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" };

  return <StoryRemotionSceneFrame {...props} theme={theme} />;
}

export const remotionRegistry: StoryRendererRegistry<SignalStoryData> =
  createStoryRendererRegistry<SignalStoryData>({
    remotion: {
      "signal-stage": SignalRemotionScene,
    },
  });

export const storyVideo = {
  story: signalStory,
  routeChoiceIds: ["answer"],
  registry: remotionRegistry,
};
