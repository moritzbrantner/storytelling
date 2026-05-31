import fc from "fast-check";
import { describe, expect, test } from "vitest";

import {
  analyzeStory,
  applyStoryPatch,
  compileStory,
  enumerateStoryPaths,
  getStoryChoices,
  parseStoryPath,
  resolveStoryPath,
  serializeStoryPath,
  validateStoryDocument,
} from "../../src/core";
import { getStoryNodeEntries } from "../../src/story-node-tree";
import {
  cloneStory,
  collectNodeIds,
  countStoryEdges,
  expectValidStory,
} from "../fixtures/story-assertions";
import {
  createBranchingStory,
  createDraftStory,
  createInvalidStoryCase,
  createLinearStory,
  createNestedStory,
} from "../fixtures/story-factories";

const propertyOptions = {
  seed: Number(process.env.FAST_CHECK_SEED ?? 20260530),
  numRuns: Number(process.env.FAST_CHECK_NUM_RUNS ?? 50),
};

describe("story correctness properties", () => {
  test("valid generated stories have no compat or strict validation issues", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 80 }), (count) => {
        const story = createLinearStory({ count });

        expect(validateStoryDocument(story)).toEqual([]);
        expect(validateStoryDocument(story, { mode: "strict" })).toEqual([]);
      }),
      propertyOptions,
    );
  });

  test("compiled edge counts match generated graph continuations", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        (depth, fanout) => {
          const story = createBranchingStory({ depth, fanout });
          const compiled = compileStory(story);

          expect(compiled.edges).toHaveLength(countStoryEdges(story));
        },
      ),
      propertyOptions,
    );
  });

  test("enumerated paths resolve back to the same current node", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 3 }),
        (depth, fanout) => {
          const story = createBranchingStory({ depth, fanout });

          for (const path of enumerateStoryPaths(story, { maxPaths: 250 })) {
            const resolved = resolveStoryPath(story, {
              choiceIds: path.choiceIds,
              autoAdvanceLinearNodes: true,
            });

            expect(resolved.currentNode.id).toBe(path.currentNode.id);
            expect(resolved.nodes.map((node) => node.id)).toEqual(
              path.nodes.map((node) => node.id),
            );
          }
        },
      ),
      propertyOptions,
    );
  });

  test("story path query strings round-trip choice ids", () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/[A-Za-z0-9._:-]{1,12}/), { maxLength: 12 }),
        (choiceIds) => {
          expect(parseStoryPath(serializeStoryPath(choiceIds))).toEqual(choiceIds);
        },
      ),
      propertyOptions,
    );
  });

  test("story patches do not mutate the original story", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 40 }), (count) => {
        const story = createLinearStory({ count });
        const original = cloneStory(story);
        const patched = applyStoryPatch(story, {
          type: "update-node",
          nodeId: "node-1",
          fields: { title: "Updated title" },
        });

        expect(story).toStrictEqual(original);
        expect(patched.nodes[1]?.title).toBe("Updated title");
      }),
      propertyOptions,
    );
  });

  test("rename-node updates opening node, next links, and choice targets", () => {
    const story = createBranchingStory({ depth: 1, fanout: 2 });
    const renamedOpening = applyStoryPatch(story, {
      type: "rename-node",
      nodeId: "root",
      nextNodeId: "renamed-root",
    });

    expect(renamedOpening.openingNodeId).toBe("renamed-root");

    const renamedTarget = applyStoryPatch(story, {
      type: "rename-node",
      nodeId: "root-0",
      nextNodeId: "renamed-target",
    });

    expect(renamedTarget.nodes[0]?.choices?.[0]?.target).toBe("renamed-target");

    const linear = createLinearStory({ count: 3 });
    const renamedNext = applyStoryPatch(linear, {
      type: "rename-node",
      nodeId: "node-1",
      nextNodeId: "renamed-node",
    });

    expect(renamedNext.nodes[0]?.next).toBe("renamed-node");
  });

  test("disabled choices are not selected by default", () => {
    const story = createBranchingStory({
      depth: 1,
      fanout: 2,
      includeDisabledChoices: true,
    });
    const disabledChoiceId = story.nodes[0]?.choices?.find((choice) => choice.disabled)?.id;

    expect(disabledChoiceId).toBeTruthy();

    const resolved = resolveStoryPath(story, { choiceIds: [disabledChoiceId!] });
    expect(resolved.completed).toBe(false);
    expect(resolved.stoppedReason).toBe("invalid-choice");
    expect(enumerateStoryPaths(story).map((path) => path.choiceIds)).not.toContainEqual([
      disabledChoiceId,
    ]);
    expect(enumerateStoryPaths(story, { includeDisabledChoices: true })).toHaveLength(2);
  });

  test("nested implicit continuations preserve depth-first node order", () => {
    const story = createNestedStory({ depth: 2, breadth: 2 });
    const expectedNodeIds = collectNodeIds(story);
    const resolved = resolveStoryPath(story, { autoAdvanceLinearNodes: true });

    expect(resolved.nodes.map((node) => node.id)).toEqual(expectedNodeIds);
  });

  test("draft analysis remains bounded by maxPaths", () => {
    const story = createDraftStory({
      count: 30,
      unreachableRatio: 0.25,
      disabledRatio: 0.2,
    });
    const report = analyzeStory(story, { maxPaths: 5 });

    expect(report.metrics.nodeCount).toBe(30);
    expect(report.metrics.pathCount).toBeLessThanOrEqual(5);
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["unreachable-node", "empty-content"]),
    );
  });
});

describe("story correctness regressions", () => {
  test("detects cycles, duplicate nested ids, mixed next and choices, and missing targets", () => {
    expect(
      validateStoryDocument(createInvalidStoryCase("cycle")).map((issue) => issue.code),
    ).toContain("story-cycle");
    expect(
      validateStoryDocument(createInvalidStoryCase("duplicate-nested-id")).map(
        (issue) => issue.code,
      ),
    ).toContain("duplicate-node-id");
    expect(
      validateStoryDocument(createInvalidStoryCase("next-and-choices"), { mode: "strict" }).map(
        (issue) => issue.code,
      ),
    ).toContain("node-has-next-and-choices");
    expect(
      validateStoryDocument(createInvalidStoryCase("missing-target")).map((issue) => issue.code),
    ).toContain("missing-choice-target");
  });

  test("reports stable strict issue paths for blank fields", () => {
    const issues = validateStoryDocument(createInvalidStoryCase("blank-strict-field"), {
      mode: "strict",
    });

    expect(issues.map((issue) => [issue.code, issue.path])).toEqual(
      expect.arrayContaining([
        ["blank-story-id", "id"],
        ["blank-story-title", "title"],
        ["blank-node-title", "nodes.0.title"],
        ["invalid-choice-id", "nodes.0.choices.0.id"],
        ["blank-choice-label", "nodes.0.choices.0.label"],
      ]),
    );
  });

  test("invalid patch targets throw by default and no-op when configured", () => {
    const story = createLinearStory({ count: 3 });

    expect(() =>
      applyStoryPatch(story, {
        type: "set-next",
        nodeId: "missing",
        target: "node-2",
      }),
    ).toThrow('does not contain node "missing"');
    expect(
      applyStoryPatch(
        story,
        { type: "set-next", nodeId: "missing", target: "node-2" },
        { onMissing: "ignore" },
      ),
    ).toStrictEqual(story);
  });

  test("story path parsing supports legacy and unknown query formats", () => {
    expect(parseStoryPath("?choices=left,right,,third")).toEqual(["left", "right", "third"]);
    expect(parseStoryPath("left%20choice,right")).toEqual(["left choice", "right"]);
    expect(parseStoryPath("?other=value")).toEqual([]);
  });

  test("story patch edge cases cover choices, opening nodes, and validation", () => {
    const story = createBranchingStory({ depth: 1, fanout: 2 });
    const moved = applyStoryPatch(story, {
      type: "move-choice",
      nodeId: "root",
      choiceId: "choice-0-1",
      index: 0,
    });
    const ignored = applyStoryPatch(
      story,
      { type: "move-choice", nodeId: "root", choiceId: "missing", index: 0 },
      { onMissing: "ignore" },
    );
    const removed = applyStoryPatch(story, {
      type: "remove-choice",
      nodeId: "root",
      choiceId: "choice-0-0",
    });
    const opened = applyStoryPatch(story, { type: "set-opening-node", nodeId: "root-1" });
    const validated = applyStoryPatch(
      story,
      { type: "add-content-block", nodeId: "root", block: { type: "quote", text: "Validated" } },
      { validate: true, validationMode: "strict" },
    );

    expect(moved.nodes[0]?.choices?.map((choice) => choice.id)).toEqual([
      "choice-0-1",
      "choice-0-0",
    ]);
    expect(ignored).toStrictEqual(story);
    expect(removed.nodes[0]?.choices).toHaveLength(1);
    expect(opened.openingNodeId).toBe("root-1");
    expect(validated.nodes[0]?.content?.at(-1)).toEqual({ type: "quote", text: "Validated" });
  });

  test("authoring fixes and content metrics cover strict draft branches", () => {
    const draft = {
      id: " ",
      title: " ",
      openingNodeId: " ",
      nodes: [
        {
          id: " ",
          title: " ",
          content: [
            { type: "heading" as const, text: "Heading words" },
            { type: "quote" as const, text: "Quoted words", cite: "Citation words" },
            { type: "list" as const, items: ["One two", "Three"] },
            { type: "image" as const, src: "/image.png", alt: "Image", caption: "Image caption" },
            { type: "audio" as const, src: "/audio.mp3", title: "Audio title" },
            { type: "video" as const, src: "/video.mp4", title: "Video title" },
          ],
          choices: [
            {
              id: " ",
              label: " ",
              target: "end",
              description: " ",
            },
          ],
        },
        { id: "end", title: "End" },
      ],
    };
    const report = analyzeStory(draft, { includeFixes: true, wordsPerMinute: 2 });

    expect(report.valid).toBe(true);
    expect(report.metrics.mediaBlockCount).toBe(3);
    expect(report.metrics.estimatedReadingMinutes).toBeGreaterThan(5);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "blank-story-id", fixes: expect.any(Array) }),
        expect.objectContaining({ code: "blank-choice-id", fixes: expect.any(Array) }),
        expect.objectContaining({ code: "blank-choice-label", fixes: expect.any(Array) }),
        expect.objectContaining({ code: "blank-choice-description", fixes: expect.any(Array) }),
      ]),
    );
  });

  test("authoring analysis falls back to draft metrics for invalid graphs", () => {
    const report = analyzeStory(createInvalidStoryCase("missing-target"), {
      requireChoiceDescriptions: true,
    });

    expect(report.valid).toBe(false);
    expect(report.metrics.edgeCount).toBe(0);
    expect(report.endings.map((node) => node.id)).toEqual([]);
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing-choice-target", "missing-choice-description"]),
    );
  });

  test("edge counts include implicit nested and linear continuations", () => {
    const story = createNestedStory({ depth: 1, breadth: 3 });
    const compiled = compileStory(story);
    const implicitChoiceIds = getStoryNodeEntries(story).flatMap((entry) =>
      getStoryChoices(story, entry.node)
        .filter((choice) => choice.id.endsWith("__continue"))
        .map((choice) => choice.id),
    );

    expectValidStory(story);
    expect(compiled.edges).toHaveLength(countStoryEdges(story));
    expect(implicitChoiceIds.length).toBeGreaterThan(0);
  });
});
