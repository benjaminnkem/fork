import { expect, test } from "@playwright/test";

const isolatedWallet = "0x494c7fdb753c15b69fea2293e1b76567ca94462d";
const live = process.env.RUN_WEB_E2E === "1";

test("home asks for a real address and shows no fake figures", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fork" })).toBeVisible();
  await expect(page.getByLabel("Base address")).toBeVisible();
  await expect(page.getByText("No dashboard numbers are shown until the API returns")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("health factor");
  await expect(page.locator("body")).not.toContainText("$1,234");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Base address")).toBeVisible();
  expect(errors).toEqual([]);
});

test("invalid pasted address stays on the form", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Base address").fill("not-an-address");
  await page.getByRole("button", { name: "Analyze address" }).click();
  await expect(page.getByText("Enter a valid 20-byte Base address")).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("unknown wallet path is rejected", async ({ page }) => {
  await page.goto("/wallets/not-an-address");
  await expect(page.getByText("Invalid address")).toBeVisible();
});

test.describe("live api", () => {
  test.skip(!live, "Set RUN_WEB_E2E=1 with api + simulator running");

  test("analyzes a real wallet and streams a simulation", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Base address").fill(isolatedWallet);
    await page.getByRole("button", { name: "Analyze address" }).click();
    await expect(page).toHaveURL(new RegExp(`/wallets/${isolatedWallet}`, "i"));
    await expect(page.getByText("Supported positions")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Current risk")).toBeVisible();
    await page.getByRole("button", { name: "Launch simulation" }).click();
    await expect(page).toHaveURL(/\/simulations\//);
    await expect(page.getByText("SIMULATION_QUEUED")).toBeVisible();
    await expect(page.getByText("COMPLETED", { exact: true })).toBeVisible({ timeout: 240_000 });
    const proof = page.getByRole("link", { name: "Open proof" });
    await expect(proof).toBeEnabled();
    await proof.click();
    await expect(page.getByRole("heading", { name: "Proof receipt" })).toBeVisible();
    await expect(page.getByText(/schema/)).toBeVisible();
  });
});
