import { test, expect } from "@playwright/test";

test("home page renders legions club header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/LEGIONS CLUB/i)).toBeVisible();
});
