import {
  StoryVideoFile,
  formatSubtitleTime,
  parseSubtitleText,
} from "@moritzbrantner/storytelling/media";
import { getStoryCompositionProps } from "@moritzbrantner/storytelling/remotion";
import { storyDocumentJsonSchema } from "@moritzbrantner/storytelling/schema";
import { StoryCanvasStage } from "@moritzbrantner/storytelling/three";
import {
  createStoryTimelineExtension,
  storyToTimelineEditorDocument,
} from "@moritzbrantner/storytelling/timeline";
import {
  createStoryWorkflowNodeTemplates,
  storyToWorkflowDocument,
} from "@moritzbrantner/storytelling/workflow";
import type { ComponentProps } from "react";

import type { StoryDocument } from "@moritzbrantner/storytelling/core";

const story: StoryDocument = {
  id: "subpaths",
  title: "Subpaths",
  openingNodeId: "start",
  nodes: [{ id: "start", title: "Start" }],
};

const composition = getStoryCompositionProps(story);
const workflowDocument = storyToWorkflowDocument(story);
const timelineDocument = storyToTimelineEditorDocument(story);
const extension = createStoryTimelineExtension();
const templates = createStoryWorkflowNodeTemplates();
const cues = parseSubtitleText("00:00:00.000 --> 00:00:01.000\nHello");
const subtitleTime: string = formatSubtitleTime(1.2);
const videoProps: ComponentProps<typeof StoryVideoFile> = { src: "/video.mp4" };
const canvasStage: typeof StoryCanvasStage = StoryCanvasStage;

void storyDocumentJsonSchema.properties.nodes;
void composition.durationInFrames;
void workflowDocument.nodes;
void timelineDocument.tracks;
void extension.createItemData;
void templates[0]?.kind;
void cues;
void subtitleTime;
void videoProps;
void canvasStage;
