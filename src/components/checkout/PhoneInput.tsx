"use client";

import { IMaskInput } from "react-imask";
import { useState, useRef, useEffect } from "react";

interface Country {
  code: string;
  flag: string;
  name: string;
  dial: string;
  mask: string;
  placeholder: string;
}

const COUNTRIES: Country[] = [
  { code: "BR", flag: "🇧🇷", name: "Brasil",          dial: "+55",  mask: "(00) 00000-0000",  placeholder: "(00) 00000-0000"  },
  { code: "US", flag: "🇺🇸", name: "United States",   dial: "+1",   mask: "(000) 000-0000",   placeholder: "(000) 000-0000"   },
  { code: "PT", flag: "🇵🇹", name: "Portugal",         dial: "+351", mask: "000 000 000",      placeholder: "000 000 000"      },
  { code: "AR", flag: "🇦🇷", name: "Argentina",        dial: "+54",  mask: "(000) 0000-0000",  placeholder: "(000) 0000-0000"  },
  { code: "MX", flag: "🇲🇽", name: "México",           dial: "+52",  mask: "(00) 0000-0000",   placeholder: "(00) 0000-0000"   },
  { code: "CO", flag: "🇨🇴", name: "Colômbia",         dial: "+57",  mask: "(000) 000-0000",   placeholder: "(000) 000-0000"   },
  { code: "CL", flag: "🇨🇱", name: "Chile",            dial: "+56",  mask: "0 0000-0000",      placeholder: "0 0000-0000"      },
  { code: "UY", flag: "🇺🇾", name: "Uruguai",          dial: "+598", mask: "0000 0000",        placeholder: "0000 0000"        },
  { code: "PY", flag: "🇵🇾", name: "Paraguai",         dial: "+595", mask: "000 000 000",      placeholder: "000 000 000"      },
  { code: "PE", flag: "🇵🇪", name: "Peru",             dial: "+51",  mask: "000 000 000",      placeholder: "000 000 000"      },
  { code: "ES", flag: "🇪🇸", name: "Espanha",          dial: "+34",  mask: "000 000 000",      placeholder: "000 000 000"      },
  { code: "IT", flag: "🇮🇹", name: "Itália",           dial: "+39",  mask: "000 000 0000",     placeholder: "000 000 0000"     },
  { code: "DE", flag: "🇩🇪", name: "Alemanha",         dial: "+49",  mask: "0000 00000000",    placeholder: "0000 00000000"    },
  { code: "GB", flag: "🇬🇧", name: "Reino Unido",      dial: "+44",  mask: "0000 000000",      placeholder: "0000 000000"      },
  { code: "FR", flag: "🇫🇷", name: "França",           dial: "+33",  mask: "0 00 00 00 00",    placeholder: "0 00 00 00 00"    },
];

interface PhoneInputProps {
  label: string;
  value: string;
  onChange: (
    masked: string,
    unmasked: string,
    international: string,
    complete: boolean
  ) => void;
  error?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
}

export default function PhoneInput({
  label,
  value,
  onChange,
  error,
  id,
  required,
}: PhoneInputProps) {
  const inputId = id ?? "phone";
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectCountry(c: Country) {
    setCountry(c);
    setOpen(false);
    onChange("", "", "", false);
  }

  function toInternationalPhone(unmasked: string) {
    return unmasked ? `${country.dial}${unmasked}` : "";
  }

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <label
        htmlFor={inputId}
        className="text-white font-inter font-medium text-sm md:text-base"
      >
        {label}
      </label>

      <div
        className={`flex items-center gap-3 border rounded-2xl px-4 py-4 min-h-[56px] relative ${
          error ? "border-red-500" : "border-white"
        }`}
      >
        {/* Country trigger */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex cursor-pointer items-center gap-1.5 flex-shrink-0 pr-2 border-r border-white/20"
          aria-label="Selecionar país"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="text-white/60 text-xs font-inter">{country.dial}</span>
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            className={`text-white/50 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <IMaskInput
          id={inputId}
          mask={country.mask}
          value={value}
          onAccept={(v: string, maskRef) => {
            const unmasked = maskRef.unmaskedValue ?? "";
            onChange(
              v as string,
              unmasked,
              toInternationalPhone(unmasked),
              maskRef.masked.isComplete
            );
          }}
          placeholder={country.placeholder}
          required={required}
          type="tel"
          className="bg-transparent text-white placeholder-[#828282] flex-1 outline-none text-sm md:text-base min-h-[24px]"
        />

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-[#111] border border-white/20 rounded-2xl overflow-hidden z-50 shadow-xl">
            <div className="max-h-64 overflow-y-auto">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => selectCountry(c)}
                  className={`w-full flex cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-white/10 transition-colors ${
                    c.code === country.code ? "bg-white/5" : ""
                  }`}
                >
                  <span className="text-base">{c.flag}</span>
                  <span className="text-white text-sm font-inter flex-1">{c.name}</span>
                  <span className="text-white/40 text-xs font-inter">{c.dial}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <span className="text-red-400 text-xs mt-0.5">{error}</span>
      )}
    </div>
  );
}
