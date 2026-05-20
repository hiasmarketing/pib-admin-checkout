import { ReactNode } from "react";

interface InputFieldProps {
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  rightIcon?: ReactNode;
  id?: string;
  required?: boolean;
  autoComplete?: string;
  valid?: boolean;
  disabled?: boolean;
}

export default function InputField({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  error,
  rightIcon,
  id,
  required,
  autoComplete,
  disabled,
}: InputFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="font-semibold text-[13px] md:text-sm text-[#2b3674]"
        style={{ fontFamily: "var(--font-inter-var), Montserrat, sans-serif", letterSpacing: "-0.02em" }}
      >
        {label}
        {required ? " *" : ""}
      </label>
      <div
        className={`flex items-center gap-3 bg-white border rounded-[10px] px-5 h-[50px] ${
          error ? "border-red-500" : "border-[#e0e5f2]"
        } ${disabled ? "opacity-60" : "focus-within:border-[#0077ff]"}`}
      >
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className="bg-transparent text-[#2b3674] placeholder-[#a3aed0] flex-1 outline-none text-sm h-full disabled:cursor-not-allowed"
          style={{ fontFamily: "var(--font-inter-var), Montserrat, sans-serif" }}
        />
        {rightIcon && <div className="flex-shrink-0">{rightIcon}</div>}
      </div>
      {error && (
        <span className="text-red-500 text-xs mt-0.5" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
