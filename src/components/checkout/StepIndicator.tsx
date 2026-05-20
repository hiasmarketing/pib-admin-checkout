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
    <nav className="flex w-full gap-3 md:gap-6 mb-8" aria-label="Progress steps">
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
              className={`h-1 w-11 rounded-full ${
                isActive ? "bg-brand-dark" : "bg-step-inactive"
              }`}
            />
            <span
              className={`font-sora text-[11px] md:text-[13px] uppercase tracking-wide text-center leading-tight ${
                isCurrent ? "text-white font-semibold" : "text-white/50"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </nav>
  );
}
