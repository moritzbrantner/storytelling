import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(packageRoot, "dist");
const budgetPath = path.join(packageRoot, "bench/budgets.size.json");

function readBudget() {
  return JSON.parse(readFileSync(budgetPath, "utf8"));
}

function readFileSize(relativePath) {
  const filePath = path.join(packageRoot, relativePath);

  if (!existsSync(filePath)) {
    throw new Error(`Expected dist file "${relativePath}" to exist.`);
  }

  const content = readFileSync(filePath);

  return {
    rawBytes: content.byteLength,
    gzipBytes: gzipSync(content).byteLength,
  };
}

async function main() {
  const { readdirSync, statSync } = await import("node:fs");
  const budget = readBudget();
  const failures = [];
  const rows = [];

  function collect(directory) {
    const files = [];

    for (const entry of readdirSync(directory)) {
      const entryPath = path.join(directory, entry);
      const stat = statSync(entryPath);

      if (stat.isDirectory()) {
        files.push(...collect(entryPath));
      } else if (entryPath.endsWith(".js")) {
        files.push(entryPath);
      }
    }

    return files;
  }

  for (const [relativePath, limit] of Object.entries(budget.files)) {
    const size = readFileSize(relativePath);

    rows.push({ path: relativePath, ...size, limit });

    if (size.rawBytes > limit) {
      failures.push(`${relativePath} raw size ${size.rawBytes}B exceeded ${limit}B`);
    }
  }

  const totalRawBytes = collect(distRoot).reduce(
    (sum, filePath) => sum + readFileSync(filePath).byteLength,
    0,
  );

  rows.push({ path: "dist/**/*.js", rawBytes: totalRawBytes, gzipBytes: 0, limit: budget.totalJs });

  if (totalRawBytes > budget.totalJs) {
    failures.push(`dist/**/*.js raw size ${totalRawBytes}B exceeded ${budget.totalJs}B`);
  }

  console.table(
    rows.map((row) => ({
      path: row.path,
      raw: `${row.rawBytes}B`,
      gzip: row.gzipBytes ? `${row.gzipBytes}B` : "-",
      limit: `${row.limit}B`,
    })),
  );

  if (failures.length > 0) {
    console.error(`Size budget failures:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
