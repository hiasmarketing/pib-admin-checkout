"use client";

import { IMaskInput } from "react-imask";

interface MaskedInputFieldProps {
  label: string;
  placeholder?: string;
  value: string;
  onAccept: (value: string, unmaskedValue: string) => void;
  error?: string;
  id?: string;
  required?: boolean;
  mask?: string;
  type?: string;
  disabled?: boolean;
}

const INPUT_CLASS =
  "bg-transparent text-[#2b3674] placeholder-[#a3aed0] flex-1 outline-none text-sm h-full w-full disabled:cursor-not-allowed";
const INPUT_STYLE = { fontFamily: "var(--font-inter-var), Montserrat, sans-serif" };

function CpfCnpjMasked({
  inputId,
  placeholder,
  value,
  onAccept,
  required,
  disabled,
}: {
  inputId: string;
  placeholder?: string;
  value: string;
  onAccept: (value: string, unmasked: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <IMaskInput
      id={inputId}
      mask={[
        { mask: "000.000.000-00", maxLength: 14 },
        { mask: "00.000.000/0000-00" },
      ]}
      value={value}
      onAccept={(v: string, maskRef) => {
        const unmasked = maskRef.unmaskedValue ?? "";
        onAccept(v as string, unmasked);
      }}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={INPUT_CLASS}
      style={INPUT_STYLE}
    />
  );
}

export default function MaskedInputField({
  label,
  placeholder,
  value,
  onAccept,
  error,
  id,
  required,
  mask = "0000 0000 0000 0000",
  type = "text",
  disabled,
}: MaskedInputFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const isCpfCnpj = mask === "cpf-cnpj";

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
        {isCpfCnpj ? (
          <CpfCnpjMasked
            inputId={inputId}
            placeholder={placeholder}
            value={value}
            onAccept={onAccept}
            required={required}
            disabled={disabled}
          />
        ) : (
          <IMaskInput
            id={inputId}
            mask={mask}
            value={value}
            onAccept={(v: string, maskRef) => {
              const unmasked = maskRef.unmaskedValue ?? "";
              onAccept(v as string, unmasked);
            }}
            placeholder={placeholder}
            required={required}
            type={type}
            disabled={disabled}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
        )}
      </div>
      {error && (
        <span className="text-red-500 text-xs mt-0.5" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
