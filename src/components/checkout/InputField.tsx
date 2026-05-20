import { ReactNode } from "react";

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="flex-shrink-0">
      <circle cx="11" cy="11" r="11" fill="white" fillOpacity="0.15" />
      <circle cx="11" cy="11" r="10.5" stroke="white" strokeOpacity="0.4" />
      <path
        d="M7 11l3 3 5-5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  valid,
  disabled,
}: InputFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const showCheck = valid ?? (value.length > 0 && !error);

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="text-white font-inter font-medium text-sm md:text-base"
      >
        {label}
      </label>
      <div
        className={`flex items-center gap-3 bg-[#1e1e1e] border rounded-2xl px-6 py-4 min-h-[56px] ${
          error ? "border-red-500" : "border-white/10"
        } ${disabled ? "opacity-60" : ""}`}
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
          className="bg-transparent text-white placeholder-[#828282] flex-1 outline-none text-sm md:text-base min-h-[24px] disabled:cursor-not-allowed"
        />
        {rightIcon && <div className="flex-shrink-0">{rightIcon}</div>}
        {showCheck && !rightIcon && <CheckIcon />}
      </div>
      {error && (
        <span className="text-red-400 text-xs mt-0.5">{error}</span>
      )}
    </div>
  );
}
