import {
  createBranchingStory,
  createDraftStory,
  createLinearStory,
  createNestedStory,
} from "./fixtures/story-factories.ts";

function createScenes(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `scene-${index}`,
    title: `Scene ${index}`,
    scrollUnits: index % 3 === 0 ? 150 : undefined,
    render: () => null,
  }));
}

export async function createCoreBenchmarkCases({ distRoot, profile }) {
  const core = await import(`${distRoot}/core.js`);
  const root = await import(`${distRoot}/index.js`);
  const linear100 = createLinearStory({ count: 100 });
  const linear1000 = createLinearStory({ count: 1000 });
  const linear5000 = createLinearStory({ count: 5000 });
  const branch4x3 = createBranchingStory({ depth: 4, fanout: 3 });
  const branch5x3 = createBranchingStory({ depth: 5, fanout: 3 });
  const branch6x3 = createBranchingStory({ depth: 6, fanout: 3 });
  const nested3x5 = createNestedStory({ depth: 3, breadth: 5 });
  const nested5x3 = createNestedStory({ depth: 5, breadth: 3 });
  const draft1000 = createDraftStory({
    count: 1000,
    unreachableRatio: 0.2,
    disabledRatio: 0.15,
  });
  const smokeCases = [
    {
      name: "core.validate.linear-1000",
      run: () => core.validateStoryDocument(linear1000),
    },
    {
      name: "core.compile.linear-1000",
      run: () => core.compileStory(linear1000),
    },
    {
      name: "core.resolve.linear-1000",
      run: () => core.resolveStoryPath(linear1000, { autoAdvanceLinearNodes: true }),
    },
    {
      name: "core.timeline.linear-1000",
      run: () => core.buildStoryTimeline(linear1000),
    },
    {
      name: "core.analyze.linear-1000",
      run: () => core.analyzeStory(linear1000),
    },
    {
      name: "core.validate.branch-5x3",
      run: () => core.validateStoryDocument(branch5x3),
    },
    {
      name: "core.compile.branch-5x3",
      run: () => core.compileStory(branch5x3),
    },
    {
      name: "core.enumerate.branch-5x3",
      run: () => core.enumerateStoryPaths(branch5x3),
    },
    {
      name: "core.analyze.branch-5x3",
      run: () => core.analyzeStory(branch5x3),
    },
    {
      name: "scroll.build-timeline.scenes-1000",
      run: () => root.buildScrollTimeline(createScenes(1000), { type: "fade", scrollUnits: 16 }),
    },
  ];

  if (profile === "smoke") {
    return smokeCases;
  }

  return [
    ...smokeCases,
    {
      name: "core.validate.linear-100",
      run: () => core.validateStoryDocument(linear100),
    },
    {
      name: "core.validate.linear-5000",
      run: () => core.validateStoryDocument(linear5000),
    },
    {
      name: "core.resolve.linear-5000",
      run: () => core.resolveStoryPath(linear5000, { autoAdvanceLinearNodes: true }),
    },
    {
      name: "core.analyze.linear-5000",
      run: () => core.analyzeStory(linear5000),
    },
    {
      name: "core.enumerate.branch-4x3",
      run: () => core.enumerateStoryPaths(branch4x3),
    },
    {
      name: "core.enumerate.branch-6x3",
      run: () => core.enumerateStoryPaths(branch6x3, { maxPaths: 1000 }),
    },
    {
      name: "core.analyze.nested-3x5",
      run: () => core.analyzeStory(nested3x5),
    },
    {
      name: "core.analyze.nested-5x3",
      run: () => core.analyzeStory(nested5x3),
    },
    {
      name: "core.analyze.draft-1000",
      run: () => core.analyzeStory(draft1000, { maxPaths: 250 }),
    },
    {
      name: "scroll.build-timeline.scenes-5000",
      run: () => root.buildScrollTimeline(createScenes(5000), { type: "slide", scrollUnits: 20 }),
    },
  ];
}
