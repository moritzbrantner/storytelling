import type { StoryContentRenderer } from "./story-render-types";

export type CreateMarkdownContentRendererOptions = {
  packageName?: string;
};

export function createMarkdownContentRenderer(
  options: CreateMarkdownContentRendererOptions = {},
): StoryContentRenderer {
  const packageName = options.packageName ?? "a markdown renderer such as react-markdown";

  return () => {
    throw new Error(
      `Markdown content rendering is optional. Install and wire ${packageName}, or provide a custom markdown renderer through StoryContent renderers.`,
    );
  };
}
