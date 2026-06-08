import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      thresholds: {
        lines: 80,
        branches: 70,
        "src/story-validation.ts": {
          lines: 85,
          branches: 75,
        },
        "src/story-path.ts": {
          lines: 85,
          branches: 75,
        },
        "src/story-graph.ts": {
          lines: 85,
          branches: 75,
        },
        "src/story-state.ts": {
          lines: 85,
          branches: 75,
        },
        "src/story-edit.ts": {
          lines: 85,
          branches: 75,
        },
        "src/story-authoring.ts": {
          lines: 85,
          branches: 75,
        },
        "src/story-content.tsx": {
          lines: 80,
          branches: 65,
        },
        "src/story-media.tsx": {
          lines: 80,
          branches: 65,
        },
        "src/remotion.tsx": {
          lines: 85,
          branches: 65,
        },
        "src/three.tsx": {
          lines: 70,
          branches: 40,
        },
        "src/adapters-markdown.ts": {
          lines: 100,
          branches: 100,
        },
        "src/adapters-charts.ts": {
          lines: 100,
          branches: 100,
        },
        "src/story-scroll-timeline.tsx": {
          lines: 70,
          branches: 60,
        },
        "src/story-scroller.tsx": {
          lines: 70,
          branches: 60,
        },
        "src/story-player.tsx": {
          lines: 70,
          branches: 60,
        },
      },
    },
  },
});
