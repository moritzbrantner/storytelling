import { defineStory, type StoryDocument, type StoryNode } from "@moritzbrantner/storytelling";
import {
  storyToTimelineEditorDocument,
  type StoryTimelineItemData,
} from "@moritzbrantner/storytelling/timeline";
import type {
  TimelineEditorDocument,
  TimelineEditorSelection,
} from "@moritzbrantner/timeline-editor";

import type { SignalStoryData } from "./story";

export type CreatorStory = StoryDocument<SignalStoryData>;
export type CreatorNode = StoryNode<SignalStoryData>;
export type CreatorTimelineDocument = TimelineEditorDocument<
  Record<string, unknown>,
  StoryTimelineItemData<SignalStoryData>
>;

export const creatorFps = 30;
export const creatorTones: SignalStoryData["tone"][] = ["cyan", "amber", "green", "rose"];

const starterImages = [
  "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80",
];

export function createCreatorNode(index: number, partial: Partial<CreatorNode> = {}): CreatorNode {
  const id = partial.id ?? `scene-${index + 1}`;
  const tone = creatorTones[index % creatorTones.length]!;

  return {
    ...partial,
    id,
    title: partial.title ?? `Scene ${index + 1}`,
    eyebrow: partial.eyebrow ?? `Beat ${String(index + 1).padStart(2, "0")}`,
    stage: partial.stage ?? { renderer: "signal-stage" },
    durationInFrames: partial.durationInFrames ?? 120,
    data: {
      channel: `Draft ${index + 1}`,
      imageAlt: `Scene ${index + 1} image`,
      imageSrc: starterImages[index % starterImages.length]!,
      intensity: 64,
      location: "Story world",
      metricLabel: "Focus",
      metricValue: "64%",
      tone,
      ...partial.data,
    },
    content: partial.content ?? [
      {
        type: "paragraph",
        text: "Write what happens in this part of the story.",
      },
    ],
  };
}

export function normalizeLinearNodes(nodes: CreatorNode[]) {
  return nodes.map((node, index) => {
    const nextNode = nodes[index + 1];

    return {
      ...node,
      next: nextNode?.id,
      choices: undefined,
    };
  });
}

export function createStarterStory(): CreatorStory {
  const nodes = normalizeLinearNodes([
    createCreatorNode(0, {
      id: "opening",
      title: "Opening signal",
      eyebrow: "Start",
      data: {
        channel: "Draft 1",
        imageAlt: "A mountain observatory under a star field",
        location: "North Ridge",
        metricLabel: "Signal",
        metricValue: "64%",
        tone: "cyan",
      },
      content: [{ type: "paragraph", text: "A quiet night breaks when a new signal appears." }],
    }),
    createCreatorNode(1, {
      id: "turning-point",
      title: "Turning point",
      eyebrow: "Middle",
      data: {
        channel: "Draft 2",
        location: "Hidden harbor",
        metricLabel: "Pressure",
        metricValue: "78%",
        tone: "amber",
      },
      content: [{ type: "paragraph", text: "The clue leads somewhere nobody expected." }],
    }),
    createCreatorNode(2, {
      id: "resolution",
      title: "Resolution",
      eyebrow: "End",
      data: {
        channel: "Draft 3",
        location: "Relay room",
        metricLabel: "Clarity",
        metricValue: "91%",
        tone: "green",
      },
      content: [{ type: "paragraph", text: "The final choice turns the signal into a path." }],
    }),
  ]);

  return defineStory<SignalStoryData>({
    id: "custom-story",
    title: "Custom Story",
    subtitle: "Timeline-authored draft",
    openingNodeId: nodes[0]!.id,
    labels: {
      choosePrompt: "Choose the next move.",
      completedBranch: "This story is complete.",
      continue: "Continue",
      restart: "Restart",
      scrollerLabel: "Custom story",
    },
    defaults: {
      durationInFrames: 120,
      transitionInFrames: 16,
    },
    nodes,
  });
}

export function getNodeBody(node: CreatorNode) {
  const paragraph = node.content?.find((block) => block.type === "paragraph");

  return paragraph?.text ?? "";
}

export function updateNodeBody(node: CreatorNode, text: string): CreatorNode {
  const nextContent = [...(node.content ?? [])];
  const paragraphIndex = nextContent.findIndex((block) => block.type === "paragraph");

  if (paragraphIndex >= 0) {
    nextContent[paragraphIndex] = { type: "paragraph", text };
  } else {
    nextContent.unshift({ type: "paragraph", text });
  }

  return {
    ...node,
    content: nextContent,
  };
}

export function makeUniqueNodeId(nodes: CreatorNode[]) {
  const usedIds = new Set(nodes.map((node) => node.id));
  let index = nodes.length + 1;
  let id = `scene-${index}`;

  while (usedIds.has(id)) {
    index += 1;
    id = `scene-${index}`;
  }

  return id;
}

export function createTimelineDocument(story: CreatorStory): CreatorTimelineDocument {
  return storyToTimelineEditorDocument(story, {
    fps: creatorFps,
    includeBranchMarkers: true,
    trackLabel: "Story beats",
  }) as CreatorTimelineDocument;
}

export function getItemIdForNode(nodeId: string) {
  return `story-scene-${nodeId}`;
}

export function findNodeIdForSelection(
  document: CreatorTimelineDocument,
  selection: TimelineEditorSelection,
) {
  const selectedItemId = selection.itemIds[0];

  if (!selectedItemId) {
    return undefined;
  }

  return document.tracks.flatMap((track) => track.items).find((item) => item.id === selectedItemId)
    ?.data?.nodeId;
}
