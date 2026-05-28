import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const registry = "https://registry.npmjs.org";
const authToken = process.env.NPM_TOKEN;
const expectedTag = `v${packageJson.version}`;

if (!authToken) {
  console.error("NPM_TOKEN is required to publish packages to the public npm registry.");
  process.exit(1);
}

if (isGitHubActionsTagContext() && process.env.GITHUB_REF_NAME !== expectedTag) {
  console.error(
    `Ref tag ${process.env.GITHUB_REF_NAME ?? "<unknown>"} does not match package version ${expectedTag}.`,
  );
  process.exit(1);
}

const npmUserConfig = createNpmUserConfig();
const publishedVersion = getPublishedVersion(packageJson.name);

if (publishedVersion === packageJson.version) {
  console.log(`Skipping ${packageJson.name}@${packageJson.version}; already published.`);
  verifyPublishedPackage();
  process.exit(0);
}

console.log(`Publishing ${packageJson.name}@${packageJson.version}`);
execFileSync("npm", ["publish", "--access", "public", "--registry", registry], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    npm_config_registry: registry,
    npm_config_userconfig: npmUserConfig,
  },
});
verifyPublishedPackage();

function getPublishedVersion(name) {
  try {
    return execFileSync("npm", ["view", name, "version", "--registry", registry], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        npm_config_userconfig: npmUserConfig,
      },
    }).trim();
  } catch {
    return null;
  }
}

function createNpmUserConfig() {
  const tempDir = mkdtempSync(path.join(tmpdir(), "storytelling-npmrc-"));
  const userConfigPath = path.join(tempDir, ".npmrc");

  writeFileSync(userConfigPath, `//registry.npmjs.org/:_authToken=${authToken}\n`, "utf8");

  return userConfigPath;
}

function isGitHubActionsTagContext() {
  return process.env.GITHUB_REF_TYPE === "tag" || process.env.GITHUB_REF?.startsWith("refs/tags/");
}

function verifyPublishedPackage() {
  execFileSync("node", ["scripts/verify-published-package.mjs"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_registry: registry,
      npm_config_userconfig: npmUserConfig,
    },
  });
}
