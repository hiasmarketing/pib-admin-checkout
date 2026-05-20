"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

interface PaymentMethodSelectorProps {
  selected: "card" | null;
  onSelectCard: () => void;
  pixPrice: string;
  cardInstallments: string;
  cardSubtitle?: string;
}

function PixIcon() {
  return (
    <Image
      src="/images/pix-brand.svg"
      alt=""
      width={56}
      height={56}
      className="h-14 w-14 object-contain"
      aria-hidden="true"
    />
  );
}

function CardIcon() {
  return (
    <Image
      src="/images/card-brand.svg"
      alt=""
      width={56}
      height={56}
      className="h-14 w-14 object-contain"
      aria-hidden="true"
    />
  );
}

export default function PaymentMethodSelector({
  selected,
  onSelectCard,
  pixPrice,
  cardInstallments,
  cardSubtitle: cardSubtitleProp,
}: PaymentMethodSelectorProps) {
  const t = useTranslations("checkout");

  const cardBase =
    "flex flex-col items-center gap-4 rounded-2xl p-6 cursor-pointer transition-all border-2";
  const cardActive = "border-brand";
  const cardInactive = "border-brand/40 hover:border-brand";

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* PIX */}
      <div
        className={`${cardBase} border-white/15 opacity-55 cursor-not-allowed`}
        aria-disabled="true"
      >
        <PixIcon />
        <div className="text-center">
          <p className="text-white/70 font-inter text-sm">
            {t("pixSubtitle")}
          </p>
          <p className="text-white font-inter font-semibold text-base mt-0.5">
            {pixPrice}
          </p>
        </div>
        <span className="border border-white/30 text-white/70 rounded-full px-5 py-2 font-inter font-medium text-sm min-h-[40px] flex items-center">
          {t("pixUnavailable")}
        </span>
      </div>

      {/* Card */}
      <button
        type="button"
        onClick={onSelectCard}
        className={`${cardBase} ${selected === "card" ? cardActive : cardInactive}`}
        aria-pressed={selected === "card"}
      >
        <CardIcon />
        <div className="text-center">
          <p className="text-white/70 font-inter text-sm">
            {cardSubtitleProp ?? t("cardSubtitle")}
          </p>
          <p className="text-white font-inter font-semibold text-base mt-0.5">
            {cardInstallments}
          </p>
        </div>
        <span className="bg-brand text-white rounded-full px-8 py-2 font-inter font-medium text-sm min-h-[40px] flex items-center">
          {t("cardButton")}
        </span>
      </button>
    </div>
  );
}
