import type { ReactNode } from "react";

export type WorkspaceTone = "public" | "teacher" | "student" | "admin";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function WorkspacePage({
  tone = "public",
  className,
  children,
}: {
  tone?: WorkspaceTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main className={cx("workspace-page", className)} data-workspace-tone={tone}>
      {children}
    </main>
  );
}

export function WorkspaceHero({
  tone = "public",
  eyebrow,
  title,
  description,
  actions,
  aside,
  footer,
  className,
}: {
  tone?: WorkspaceTone;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("workspace-hero glass-panel", className)} data-workspace-tone={tone}>
      <div className="workspace-hero-grid">
        <div className="workspace-hero-copy">
          {eyebrow ? <div className="workspace-kicker">{eyebrow}</div> : null}
          <div className="workspace-hero-title">{title}</div>
          {description ? <div className="workspace-hero-description">{description}</div> : null}
          {actions ? <div className="workspace-hero-actions">{actions}</div> : null}
        </div>
        {aside ? <aside className="workspace-hero-aside">{aside}</aside> : null}
      </div>
      {footer ? <div className="workspace-hero-footer">{footer}</div> : null}
    </section>
  );
}

export function WorkspaceBanner({
  tone = "public",
  className,
  children,
}: {
  tone?: WorkspaceTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("workspace-banner", className)} data-workspace-tone={tone}>
      {children}
    </section>
  );
}
