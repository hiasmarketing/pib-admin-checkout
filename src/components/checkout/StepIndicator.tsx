"use client";

import { useTranslations } from "next-intl";

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const t = useTranslations("steps");

  const steps = [
    { key: "contact", label: t("contact") },
    { key: "buy", label: t("buy") },
    { key: "event", label: t("event") },
  ] as const;

  return (
    <nav className="flex w-full gap-3 md:gap-6 mb-6" aria-label="Progresso">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber <= currentStep;
        const isCurrent = stepNumber === currentStep;
        return (
          <div
            key={step.key}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <div
              className={`h-1 w-full max-w-[64px] rounded-full ${
                isActive ? "bg-[#0077ff]" : "bg-[#e0e5f2]"
              }`}
            />
            <span
              className={`text-[10px] md:text-[12px] uppercase tracking-wide text-center leading-tight font-semibold ${
                isCurrent ? "text-[#2b3674]" : "text-[#a3aed0]"
              }`}
              style={{ fontFamily: "var(--font-inter-var), Montserrat, sans-serif", letterSpacing: "0.05em" }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
