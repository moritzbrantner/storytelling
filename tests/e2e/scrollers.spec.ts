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

function storyStateSummary(page: Page) {
  return page.getByLabel("Story state").locator("pre").first();
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

test.describe("StoryScroller example app", () => {
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
});
