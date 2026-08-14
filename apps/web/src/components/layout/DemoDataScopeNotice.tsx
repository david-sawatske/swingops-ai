export function DemoDataScopeNotice() {
  return (
    <aside
      aria-labelledby="demo-data-scope-title"
      className="demo-data-scope-notice"
    >
      <div className="demo-data-scope-notice__heading">
        <span>Demo data scope</span>
        <strong id="demo-data-scope-title">
          Inventory and valuation coverage are intentionally limited.
        </strong>
      </div>

      <div className="demo-data-scope-notice__limits">
        <p>
          <strong>Inventory:</strong> This preview uses a small seeded club
          catalog, so only the included example products can be matched.
        </p>
        <p>
          <strong>Valuation:</strong> Trade-in estimates use illustrative
          reference ranges, not a complete or live market-pricing source.
        </p>
      </div>

      <p className="demo-data-scope-notice__production-path">
        A production deployment would connect the same guarded workflow to
        authorized inventory, product-catalog, and valuation systems. That
        expands coverage beyond the demo examples while preserving grounding,
        human review, and audit controls.
      </p>

      <p className="demo-data-scope-notice__recommended-path">
        <strong>Best way to explore the demo:</strong> Load the Golden
        Demonstration in Step 1. Its examples are designed for the seeded
        catalog and valuation ranges, so you can experience the complete
        workflow.
      </p>
    </aside>
  );
}
