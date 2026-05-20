import { ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "secondary";

interface ButtonProps {
  variant?: ButtonVariant;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export default function Button({
  variant = "primary",
  children,
  onClick,
  type = "button",
  disabled,
  loading,
  fullWidth,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseClass =
    "inline-flex items-center justify-center h-[54px] px-6 rounded-[10px] font-semibold text-sm leading-none transition-colors";
  const widthClass = fullWidth ? "w-full" : "";
  const disabledClass = isDisabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  const variantClass =
    variant === "ghost"
      ? "bg-transparent text-[#2b3674] hover:bg-[#f3f5fa]"
      : variant === "secondary"
        ? "bg-[#efefef] text-[#2b3674] border border-[#c7c7c7] hover:bg-[#e6e6e6]"
        : "bg-[#0077ff] text-white hover:bg-[#0066dd] active:scale-[0.99]";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClass} ${widthClass} ${disabledClass} ${variantClass}`}
      style={{ fontFamily: "var(--font-inter-var), Montserrat, sans-serif", letterSpacing: "-0.02em" }}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
