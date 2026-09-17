import React from "react";

interface SectionHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Right-aligned action, e.g. a "Create" button. */
  action?: React.ReactNode;
}

/**
 * Shared heading for the dashboard panes. The page-level title already comes
 * from the account shell, so panes use a modest h2 rather than a second h1.
 */
const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  action,
}) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div className="min-w-0">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default SectionHeader;
