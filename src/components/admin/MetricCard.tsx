type Props = {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
};

export function MetricCard({ label, value, sublabel, highlight }: Props) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        background: "var(--admin-surface)",
        borderColor: highlight ? "var(--admin-brand)" : "var(--admin-border)",
      }}
    >
      <div
        className="text-xs uppercase tracking-wider mb-2"
        style={{ color: "var(--admin-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-2xl font-bold leading-tight"
        style={{ color: "var(--admin-fg)", fontFamily: "var(--font-sora)" }}
      >
        {value}
      </div>
      {sublabel && (
        <div className="text-xs mt-1" style={{ color: "var(--admin-muted)" }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
