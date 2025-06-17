import { test, expect } from "@playwright/test";

test.describe("CS2 Memory Game", () => {
  test("should load the main page", async ({ page }) => {
    await page.goto("/");

    // Check if the page loads without errors
    await expect(page.locator("h1")).toHaveText("CS2 Memory Game");

    // Wait for the page to be fully loaded
    await page.waitForLoadState("networkidle");
  });

  test("should have a responsive layout", async ({ page }) => {
    await page.goto("/");

    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForLoadState("networkidle");

    // Test tablet layout
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState("networkidle");

    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState("networkidle");
  });

  test("should not have any console errors on load", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that there are no console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test("should have proper meta tags", async ({ page }) => {
    await page.goto("/");

    // Check if basic meta tags are present
    const viewport = await page.getAttribute(
      'meta[name="viewport"]',
      "content"
    );
    expect(viewport).toBeTruthy();

    // Check for character encoding
    const charset = await page.getAttribute("meta[charset]", "charset");
    expect(charset).toBeTruthy();
  });
});
