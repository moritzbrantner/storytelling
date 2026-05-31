import {
  analyzeStory,
  applyStoryPatch,
  compileStory,
  createStoryPathState,
  defineStory,
  enumerateStoryPaths,
  getStoryBranches,
  getStoryEndings,
  parseStoryPath,
  resolveStoryPath,
  serializeStoryPath,
  validateStoryDocument,
  type StoryDocument,
} from "@moritzbrantner/storytelling/core";

type CoreData = {
  score: number;
};

const story: StoryDocument<CoreData> = defineStory({
  id: "core-only",
  title: "Core Only",
  openingNodeId: "start",
  nodes: [
    {
      id: "start",
      title: "Start",
      data: { score: 1 },
      choices: [{ id: "finish", label: "Finish", target: "end" }],
    },
    { id: "end", title: "End", data: { score: 2 } },
  ],
});

const issues = validateStoryDocument(story);
const compiled = compileStory(story);
const branches = getStoryBranches(compiled);
const endings = getStoryEndings(compiled);
const paths = enumerateStoryPaths(story);
const resolved = resolveStoryPath(story, { choiceIds: ["finish"] });
const state = createStoryPathState(story, { choiceIds: ["finish"] });
const encoded = serializeStoryPath(state);
const decoded = parseStoryPath(encoded);
const report = analyzeStory(story);
const patched = applyStoryPatch(story, {
  type: "update-node",
  nodeId: "end",
  fields: { title: "Updated end" },
});

void issues;
void branches;
void endings;
void paths;
void resolved.currentNode.data?.score;
void decoded;
void report.metrics.nodeCount;
void patched.nodes[1]?.data?.score;
