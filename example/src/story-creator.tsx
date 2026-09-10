import { useMemo, useState } from "react";
import { StoryPlayer, validateStoryDocument } from "@moritzbrantner/storytelling";
import {
  applyTimelineTimingsToStory,
  type StoryTimelineItemData,
} from "@moritzbrantner/storytelling/timeline";
import {
  TimelineEditor,
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
} from "./ui";

import { storyRegistry, type SignalStoryData } from "./story";
import {
  createCreatorNode,
  createStarterStory,
  createTimelineDocument,
  creatorFps,
  creatorTones,
  findNodeIdForSelection,
  getItemIdForNode,
  getNodeBody,
  makeUniqueNodeId,
  normalizeLinearNodes,
  updateNodeBody,
  type CreatorNode,
  type CreatorStory,
  type CreatorTimelineDocument,
} from "./story-creator-model";

type StoryCreatorPageProps = {
  onOpenLab: () => void;
};

function StoryTimelineItem({
  item,
  selected,
}: TimelineEditorItemRenderContext<StoryTimelineItemData<SignalStoryData>>) {
  const seconds = Math.max(0.1, item.durationMs / 1000);

  return (
    <div
      className="grid h-full content-center gap-0.5 overflow-hidden rounded-md bg-[linear-gradient(135deg,#0a7c6f,#be5034)] px-2 py-1 text-white data-[selected=true]:outline data-[selected=true]:outline-2 data-[selected=true]:-outline-offset-2 data-[selected=true]:outline-[#111817]"
      data-selected={selected ? "true" : undefined}
    >
      <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-tight">
        {item.label}
      </strong>
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs opacity-80">
        {seconds.toFixed(1)}s
      </span>
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
        <header
          className="grid items-end gap-4 border-b border-[#17211f]/10 pb-4 min-[760px]:grid-cols-[minmax(0,1fr)_auto]"
          aria-labelledby="story-creator-title"
        >
          <div>
            <Badge variant="outline" className="mb-3 border-[#17211f]/15 bg-white/70">
              Timeline editor
            </Badge>
            <h1
              id="story-creator-title"
              className="m-0 max-w-[10ch] text-[clamp(3rem,8vw,6rem)] font-bold leading-[0.92] tracking-normal text-[#111817]"
            >
              Create your story
            </h1>
            <p className="m-0 mt-4 text-base leading-relaxed text-[#3d4a46]">
              {story.nodes.length} scenes on a {totalSeconds.toFixed(1)}s timeline.
            </p>
          </div>

          <nav
            className="flex w-fit max-w-full flex-wrap justify-start gap-1 rounded-lg border border-[#17211f]/15 bg-white/80 p-1 shadow-[0_10px_24px_rgba(23,33,31,0.06)]"
            aria-label="Example pages"
          >
            <Button type="button" variant="ghost" onClick={onOpenLab}>
              Component lab
            </Button>
            <Button type="button" aria-current="page">
              Create story
            </Button>
          </nav>
        </header>

        <section
          className="grid items-start gap-4 min-[1180px]:grid-cols-[minmax(16rem,20rem)_minmax(0,1.25fr)_minmax(19rem,0.8fr)]"
          aria-label="Story creator"
        >
          <aside
            className="grid gap-4 rounded-lg border border-[#17211f]/15 bg-white/90 p-4 shadow-[0_16px_36px_rgba(23,33,31,0.08)] min-[1180px]:sticky min-[1180px]:top-4"
            aria-label="Story outline"
          >
            <div className="flex items-start justify-between gap-3">
              <Badge variant="outline">Outline</Badge>
              <Button type="button" size="sm" onClick={addScene}>
                Add scene
              </Button>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#4a5753]">
                  Story title
                </span>
                <Input
                  value={story.title}
                  onChange={(event) => updateStoryMeta({ title: event.currentTarget.value })}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#4a5753]">
                  Subtitle
                </span>
                <Input
                  value={story.subtitle ?? ""}
                  onChange={(event) => updateStoryMeta({ subtitle: event.currentTarget.value })}
                />
              </label>
            </div>

            <ol className="m-0 grid list-none gap-2 p-0 min-[1180px]:grid-cols-1 max-[1179px]:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]">
              {story.nodes.map((node, index) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className={cn(
                      "grid w-full cursor-pointer grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-0.5 rounded-lg border border-[#17211f]/10 bg-white p-3 text-left text-[#17211f] hover:border-[#0a7c6f]/45 hover:shadow-[0_10px_24px_rgba(23,33,31,0.08)]",
                      node.id === selectedNode.id &&
                        "border-[#0a7c6f]/45 shadow-[0_10px_24px_rgba(23,33,31,0.08)]",
                    )}
                    onClick={() => selectNode(node.id)}
                  >
                    <span className="text-xs font-extrabold text-[#0a7c6f]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <strong className="min-w-0 text-sm [overflow-wrap:anywhere]">
                      {node.title}
                    </strong>
                    <small className="col-start-2 text-xs text-[#66726e]">
                      {node.eyebrow ?? "Scene"}
                    </small>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <section className="grid gap-4" aria-label="Scene editor">
            <div className="grid gap-4 rounded-lg border border-[#17211f]/15 bg-white/90 p-4 shadow-[0_16px_36px_rgba(23,33,31,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant="outline">Scene {selectedIndex + 1}</Badge>
                  <h2 className="m-0 mt-2 max-w-[16ch] text-[clamp(1.6rem,3vw,2.5rem)] leading-none tracking-normal text-[#111817]">
                    {selectedNode.title}
                  </h2>
                </div>

                <TooltipProvider>
                  <div className="flex flex-wrap justify-end gap-1" aria-label="Scene tools">
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

              <div className="grid gap-3 min-[760px]:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#4a5753]">
                    Scene title
                  </span>
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
                <label className="grid gap-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#4a5753]">
                    Eyebrow
                  </span>
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
                <label className="grid gap-1.5 min-[760px]:col-span-2">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#4a5753]">
                    Story text
                  </span>
                  <Textarea
                    rows={5}
                    value={getNodeBody(selectedNode)}
                    onChange={(event) =>
                      updateSelectedNode((node) => updateNodeBody(node, event.currentTarget.value))
                    }
                  />
                </label>
                <label className="grid gap-1.5 min-[760px]:col-span-2">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#4a5753]">
                    Image URL
                  </span>
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
                <label className="grid gap-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#4a5753]">
                    Location
                  </span>
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
                <label className="grid gap-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#4a5753]">
                    Metric value
                  </span>
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
                <label className="grid gap-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#4a5753]">
                    Tone
                  </span>
                  <select
                    className="min-h-10 w-full rounded-lg border border-[#17211f]/15 bg-white px-3 text-[#17211f]"
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
                <label className="grid gap-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#4a5753]">
                    Intensity
                  </span>
                  <input
                    className="min-h-10"
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

            <Card className="rounded-lg border-[#17211f]/15 bg-white/90 shadow-[0_16px_36px_rgba(23,33,31,0.08)] [&_.card-content]:pt-0">
              <CardHeader>
                <Badge variant="outline" className="w-fit">
                  Timing
                </Badge>
                <CardTitle>Drag or resize scenes</CardTitle>
              </CardHeader>
              <CardContent>
                <TimelineEditor
                  className="min-h-64 overflow-hidden rounded-lg border border-[#17211f]/10 bg-[#f9faf9]"
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

          <aside className="grid gap-4" aria-label="Preview and export">
            <div className="overflow-hidden rounded-lg border border-[#17211f]/15 bg-white/90 shadow-[0_16px_36px_rgba(23,33,31,0.08)] [&_.demo-stage]:min-h-[32rem] [&_.demo-stage>div:nth-of-type(3)]:grid-cols-1 [&_.demo-stage>div:nth-of-type(3)]:gap-4 [&_.demo-stage>div:nth-of-type(3)]:p-4 [&_.demo-stage>div:nth-of-type(3)]:pb-16 [&_.demo-stage_h2]:max-w-[7ch] [&_.demo-stage_h2]:text-[clamp(2.45rem,4vw,3.6rem)] [&_.demo-stage_h2]:leading-[0.95] [&_.demo-stage_section]:min-h-[32rem] [&_.demo-stage_section]:border-0">
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
                  <ul className="m-0 grid list-none gap-2 p-0">
                    {validationIssues.map((issue) => (
                      <li key={`${issue.code}-${issue.path}`} className="grid gap-1">
                        <strong className="text-sm text-[#be5034]">{issue.code}</strong>
                        <span className="text-sm text-[#4a5753]">{issue.path}</span>
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
                <Textarea
                  className="min-h-64 font-mono text-xs leading-relaxed"
                  readOnly
                  value={storyJson}
                />
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
