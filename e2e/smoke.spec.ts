import { expect, test, type Page } from "@playwright/test";

const ROUTES = [
  "/dashboard",
  "/inventory/products", "/inventory/stock", "/inventory/warehouses", "/inventory/adjustments", "/inventory/transfers", "/inventory/labels",
  "/sales/invoices", "/sales/invoices/new", "/sales/pos", "/sales/quotations", "/sales/quotations/new", "/sales/orders", "/sales/challans", "/sales/returns", "/sales/customers", "/sales/payments",
  "/purchases/bills", "/purchases/bills/new", "/purchases/orders", "/purchases/grn", "/purchases/returns", "/purchases/suppliers", "/purchases/payments",
  "/accounting/accounts", "/accounting/vouchers", "/accounting/expenses", "/accounting/cash-book", "/accounting/bank-book", "/accounting/day-book", "/accounting/reports",
  "/accounting/reports?r=trial-balance", "/accounting/reports?r=profit-loss", "/accounting/reports?r=balance-sheet", "/accounting/reports?r=gstr1", "/accounting/reports?r=gstr3b",
  "/accounting/reports?r=itc", "/accounting/reports?r=sales-register", "/accounting/reports?r=purchase-register", "/accounting/reports?r=receivables", "/accounting/reports?r=payables", "/accounting/reports?r=item-profit",
  "/settings/business", "/settings/invoice", "/settings/taxes", "/settings/users", "/settings/activity",
];

const PUBLIC = ["/", "/login", "/signup", "/forgot-password", "/mfa", "/terms", "/privacy", "/help"];

function watch(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/favicon|Download the React DevTools/.test(t)) return;
    errors.push(`console: ${t}`);
  });
  return errors;
}

test("public pages render with a heading and no errors", async ({ page }) => {
  const errors = watch(page);
  for (const path of PUBLIC) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await expect(page.locator("h1").first(), path).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("security headers and CSP are set", async ({ request }) => {
  const res = await request.get("/login");
  const h = res.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("'nonce-");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("every app route renders for a signed in demo user without errors", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watch(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Open the demo business" }).click();
  await page.waitForURL("**/dashboard");
  for (const path of ROUTES) {
    const before = errors.length;
    await page.goto(path);
    await expect(page.locator("main h1, main h2").first(), path).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("This page could not be shown"), path).toHaveCount(0);
    await expect(page.getByText("could not be loaded"), path).toHaveCount(0);
    await page.waitForTimeout(250);
    expect(errors.slice(before), path).toEqual([]);
  }
});

test("create product, buy it, sell it, get paid, books balance", async ({ page }) => {
  const errors = watch(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Open the demo business" }).click();
  await page.waitForURL("**/dashboard");

  // Product
  await page.goto("/inventory/products?new=1");
  await page.getByLabel(/^Product name/).fill("E2E widget");
  await page.getByLabel("SKU", { exact: true }).fill("E2E1");
  await page.getByLabel("HSN or SAC", { exact: true }).fill("8501");
  await page.getByLabel("Sale price (before tax)").fill("200");
  await page.getByLabel("Purchase price (before tax)").fill("100");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByText("E2E widget saved")).toBeVisible();

  // Purchase 10
  await page.goto("/purchases/bills/new");
  await page.locator("#dparty").selectOption({ label: "Agro Foods Distributors" });
  await page.getByLabel("Supplier invoice no.").fill("E2E-001");
  await page.getByRole("combobox", { name: "Search product, SKU or barcode" }).fill("E2E1");
  await page.getByRole("combobox", { name: "Search product, SKU or barcode" }).press("Enter");
  await page.getByLabel("Quantity for row 1").fill("10");
  await page.getByRole("button", { name: "Issue and save" }).click();
  await expect(page.getByText(/Purchase bill .* saved/)).toBeVisible();

  // Sell 4 to an in-state customer
  await page.goto("/sales/invoices/new");
  await page.locator("#dparty").selectOption({ label: "Patil Kirana Stores" });
  await page.getByRole("combobox", { name: "Search product, SKU or barcode" }).fill("E2E1");
  await page.getByRole("combobox", { name: "Search product, SKU or barcode" }).press("Enter");
  await page.getByLabel("Quantity for row 1").fill("4");
  await expect(page.getByText("Different state: IGST")).toHaveCount(0);
  await page.getByRole("button", { name: "Issue and save" }).click();
  await expect(page.getByText(/Tax invoice INV\/\d\d-\d\d\/\d{4} saved/)).toBeVisible();

  // Overselling is refused
  await page.goto("/sales/invoices/new");
  await page.getByRole("combobox", { name: "Search product, SKU or barcode" }).fill("E2E1");
  await page.getByRole("combobox", { name: "Search product, SKU or barcode" }).press("Enter");
  await page.getByLabel("Quantity for row 1").fill("50");
  await expect(page.getByText(/Only 6 PCS available here/)).toBeVisible();
  await page.getByRole("button", { name: "Issue and save" }).click();
  await expect(page.getByText(/Only 6 PCS of E2E widget in stock/).first()).toBeVisible();

  // Books still balance
  await page.goto("/accounting/reports?r=trial-balance");
  await expect(page.getByText("Balanced")).toBeVisible();
  expect(errors).toEqual([]);
});
