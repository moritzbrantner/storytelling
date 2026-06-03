import { useMemo, useState } from "react";
import {
  StoryPlayer,
  defineStory,
  validateStoryDocument,
  type StoryDocument,
  type StoryNode,
} from "@moritzbrantner/storytelling";
import {
  applyTimelineTimingsToStory,
  storyToTimelineEditorDocument,
  type StoryTimelineItemData,
} from "@moritzbrantner/storytelling/timeline";
import {
  TimelineEditor,
  type TimelineEditorDocument,
  type TimelineEditorItemRenderContext,
  type TimelineEditorSelection,
  type TimelineEditorViewport,
} from "@moritzbrantner/timeline-editor";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from "@moritzbrantner/ui";

import { storyRegistry, type SignalStoryData } from "./story";

type StoryCreatorPageProps = {
  onOpenLab: () => void;
};

type CreatorStory = StoryDocument<SignalStoryData>;
type CreatorNode = StoryNode<SignalStoryData>;
type CreatorTimelineDocument = TimelineEditorDocument<
  Record<string, unknown>,
  StoryTimelineItemData<SignalStoryData>
>;

const creatorFps = 30;
const creatorTones: SignalStoryData["tone"][] = ["cyan", "amber", "green", "rose"];

const starterImages = [
  "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80",
];

function createCreatorNode(index: number, partial: Partial<CreatorNode> = {}): CreatorNode {
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

function normalizeLinearNodes(nodes: CreatorNode[]) {
  return nodes.map((node, index) => {
    const nextNode = nodes[index + 1];

    return {
      ...node,
      next: nextNode?.id,
      choices: undefined,
    };
  });
}

function createStarterStory(): CreatorStory {
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

function getNodeBody(node: CreatorNode) {
  const paragraph = node.content?.find((block) => block.type === "paragraph");

  return paragraph?.text ?? "";
}

function updateNodeBody(node: CreatorNode, text: string): CreatorNode {
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

function makeUniqueNodeId(nodes: CreatorNode[]) {
  const usedIds = new Set(nodes.map((node) => node.id));
  let index = nodes.length + 1;
  let id = `scene-${index}`;

  while (usedIds.has(id)) {
    index += 1;
    id = `scene-${index}`;
  }

  return id;
}

function createTimelineDocument(story: CreatorStory): CreatorTimelineDocument {
  return storyToTimelineEditorDocument(story, {
    fps: creatorFps,
    includeBranchMarkers: true,
    trackLabel: "Story beats",
  }) as CreatorTimelineDocument;
}

function getItemIdForNode(nodeId: string) {
  return `story-scene-${nodeId}`;
}

function findNodeIdForSelection(
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

function StoryTimelineItem({
  item,
  selected,
}: TimelineEditorItemRenderContext<StoryTimelineItemData<SignalStoryData>>) {
  const seconds = Math.max(0.1, item.durationMs / 1000);

  return (
    <div className="story-creator-timeline-item" data-selected={selected ? "true" : undefined}>
      <strong>{item.label}</strong>
      <span>{seconds.toFixed(1)}s</span>
    </div>
  );
}

export function StoryCreatorPage({ onOpenLab }: StoryCreatorPageProps) {
  const [story, setStory] = useState<CreatorStory>(() => createStarterStory());
  const [timelineDocument, setTimelineDocument] = useState<CreatorTimelineDocument>(() =>
    createTimelineDocument(createStarterStory()),
  );
  const [selection, setSelection] = useState<TimelineEditorSelection>({
    itemIds: [getItemIdForNode("opening")],
  });
  const [viewport, setViewport] = useState<TimelineEditorViewport>({
    pixelsPerSecond: 62,
  });
  const [selectedNodeId, setSelectedNodeId] = useState("opening");
  const selectedNode = story.nodes.find((node) => node.id === selectedNodeId) ?? story.nodes[0]!;
  const selectedIndex = story.nodes.findIndex((node) => node.id === selectedNode.id);
  const validationIssues = useMemo(() => validateStoryDocument(story), [story]);
  const isStoryValid = validationIssues.length === 0;
  const storyJson = useMemo(() => JSON.stringify(story, null, 2), [story]);
  const totalSeconds = Math.round((timelineDocument.durationMs ?? 0) / 100) / 10;

  const commitStory = (nextStory: CreatorStory) => {
    const timedStory = applyTimelineTimingsToStory(nextStory, timelineDocument, {
      fps: creatorFps,
    });
    const nextTimelineDocument = createTimelineDocument(timedStory);

    setStory(timedStory);
    setTimelineDocument(nextTimelineDocument);
  };

  const updateStoryMeta = (patch: Partial<Pick<CreatorStory, "title" | "subtitle">>) => {
    commitStory({
      ...story,
      ...patch,
    });
  };

  const updateSelectedNode = (updater: (node: CreatorNode) => CreatorNode) => {
    const nextNodes = story.nodes.map((node) =>
      node.id === selectedNode.id ? updater(node) : node,
    );

    commitStory({
      ...story,
      nodes: normalizeLinearNodes(nextNodes),
    });
  };

  const addScene = () => {
    const nextNodes = [
      ...story.nodes,
      createCreatorNode(story.nodes.length, { id: makeUniqueNodeId(story.nodes) }),
    ];
    const normalizedNodes = normalizeLinearNodes(nextNodes);
    const newNode = normalizedNodes[normalizedNodes.length - 1]!;

    commitStory({
      ...story,
      nodes: normalizedNodes,
    });
    setSelectedNodeId(newNode.id);
    setSelection({ itemIds: [getItemIdForNode(newNode.id)] });
  };

  const removeSelectedScene = () => {
    if (story.nodes.length <= 1) {
      return;
    }

    const nextNodes = normalizeLinearNodes(
      story.nodes.filter((node) => node.id !== selectedNode.id),
    );
    const fallbackNode = nextNodes[Math.max(0, selectedIndex - 1)] ?? nextNodes[0]!;

    commitStory({
      ...story,
      openingNodeId: nextNodes[0]!.id,
      nodes: nextNodes,
    });
    setSelectedNodeId(fallbackNode.id);
    setSelection({ itemIds: [getItemIdForNode(fallbackNode.id)] });
  };

  const moveSelectedScene = (direction: -1 | 1) => {
    const targetIndex = selectedIndex + direction;

    if (targetIndex < 0 || targetIndex >= story.nodes.length) {
      return;
    }

    const nextNodes = [...story.nodes];
    const [movedNode] = nextNodes.splice(selectedIndex, 1);
    nextNodes.splice(targetIndex, 0, movedNode!);
    const normalizedNodes = normalizeLinearNodes(nextNodes);

    commitStory({
      ...story,
      openingNodeId: normalizedNodes[0]!.id,
      nodes: normalizedNodes,
    });
  };

  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelection({ itemIds: [getItemIdForNode(nodeId)] });
  };

  const handleTimelineSelectionChange = (nextSelection: TimelineEditorSelection) => {
    setSelection(nextSelection);

    const nodeId = findNodeIdForSelection(timelineDocument, nextSelection);

    if (nodeId) {
      setSelectedNodeId(nodeId);
    }
  };

  const handleTimelineDocumentChange = (nextDocument: CreatorTimelineDocument) => {
    setTimelineDocument(nextDocument);
    setStory((currentStory) =>
      applyTimelineTimingsToStory(currentStory, nextDocument, {
        fps: creatorFps,
      }),
    );
  };

  return (
    <main className="min-h-screen bg-[#f6f7f8] text-[#17211f]">
      <div className="mx-auto grid w-full max-w-[1580px] gap-4 p-3 md:p-6">
        <header className="story-page-header" aria-labelledby="story-creator-title">
          <div>
            <Badge variant="outline" className="mb-3 border-[#17211f]/15 bg-white/70">
              Timeline editor
            </Badge>
            <h1 id="story-creator-title">Create your story</h1>
            <p>
              {story.nodes.length} scenes on a {totalSeconds.toFixed(1)}s timeline.
            </p>
          </div>

          <nav className="story-page-nav" aria-label="Example pages">
            <Button type="button" variant="ghost" onClick={onOpenLab}>
              Component lab
            </Button>
            <Button type="button" aria-current="page">
              Create story
            </Button>
          </nav>
        </header>

        <section className="story-creator-shell" aria-label="Story creator">
          <aside className="story-creator-panel" aria-label="Story outline">
            <div className="story-creator-panel-header">
              <Badge variant="outline">Outline</Badge>
              <Button type="button" size="sm" onClick={addScene}>
                Add scene
              </Button>
            </div>

            <div className="story-creator-fields">
              <label>
                <span>Story title</span>
                <Input
                  value={story.title}
                  onChange={(event) => updateStoryMeta({ title: event.currentTarget.value })}
                />
              </label>
              <label>
                <span>Subtitle</span>
                <Input
                  value={story.subtitle ?? ""}
                  onChange={(event) => updateStoryMeta({ subtitle: event.currentTarget.value })}
                />
              </label>
            </div>

            <ol className="story-creator-scenes">
              {story.nodes.map((node, index) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className={cn(
                      "story-creator-scene",
                      node.id === selectedNode.id && "is-active",
                    )}
                    onClick={() => selectNode(node.id)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{node.title}</strong>
                    <small>{node.eyebrow ?? "Scene"}</small>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <section className="story-creator-main" aria-label="Scene editor">
            <div className="story-creator-editor-card">
              <div className="story-creator-editor-header">
                <div>
                  <Badge variant="outline">Scene {selectedIndex + 1}</Badge>
                  <h2>{selectedNode.title}</h2>
                </div>

                <TooltipProvider>
                  <div className="story-creator-tools" aria-label="Scene tools">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => moveSelectedScene(-1)}
                          disabled={selectedIndex <= 0}
                        >
                          Up
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Move scene earlier</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => moveSelectedScene(1)}
                          disabled={selectedIndex >= story.nodes.length - 1}
                        >
                          Down
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Move scene later</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={removeSelectedScene}
                          disabled={story.nodes.length <= 1}
                        >
                          Delete
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete selected scene</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>

              <div className="story-creator-form">
                <label>
                  <span>Scene title</span>
                  <Input
                    value={selectedNode.title}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        title: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Eyebrow</span>
                  <Input
                    value={selectedNode.eyebrow ?? ""}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        eyebrow: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
                <label className="story-creator-form-wide">
                  <span>Story text</span>
                  <Textarea
                    rows={5}
                    value={getNodeBody(selectedNode)}
                    onChange={(event) =>
                      updateSelectedNode((node) => updateNodeBody(node, event.currentTarget.value))
                    }
                  />
                </label>
                <label className="story-creator-form-wide">
                  <span>Image URL</span>
                  <Input
                    value={selectedNode.data.imageSrc}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          imageSrc: event.currentTarget.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Location</span>
                  <Input
                    value={selectedNode.data.location}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          location: event.currentTarget.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Metric value</span>
                  <Input
                    value={selectedNode.data.metricValue}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          metricValue: event.currentTarget.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Tone</span>
                  <select
                    value={selectedNode.data.tone}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          tone: event.currentTarget.value as SignalStoryData["tone"],
                        },
                      }))
                    }
                  >
                    {creatorTones.map((tone) => (
                      <option key={tone} value={tone}>
                        {tone}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Intensity</span>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={selectedNode.data.intensity}
                    onChange={(event) => {
                      const intensity = Number(event.currentTarget.value);

                      updateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          intensity,
                          metricValue:
                            node.data.metricLabel === "Focus"
                              ? `${intensity}%`
                              : node.data.metricValue,
                        },
                      }));
                    }}
                  />
                </label>
              </div>
            </div>

            <Card className="story-creator-timeline-card">
              <CardHeader>
                <Badge variant="outline" className="w-fit">
                  Timing
                </Badge>
                <CardTitle>Drag or resize scenes</CardTitle>
              </CardHeader>
              <CardContent>
                <TimelineEditor
                  className="story-creator-timeline"
                  document={timelineDocument}
                  selection={selection}
                  viewport={viewport}
                  frameRate={creatorFps}
                  minItemDurationMs={500}
                  followCurrentTime="keep-visible"
                  onDocumentChange={handleTimelineDocumentChange}
                  onSelectionChange={handleTimelineSelectionChange}
                  onViewportChange={setViewport}
                  onCurrentTimeChange={(currentTimeMs) =>
                    setTimelineDocument((currentDocument) => ({
                      ...currentDocument,
                      currentTimeMs,
                    }))
                  }
                  renderItem={StoryTimelineItem}
                />
              </CardContent>
            </Card>
          </section>

          <aside className="story-creator-preview" aria-label="Preview and export">
            <div className="story-creator-preview-stage">
              <StoryPlayer
                key={storyJson}
                story={story}
                registry={storyRegistry}
                layout="stacked"
              />
            </div>

            <Card className="border-[#17211f]/15 bg-white/90">
              <CardHeader>
                <Badge variant="outline" className="w-fit">
                  Validation
                </Badge>
                <CardTitle>{isStoryValid ? "Ready story document" : "Needs edits"}</CardTitle>
              </CardHeader>
              <CardContent>
                {isStoryValid ? (
                  <p className="m-0 text-sm leading-6 text-[#2d3835]">
                    The generated document validates and can be used by the player, scroller,
                    Remotion, or timeline adapters.
                  </p>
                ) : (
                  <ul className="story-creator-issues">
                    {validationIssues.map((issue) => (
                      <li key={`${issue.code}-${issue.path}`}>
                        <strong>{issue.code}</strong>
                        <span>{issue.path}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#17211f]/15 bg-white/90">
              <CardHeader>
                <Badge variant="outline" className="w-fit">
                  Export
                </Badge>
                <CardTitle>Story JSON</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea className="story-creator-json" readOnly value={storyJson} />
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
