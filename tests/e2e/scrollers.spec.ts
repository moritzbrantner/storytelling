import { expect, test, type Locator, type Page } from "@playwright/test";

function scrollerViewport(page: Page) {
  return page.locator("[data-story-scroller-viewport]");
}

function activeScrollerPage(page: Page) {
  return page.locator('[data-story-scroller-page][data-active="true"]');
}

async function getScrollerScrollTop(page: Page) {
  return scrollerViewport(page).evaluate((element) => element.scrollTop);
}

async function openExample(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Storytelling component lab" })).toBeVisible();
}

async function chooseStoryType(page: Page, label: string) {
  await page.getByRole("radio", { name: label }).click();
}

async function chooseComponent(page: Page, label: string) {
  await page.getByRole("radio", { name: label }).click();
}

async function expectActiveScene(page: Page, label: RegExp) {
  await expect(activeScrollerPage(page)).toHaveAttribute("aria-label", label);
}

async function expectPlayerHeading(region: Locator, name: string) {
  await expect(region.getByRole("heading", { name }).last()).toBeVisible();
}

async function continuePlayerTo(page: Page, region: Locator, heading: string) {
  const continueButton = page.getByRole("button", { name: "Continue" });
  await continueButton.focus();
  await expect(continueButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expectPlayerHeading(region, heading);
}

function storyStateSummary(page: Page) {
  return page.getByLabel("Story state").locator("pre").first();
}

function choiceIdsSummary(page: Page) {
  return page.getByLabel("Story state").locator("code").first();
}

function autoscrollDetails(page: Page) {
  return page.getByLabel("Story state").locator("pre").nth(1);
}

async function waitForScrollStateToSettle(page: Page) {
  await scrollerViewport(page).evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function focusScroller(region: Locator) {
  await region.focus();
  await expect(region).toBeFocused();
}

async function expectMotionPresetReset(page: Page, region: Locator, preset: string) {
  await page.getByRole("button", { name: preset }).click();
  await expect(region).toBeVisible();
  await expect(storyStateSummary(page)).toHaveText("Signal resolves\nProgress 0%\nScene 1 of 4");
  await expectActiveScene(page, /1\. Signal resolves/);
}

async function setScrollerSceneProgress(page: Page, progress: number) {
  await scrollerViewport(page).evaluate((element, nextProgress) => {
    const activePage = element.querySelector<HTMLElement>(
      '[data-story-scroller-page][data-active="true"]',
    );
    const activeIndex = Number(activePage?.dataset.storyScrollerIndex ?? 0);
    const sceneCount = element.querySelectorAll("[data-story-scroller-marker]").length || 1;
    const transitionUnits = 16;
    const totalUnits = sceneCount * 100 + Math.max(sceneCount - 1, 0) * transitionUnits;
    const targetUnit = activeIndex * (100 + transitionUnits) + nextProgress * 100;
    const maxScrollTop = Math.max(element.scrollHeight - element.clientHeight, 0);

    element.scrollTop = (targetUnit / totalUnits) * maxScrollTop;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  }, progress);
}

test.describe("StoryScroller example app", () => {
  test("branching story player supports choices, back navigation, and completed branches", async ({
    page,
  }) => {
    await openExample(page);

    const region = page.getByRole("region", { name: "Observatory Relay" });
    await expect(region).toBeVisible();
    await expectPlayerHeading(region, "Wake the observatory");

    await page.getByRole("button", { name: "Answer the pulse" }).click();
    await expectPlayerHeading(region, "A pilot breaks through");

    await page.keyboard.press("Backspace");
    await expectPlayerHeading(region, "Wake the observatory");

    await page.getByRole("button", { name: "Trace the source" }).click();
    await expectPlayerHeading(region, "The map reveals a hidden harbor");

    await page.getByRole("button", { name: /Broadcast the fix/ }).click();
    await expectPlayerHeading(region, "Every receiver answers back");
    await expect(region.getByText("This branch is complete.").first()).toBeVisible();
    await expect(storyStateSummary(page)).toContainText("Wake the observatory");
    await expect(storyStateSummary(page)).toContainText("The map reveals a hidden harbor");
    await expect(storyStateSummary(page)).toContainText("Every receiver answers back");
  });

  test("branching story player honors start path presets and resets to opening", async ({
    page,
  }) => {
    await openExample(page);

    await page.getByRole("button", { name: "Harbor team" }).click();
    await expect(choiceIdsSummary(page)).toHaveText("trace -> send-team");
    await expectPlayerHeading(
      page.getByRole("region", { name: "Observatory Relay" }),
      "The field team finds the beacon",
    );
    await expect(storyStateSummary(page)).toContainText("The field team finds the beacon");

    await page.getByRole("button", { name: "Opening" }).click();
    await expect(choiceIdsSummary(page)).toHaveText("none");
    await expectPlayerHeading(
      page.getByRole("region", { name: "Observatory Relay" }),
      "Wake the observatory",
    );
  });

  test("Long branching showcase player supports alternate route choices", async ({ page }) => {
    await openExample(page);
    await chooseStoryType(page, "Branching (Deep)");

    const region = page.getByRole("region", { name: "Extended Relay Route" });
    await expect(region).toBeVisible();
    await expectPlayerHeading(region, "Relay awakening");

    await page.getByRole("button", { name: "Answer the pilot" }).click();
    await expectPlayerHeading(region, "Pilot signature locks in");

    await continuePlayerTo(page, region, "The wave is stable");
    await continuePlayerTo(page, region, "Control asks for a route decision");
    await page.getByRole("button", { name: "Stabilize the route" }).click();
    await expectPlayerHeading(region, "Stabilized route active");
    await continuePlayerTo(page, region, "Relay hub convergence");
    await continuePlayerTo(page, region, "Clearance diagnostics run");
    await continuePlayerTo(page, region, "Network clearance");
    await expect(storyStateSummary(page)).toContainText("Relay hub convergence");
  });

  test("Long branching showcase player preset displays expected branch sequence", async ({
    page,
  }) => {
    await openExample(page);
    await chooseStoryType(page, "Branching (Deep)");
    await page.getByRole("button", { name: "Pilot route (stabilize)" }).click();

    await expect(choiceIdsSummary(page)).toHaveText("answer-pilot -> stabilize-route");
    await expectPlayerHeading(
      page.getByRole("region", { name: "Extended Relay Route" }),
      "Network clearance",
    );
    await expect(storyStateSummary(page)).toContainText("Pilot signature locks in");
    await expect(storyStateSummary(page)).toContainText("Relay hub convergence");
  });

  test("Long branching showcase scroller can jump to overlay choices and switch branches after return", async ({
    page,
  }) => {
    await openExample(page);
    await chooseStoryType(page, "Branching (Deep)");
    await chooseComponent(page, "Scroller");

    const region = page.getByRole("region", { name: "Extended Relay Route scroller" });
    await expect(region).toBeVisible();
    await focusScroller(region);

    await setScrollerSceneProgress(page, 0.95);
    await page.getByRole("button", { name: /Trace the source/ }).click();
    await expectActiveScene(page, /2\. Unknown source appears on scan/);

    await region.press("Home");
    await expectActiveScene(page, /1\. Relay awakening/);

    await setScrollerSceneProgress(page, 0.95);
    await page.getByRole("button", { name: /Answer the pilot/ }).click();
    await expectActiveScene(page, /2\. Pilot signature locks in/);
  });

  test("linear story scroller supports vertical scrolling and horizontal scene navigation", async ({
    page,
  }) => {
    await openExample(page);
    await chooseStoryType(page, "Linear");

    const region = page.getByRole("region", { name: "Morning Dispatch scroller" });
    await expect(region).toBeVisible();
    await expectActiveScene(page, /1\. Brief the morning desk/);
    await focusScroller(region);

    await region.press("ArrowDown");
    await expect.poll(() => getScrollerScrollTop(page)).toBeGreaterThan(0);
    const firstStep = await getScrollerScrollTop(page);

    await region.press("ArrowDown");
    await expect.poll(() => getScrollerScrollTop(page)).toBeGreaterThan(firstStep);

    await region.press("ArrowRight");
    await expectActiveScene(page, /2\. Ride the first train/);
    await expect(page.getByText("Passengers fall quiet")).toBeVisible();

    await region.press("ArrowLeft");
    await expectActiveScene(page, /1\. Brief the morning desk/);
  });

  test("branching story scroller follows a preset path and can jump between resolved scenes", async ({
    page,
  }) => {
    await openExample(page);
    await page.getByRole("button", { name: "Pilot route" }).click();
    await chooseComponent(page, "Scroller");

    const region = page.getByRole("region", { name: "Observatory Relay scroller" });
    await expect(region).toBeVisible();
    await expectActiveScene(page, /1\. Wake the observatory/);
    await focusScroller(region);

    await region.press("ArrowRight");
    await expectActiveScene(page, /2\. A pilot breaks through/);
    await expect(page.getByRole("heading", { name: "A pilot breaks through" })).toBeVisible();

    await region.press("Home");
    await expectActiveScene(page, /1\. Wake the observatory/);
  });

  test("branching story minimap selects scenes and collapses", async ({ page }) => {
    await openExample(page);
    await page.getByRole("button", { name: "Pilot route" }).click();
    await chooseComponent(page, "Scroller");

    const region = page.getByRole("region", { name: "Observatory Relay scroller" });
    await expect(region).toBeVisible();

    const secondScene = page.getByRole("button", {
      name: "Go to scene 2: A pilot breaks through",
    });
    await secondScene.click();
    await expectActiveScene(page, /2\. A pilot breaks through/);

    await page.getByRole("button", { name: "Minimize minimap" }).focus();
    await page.keyboard.press("Enter");
    await expect(secondScene).toBeHidden();

    await page.getByRole("button", { name: "Show minimap" }).focus();
    await page.keyboard.press("Enter");
    await expect(secondScene).toBeVisible();
  });

  test("branching story choices appear as an overlay and support numeric hotkeys", async ({
    page,
  }) => {
    await openExample(page);
    await chooseComponent(page, "Scroller");

    const region = page.getByRole("region", { name: "Observatory Relay scroller" });
    await expect(region).toBeVisible();
    await focusScroller(region);

    await scrollerViewport(page).evaluate((element) => {
      element.scrollTop = element.scrollHeight - element.clientHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    await expect(page.getByText("Route the signal.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Answer the pulse/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Trace the source/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Check the archive/ })).toBeVisible();

    await expect
      .poll(async () =>
        activeScrollerPage(page).evaluate((article) => {
          const stage = article.querySelector(".demo-stage");

          return stage
            ? Math.abs(
                article.getBoundingClientRect().height - stage.getBoundingClientRect().height,
              )
            : Number.POSITIVE_INFINITY;
        }),
      )
      .toBeLessThan(1);

    await page.keyboard.press("2");
    await expectActiveScene(page, /2\. The map reveals a hidden harbor/);
  });

  test("branching story opening choices are selectable during overlay reveal", async ({ page }) => {
    await openExample(page);
    await chooseComponent(page, "Scroller");

    const region = page.getByRole("region", { name: "Observatory Relay scroller" });
    await expect(region).toBeVisible();

    await scrollerViewport(page).evaluate((element) => {
      element.scrollTop = (element.scrollHeight - element.clientHeight) * 0.95;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    const answerChoice = page.getByRole("button", { name: /Answer the pulse/ });
    await expect(answerChoice).toBeVisible();
    await expect(answerChoice).toBeEnabled();

    await answerChoice.click();
    await expectActiveScene(page, /2\. A pilot breaks through/);
  });

  test("branching story scroller allows choosing a different branch after returning", async ({
    page,
  }) => {
    await openExample(page);
    await chooseComponent(page, "Scroller");

    const region = page.getByRole("region", { name: "Observatory Relay scroller" });
    await expect(region).toBeVisible();
    await focusScroller(region);

    await setScrollerSceneProgress(page, 0.95);
    await page.getByRole("button", { name: /Trace the source/ }).click();
    await expectActiveScene(page, /2\. The map reveals a hidden harbor/);

    await region.press("Home");
    await expectActiveScene(page, /1\. Wake the observatory/);

    await setScrollerSceneProgress(page, 0.95);
    await page.getByRole("button", { name: /Answer the pulse/ }).click();
    await expectActiveScene(page, /2\. A pilot breaks through/);
  });

  test("custom motion scroller supports scene jumps, direct end navigation, and reverse scroll", async ({
    page,
  }) => {
    await openExample(page);
    await chooseStoryType(page, "Motion");

    const region = page.getByRole("region", { name: "Motion examples" });
    await expect(region).toBeVisible();
    await expectActiveScene(page, /1\. Signal resolves/);
    await focusScroller(region);

    await region.press("ArrowRight");
    await waitForScrollStateToSettle(page);
    await expectActiveScene(page, /2\. Field shifts/);
    await expect(storyStateSummary(page)).toHaveText("Field shifts\nProgress 0%\nScene 2 of 4");

    await region.press("End");
    await expectActiveScene(page, /4\. Archive lands/);

    const endTop = await getScrollerScrollTop(page);
    await region.press("ArrowUp");
    await expect.poll(() => getScrollerScrollTop(page)).toBeLessThan(endTop);

    await region.press("Home");
    await expectActiveScene(page, /1\. Signal resolves/);
  });

  test("motion transition presets reset the visible scene and direct mode remains navigable", async ({
    page,
  }) => {
    await openExample(page);
    await chooseStoryType(page, "Motion");

    const region = page.getByRole("region", { name: "Motion examples" });
    await expect(region).toBeVisible();

    await expectMotionPresetReset(page, region, "Fade");
    await expectMotionPresetReset(page, region, "Slide");
    await expectMotionPresetReset(page, region, "Push");
    await expectMotionPresetReset(page, region, "Wipe");
    await expectMotionPresetReset(page, region, "Zoom");
    await expectMotionPresetReset(page, region, "Blur");
    await expectMotionPresetReset(page, region, "Direct");

    await focusScroller(region);
    await region.press("ArrowRight");
    await expectActiveScene(page, /2\. Field shifts/);
  });

  test("autoscroll scroller advances itself and still accepts keyboard navigation", async ({
    page,
  }) => {
    await openExample(page);
    await chooseStoryType(page, "Autoscroll");

    const region = page.getByRole("region", { name: "Autoscroll examples" });
    await expect(region).toBeVisible();
    await expectActiveScene(page, /1\. Briefing opens/);

    const initialTop = await getScrollerScrollTop(page);
    await expect.poll(() => getScrollerScrollTop(page)).toBeGreaterThan(initialTop);

    await focusScroller(region);
    await region.press("ArrowRight");
    await expectActiveScene(page, /2\. Evidence passes/);

    await region.press("ArrowLeft");
    await expectActiveScene(page, /1\. Briefing opens/);
  });

  test("autoscroll presets update rendered details and continue advancing", async ({ page }) => {
    await openExample(page);
    await chooseStoryType(page, "Autoscroll");

    const region = page.getByRole("region", { name: "Autoscroll examples" });
    await expect(region).toBeVisible();

    await page.getByRole("button", { name: "Fast scan" }).click();
    await expect(autoscrollDetails(page)).toHaveText(
      "Pace 34 units/s\nInput scale 1.25\nTransition direct",
    );

    const initialTop = await getScrollerScrollTop(page);
    await expect.poll(() => getScrollerScrollTop(page)).toBeGreaterThan(initialTop);

    await page.getByRole("button", { name: "Reading pace" }).click();
    await expect(autoscrollDetails(page)).toHaveText(
      "Pace 12 units/s\nInput scale 0.5\nTransition 14 units fade",
    );
  });

  test("authoring view reports schema coverage and applies suggested core fixes", async ({
    page,
  }) => {
    await openExample(page);
    await chooseStoryType(page, "Authoring");

    const workbench = page.getByRole("region", { name: "Authoring workbench" });
    const diagnosticCodes = workbench.locator(".authoring-panel").first().locator("strong");
    await expect(workbench).toBeVisible();
    await expect(workbench.getByRole("heading", { name: "Authoring draft review" })).toBeVisible();
    await expect(workbench.getByLabel("Authoring metrics")).toContainText("Issues");
    await expect(diagnosticCodes.filter({ hasText: "blank-story-title" })).toBeVisible();
    await expect(workbench.getByText('Remove unreachable node "locked"')).toBeVisible();
    await expect(workbench.getByText(/storyDocumentJsonSchema/)).toBeVisible();
    await expect(workbench.getByText(/id, title, subtitle, description/)).toBeVisible();

    await page.getByRole("button", { name: "Apply suggested fixes" }).click();
    await expect(workbench.getByLabel("Authoring metrics")).toContainText("0");
    await expect(diagnosticCodes.filter({ hasText: "blank-story-title" })).toBeHidden();

    await page.getByRole("button", { name: "Show original draft" }).click();
    await expect(diagnosticCodes.filter({ hasText: "blank-story-title" })).toBeVisible();
  });
});
