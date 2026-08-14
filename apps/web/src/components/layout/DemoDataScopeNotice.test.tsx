import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DemoDataScopeNotice } from "./DemoDataScopeNotice";

describe("DemoDataScopeNotice", () => {
  it("explains both demo limitations and the production integration path", () => {
    const html = renderToStaticMarkup(<DemoDataScopeNotice />);

    expect(html).toContain(
      "Inventory and valuation coverage are intentionally limited.",
    );
    expect(html).toContain("small seeded club catalog");
    expect(html).toContain("illustrative reference ranges");
    expect(html).toContain(
      "authorized inventory, product-catalog, and valuation systems",
    );
    expect(html).toContain("human review, and audit controls");
    expect(html).toContain("Best way to explore the demo:");
    expect(html).toContain("Load the Golden Demonstration in Step 1");
  });
});
