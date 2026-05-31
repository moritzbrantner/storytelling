import { JSDOM } from "jsdom";

import { createBranchingStory, createLinearStory } from "./fixtures/story-factories.ts";

let domReady = false;

function setupDom() {
  if (domReady) return;

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1/",
    pretendToBeVisual: true,
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.navigator = dom.window.navigator;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLDivElement = dom.window.HTMLDivElement;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  domReady = true;
}

function createScenes(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `scene-${index}`,
    title: `Scene ${index}`,
    render: ({ value }) => globalThis.React.createElement("div", null, `Scene ${index} ${value}`),
  }));
}

function setScrollerGeometry(viewport, sceneCount) {
  Object.defineProperty(viewport, "scrollHeight", {
    configurable: true,
    value: (sceneCount + 1) * 100,
  });
  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    value: 100,
  });
}

export async function createReactBenchmarkCases({ distRoot, profile }) {
  setupDom();
  const React = await import("react");
  const { fireEvent, render, cleanup } = await import("@testing-library/react");
  const { StoryPlayer, StoryScroller, StoryScrollTimeline } = await import(`${distRoot}/index.js`);

  globalThis.React = React;

  const linear100 = createLinearStory({ count: 100 });
  const branchStory = createBranchingStory({ depth: 1, fanout: 2 });
  const sceneCounts = profile === "smoke" ? [100] : [10, 100, 500];
  const cases = [
    {
      name: "react.story-player.render.linear-100",
      samples: 15,
      run: () => {
        const result = render(React.createElement(StoryPlayer, { story: linear100 }));
        result.unmount();
        cleanup();
      },
    },
    {
      name: "react.story-player.choice-update.branch",
      samples: 15,
      run: () => {
        const result = render(React.createElement(StoryPlayer, { story: branchStory }));
        fireEvent.click(result.getByRole("button", { name: "Choice 0.0" }));
        result.unmount();
        cleanup();
      },
    },
    {
      name: "react.story-scroller.render.scenes-100",
      samples: 15,
      run: () => {
        const result = render(
          React.createElement(StoryScroller, {
            ariaLabel: "Benchmark scroller",
            scenes: createScenes(100),
          }),
        );
        result.unmount();
        cleanup();
      },
    },
    {
      name: "react.scroll-timeline.update",
      samples: 15,
      scaleDurationBy: 100,
      run: () => {
        const result = render(
          React.createElement(StoryScrollTimeline, {
            ariaLabel: "Benchmark timeline",
            scenes: createScenes(100),
          }),
        );
        const viewport = result.container.querySelector("[data-story-scroller-viewport]");

        if (!viewport) {
          throw new Error("StoryScrollTimeline benchmark could not find viewport.");
        }

        setScrollerGeometry(viewport, 100);

        for (let index = 0; index < 100; index += 1) {
          viewport.scrollTop = index;
          fireEvent.scroll(viewport);
        }

        result.unmount();
        cleanup();
      },
    },
  ];

  if (profile === "smoke") {
    return cases;
  }

  return [
    ...cases,
    ...sceneCounts.map((count) => ({
      name: `react.story-scroller.render.scenes-${count}`,
      samples: count >= 500 ? 8 : 15,
      run: () => {
        const result = render(
          React.createElement(StoryScroller, {
            ariaLabel: `Benchmark scroller ${count}`,
            scenes: createScenes(count),
          }),
        );
        result.unmount();
        cleanup();
      },
    })),
  ];
}
