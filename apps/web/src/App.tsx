import { DashboardSection } from "./components/DashboardSection";
import { EmptyState } from "./components/EmptyState";

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <h1>SwingOps AI</h1>

        <p className="subtitle">Agentic Golf Retail Workflow Platform</p>
      </section>

      <DashboardSection
        title="Intake Batches"
        description="Messy golf trade-in notes, CSV rows, and email text imported for workflow processing."
      >
        <EmptyState
          title="No intake batches loaded yet"
          message="API-backed intake batch data will be connected next."
        />
      </DashboardSection>
    </main>
  );
}

export default App;
