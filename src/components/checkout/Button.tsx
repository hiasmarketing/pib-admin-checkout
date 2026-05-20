import { ReactNode } from "react";

type ButtonVariant = "primary" | "ghost";

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

  if (variant === "ghost") {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        className={`inline-flex min-h-[44px] items-center justify-center text-center font-inter text-sm font-medium leading-none text-white transition-opacity md:text-base ${
          fullWidth ? "w-full" : ""
        } px-4 ${
          isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"
        }`}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand px-10 py-3 text-center font-inter text-sm font-medium uppercase leading-none tracking-wider text-white transition-opacity md:px-16 md:py-4 md:text-base ${
        fullWidth ? "w-full" : ""
      } ${
        isDisabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:opacity-90 active:scale-95"
      }`}
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
