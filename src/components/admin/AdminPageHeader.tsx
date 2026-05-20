interface AdminPageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function AdminPageHeader({ title, description, action }: AdminPageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1
          className="text-xl font-semibold leading-tight"
          style={{ color: "var(--admin-fg)", fontFamily: "var(--font-sora)" }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm" style={{ color: "var(--admin-muted)" }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}
