import { expect, test, type Page } from "@playwright/test";

// This app has no login and talks to the real database. The read-only checks always run.
// The full flow creates a product, stock and a bill, so it runs only when you ask for it:
//   E2E_ALLOW_WRITES=1 npx playwright test
const WRITES = process.env.E2E_ALLOW_WRITES === "1";

const PAGES = ["/dashboard", "/stock", "/bills", "/bills/new", "/settings"];

function watch(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test("opens straight to the data, with no login page", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const gone of ["/login", "/signup", "/forgot-password", "/mfa"]) {
    const res = await page.goto(gone);
    expect(res?.status(), gone).toBe(404);
  }
});

test("every page renders without errors", async ({ page }) => {
  const errors = watch(page);
  for (const path of PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await expect(page.locator("h1").first(), path).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("security headers and CSP are set", async ({ request }) => {
  const h = (await request.get("/dashboard")).headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("'nonce-");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("language button switches between Hinglish and English and is remembered", async ({ page }) => {
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation");

  // New visitors see Hinglish.
  await expect(nav.getByRole("link", { name: "Bill banao" })).toBeVisible();

  // The language button sits directly before the light/dark button.
  const lang = page.getByRole("button", { name: "English mein dikhao" });
  await expect(lang).toBeVisible();
  const nextIsTheme = await lang.evaluate((el) => /theme|rang/i.test(el.nextElementSibling?.getAttribute("aria-label") ?? ""));
  expect(nextIsTheme).toBe(true);

  await lang.click();
  await expect(nav.getByRole("link", { name: "Make bill" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Stock" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");

  // Remembered after a reload and on other pages.
  await page.goto("/stock");
  await expect(page.getByRole("heading", { level: 1, name: "Stock" })).toBeVisible();

  await page.getByRole("button", { name: "Show in Hinglish" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Maal" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi-Latn");
});

test("phone-size screen has no sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test("add product, add stock, make a bill, stock drops, home shows it", async ({ page }) => {
  test.skip(!WRITES, "Writes to the real database. Set E2E_ALLOW_WRITES=1 to run.");
  test.setTimeout(120_000);
  const errors = watch(page);
  const name = `E2E Rice ${Date.now()}`;

  // English for stable labels.
  await page.goto("/stock");
  await page.getByRole("button", { name: "English mein dikhao" }).click();

  // Product with 100 kg at 40, selling at 50.
  await page.getByRole("button", { name: "Add product" }).first().click();
  await page.getByLabel("Product name").fill(name);
  await page.getByLabel("Buying price (for one)").fill("40");
  await page.getByLabel("Selling price (for one)").fill("50");
  await page.getByLabel("How much do you have now?").fill("100");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("100 kg");

  // Bill 20 kg, no GST.
  await page.goto("/bills/new");
  await page.getByLabel("Customer name").fill("Ram");
  await page.getByLabel("Mobile number").fill("9876543210");
  await page.getByLabel("Product").first().selectOption({ label: `${name} (100 kg left)` });
  await page.getByLabel(/^Qty/).first().fill("20");
  await page.getByRole("button", { name: "Save bill" }).click();
  await page.waitForURL(/\/bills\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Ram")).toBeVisible();
  await expect(page.getByText(/GST \(/)).toHaveCount(0);

  // Selling more than is left is refused.
  await page.goto("/bills/new");
  await page.getByLabel("Product").first().selectOption({ label: `${name} (80 kg left)` });
  await page.getByLabel(/^Qty/).first().fill("500");
  await page.getByRole("button", { name: "Save bill" }).click();
  await expect(page.getByText("Only 80 kg left.")).toBeVisible();

  // Second bill with 5% GST shows a GST line.
  await page.getByLabel(/^Qty/).first().fill("10");
  await page.getByLabel(/^GST %/).fill("5");
  await page.getByRole("button", { name: "Save bill" }).click();
  await page.waitForURL(/\/bills\/[0-9a-f-]{36}$/);
  await expect(page.getByText("GST (5%)")).toBeVisible();

  // Stock went down to 70 kg and Home shows the sale.
  await page.goto("/stock");
  await expect(page.getByRole("listitem").filter({ hasText: name })).toContainText("70 kg");
  await page.goto("/dashboard");
  await expect(page.getByText(name)).toBeVisible();

  expect(errors).toEqual([]);
});
