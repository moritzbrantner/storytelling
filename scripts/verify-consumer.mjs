import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const tempRoot = mkdtempSync(path.join(tmpdir(), "storytelling-consumer-"));
let packageTarballPath;

const exactPeer = (name) => {
  const range = packageJson.peerDependencies?.[name];
  const match = /^(?:\^|~|>=\s*)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\s+<[^\s]+)?$/.exec(
    range ?? "",
  );

  if (!match) {
    throw new Error(
      `Expected ${name} to expose a deterministic minimum peer version, received ${range ?? "missing"}`,
    );
  }

  return `${name}@${match[1]}`;
};

const peerInstallPath = (name) => path.join(tempRoot, "node_modules", ...name.split("/"));

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
      exactPeer("react"),
      exactPeer("react-dom"),
      exactPeer("remotion"),
      exactPeer("three"),
      exactPeer("@react-three/fiber"),
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

  execFileSync(process.execPath, ["verify.mjs"], {
    cwd: tempRoot,
    stdio: "inherit",
  });

  for (const peerName of Object.keys(packageJson.peerDependencies ?? {})) {
    rmSync(peerInstallPath(peerName), { recursive: true, force: true });
  }

  writeFileSync(
    path.join(tempRoot, "verify-core.mjs"),
    [
      'import assert from "node:assert/strict";',
      'import { defineStory, analyzeStory, applyStoryPatch } from "@moritzbrantner/storytelling/core";',
      'assert.equal(typeof defineStory, "function");',
      'assert.equal(typeof analyzeStory, "function");',
      'assert.equal(typeof applyStoryPatch, "function");',
    ].join("\n"),
    "utf8",
  );

  execFileSync(process.execPath, ["verify-core.mjs"], {
    cwd: tempRoot,
    stdio: "inherit",
  });

  console.log("@moritzbrantner/storytelling consumer imports verified");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  if (packageTarballPath) {
    rmSync(packageTarballPath, { force: true });
  }
}
