interface AdminCardProps {
  children: React.ReactNode;
  className?: string;
}

export function AdminCard({ children, className = "" }: AdminCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{
        background: "var(--admin-surface)",
        borderColor: "var(--admin-border)",
      }}
    >
      {children}
    </div>
  );
}
