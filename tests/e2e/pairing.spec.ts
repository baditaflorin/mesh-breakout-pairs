import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";

test("a facilitator starts a shared pair round", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", {
    storagePrefix: "mesh-breakout-pairs",
  });
  try {
    await a.getByLabel("Your display name").fill("Nina");
    await b.getByLabel("Your display name").fill("Omar");
    await a.getByRole("button", { name: "Run this breakout" }).click();
    await expect(a.getByRole("button", { name: "Start breakouts" })).toBeEnabled();
    await a.getByRole("button", { name: "Start breakouts" }).click();
    await expect(a.getByText("Meet Omar", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(b.getByText("Meet Nina", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(b.getByLabel("Time remaining")).toContainText(/\d:\d\d/);
  } finally {
    await cleanup();
  }
});
