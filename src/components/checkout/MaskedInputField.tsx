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
      className="bg-transparent text-white placeholder-[#828282] flex-1 outline-none text-sm md:text-base min-h-[24px] w-full disabled:cursor-not-allowed"
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
        className="text-white font-inter font-medium text-sm md:text-base"
      >
        {label}
      </label>
      <div
        className={`flex items-center gap-3 bg-[#1e1e1e] border rounded-2xl px-6 py-4 min-h-[56px] ${
          error ? "border-red-500" : "border-white/10"
        } ${disabled ? "opacity-60" : ""}`}
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
            className="bg-transparent text-white placeholder-[#828282] flex-1 outline-none text-sm md:text-base min-h-[24px] w-full disabled:cursor-not-allowed"
          />
        )}
      </div>
      {error && (
        <span className="text-red-400 text-xs mt-0.5">{error}</span>
      )}
    </div>
  );
}
