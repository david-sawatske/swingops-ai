import type { ReactNode } from "react";

type DashboardSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function DashboardSection({
  title,
  description,
  children,
}: DashboardSectionProps) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section__header">
        <h2>{title}</h2>

        {description ? <p>{description}</p> : null}
      </div>

      <div className="dashboard-section__body">{children}</div>
    </section>
  );
}
