import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  StoryMinimap,
  StoryPlayer,
  StoryScroller,
  resolveStoryPath,
  type StoryHistoryEntry,
} from "@moritzbrantner/storytelling";
import { analyzeStory, applyStoryPatch } from "@moritzbrantner/storytelling/core";
import { storyDocumentJsonSchema } from "@moritzbrantner/storytelling/schema";

import {
  authoringDraftStory,
  autoscrollLabScenes,
  motionLabScenes,
  signalStoryHooks,
  storyRegistry,
  type SignalStoryData,
} from "./story";
import {
  exampleCatalog,
  getAutoscrollPaceLabel,
  getDefaultPresetId,
  getExampleCatalog,
  getHistorySummary,
  getSceneSummary,
  getStoryScrollerPageId,
  getTransitionSummary,
  storyOptionsFallback,
  type ExampleMode,
  type ExamplePage,
  type ExampleStoryId,
} from "./example-catalog";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingState,
  ToggleGroup,
  ToggleGroupItem,
  cn,
} from "@moritzbrantner/ui";
import { StoryCreatorPage } from "./story-creator";

function StateSummary({ summary }: { summary: string }) {
  return <pre className="m-0 whitespace-pre-wrap text-sm leading-7 text-[#2d3835]">{summary}</pre>;
}

function getFixPatches(report: ReturnType<typeof analyzeStory<SignalStoryData>>) {
  return report.issues.flatMap((issue) => issue.fixes?.flatMap((fix) => fix.patch) ?? []);
}

function AuthoringWorkbench() {
  const [fixesApplied, setFixesApplied] = useState(false);
  const report = useMemo(() => analyzeStory(authoringDraftStory, { includeFixes: true }), []);
  const suggestedPatches = useMemo(() => getFixPatches(report), [report]);
  const patchedStory = useMemo(
    () =>
      fixesApplied
        ? applyStoryPatch(authoringDraftStory, suggestedPatches, { onMissing: "ignore" })
        : authoringDraftStory,
    [fixesApplied, suggestedPatches],
  );
  const patchedReport = useMemo(
    () => analyzeStory(patchedStory, { includeFixes: true }),
    [patchedStory],
  );
  const schemaProperties = Object.keys(
    (storyDocumentJsonSchema.properties ?? {}) as Record<string, unknown>,
  );
  const fixableIssues = report.issues.filter((issue) => (issue.fixes?.length ?? 0) > 0);

  return (
    <section
      className="grid min-h-[clamp(34rem,70vw,48rem)] gap-4 rounded-lg border border-white/25 bg-[linear-gradient(135deg,rgba(86,213,196,0.22),transparent_34%),linear-gradient(315deg,rgba(239,139,114,0.2),transparent_38%),#101615] p-[clamp(1rem,3vw,2rem)] text-white"
      aria-label="Authoring workbench"
    >
      <div className="grid min-h-72 content-end gap-6">
        <div>
          <Badge variant="outline" className="mb-3 border-white/25 bg-white/10 text-white">
            Core export
          </Badge>
          <h2 className="m-0 max-w-[10ch] text-[clamp(3rem,9vw,7rem)] leading-[0.88] tracking-normal">
            Authoring draft review
          </h2>
          <p className="m-0 mt-5 max-w-[44rem] text-[clamp(1rem,1.6vw,1.15rem)] leading-relaxed text-white/75">
            This view imports analysis and patch helpers from the server-safe core entrypoint, then
            applies deterministic fixes to a draft story.
          </p>
        </div>

        <div
          className="grid max-w-[38rem] gap-3 min-[760px]:grid-cols-3"
          aria-label="Authoring metrics"
        >
          <div className="grid gap-2 rounded-lg border border-white/15 bg-[#080c0c]/50 p-3 backdrop-blur-xl">
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/60">
              Issues
            </span>
            <strong className="text-3xl leading-none">{patchedReport.issues.length}</strong>
          </div>
          <div className="grid gap-2 rounded-lg border border-white/15 bg-[#080c0c]/50 p-3 backdrop-blur-xl">
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/60">
              Fixes
            </span>
            <strong className="text-3xl leading-none">{fixableIssues.length}</strong>
          </div>
          <div className="grid gap-2 rounded-lg border border-white/15 bg-[#080c0c]/50 p-3 backdrop-blur-xl">
            <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/60">
              Reachable
            </span>
            <strong className="text-3xl leading-none">
              {patchedReport.metrics.reachableNodeCount}/{patchedReport.metrics.nodeCount}
            </strong>
          </div>
        </div>

        <Button type="button" className="w-fit" onClick={() => setFixesApplied((value) => !value)}>
          {fixesApplied ? "Show original draft" : "Apply suggested fixes"}
        </Button>
      </div>

      <div className="grid items-stretch gap-3 min-[760px]:grid-cols-3">
        <div className="min-h-60 rounded-lg border border-white/15 bg-[#080c0c]/50 p-4 backdrop-blur-xl">
          <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/60">
            Diagnostics
          </span>
          <ul className="m-0 mt-4 grid list-none gap-3 p-0">
            {patchedReport.issues.slice(0, 6).map((issue) => (
              <li
                key={`${issue.code}-${issue.path}-${issue.nodeId ?? ""}`}
                className="grid gap-1 border-t border-white/10 pt-3"
              >
                <strong className="text-sm text-white">{issue.code}</strong>
                <small className="text-sm leading-6 text-white/65">
                  {issue.nodeId ?? issue.path}
                </small>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-h-60 rounded-lg border border-white/15 bg-[#080c0c]/50 p-4 backdrop-blur-xl">
          <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/60">
            Suggested patches
          </span>
          <ul className="m-0 mt-4 grid list-none gap-3 p-0">
            {fixableIssues.map((issue) => (
              <li
                key={`${issue.code}-${issue.path}-${issue.nodeId ?? ""}`}
                className="grid gap-1 border-t border-white/10 pt-3"
              >
                <strong className="text-sm text-white">{issue.fixes?.[0]?.label}</strong>
                <small className="text-sm leading-6 text-white/65">{issue.code}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-h-60 rounded-lg border border-white/15 bg-[#080c0c]/50 p-4 backdrop-blur-xl">
          <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/60">
            Schema export
          </span>
          <p className="m-0 mt-4 text-sm leading-6 text-white/65">
            `storyDocumentJsonSchema` covers {schemaProperties.length} top-level fields:
            {` ${schemaProperties.join(", ")}`}.
          </p>
        </div>
      </div>
    </section>
  );
}

function getExamplePageFromHash(): ExamplePage {
  return window.location.hash === "#create-story" ? "creator" : "lab";
}

function setExamplePageHash(page: ExamplePage) {
  window.location.hash = page === "creator" ? "create-story" : "";
}

function ExamplePageNav({
  activePage,
  onPageChange,
}: {
  activePage: ExamplePage;
  onPageChange: (page: ExamplePage) => void;
}) {
  return (
    <nav
      className="flex w-fit max-w-full flex-wrap justify-start gap-1 rounded-lg border border-[#17211f]/15 bg-white/80 p-1 shadow-[0_10px_24px_rgba(23,33,31,0.06)]"
      aria-label="Example pages"
    >
      <Button
        type="button"
        variant={activePage === "lab" ? "default" : "ghost"}
        aria-current={activePage === "lab" ? "page" : undefined}
        onClick={() => onPageChange("lab")}
      >
        Component lab
      </Button>
      <Button
        type="button"
        variant={activePage === "creator" ? "default" : "ghost"}
        aria-current={activePage === "creator" ? "page" : undefined}
        onClick={() => onPageChange("creator")}
      >
        Create story
      </Button>
    </nav>
  );
}

function ExampleLab({ onOpenCreator }: { onOpenCreator: () => void }) {
  const catalogQuery = useQuery({
    queryKey: ["storytelling-example-catalog"],
    queryFn: getExampleCatalog,
  });
  const [storyId, setStoryId] = useState<ExampleStoryId>("branching");
  const [mode, setMode] = useState<ExampleMode>("player");
  const [scrollerActiveIndex, setScrollerActiveIndex] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [history, setHistory] = useState<StoryHistoryEntry<SignalStoryData>[]>([]);
  const [presetId, setPresetId] = useState("opening");
  const catalog = catalogQuery.data ?? exampleCatalog;
  const storyOptions = catalog?.storyOptions ?? storyOptionsFallback;
  const exampleStories = catalog?.stories ?? [];
  const motionPresets = catalog?.motionPresets ?? [];
  const autoscrollPresets = catalog?.autoscrollPresets ?? [];
  const isMotionStory = storyId === "motion";
  const isAutoscrollStory = storyId === "autoscroll";
  const isAuthoringStory = storyId === "authoring";
  const isCustomSceneStory = isMotionStory || isAutoscrollStory;
  const activeExample =
    exampleStories.find((example) => example.id === storyId) ?? exampleStories[0]!;
  const activePreset =
    activeExample.presets.find((preset) => preset.id === presetId) ?? activeExample.presets[0]!;
  const activeMotionPreset =
    motionPresets.find((preset) => preset.id === presetId) ?? motionPresets[0]!;
  const activeAutoscrollPreset =
    autoscrollPresets.find((preset) => preset.id === presetId) ?? autoscrollPresets[0]!;
  const customScenes = isAutoscrollStory ? autoscrollLabScenes : motionLabScenes;
  const presetPath = useMemo(
    () =>
      resolveStoryPath(activeExample.story, {
        routeChoiceIds: activePreset.choiceIds,
        autoAdvanceLinearNodes: activePreset.choiceIds.length > 0,
        hooks: activeExample.id === "signal" ? signalStoryHooks : undefined,
      }),
    [activeExample.id, activeExample.story, activePreset.choiceIds],
  );
  const linearScrollPath = useMemo(
    () =>
      resolveStoryPath(activeExample.story, {
        autoAdvanceLinearNodes: true,
      }),
    [activeExample.story],
  );
  const isLinearStory = storyId === "linear";
  const isScrollerMode =
    !isAuthoringStory && (isCustomSceneStory || isLinearStory || mode === "scroller");
  const visibleHistory = isLinearStory
    ? linearScrollPath.history
    : history.length > 0
      ? history
      : presetPath.history;
  const activeMinimapIndex = isScrollerMode
    ? scrollerActiveIndex
    : Math.max(visibleHistory.length - 1, 0);
  const showBranchControls = !isLinearStory && !isCustomSceneStory && !isAuthoringStory;
  const minimapItems = isCustomSceneStory
    ? customScenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        eyebrow: scene.eyebrow,
      }))
    : visibleHistory.map((entry) => {
        const node = activeExample.story.nodes.find((candidate) => candidate.id === entry.nodeId);

        return {
          id: entry.nodeId,
          title: node?.title ?? entry.nodeId,
          eyebrow: node?.eyebrow,
        };
      });
  const stateSummary = isCustomSceneStory
    ? getSceneSummary(customScenes, activeMinimapIndex, sceneProgress)
    : getHistorySummary(activeExample.story, visibleHistory);
  const autoscrollSummary =
    activeAutoscrollPreset &&
    `Pace ${getAutoscrollPaceLabel(activeAutoscrollPreset.autoplay)}
Input scale ${activeAutoscrollPreset.scrollInputScale}
Transition ${getTransitionSummary(activeAutoscrollPreset.transition)}`;

  useEffect(() => {
    setScrollerActiveIndex(0);
    setSceneProgress(0);
  }, [storyId, activePreset.id, activeMotionPreset.id, activeAutoscrollPreset?.id, mode]);

  useEffect(() => {
    if ((isLinearStory || isCustomSceneStory) && mode !== "scroller") {
      setMode("scroller");
    }
  }, [isCustomSceneStory, isLinearStory, mode]);

  const selectMinimapItem = (index: number) => {
    if (!isScrollerMode) return;

    if (isCustomSceneStory) {
      const scene = customScenes[index];
      if (!scene) return;

      setScrollerActiveIndex(index);
      document.getElementById(scene.id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    const entry = visibleHistory[index];
    if (!entry) return;

    setScrollerActiveIndex(index);
    document
      .getElementById(getStoryScrollerPageId(activeExample.story.id, entry.nodeId))
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  if (catalogQuery.isPending) {
    return (
      <main className="min-h-screen bg-[linear-gradient(135deg,rgba(10,124,111,0.08),transparent_34%),linear-gradient(315deg,rgba(190,80,52,0.09),transparent_38%),#f6f7f8] p-4 md:p-8">
        <LoadingState className="mx-auto min-h-[28rem] max-w-4xl" label="Loading story catalog" />
      </main>
    );
  }

  if (catalogQuery.isError) {
    return (
      <main className="min-h-screen bg-[linear-gradient(135deg,rgba(10,124,111,0.08),transparent_34%),linear-gradient(315deg,rgba(190,80,52,0.09),transparent_38%),#f6f7f8] p-4 md:p-8">
        <ErrorState className="mx-auto min-h-[28rem] max-w-4xl">
          Story catalog could not be loaded.
        </ErrorState>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,rgba(10,124,111,0.08),transparent_34%),linear-gradient(315deg,rgba(190,80,52,0.09),transparent_38%),#f6f7f8] p-3 text-[#17211f] md:p-8">
      <section className="mx-auto w-full max-w-[1480px]" aria-labelledby="example-title">
        <header className="grid gap-4 pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <Badge variant="outline" className="mb-3 border-[#17211f]/15 bg-white/60">
              Example website
            </Badge>
            <h1
              id="example-title"
              className="max-w-[9ch] text-5xl font-semibold leading-[0.92] tracking-normal text-[#111817] md:max-w-[13ch] md:text-6xl xl:text-7xl"
            >
              Storytelling component lab
            </h1>
          </div>

          <div className="grid gap-3 lg:justify-items-end" aria-label="Example controls">
            <ExamplePageNav
              activePage="lab"
              onPageChange={(page) => page === "creator" && onOpenCreator()}
            />

            <ToggleGroup
              type="single"
              value={storyId}
              onValueChange={(nextStoryId) => {
                if (!nextStoryId) return;

                const typedStoryId = nextStoryId as ExampleStoryId;

                setStoryId(typedStoryId);
                setPresetId(getDefaultPresetId(typedStoryId, catalog));
                if (
                  typedStoryId === "linear" ||
                  typedStoryId === "motion" ||
                  typedStoryId === "autoscroll"
                ) {
                  setMode("scroller");
                }
                setHistory([]);
              }}
              className="flex-wrap justify-start border border-[#17211f]/15 bg-white/75 p-1 shadow-[0_10px_24px_rgba(23,33,31,0.06)] lg:justify-end"
              aria-label="Story type"
            >
              {storyOptions.map((example) => (
                <ToggleGroupItem
                  key={example.id}
                  value={example.id}
                  aria-label={example.label}
                  className="min-h-9 px-3"
                >
                  {example.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {showBranchControls ? (
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(nextMode) => {
                  if (!nextMode) return;

                  setMode(nextMode as ExampleMode);
                  setHistory([]);
                }}
                className="flex-wrap justify-start border border-[#17211f]/15 bg-white/75 p-1 shadow-[0_10px_24px_rgba(23,33,31,0.06)] lg:justify-end"
                aria-label="Component"
              >
                <ToggleGroupItem value="player" className="min-h-9 px-3">
                  Player
                </ToggleGroupItem>
                <ToggleGroupItem value="scroller" className="min-h-9 px-3">
                  Scroller
                </ToggleGroupItem>
              </ToggleGroup>
            ) : null}

            {showBranchControls ? (
              <div
                className="flex flex-wrap justify-start gap-1 rounded-lg border border-[#17211f]/15 bg-white/75 p-1 shadow-[0_10px_24px_rgba(23,33,31,0.06)] lg:justify-end"
                aria-label="Start path"
              >
                {activeExample.presets.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={preset.id === activePreset.id ? "default" : "ghost"}
                    size="sm"
                    className="min-h-9"
                    onClick={() => {
                      setPresetId(preset.id);
                      setHistory([]);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            ) : null}

            {isMotionStory ? (
              <div
                className="flex flex-wrap justify-start gap-1 rounded-lg border border-[#17211f]/15 bg-white/75 p-1 shadow-[0_10px_24px_rgba(23,33,31,0.06)] lg:justify-end"
                aria-label="Motion transition"
              >
                {motionPresets.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={preset.id === activeMotionPreset.id ? "default" : "ghost"}
                    size="sm"
                    className="min-h-9"
                    onClick={() => {
                      setPresetId(preset.id);
                      setHistory([]);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            ) : null}

            {isAutoscrollStory ? (
              <div
                className="flex flex-wrap justify-start gap-1 rounded-lg border border-[#17211f]/15 bg-white/75 p-1 shadow-[0_10px_24px_rgba(23,33,31,0.06)] lg:justify-end"
                aria-label="Autoscroll preset"
              >
                {autoscrollPresets.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={preset.id === activeAutoscrollPreset.id ? "default" : "ghost"}
                    size="sm"
                    className="min-h-9"
                    onClick={() => {
                      setPresetId(preset.id);
                      setHistory([]);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        <div
          className={cn(
            "grid items-start gap-4",
            isAuthoringStory ? "" : "xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]",
          )}
        >
          <div className="[&>section]:shadow-[0_18px_54px_rgba(23,33,31,0.10)] [&_[data-story-scroller-page]_.demo-stage]:h-full [&_[data-story-scroller-page]_.demo-stage]:min-h-0 [&_[data-story-scroller-page]_.demo-stage]:transition-[border-color,box-shadow] [&_[data-story-scroller-page][data-active=true]_.demo-stage]:border-white/70 [&_[data-story-scroller-page][data-active=true]_.demo-stage]:shadow-[0_18px_54px_rgba(23,33,31,0.18)]">
            {isAuthoringStory ? (
              <AuthoringWorkbench />
            ) : isMotionStory ? (
              <StoryScroller
                key={`motion-${activeMotionPreset.id}`}
                scenes={motionLabScenes}
                transition={activeMotionPreset.transition}
                ariaLabel="Motion examples"
                onActiveIndexChange={setScrollerActiveIndex}
                onSceneProgressChange={setSceneProgress}
              />
            ) : isAutoscrollStory ? (
              <StoryScroller
                key={`autoscroll-${activeAutoscrollPreset.id}`}
                scenes={autoscrollLabScenes}
                transition={activeAutoscrollPreset.transition}
                autoplay={activeAutoscrollPreset.autoplay}
                scrollInputScale={activeAutoscrollPreset.scrollInputScale}
                ariaLabel="Autoscroll examples"
                onActiveIndexChange={setScrollerActiveIndex}
                onSceneProgressChange={setSceneProgress}
              />
            ) : !isScrollerMode ? (
              <StoryPlayer
                key={`${activeExample.id}-${activePreset.id}`}
                story={activeExample.story}
                registry={storyRegistry}
                defaultSnapshot={presetPath.snapshot}
                hooks={activeExample.id === "signal" ? signalStoryHooks : undefined}
                onPathChange={setHistory}
              />
            ) : (
              <StoryScroller
                key={`${activeExample.id}-${activePreset.id}`}
                story={activeExample.story}
                registry={storyRegistry}
                defaultSnapshot={presetPath.snapshot}
                hooks={activeExample.id === "signal" ? signalStoryHooks : undefined}
                transition={{ type: "fade", scrollUnits: 16 }}
                onPathChange={setHistory}
                onActiveIndexChange={setScrollerActiveIndex}
                onSceneProgressChange={setSceneProgress}
              />
            )}
          </div>

          {!isAuthoringStory ? (
            <aside className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1" aria-label="Story state">
              <StoryMinimap
                items={minimapItems}
                activeIndex={activeMinimapIndex}
                onSelect={isScrollerMode ? selectMinimapItem : undefined}
                collapsible
                className="border-[#17211f]/15 bg-white/85 shadow-[0_16px_36px_rgba(23,33,31,0.08)] lg:col-span-2 xl:col-span-1"
              />

              <Card className="border-[#17211f]/15 bg-white/85 shadow-[0_16px_36px_rgba(23,33,31,0.08)]">
                <CardHeader>
                  <Badge variant="outline" className="w-fit">
                    {isMotionStory
                      ? "Motion scene"
                      : isAutoscrollStory
                        ? "Autoscroll scene"
                        : isLinearStory
                          ? "Scroll sequence"
                          : mode === "player"
                            ? "Active path"
                            : "Start path"}
                  </Badge>
                  <CardTitle className="text-xl">
                    {isCustomSceneStory
                      ? (customScenes[activeMinimapIndex]?.title ?? "Scroll scenes")
                      : isLinearStory
                        ? "Story cards"
                        : activePreset.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StateSummary summary={stateSummary} />
                </CardContent>
              </Card>

              {showBranchControls ? (
                <Card className="border-[#17211f]/15 bg-white/85 shadow-[0_16px_36px_rgba(23,33,31,0.08)]">
                  <CardHeader>
                    <Badge variant="outline" className="w-fit">
                      Choice ids
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <code
                      className={cn(
                        "block overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-[#2d3835]",
                        activePreset.choiceIds.length === 0 ? "text-muted-foreground" : "",
                      )}
                    >
                      {activePreset.choiceIds.join(" -> ") || "none"}
                    </code>
                  </CardContent>
                </Card>
              ) : null}

              {isAutoscrollStory && activeAutoscrollPreset ? (
                <Card className="border-[#17211f]/15 bg-white/85 shadow-[0_16px_36px_rgba(23,33,31,0.08)]">
                  <CardHeader>
                    <Badge variant="outline" className="w-fit">
                      Autoplay
                    </Badge>
                    <CardTitle className="text-xl">{activeAutoscrollPreset.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <p className="m-0 text-sm leading-6 text-[#2d3835]">
                      {activeAutoscrollPreset.description}
                    </p>
                    <StateSummary summary={autoscrollSummary || "No autoscroll preset"} />
                  </CardContent>
                </Card>
              ) : null}
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function ExampleApp() {
  const [page, setPage] = useState<ExamplePage>(() => getExamplePageFromHash());

  useEffect(() => {
    const syncPageFromHash = () => setPage(getExamplePageFromHash());

    window.addEventListener("hashchange", syncPageFromHash);

    return () => window.removeEventListener("hashchange", syncPageFromHash);
  }, []);

  const openPage = (nextPage: ExamplePage) => {
    setPage(nextPage);
    setExamplePageHash(nextPage);
  };

  if (page === "creator") {
    return <StoryCreatorPage onOpenLab={() => openPage("lab")} />;
  }

  return <ExampleLab onOpenCreator={() => openPage("creator")} />;
}
