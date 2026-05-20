"use client";

import { useState, useEffect, Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckoutLayout,
  StepIndicator,
  InputField,
  PhoneInput,
  Button,
} from "@/components/checkout";
import {
  captureTrackingFromParams,
  captureSelectionFromParams,
  loadTracking,
  saveTracking,
  saveCatalogSelection,
} from "@/lib/tracking";

function FormularioContent() {
  const t = useTranslations("formulario");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneInternational, setPhoneInternational] = useState("");
  const [phoneComplete, setPhoneComplete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function localizedPath(path: `/${string}`) {
    if (locale === "en") return `/en${path}`;
    return process.env.NODE_ENV === "development" ? `/pt${path}` : path;
  }

  useEffect(() => {
    const trackingData = captureTrackingFromParams(searchParams);
    saveTracking(trackingData);
    saveCatalogSelection(captureSelectionFromParams(searchParams));
  }, [searchParams]);

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Nome obrigatório";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "E-mail inválido";
    }
    if (!phoneComplete || !phoneInternational) {
      newErrors.phone = "Celular inválido";
    }
    return newErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phoneInternational,
          tracking: loadTracking(),
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { leadId?: string; error?: string }
        | null;

      if (!response.ok || !data?.leadId) {
        setSubmitError(data?.error ?? t("saveError"));
        return;
      }

      sessionStorage.setItem("destiny_lead_id", data.leadId);
      const contact = {
        name: name.trim(),
        email: email.trim(),
        phone: phoneInternational,
      };
      sessionStorage.setItem("destiny_contact", JSON.stringify(contact));
      sessionStorage.setItem("destiny_lead_contact", JSON.stringify(contact));
      router.push(localizedPath("/checkout"));
    } catch {
      setSubmitError(t("saveError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isValid =
    name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    phoneComplete;

  return (
    <CheckoutLayout>
      <StepIndicator currentStep={1} />

      <h1 className="text-white font-sora font-semibold text-xl md:text-2xl text-center mb-8 leading-snug">
        {t("title")}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <InputField
          id="name"
          label={t("name")}
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={setName}
          error={errors.name}
          required
          autoComplete="name"
        />

        <InputField
          id="email"
          label={t("email")}
          placeholder={t("emailPlaceholder")}
          type="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
          required
          autoComplete="email"
        />

        <PhoneInput
          id="phone"
          label={t("phone")}
          placeholder={t("phonePlaceholder")}
          value={phone}
          onChange={(masked, _unmasked, international, complete) => {
            setPhone(masked);
            setPhoneInternational(international);
            setPhoneComplete(complete);
          }}
          error={errors.phone}
          required
        />

        <div className="pt-6">
          {/* Mobile: full-width button, no back on step 1 */}
          {submitError && (
            <p className="text-sm text-red-300 font-inter mb-4" role="alert">
              {submitError}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={!isValid || isSubmitting}
            fullWidth
          >
            {isSubmitting ? t("saving") : t("next")}
          </Button>
        </div>
      </form>
    </CheckoutLayout>
  );
}

export default function FormularioPage() {
  return (
    <Suspense>
      <FormularioContent />
    </Suspense>
  );
}
