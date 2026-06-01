import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const registry = "https://registry.npmjs.org";
const spec = `${packageJson.name}@${packageJson.version}`;

const metadata = JSON.parse(
  execFileSync(
    "npm",
    ["view", spec, "version", "dist-tags", "dist.tarball", "--registry", registry, "--json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  ),
);

assert.equal(metadata.version, packageJson.version, `${spec} must resolve on npm`);
assert.equal(metadata["dist-tags"]?.latest, packageJson.version, "latest must point at version");
assert.equal(typeof metadata["dist.tarball"], "string", "published package must expose a tarball");

const tempRoot = mkdtempSync(path.join(tmpdir(), "storytelling-published-consumer-"));

try {
  writeFileSync(
    path.join(tempRoot, "package.json"),
    JSON.stringify({ private: true, type: "module" }, null, 2),
    "utf8",
  );

  execFileSync("npm", ["install", "--dry-run", "--ignore-scripts", "--registry", registry, spec], {
    cwd: tempRoot,
    stdio: "inherit",
  });
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log(`${spec} published npm metadata and installability verified`);
