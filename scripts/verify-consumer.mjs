import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = mkdtempSync(path.join(tmpdir(), "storytelling-consumer-"));
let packageTarballPath;

try {
  const [packageMetadata] = JSON.parse(
    execFileSync("npm", ["pack", "--ignore-scripts", "--json"], {
      cwd: packageRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }),
  );

  packageTarballPath = path.join(packageRoot, packageMetadata.filename);

  writeFileSync(
    path.join(tempRoot, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
      },
      null,
      2,
    ),
    "utf8",
  );

  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      packageTarballPath,
      "react@^19.0.0",
      "react-dom@^19.0.0",
      "remotion@^4.0.379",
      "three@^0.180.0",
      "@react-three/fiber@^9.4.0",
    ],
    {
      cwd: tempRoot,
      stdio: "inherit",
    },
  );

  writeFileSync(
    path.join(tempRoot, "verify.mjs"),
    [
      'import assert from "node:assert/strict";',
      'import { defineStory, validateStory, StoryPlayer } from "@moritzbrantner/storytelling";',
      'import { analyzeStory, applyStoryPatch } from "@moritzbrantner/storytelling/core";',
      'import { storyDocumentJsonSchema } from "@moritzbrantner/storytelling/schema";',
      'import { getStoryCompositionProps } from "@moritzbrantner/storytelling/remotion";',
      'import { StoryCanvasStage } from "@moritzbrantner/storytelling/three";',
      'import { StoryVideoFile } from "@moritzbrantner/storytelling/media";',
      'import { storyToWorkflowDocument } from "@moritzbrantner/storytelling/workflow";',
      'import { storyToTimelineEditorDocument } from "@moritzbrantner/storytelling/timeline";',
      'assert.equal(typeof defineStory, "function");',
      'assert.equal(typeof validateStory, "function");',
      'assert.equal(typeof StoryPlayer, "function");',
      'assert.equal(typeof analyzeStory, "function");',
      'assert.equal(typeof applyStoryPatch, "function");',
      'assert.equal(typeof storyDocumentJsonSchema, "object");',
      'assert.equal(typeof getStoryCompositionProps, "function");',
      'assert.equal(typeof StoryCanvasStage, "function");',
      'assert.equal(typeof StoryVideoFile, "function");',
      'assert.equal(typeof storyToWorkflowDocument, "function");',
      'assert.equal(typeof storyToTimelineEditorDocument, "function");',
    ].join("\n"),
    "utf8",
  );

  execFileSync("node", ["verify.mjs"], {
    cwd: tempRoot,
    stdio: "inherit",
  });

  const coreOnlyRoot = mkdtempSync(path.join(tmpdir(), "storytelling-core-consumer-"));

  try {
    writeFileSync(
      path.join(coreOnlyRoot, "package.json"),
      JSON.stringify(
        {
          private: true,
          type: "module",
        },
        null,
        2,
      ),
      "utf8",
    );

    execFileSync("npm", ["install", "--ignore-scripts", "--legacy-peer-deps", packageTarballPath], {
      cwd: coreOnlyRoot,
      stdio: "inherit",
    });

    writeFileSync(
      path.join(coreOnlyRoot, "verify-core.mjs"),
      [
        'import assert from "node:assert/strict";',
        'import { defineStory, analyzeStory, applyStoryPatch } from "@moritzbrantner/storytelling/core";',
        'assert.equal(typeof defineStory, "function");',
        'assert.equal(typeof analyzeStory, "function");',
        'assert.equal(typeof applyStoryPatch, "function");',
      ].join("\n"),
      "utf8",
    );

    execFileSync("node", ["verify-core.mjs"], {
      cwd: coreOnlyRoot,
      stdio: "inherit",
    });
  } finally {
    rmSync(coreOnlyRoot, { recursive: true, force: true });
  }

  console.log("@moritzbrantner/storytelling consumer imports verified");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  if (packageTarballPath) {
    rmSync(packageTarballPath, { force: true });
  }
}
