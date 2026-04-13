import Link from "next/link";
import type { ReactNode } from "react";

import { cx, type WorkspaceTone } from "@/components/workspace-shell";

export function WorkspaceSection({
  tone = "public",
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: {
  tone?: WorkspaceTone;
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("workspace-section editorial-panel", className)} data-workspace-tone={tone}>
      {(eyebrow || title || description || actions) ? (
        <header className="workspace-section-header">
          <div className="workspace-section-copy">
            {eyebrow ? <div className="workspace-eyebrow">{eyebrow}</div> : null}
            {title ? <div className="workspace-section-title">{title}</div> : null}
            {description ? <div className="workspace-section-description">{description}</div> : null}
          </div>
          {actions ? <div className="workspace-section-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="workspace-section-body">{children}</div>
    </section>
  );
}

export function SignalStrip({
  tone = "public",
  items,
  className,
}: {
  tone?: WorkspaceTone;
  items: Array<{
    label: ReactNode;
    value: ReactNode;
    note?: ReactNode;
  }>;
  className?: string;
}) {
  return (
    <div className={cx("signal-strip", className)} data-workspace-tone={tone}>
      {items.map((item) => (
        <article key={String(item.label)} className="signal-card">
          <p className="signal-label">{item.label}</p>
          <div className="signal-value">{item.value}</div>
          {item.note ? <p className="signal-note">{item.note}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function MetricCard({
  tone = "public",
  label,
  value,
  note,
  className,
}: {
  tone?: WorkspaceTone;
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cx("metric-card", className)} data-workspace-tone={tone}>
      <p className="metric-label">{label}</p>
      <div className="metric-value">{value}</div>
      {note ? <p className="metric-note">{note}</p> : null}
    </article>
  );
}

export function ActionTile({
  tone = "public",
  href,
  eyebrow,
  title,
  description,
  cta,
  className,
}: {
  tone?: WorkspaceTone;
  href: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  cta?: ReactNode;
  className?: string;
}) {
  return (
    <Link className={cx("action-tile", className)} data-workspace-tone={tone} href={href}>
      <div className="action-tile-copy">
        {eyebrow ? <p className="workspace-eyebrow">{eyebrow}</p> : null}
        <div className="action-tile-title">{title}</div>
        {description ? <p className="action-tile-description">{description}</p> : null}
      </div>
      <div className="action-tile-cta">{cta || "点击进入"}</div>
    </Link>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("empty-state", className)}>
      <div className="empty-state-title">{title}</div>
      {description ? <p className="empty-state-description">{description}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
