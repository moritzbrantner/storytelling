import type { StoryContentRenderer } from "./story-render-types";

export type CreateChartContentRendererOptions = {
  packageName?: string;
};

export function createChartContentRenderer(
  options: CreateChartContentRendererOptions = {},
): StoryContentRenderer {
  const packageName = options.packageName ?? "a chart renderer such as recharts";

  return () => {
    throw new Error(
      `Chart content rendering is optional. Install and wire ${packageName}, or provide a custom chart renderer through StoryContent renderers.`,
    );
  };
}
