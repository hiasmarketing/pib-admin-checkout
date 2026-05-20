import Link from "next/link";

interface AdminButtonProps {
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

const VARIANT_STYLES = {
  primary: {
    background: "var(--admin-brand)",
    color: "#fff",
    border: "transparent",
  },
  secondary: {
    background: "var(--admin-surface-elevated)",
    color: "var(--admin-fg)",
    border: "var(--admin-border)",
  },
  danger: {
    background: "var(--admin-danger)",
    color: "#fff",
    border: "transparent",
  },
};

export function AdminButton({
  href,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
  children,
}: AdminButtonProps) {
  const styles = VARIANT_STYLES[variant];
  const baseClass = `inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-opacity disabled:opacity-50 border ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={baseClass}
        style={{
          background: styles.background,
          color: styles.color,
          borderColor: styles.border,
        }}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={baseClass}
      style={{
        background: styles.background,
        color: styles.color,
        borderColor: styles.border,
      }}
    >
      {children}
    </button>
  );
}
