import type { ReactNode } from "react";

export type AdminOpsMetric = {
  label: string;
  value: string | number;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function AdminOpsMetricCard({ metric }: { metric: AdminOpsMetric }) {
  return (
    <article className="admin-ops-metric-card">
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <p>{metric.detail}</p>
      {metric.actionLabel && metric.onAction ? (
        <button
          className="admin-ops-card-action-button"
          onClick={metric.onAction}
          type="button"
        >
          {metric.actionLabel}
        </button>
      ) : null}
    </article>
  );
}

export function AdminOpsInspectionGuide({
  showing,
  attention,
  inspectNext,
}: {
  showing: string;
  attention: string;
  inspectNext: string;
}) {
  const items = [
    {
      label: "What this shows",
      value: showing,
    },
    {
      label: "Needs attention",
      value: attention,
    },
    {
      label: "Inspect next",
      value: inspectNext,
    },
  ];

  return (
    <div
      className="admin-ops-inspection-guide"
      aria-label="Section inspection guidance"
    >
      {items.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <p>{item.value}</p>
        </article>
      ))}
    </div>
  );
}

export function AdminOpsStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "neutral";
}) {
  return (
    <span className={`admin-ops-status-badge admin-ops-status-badge--${tone}`}>
      {children}
    </span>
  );
}

export function AdminOpsAliasList({ aliases }: { aliases: string[] }) {
  const visibleAliases = aliases.slice(0, 5);
  const hiddenAliasCount = aliases.length - visibleAliases.length;

  return (
    <div className="admin-ops-alias-list">
      {visibleAliases.map((alias) => (
        <span key={alias}>{alias}</span>
      ))}
      {hiddenAliasCount > 0 ? <small>+{hiddenAliasCount}</small> : null}
    </div>
  );
}

export function formatNullable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Blank";
  }

  return String(value);
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not tracked";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    style: "currency",
  }).format(value);
}

export function formatLatency(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not tracked";
  }

  return `${value} ms`;
}

export function formatShortId(value: string | null | undefined) {
  if (!value) {
    return "Blank";
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function formatAdminOpsPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return "0%";
  }

  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function formatAdminOpsCountLabel(
  count: number,
  singularLabel: string,
  pluralLabel = `${singularLabel}s`,
) {
  return `${count.toLocaleString()} ${count === 1 ? singularLabel : pluralLabel}`;
}

export function formatAdminOpsDate(value: string | null | undefined) {
  if (!value) {
    return "Not tracked";
  }

  return new Date(value).toLocaleString();
}
