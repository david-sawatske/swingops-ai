import { expect, test } from "@playwright/test";

test("completes the deterministic golden demonstration from intake to final report", async ({
  page,
}) => {
  const browserFailures: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserFailures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    browserFailures.push(`page: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      browserFailures.push(
        `response: ${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });

  try {
    await page.goto("/");

    await page
      .getByRole("button", { name: "Continue to Messy Source Intake" })
      .click();
    await page
      .getByRole("button", { name: "Load golden demonstration" })
      .click();

    const intakeStatus = page.getByLabel("Source intake status");
    await expect(intakeStatus).toContainText("4 sources staged");
    await expect(intakeStatus).toContainText("4 source types");
    await expect(intakeStatus).toContainText("4 ready sources");
    await expect(intakeStatus).toContainText("Normalization: not run");

    await page.getByRole("button", { name: "Normalize Sources" }).click();

    await expect(
      page.getByRole("heading", { name: "What did intake create?" }),
    ).toBeVisible();
    await expect(
      page.getByText("Extracted", { exact: true }).locator(".."),
    ).toContainText("5");
    await expect(page.getByRole("cell", { name: "Cleveland" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "TaylorMade" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Odyssey" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Titleist" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Callaway" })).toBeVisible();

    await page
      .getByRole("button", { name: "Continue to Guarded Workflow Execution" })
      .click();
    await page.getByRole("button", { name: "Run Guarded Workflow" }).click();

    await expect(
      page.getByText("Workflow run completed", { exact: true }),
    ).toBeVisible({
      timeout: 30_000,
    });
    const modelSummary = page.getByLabel("Model execution summary");
    await expect(modelSummary).toContainText("MOCK");
    await expect(modelSummary).toContainText("Fallback");
    await expect(modelSummary).toContainText("Not used");
    await expect(modelSummary).toContainText("Records assessed");
    await expect(modelSummary).toContainText("4");

    await page
      .getByRole("button", { name: "Continue to Validation and Review" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Which records need attention before the final report?",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("4 active", { exact: true }).first(),
    ).toBeVisible();

    const taylorMadeReview = page.getByLabel(
      "TaylorMade · Stealth 2 · Driver review record",
    );
    await taylorMadeReview
      .getByRole("heading", { name: "TaylorMade · Stealth 2 · Driver" })
      .click();
    await taylorMadeReview
      .getByRole("button", { name: "Accept Stiff and resolve" })
      .click();
    await expect(taylorMadeReview).toContainText("Review status: resolved");
    await expect(taylorMadeReview).not.toHaveAttribute("open", "");
    await expect(
      page.getByRole("heading", { name: "Current run review records" }),
    ).toBeInViewport();

    const odysseyReview = page.getByLabel(
      "Odyssey · White Hot OG · Putter review record",
    );
    await odysseyReview
      .getByRole("heading", { name: "Odyssey · White Hot OG · Putter" })
      .click();
    await odysseyReview
      .getByRole("button", { name: "Edit before resolving" })
      .click();
    await expect(
      odysseyReview.getByRole("combobox", {
        name: "Condition grade",
        exact: true,
      }),
    ).toHaveValue("6.0 Poor");
    await odysseyReview
      .getByRole("button", { name: "Save correction and resolve" })
      .click();
    await expect(odysseyReview).toContainText("Review status: resolved");

    const titleistReview = page.getByLabel(
      "Titleist · TSR · Fairway Wood review record",
    );
    await titleistReview
      .getByRole("heading", { name: "Titleist · TSR · Fairway Wood" })
      .click();
    await expect(titleistReview).toContainText("Choose the catalog product");
    await titleistReview
      .getByRole("button", { name: "Confirm TSR2 and resolve" })
      .click();
    await expect(titleistReview).toContainText("Review status: resolved");

    const callawayReview = page.getByLabel(
      "Callaway · mystery driver · Driver review record",
    );
    await callawayReview
      .getByRole("heading", { name: "Callaway · mystery driver · Driver" })
      .click();
    await expect(callawayReview).toContainText("Store inspection required");
    await expect(callawayReview).toContainText(
      "Do not infer these values from the current record",
    );
    await callawayReview
      .getByRole("button", { name: "Send to store inspection" })
      .click();
    await expect(callawayReview).toContainText("Store inspection requested");

    await expect(
      page.getByText("1 active", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("1 open · 3 resolved", { exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Continue to Final Run Report" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "What happened across the five-step workflow?",
      }),
    ).toBeVisible();

    const readyRecords = page
      .getByRole("heading", { name: "Ready records" })
      .locator("..");
    await expect(readyRecords).toContainText("4");
    await expect(
      page.getByText(
        "5 merged final record(s), 3 reviewed write(s), 3 learning event(s).",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText("1 item(s) still need human review"),
    ).toBeVisible();
    await expect(
      page.getByText("record(s) updated by review").locator(".."),
    ).toContainText("3");
    await expect(
      page.getByText("field correction(s) captured").locator(".."),
    ).toContainText("3");
    await expect(
      page.getByText("learning event(s) written").locator(".."),
    ).toContainText("3");
  } finally {
    expect
      .soft(browserFailures, "browser console, page, and server failures")
      .toEqual([]);
  }
});
