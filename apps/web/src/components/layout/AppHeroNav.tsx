import { APP_NAV_ITEMS, type AppView } from "../../constants/appNav";

export function AppHeroNav({
  activeView,
  onViewChange,
}: {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}) {
  return (
    <>
      <section className="hero">
        <h1>SwingOps AI</h1>

        <p className="subtitle">Agentic Golf Retail Workflow Platform</p>

        <p className="hero__description">
          SwingOps AI turns messy golf trade-in notes into structured workflow
          runs using model routing, tool execution, human review, and MCP-style
          connector safety.
        </p>
      </section>

      <nav aria-label="SwingOps demo sections" className="app-nav">
        {APP_NAV_ITEMS.map((item) => (
          <button
            className={
              activeView === item.view
                ? "app-nav__button app-nav__button--active"
                : "app-nav__button"
            }
            key={item.view}
            onClick={() => onViewChange(item.view)}
            type="button"
          >
            <span>{item.eyebrow}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </nav>
    </>
  );
}
