import { Composition } from "remotion";
import {
  StoryRemotionComposition,
  getStoryCompositionProps,
  type StoryRemotionCompositionProps,
} from "@moritzbrantner/storytelling/remotion";

import type { SignalStoryData } from "../src/story";
import { storyVideo } from "./story-video";

const composition = getStoryCompositionProps(storyVideo.story, {
  id: "observatory-relay",
  routeChoiceIds: storyVideo.routeChoiceIds,
  fps: 30,
  width: 1920,
  height: 1080,
});

function StoryVideoComposition(props: StoryRemotionCompositionProps<SignalStoryData>) {
  return <StoryRemotionComposition {...props} registry={storyVideo.registry} />;
}

export function RemotionRoot() {
  return <Composition {...composition} component={StoryVideoComposition} />;
}
