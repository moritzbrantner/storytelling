import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { StoryPlayer, defineStory } from ".";

const linearStory = defineStory({
  id: "compound-linear",
  title: "Compound linear story",
  openingNodeId: "start",
  nodes: [
    { id: "start", title: "Start", next: "middle" },
    { id: "middle", title: "Middle", next: "end" },
    { id: "end", title: "End" },
  ],
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("StoryPlayer compound composition", () => {
  test("composes navigation primitives and rewinds through the menu", () => {
    render(
      <StoryPlayer.Root story={linearStory}>
        <StoryPlayer.Layout layout="stacked">
          <StoryPlayer.Stage render={({ node }) => <p>{node.title}</p>} />
          <StoryPlayer.Aside layout="stacked">
            <StoryPlayer.Transport />
            <StoryPlayer.Menu />
          </StoryPlayer.Aside>
        </StoryPlayer.Layout>
      </StoryPlayer.Root>,
    );

    expect(screen.getByText("Start")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Middle", { selector: "p" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("navigation", { name: "Story menu" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByText("Start")).toBeTruthy();
  });

  test("pauses and resumes linear autoplay", () => {
    vi.useFakeTimers();

    render(
      <StoryPlayer.Root story={linearStory} autoplay={{ enabled: true, intervalMs: 50 }}>
        <StoryPlayer.Layout layout="stacked">
          <StoryPlayer.Stage render={({ node }) => <p>{node.title}</p>} />
          <StoryPlayer.PlayPause />
        </StoryPlayer.Layout>
      </StoryPlayer.Root>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText("Start")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByText("Middle")).toBeTruthy();
  });
});
