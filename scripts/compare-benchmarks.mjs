import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readArgs(argv) {
  const args = {
    baseline: undefined,
    candidate: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--baseline":
        args.baseline = argv[++index];
        break;
      case "--candidate":
        args.candidate = argv[++index];
        break;
      default:
        throw new Error(`Unknown benchmark comparison argument "${arg}".`);
    }
  }

  if (!args.baseline || !args.candidate) {
    throw new Error(
      "Usage: node scripts/compare-benchmarks.mjs --baseline <file> --candidate <file>",
    );
  }

  return args;
}

function readReport(filePath) {
  const resolvedPath = path.resolve(packageRoot, filePath);

  if (!existsSync(resolvedPath)) {
    return undefined;
  }

  return JSON.parse(readFileSync(resolvedPath, "utf8"));
}

function indexResults(report) {
  return new Map((report.results ?? []).map((result) => [result.name, result]));
}

function main() {
  const args = readArgs(process.argv.slice(2));
  const baseline = readReport(args.baseline);
  const candidate = readReport(args.candidate);

  if (!baseline) {
    console.warn(`Benchmark baseline "${args.baseline}" does not exist; skipping comparison.`);
    return;
  }

  if (!candidate) {
    console.warn(`Benchmark candidate "${args.candidate}" does not exist; skipping comparison.`);
    return;
  }

  const baselineResults = indexResults(baseline);
  const failures = [];

  for (const candidateResult of candidate.results ?? []) {
    const baselineResult = baselineResults.get(candidateResult.name);
    if (!baselineResult) continue;

    const medianDeltaMs = candidateResult.medianMs - baselineResult.medianMs;
    const regressionRatio =
      baselineResult.medianMs > 0 ? candidateResult.medianMs / baselineResult.medianMs - 1 : 0;

    if (regressionRatio > 0.15 && medianDeltaMs > 1) {
      failures.push(
        `${candidateResult.name} median regressed ${(regressionRatio * 100).toFixed(
          1,
        )}% (${baselineResult.medianMs.toFixed(2)}ms -> ${candidateResult.medianMs.toFixed(2)}ms)`,
      );
    }
  }

  if (failures.length > 0) {
    console.error(
      `Benchmark regressions:\n${failures.map((failure) => `- ${failure}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("Benchmark comparison passed");
}

main();
