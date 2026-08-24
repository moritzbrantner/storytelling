import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(packageRoot, "dist");

for (const requiredFile of [
  "index.js",
  "index.d.ts",
  "core.js",
  "core.d.ts",
  "react.js",
  "react.d.ts",
  "schema.js",
  "schema.d.ts",
  "remotion.js",
  "three.js",
  "media.js",
  "workflow.js",
  "timeline.js",
]) {
  assert.equal(
    existsSync(path.join(distRoot, requiredFile)),
    true,
    `dist must include ${requiredFile}`,
  );
}

const root = await import(path.join(distRoot, "index.js"));
assert.equal(typeof root.defineStory, "function", "root export should include defineStory");
assert.equal(typeof root.StoryPlayer, "function", "root export should include StoryPlayer");
assert.equal(
  typeof root.createStoryRendererRegistry,
  "function",
  "root export should include createStoryRendererRegistry",
);

const core = await import(path.join(distRoot, "core.js"));
assert.equal(typeof core.defineStory, "function", "core export should include defineStory");
assert.equal(typeof core.StoryPlayer, "undefined", "core export must not include React UI");

const coreTypes = readFileSync(path.join(distRoot, "core.d.ts"), "utf8");
assert.equal(coreTypes.includes("react"), false, "core types must not reference React");
assert.equal(
  coreTypes.includes("StoryRenderProps"),
  false,
  "core types must not expose React render props",
);

const react = await import(path.join(distRoot, "react.js"));
assert.equal(typeof react.StoryPlayer, "function", "react export should include StoryPlayer");
assert.equal(typeof react.useStoryPlayer, "function", "react export should include useStoryPlayer");

const schema = await import(path.join(distRoot, "schema.js"));
assert.equal(
  typeof schema.storyDocumentJsonSchema,
  "object",
  "schema export should include storyDocumentJsonSchema",
);

const remotion = await import(path.join(distRoot, "remotion.js"));
assert.equal(
  typeof remotion.getStoryCompositionProps,
  "function",
  "remotion export should include getStoryCompositionProps",
);

const three = await import(path.join(distRoot, "three.js"));
assert.equal(
  typeof three.StoryCanvasStage,
  "function",
  "three export should include StoryCanvasStage",
);

const media = await import(path.join(distRoot, "media.js"));
assert.equal(typeof media.StoryVideoFile, "function", "media export should include StoryVideoFile");

const workflow = await import(path.join(distRoot, "workflow.js"));
assert.equal(
  typeof workflow.storyToWorkflowDocument,
  "function",
  "workflow export should include storyToWorkflowDocument",
);

const timeline = await import(path.join(distRoot, "timeline.js"));
assert.equal(
  typeof timeline.storyToTimelineEditorDocument,
  "function",
  "timeline export should include storyToTimelineEditorDocument",
);

const pack = spawnSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], {
  cwd: packageRoot,
  encoding: "utf8",
});

if (pack.error) {
  throw pack.error;
}

assert.equal(pack.status, 0, pack.stderr);

const [packageMetadata] = JSON.parse(pack.stdout);
const packageFiles = new Set(packageMetadata.files.map((file) => file.path));

for (const requiredFile of [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/core.js",
  "dist/core.d.ts",
  "dist/react.js",
  "dist/react.d.ts",
  "dist/schema.js",
  "dist/schema.d.ts",
  "dist/remotion.js",
  "dist/remotion.d.ts",
  "dist/three.js",
  "dist/three.d.ts",
  "dist/media.js",
  "dist/media.d.ts",
  "dist/workflow.js",
  "dist/workflow.d.ts",
  "dist/timeline.js",
  "dist/timeline.d.ts",
  "docs/API.md",
]) {
  assert.equal(packageFiles.has(requiredFile), true, `package must include ${requiredFile}`);
}

console.log("@moritzbrantner/storytelling package exports and package contents verified");
