import type { StoryDocument, StoryNode, StoryNodeData, StoryNodeTreeEntry } from "./story-model";
import { compileStory, getStoryBranches, getStoryEndings } from "./story-graph";
import { buildStoryTimeline } from "./story-path";

export type StoryTimelineTrackData = {
  storyId: string;
};

export type StoryTimelineItemData<TData extends StoryNodeData = StoryNodeData> = {
  mediaType?: "story-node";
  nodeId: string;
  storyNode: StoryNode<TData>;
  nodeEntry?: StoryNodeTreeEntry<TData>;
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
  routeChoiceIds?: string[];
  fps?: number;
  trackId?: string;
  trackLabel?: string;
  includeBranchMarkers?: boolean;
};

export type ApplyTimelineTimingsOptions = {
  fps?: number;
};

const DEFAULT_STORY_TIMELINE_FPS = 30;

function resolveTimelineFps(fps: number | undefined) {
  const resolvedFps = fps ?? DEFAULT_STORY_TIMELINE_FPS;

  if (!Number.isFinite(resolvedFps) || resolvedFps <= 0) {
    throw new Error("Story timeline fps must be finite and greater than 0.");
  }

  return resolvedFps;
}

function framesToMs(frames: number, fps: number) {
  return (frames / fps) * 1000;
}

function msToFrames(ms: number, fps: number) {
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 1;

  return Math.max(1, Math.round((safeMs / 1000) * fps));
}

export function storyToTimelineEditorDocument<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: StoryToTimelineDocumentOptions = {},
): StoryTimelineDocument<TData> {
  const fps = resolveTimelineFps(options.fps);
  const timeline = buildStoryTimeline(story, {
    routeChoiceIds: options.routeChoiceIds,
    fps,
  });
  const trackId = options.trackId ?? "story-scenes";
  const branchNodeIds = new Set<string>();
  const endingNodeIds = new Set<string>();

  if (options.includeBranchMarkers) {
    const compiledStory = compileStory(story);

    for (const node of getStoryBranches(compiledStory)) {
      branchNodeIds.add(node.id);
    }

    for (const node of getStoryEndings(compiledStory)) {
      endingNodeIds.add(node.id);
    }
  }

  const sceneMarkers = timeline.scenes.map((scene) => ({
    id: `story-marker-${scene.node.id}`,
    timeMs: framesToMs(scene.startFrame, timeline.fps),
    label: scene.node.title,
  }));
  const branchMarkers = options.includeBranchMarkers
    ? timeline.scenes.flatMap((scene) => {
        const markers: StoryTimelineMarker[] = [];
        const timeMs = framesToMs(scene.startFrame, timeline.fps);

        if (branchNodeIds.has(scene.node.id)) {
          markers.push({
            id: `story-branch-marker-${scene.node.id}`,
            timeMs,
            label: `Branch: ${scene.node.title}`,
          });
        }

        if (endingNodeIds.has(scene.node.id)) {
          markers.push({
            id: `story-ending-marker-${scene.node.id}`,
            timeMs,
            label: `Ending: ${scene.node.title}`,
          });
        }

        return markers;
      })
    : [];

  return {
    durationMs: framesToMs(timeline.totalFrames, timeline.fps),
    currentTimeMs: 0,
    markers: [...sceneMarkers, ...branchMarkers],
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
            nodeEntry: scene.nodeEntry,
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
  const fps = resolveTimelineFps(options.fps);
  const durationByNodeId = new Map<string, number>();

  for (const track of document.tracks) {
    for (const item of track.items) {
      const nodeId = item.data?.nodeId;

      if (nodeId) {
        durationByNodeId.set(nodeId, msToFrames(item.durationMs, fps));
      }
    }
  }

  const applyDurations = (nodes: StoryNode<TData>[]): StoryNode<TData>[] =>
    nodes.map((node) => ({
      ...node,
      durationInFrames: durationByNodeId.get(node.id) ?? node.durationInFrames,
      children: node.children ? applyDurations(node.children) : undefined,
    }));

  return {
    ...story,
    nodes: applyDurations(story.nodes),
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
