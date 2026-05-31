/* eslint-disable no-await-in-loop */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

import { createCoreBenchmarkCases } from "../bench/core.bench.mjs";
import { createReactBenchmarkCases } from "../bench/react.bench.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readArgs(argv) {
  const args = {
    profile: "smoke",
    out: undefined,
    budget: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--profile":
        args.profile = argv[++index] ?? args.profile;
        break;
      case "--out":
        args.out = argv[++index];
        break;
      case "--budget":
        args.budget = argv[++index];
        break;
      default:
        throw new Error(`Unknown benchmark argument "${arg}".`);
    }
  }

  if (args.profile !== "smoke" && args.profile !== "full") {
    throw new Error(`Unsupported benchmark profile "${args.profile}".`);
  }

  return args;
}

function percentile(samples, percentileValue) {
  if (samples.length === 0) return 0;

  const index = Math.min(
    samples.length - 1,
    Math.ceil((percentileValue / 100) * samples.length) - 1,
  );

  return samples[index] ?? 0;
}

function summarizeSamples(samples) {
  const sortedSamples = [...samples].sort((a, b) => a - b);
  const total = sortedSamples.reduce((sum, value) => sum + value, 0);
  const mean = total / Math.max(sortedSamples.length, 1);
  const median = percentile(sortedSamples, 50);

  return {
    samples: sortedSamples.length,
    minMs: sortedSamples[0] ?? 0,
    maxMs: sortedSamples[sortedSamples.length - 1] ?? 0,
    meanMs: mean,
    medianMs: median,
    p95Ms: percentile(sortedSamples, 95),
    opsPerSecond: median > 0 ? 1000 / median : 0,
  };
}

function readBudget(budgetPath) {
  if (!budgetPath) return {};

  const resolvedBudgetPath = path.resolve(packageRoot, budgetPath);

  return JSON.parse(readFileSync(resolvedBudgetPath, "utf8"));
}

function checkBudgets(results, budgets) {
  const failures = [];

  for (const result of results) {
    const budget = budgets[result.name];
    if (!budget) continue;

    for (const [metric, limit] of Object.entries(budget)) {
      const actual = result[metric];

      if (typeof actual === "number" && actual > limit) {
        failures.push(
          `${result.name} ${metric} ${actual.toFixed(2)}ms exceeded ${Number(limit).toFixed(2)}ms`,
        );
      }
    }
  }

  return failures;
}

async function runCase(testCase, profile) {
  const warmup = testCase.warmup ?? (profile === "smoke" ? 5 : 8);
  const samples = testCase.samples ?? (profile === "smoke" ? 25 : 35);
  const scaleDurationBy = testCase.scaleDurationBy ?? 1;

  for (let index = 0; index < warmup; index += 1) {
    await testCase.run();
  }

  const heapBefore = typeof process.memoryUsage === "function" ? process.memoryUsage().heapUsed : 0;
  const durations = [];

  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();

    await testCase.run();

    durations.push((performance.now() - startedAt) / scaleDurationBy);
  }

  const heapAfter = typeof process.memoryUsage === "function" ? process.memoryUsage().heapUsed : 0;

  return {
    name: testCase.name,
    profile,
    scaleDurationBy,
    heapDeltaBytes: heapAfter - heapBefore,
    ...summarizeSamples(durations),
  };
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const distRoot = pathToFileURL(path.join(packageRoot, "dist")).href;
  const cases = [
    ...(await createCoreBenchmarkCases({ distRoot, profile: args.profile })),
    ...(await createReactBenchmarkCases({ distRoot, profile: args.profile })),
  ];
  const results = [];

  for (const testCase of cases) {
    const result = await runCase(testCase, args.profile);

    results.push(result);
    console.log(
      `${result.name}: median=${result.medianMs.toFixed(2)}ms p95=${result.p95Ms.toFixed(
        2,
      )}ms ops=${Math.round(result.opsPerSecond)}/s`,
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    profile: args.profile,
    runtime: {
      bun: process.versions.bun,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    },
    results,
  };

  if (args.out) {
    const outPath = path.resolve(packageRoot, args.out);

    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  const failures = checkBudgets(results, readBudget(args.budget));

  if (failures.length > 0) {
    console.error(
      `\nBenchmark budget failures:\n${failures.map((failure) => `- ${failure}`).join("\n")}`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
