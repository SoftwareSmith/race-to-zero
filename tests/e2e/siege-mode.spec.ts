import { expect, test } from "@playwright/test";

test("arms siege mode from the dashboard", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "Open interactive bug game" }).click();

  const statsHud = page.getByTestId("siege-hud");

  await expect(statsHud).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to dashboard" })).toBeVisible();
  await expect(statsHud.getByText("Bugs")).toBeVisible();
  await expect(statsHud.getByText("Kills")).toBeVisible();
  await expect(statsHud.getByText("Active tool")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open interactive bug game" })).toHaveCount(0);

  const box = await statsHud.boundingBox();
  expect(box?.width ?? 0).toBeLessThan(380);
});

test("keeps siege controls stable during pointer movement and exits cleanly", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "Open interactive bug game" }).click();

  await page.mouse.move(120, 120);
  await page.mouse.move(640, 220);
  await page.mouse.move(980, 520);

  await expect(page.getByTestId("siege-hud")).toBeVisible();
  await page.getByRole("button", { name: "Back to dashboard" }).click();

  await expect(page.getByRole("button", { name: "Open interactive bug game" })).toBeVisible();
  await expect(page.getByTestId("siege-hud")).toBeHidden();
});

test("esc exits siege mode", async ({ page }) => {
  await page.goto("./");

  await page.getByRole("button", { name: "Open interactive bug game" }).click();
  await expect(page.getByTestId("siege-hud")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("button", { name: "Open interactive bug game" })).toBeVisible();
  await expect(page.getByTestId("siege-hud")).toBeHidden();
});