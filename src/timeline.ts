import type { StoryDocument, StoryNode, StoryNodeData } from "./story-model";
import { buildStoryTimeline } from "./story-path";

export type StoryTimelineTrackData = {
  storyId: string;
};

export type StoryTimelineItemData<TData extends StoryNodeData = StoryNodeData> = {
  mediaType?: "story-node";
  nodeId: string;
  storyNode: StoryNode<TData>;
  pathIndex: number;
};

export type StoryTimelineItem<TData extends StoryNodeData = StoryNodeData> = {
  id: string;
  trackId: string;
  label: string;
  startMs: number;
  durationMs: number;
  kind?: string;
  color?: string;
  data?: StoryTimelineItemData<TData>;
};

export type StoryTimelineTrack<TData extends StoryNodeData = StoryNodeData> = {
  id: string;
  label: string;
  kind?: string;
  acceptsItemKinds?: string[];
  items: Array<StoryTimelineItem<TData>>;
  data?: StoryTimelineTrackData;
};

export type StoryTimelineMarker = {
  id: string;
  timeMs: number;
  label?: string;
  color?: string;
};

export type StoryTimelineDocument<TData extends StoryNodeData = StoryNodeData> = {
  tracks: Array<StoryTimelineTrack<TData>>;
  durationMs?: number;
  currentTimeMs?: number;
  markers?: StoryTimelineMarker[];
};

export type StoryTimelineWorkbenchExtension<TData extends StoryNodeData = StoryNodeData> = {
  id: "storytelling";
  label: string;
  itemKinds: ["story-node"];
  mediaTypes: ["story-node"];
  createItemData: (node: StoryNode<TData>, pathIndex: number) => StoryTimelineItemData<TData>;
};

export type StoryToTimelineDocumentOptions = {
  choiceIds?: string[];
  fps?: number;
  trackId?: string;
  trackLabel?: string;
};

export type ApplyTimelineTimingsOptions = {
  fps?: number;
};

const DEFAULT_STORY_TIMELINE_FPS = 30;

function framesToMs(frames: number, fps: number) {
  return (frames / fps) * 1000;
}

function msToFrames(ms: number, fps: number) {
  return Math.max(1, Math.round((ms / 1000) * fps));
}

export function storyToTimelineEditorDocument<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: StoryToTimelineDocumentOptions = {},
): StoryTimelineDocument<TData> {
  const fps = options.fps ?? DEFAULT_STORY_TIMELINE_FPS;
  const timeline = buildStoryTimeline(story, {
    choiceIds: options.choiceIds,
    fps,
  });
  const trackId = options.trackId ?? "story-scenes";

  return {
    durationMs: framesToMs(timeline.totalFrames, timeline.fps),
    currentTimeMs: 0,
    markers: timeline.scenes.map((scene) => ({
      id: `story-marker-${scene.node.id}`,
      timeMs: framesToMs(scene.startFrame, timeline.fps),
      label: scene.node.title,
    })),
    tracks: [
      {
        id: trackId,
        label: options.trackLabel ?? "Story scenes",
        kind: "story-node",
        acceptsItemKinds: ["story-node"],
        data: { storyId: story.id },
        items: timeline.scenes.map((scene) => ({
          id: `story-scene-${scene.node.id}`,
          trackId,
          label: scene.node.title,
          startMs: framesToMs(scene.startFrame, timeline.fps),
          durationMs: framesToMs(scene.durationInFrames, timeline.fps),
          kind: "story-node",
          data: {
            mediaType: "story-node",
            nodeId: scene.node.id,
            storyNode: scene.node,
            pathIndex: scene.pathIndex,
          },
        })),
      },
    ],
  };
}

export function applyTimelineTimingsToStory<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  document: StoryTimelineDocument<TData>,
  options: ApplyTimelineTimingsOptions = {},
): StoryDocument<TData> {
  const fps = options.fps ?? DEFAULT_STORY_TIMELINE_FPS;
  const durationByNodeId = new Map<string, number>();

  for (const track of document.tracks) {
    for (const item of track.items) {
      const nodeId = item.data?.nodeId;

      if (nodeId) {
        durationByNodeId.set(nodeId, msToFrames(item.durationMs, fps));
      }
    }
  }

  return {
    ...story,
    nodes: story.nodes.map((node) => ({
      ...node,
      durationInFrames: durationByNodeId.get(node.id) ?? node.durationInFrames,
    })),
  };
}

export function createStoryTimelineExtension<
  TData extends StoryNodeData = StoryNodeData,
>(): StoryTimelineWorkbenchExtension<TData> {
  return {
    id: "storytelling",
    label: "Storytelling",
    itemKinds: ["story-node"],
    mediaTypes: ["story-node"],
    createItemData: (node, pathIndex) => ({
      mediaType: "story-node",
      nodeId: node.id,
      storyNode: node,
      pathIndex,
    }),
  };
}
