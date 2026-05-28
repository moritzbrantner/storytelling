import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import type { ReactNode } from "react";

import { buildStoryTimeline } from "./story-path";
import { getStoryChoices, getStoryNode, isStoryEnding, validateStory } from "./story-validation";
import { defaultStoryTheme, type StoryTheme } from "./story-theme";
import { getStoryRendererKey } from "./story-render-registry";
import type {
  ResolvedStoryPath,
  StoryContentBlock,
  StoryDocument,
  StoryNodeData,
  StoryRemotionSceneComponent,
  StoryRemotionSceneProps,
  StoryRenderProps,
  StoryRendererRegistry,
} from "./story-model";

export { buildStoryTimeline } from "./story-path";

export type StoryRemotionLayout = {
  width?: number;
  height?: number;
  fps?: number;
};

export type StoryRemotionCompositionProps<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  choiceIds?: string[];
  registry?: StoryRendererRegistry<TData>;
  theme?: StoryTheme;
  layout?: StoryRemotionLayout;
};

export type StoryCompositionOptions = {
  id?: string;
  choiceIds?: string[];
  fps?: number;
  width?: number;
  height?: number;
};

function resolveRemotionFps(fps: number | undefined) {
  if (fps === undefined) {
    return undefined;
  }

  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error("Story Remotion fps must be finite and greater than 0.");
  }

  return fps;
}

function clampProgress(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function getStoryCompositionProps<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  options: StoryCompositionOptions = {},
) {
  const timeline = buildStoryTimeline(story, {
    choiceIds: options.choiceIds,
    fps: resolveRemotionFps(options.fps),
  });
  const id =
    options.id ??
    `${story.id}-${options.choiceIds?.length ? options.choiceIds.join("-") : "default"}`;

  return {
    id,
    fps: timeline.fps,
    width: options.width ?? 1920,
    height: options.height ?? 1080,
    durationInFrames: timeline.totalFrames,
    defaultProps: {
      story,
      choiceIds: options.choiceIds ?? [],
      layout: {
        fps: timeline.fps,
        width: options.width ?? 1920,
        height: options.height ?? 1080,
      },
    } satisfies StoryRemotionCompositionProps<TData>,
  };
}

export function StoryRemotionContent({
  content,
  color = "rgba(255,255,255,0.82)",
}: {
  content?: StoryContentBlock[];
  color?: string;
}) {
  if (!content?.length) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 18, color }}>
      {content.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case "paragraph":
            return (
              <p key={key} style={{ margin: 0, fontSize: 30, lineHeight: 1.45 }}>
                {block.text}
              </p>
            );
          case "heading": {
            const size = block.level === 2 ? 46 : block.level === 4 ? 30 : 36;

            return (
              <p
                key={key}
                style={{
                  margin: 0,
                  fontSize: size,
                  lineHeight: 1.15,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {block.text}
              </p>
            );
          }
          case "quote":
            return (
              <div
                key={key}
                style={{
                  borderLeft: "4px solid rgba(255,255,255,0.35)",
                  paddingLeft: 24,
                  fontSize: 30,
                  lineHeight: 1.4,
                }}
              >
                <p style={{ margin: 0 }}>{block.text}</p>
                {block.cite ? (
                  <p style={{ margin: "12px 0 0", fontSize: 20, opacity: 0.72 }}>{block.cite}</p>
                ) : null}
              </div>
            );
          case "list":
            return (
              <ul key={key} style={{ margin: 0, paddingLeft: 32, fontSize: 28 }}>
                {block.items.map((item) => (
                  <li key={item} style={{ marginBottom: 10 }}>
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "image":
            return (
              <div key={key} style={{ display: "grid", gap: 12 }}>
                <img
                  src={block.src}
                  alt={block.alt}
                  style={{
                    width: "100%",
                    maxHeight: 420,
                    objectFit: "cover",
                    borderRadius: 18,
                  }}
                />
                {block.caption ? (
                  <p style={{ margin: 0, fontSize: 18, opacity: 0.7 }}>{block.caption}</p>
                ) : null}
              </div>
            );
          case "audio":
          case "video":
            return (
              <div
                key={key}
                style={{
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: 18,
                  padding: 24,
                  fontSize: 24,
                }}
              >
                {block.title ?? block.src}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export function StoryRemotionProgress({ progress, label }: { progress: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div
        style={{
          width: 440,
          borderRadius: 999,
          background: "rgba(255,255,255,0.14)",
          padding: 6,
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(progress, 1)) * 100}%`,
            height: 10,
            borderRadius: 999,
            background: "white",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 17,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          opacity: 0.72,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function StoryRemotionTransition({
  frame,
  durationInFrames,
  transitionInFrames,
  children,
}: {
  frame: number;
  durationInFrames: number;
  transitionInFrames: number;
  children: ReactNode;
}) {
  const transitionFrames = Math.min(transitionInFrames, Math.floor(durationInFrames / 2));

  if (transitionFrames <= 0) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  const opacity = interpolate(
    frame,
    [0, transitionFrames, durationInFrames - transitionFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const translateY = interpolate(frame, [0, transitionFrames, durationInFrames], [36, 0, -24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, transform: `translateY(${translateY}px)` }}>
      {children}
    </AbsoluteFill>
  );
}

export function StoryRemotionSceneFrame<TData extends StoryNodeData = StoryNodeData>(
  props: StoryRemotionSceneProps<TData> & { theme?: StoryTheme },
) {
  const { node, currentIndex, progress, theme } = props;
  const resolvedTheme = { ...defaultStoryTheme, ...theme };
  const accent = node.stage?.props?.accent;
  const background =
    typeof accent === "string"
      ? `linear-gradient(135deg, ${accent}, #111827 55%, #020617)`
      : `linear-gradient(135deg, ${resolvedTheme.accent}, #111827 55%, #020617)`;

  return (
    <StoryRemotionTransition
      frame={props.frame}
      durationInFrames={props.durationInFrames}
      transitionInFrames={props.timelineScene.transitionInFrames}
    >
      <AbsoluteFill
        style={{
          justifyContent: "space-between",
          padding: 72,
          background,
          color: "white",
          fontFamily: resolvedTheme.fontFamily,
        }}
      >
        <div style={{ maxWidth: 1040 }}>
          {node.eyebrow ? (
            <p
              style={{
                margin: 0,
                fontSize: 18,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                opacity: 0.72,
              }}
            >
              {node.eyebrow}
            </p>
          ) : null}
          <h1
            style={{
              margin: "20px 0 0",
              fontSize: 68,
              lineHeight: 1.03,
              letterSpacing: 0,
              maxWidth: 1040,
            }}
          >
            {node.title}
          </h1>
          <div style={{ marginTop: 30, maxWidth: 900 }}>
            <StoryRemotionContent content={node.content} />
          </div>
        </div>

        <StoryRemotionProgress progress={progress} label={`Scene ${currentIndex + 1}`} />
      </AbsoluteFill>
    </StoryRemotionTransition>
  );
}

export function StoryRemotionComposition<TData extends StoryNodeData = StoryNodeData>({
  story: input,
  choiceIds = [],
  registry,
  theme,
  layout,
}: StoryRemotionCompositionProps<TData>) {
  const story = validateStory(input);
  const absoluteFrame = useCurrentFrame();
  const timeline = buildStoryTimeline(story, { choiceIds, fps: resolveRemotionFps(layout?.fps) });

  return (
    <AbsoluteFill>
      {timeline.scenes.map((scene, index) => {
        const rendererKey = getStoryRendererKey(scene.node);
        const CustomScene = registry?.remotion?.[rendererKey] as
          | StoryRemotionSceneComponent<TData>
          | undefined;
        const node = getStoryNode(story, scene.node.id);
        const frame = Math.max(absoluteFrame - scene.startFrame, 0);
        const history = scene.history;
        const path: ResolvedStoryPath<TData> = {
          nodes: timeline.scenes.slice(0, index + 1).map((entry) => entry.node),
          history,
          currentNode: node,
          completed: isStoryEnding(story, node),
        };
        const choices = getStoryChoices(story, node);
        const renderProps: StoryRenderProps<TData> = {
          story,
          node,
          history,
          path,
          currentIndex: index,
          progress: (index + 1) / Math.max(timeline.scenes.length, 1),
          isEnding: isStoryEnding(story, node),
          canGoBack: index > 0,
          choices,
          choose: () => {},
          goBack: () => {},
          restart: () => {},
        };
        const sceneProps: StoryRemotionSceneProps<TData> = {
          ...renderProps,
          frame,
          absoluteFrame,
          durationInFrames: scene.durationInFrames,
          fps: timeline.fps,
          sceneProgress: clampProgress(frame / Math.max(scene.durationInFrames, 1)),
          timelineScene: scene,
        };

        return (
          <Sequence
            key={`${scene.node.id}-${scene.startFrame}`}
            from={scene.startFrame}
            durationInFrames={scene.durationInFrames}
          >
            {CustomScene ? (
              <CustomScene {...sceneProps} />
            ) : (
              <StoryRemotionSceneFrame {...sceneProps} theme={theme} />
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
