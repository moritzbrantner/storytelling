export type JsonSchema = {
  readonly [key: string]: unknown;
};

const textTrackSchema = {
  type: "object",
  additionalProperties: false,
  required: ["src", "label"],
  properties: {
    src: { type: "string" },
    label: { type: "string" },
    srcLang: { type: "string" },
    kind: {
      enum: ["subtitles", "captions", "descriptions", "chapters", "metadata"],
    },
    default: { type: "boolean" },
  },
} satisfies JsonSchema;

const contentBlockSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "text"],
      properties: {
        type: { const: "paragraph" },
        text: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "text"],
      properties: {
        type: { const: "heading" },
        text: { type: "string" },
        level: { enum: [2, 3, 4] },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "text"],
      properties: {
        type: { const: "quote" },
        text: { type: "string" },
        cite: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "items"],
      properties: {
        type: { const: "list" },
        items: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "src", "alt"],
      properties: {
        type: { const: "image" },
        src: { type: "string" },
        alt: { type: "string" },
        caption: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "src"],
      properties: {
        type: { const: "audio" },
        src: { type: "string" },
        title: { type: "string" },
        tracks: {
          type: "array",
          items: textTrackSchema,
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "src"],
      properties: {
        type: { const: "video" },
        src: { type: "string" },
        title: { type: "string" },
        poster: { type: "string" },
        tracks: {
          type: "array",
          items: textTrackSchema,
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "columns", "rows"],
      properties: {
        type: { const: "table" },
        caption: { type: "string" },
        columns: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "header"],
            properties: {
              id: { type: "string" },
              header: { type: "string" },
              align: { enum: ["left", "center", "right"] },
            },
          },
        },
        rows: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: {
              anyOf: [
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
                { type: "null" },
              ],
            },
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "code"],
      properties: {
        type: { const: "code" },
        code: { type: "string" },
        language: { type: "string" },
        filename: { type: "string" },
        highlightedLines: {
          type: "array",
          items: { type: "integer", minimum: 1 },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "chartType", "data"],
      properties: {
        type: { const: "chart" },
        title: { type: "string" },
        description: { type: "string" },
        chartType: { enum: ["bar", "line", "area", "pie"] },
        data: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: {
              anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
            },
          },
        },
        xKey: { type: "string" },
        yKey: { type: "string" },
        series: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key"],
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              color: { type: "string" },
            },
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "src", "title"],
      properties: {
        type: { const: "embed" },
        src: { type: "string" },
        title: { type: "string" },
        provider: { enum: ["iframe", "youtube", "vimeo", "codepen", "custom"] },
        aspectRatio: { enum: ["16:9", "4:3", "1:1", "auto"] },
        allow: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "content"],
      properties: {
        type: { const: "callout" },
        tone: { enum: ["info", "success", "warning", "danger", "neutral"] },
        title: { type: "string" },
        content: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "markdown"],
      properties: {
        type: { const: "markdown" },
        markdown: { type: "string" },
      },
    },
  ],
} satisfies JsonSchema;

const storyChoiceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "target"],
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    target: { type: "string" },
    description: { type: "string" },
    disabled: { type: "boolean" },
    hidden: { type: "boolean" },
  },
} satisfies JsonSchema;

const runtimeStateSchema = {
  type: "object",
  additionalProperties: true,
} satisfies JsonSchema;

const storyStageDescriptorSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    renderer: { type: "string" },
    variant: { enum: ["default", "media", "fullscreen", "split"] },
    props: {
      type: "object",
      additionalProperties: true,
    },
  },
} satisfies JsonSchema;

const storyTransitionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { enum: ["fade", "slide", "scale", "none"] },
    durationInFrames: {
      type: "integer",
      minimum: 0,
    },
    reducedMotion: { type: "boolean" },
  },
} satisfies JsonSchema;

const storyNodeSchema = { $ref: "#/$defs/storyNode" } satisfies JsonSchema;

export type CreateStoryDocumentJsonSchemaOptions = {
  contentBlocks?: Record<string, JsonSchema>;
};

function createContentBlockSchema(options: CreateStoryDocumentJsonSchemaOptions = {}) {
  const extensionSchemas = Object.entries(options.contentBlocks ?? {}).map(([type, schema]) => ({
    allOf: [{ type: "object", required: ["type"], properties: { type: { const: type } } }, schema],
  }));

  if (extensionSchemas.length === 0) {
    return contentBlockSchema;
  }

  return {
    oneOf: [...(contentBlockSchema.oneOf as JsonSchema[]), ...extensionSchemas],
  } satisfies JsonSchema;
}

export function createStoryDocumentJsonSchema(options: CreateStoryDocumentJsonSchemaOptions = {}) {
  const resolvedContentBlockSchema = createContentBlockSchema(options);

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://moritzbrantner.github.io/storytelling/story-document.schema.json",
    title: "StoryDocument",
    type: "object",
    additionalProperties: false,
    required: ["id", "title", "openingNodeId", "nodes"],
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      subtitle: { type: "string" },
      description: { type: "string" },
      openingNodeId: { type: "string" },
      nodes: {
        type: "array",
        minItems: 1,
        items: storyNodeSchema,
      },
      defaults: {
        type: "object",
        additionalProperties: false,
        properties: {
          durationInFrames: {
            type: "integer",
            minimum: 1,
          },
          transitionInFrames: {
            type: "integer",
            minimum: 0,
          },
          stage: storyStageDescriptorSchema,
        },
      },
      labels: {
        type: "object",
        additionalProperties: false,
        properties: {
          back: { type: "string" },
          restart: { type: "string" },
          continue: { type: "string" },
          choosePrompt: { type: "string" },
          endingPrompt: { type: "string" },
          completedBranch: { type: "string" },
          scrollerLabel: { type: "string" },
          minimapLabel: { type: "string" },
        },
      },
      initialState: runtimeStateSchema,
    },
    $defs: {
      storyNode: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          eyebrow: { type: "string" },
          content: {
            type: "array",
            items: resolvedContentBlockSchema,
          },
          prompt: { type: "string" },
          data: {
            type: "object",
            additionalProperties: true,
          },
          next: { type: "string" },
          choices: {
            type: "array",
            items: storyChoiceSchema,
          },
          children: {
            type: "array",
            items: { $ref: "#/$defs/storyNode" },
          },
          durationInFrames: {
            type: "integer",
            minimum: 1,
          },
          scrollUnits: {
            type: "number",
            exclusiveMinimum: 0,
          },
          transition: storyTransitionSchema,
          stage: storyStageDescriptorSchema,
        },
      },
    },
  } satisfies JsonSchema;
}

export const storyDocumentJsonSchema = createStoryDocumentJsonSchema();

export type StoryDocumentJsonSchema = typeof storyDocumentJsonSchema;
