import { test, expect } from "@playwright/test";

// Covers the critical path from the product spec (docs/product-spec.md §12 / brief §24):
// signup -> onboarding -> personalized feed -> opportunity detail -> save -> tracker.
// Runs against the real dev server + real (seeded) database, exercising the actual
// matching engine end-to-end rather than mocked data.

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10000)}@polaris.test`;
}

// TagInput (components/ui/tag-input.tsx) commits a tag on Enter, not on fill() alone — fill()
// only sets the draft text. Filling a comma-joined string in one shot was the old CSV-input
// interaction pattern and no longer applies (docs/personalization.md).
async function addTag(page: import("@playwright/test").Page, label: string, ...tags: string[]) {
  const input = page.getByLabel(label);
  for (const tag of tags) {
    await input.fill(tag);
    await input.press("Enter");
  }
}

test("signup through onboarding to a personalized, explained feed", async ({ page }) => {
  // This flow makes 7+ sequential real Cloud SQL round trips (one PATCH per onboarding step)
  // plus a Gemini call for the aspirations step — comfortably more than any other E2E test,
  // and occasionally over Playwright's 30s default under real Cloud SQL Auth Proxy latency
  // (docs/data-architecture.md's latency note above). Bumped, not papered over, matching that
  // same rationale rather than leaving this test intermittently flaky.
  test.setTimeout(60000);
  const email = uniqueEmail();

  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("TestPassword123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/onboarding/, { timeout: 20000 });
  await expect(page.getByText("Step 1 of 6")).toBeVisible();

  // Step 1: basics
  await page.getByLabel("Name").fill("E2E Test User");
  await page.getByLabel("Location / country").fill("India");
  await page.getByLabel("Citizenship").fill("India");
  await page.getByLabel("Current stage").selectOption("EARLY_CAREER");
  await page.getByLabel("Gender").selectOption("woman");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: education
  await expect(page.getByText("Step 2 of 6")).toBeVisible();
  await page.getByLabel("School / university").fill("Test University");
  await addTag(page, "Academic interests", "AI/ML", "Public Policy");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: professional
  await expect(page.getByText("Step 3 of 6")).toBeVisible();
  await addTag(page, "Skills", "Research");
  await addTag(page, "Technologies & tools", "Python");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4: interests
  await expect(page.getByText("Step 4 of 6")).toBeVisible();
  await page.getByRole("button", { name: "AI/ML", exact: true }).click();
  await page.getByRole("button", { name: "Public Policy", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5: aspirations
  await expect(page.getByText("Step 5 of 6")).toBeVisible();
  await page
    .getByPlaceholder(/I want to eventually work in AI policy/)
    .fill("I want to work in AI policy and technology governance.");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 6: preferences
  await expect(page.getByText("Step 6 of 6")).toBeVisible();
  await page.getByRole("button", { name: "Scholarship", exact: true }).click();
  await page.getByRole("button", { name: "Fellowship", exact: true }).click();
  await page.getByRole("button", { name: "See my feed" }).click();

  // Lands on a populated, explained feed
  await expect(page).toHaveURL(/\/feed/);
  await expect(page.getByRole("heading", { name: "Your feed" })).toBeVisible();
  await expect(page.getByText("Why this matches you").first()).toBeVisible();
  await expect(page.getByText(/^Match$/).first()).toBeVisible({ timeout: 10000 });
});

test("opportunity detail -> save -> appears in tracker", async ({ page }) => {
  // Use the seeded demo account (has a complete profile) to reach the feed directly.
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@polaris.demo");
  await page.getByLabel("Password").fill("PolarisDemo!23");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/feed/);

  const firstCardLink = page.getByRole("link", { name: "View details →" }).first();
  await firstCardLink.click();

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Scoped to the heading role, not a plain text match — real ingested opportunity
  // descriptions can themselves contain the literal word "Overview" as their own first word
  // (e.g. scraped content that starts "Overview: ..."), which would otherwise make
  // getByText("Overview") ambiguous once more than one such opportunity is in the catalog.
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Important dates")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source", exact: true })).toBeVisible();
  await expect(page.getByText("Last checked")).toBeVisible();

  const title = await page.getByRole("heading", { level: 1 }).textContent();

  // Save/Interested/Applied/Completed live directly on the detail page (components/feed/tracking-actions.tsx).
  const saveButton = page.getByRole("button", { name: /Save$/ });
  const alreadySaved = (await saveButton.getAttribute("aria-pressed")) === "true";
  if (!alreadySaved) {
    await saveButton.click();
    await expect(saveButton).toHaveAttribute("aria-pressed", "true");
  }

  await page.goto("/tracker");
  await expect(page.getByRole("heading", { name: "Your tracker" })).toBeVisible();
  await expect(page.getByText(title!.trim())).toBeVisible();
});

test("search with no matches shows an empty state, not an error", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByText(/\d+ results?/)).toBeVisible();

  const searchResponse = page.waitForResponse((res) => res.url().includes("/api/search"));
  await page.getByPlaceholder("Search opportunities…").fill("zzznonexistentqueryxyz123");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await searchResponse;

  await expect(page.getByText("No opportunities found")).toBeVisible({ timeout: 10000 });
});

test("a logged-out visitor can browse and view an opportunity, but sees no match score", async ({
  page,
}) => {
  await page.goto("/search");
  await expect(page.getByText(/\d+ results?/)).toBeVisible();

  const firstCardLink = page.getByRole("link", { name: "View details →" }).first();
  await firstCardLink.click();

  await expect(page.getByText("Why Polaris recommends it")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Source", exact: true })).toBeVisible();
});
