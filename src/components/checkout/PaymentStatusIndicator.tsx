"use client";

import React, { useEffect, useRef, useState } from "react";

export type PaymentStatus = "loading" | "success" | "error";

interface PaymentStatusIndicatorProps {
  /** Estado atual do pagamento */
  status: PaymentStatus;
  /** Tamanho do indicador em px (padrão: 120) */
  size?: number;
  /** Espessura do traço (padrão: 6) */
  strokeWidth?: number;
  /**
   * Mostrar label de texto abaixo do ícone.
   * Passe `false` quando a mensagem for renderizada externamente
   * (ex: lookup de stripeErrors[code] via next-intl).
   */
  showLabel?: boolean;
  /** Textos customizados (ignorados se showLabel={false}) */
  labels?: {
    loading?: string;
    success?: string;
    error?: string;
  };
  /** Classe extra para o container */
  className?: string;
}

const DEFAULT_LABELS = {
  loading: "Processando pagamento...",
  success: "Pagamento aprovado!",
  error: "Pagamento recusado",
};

const COLORS = {
  loading: "#c913dd",
  loadingTrack: "rgba(255, 255, 255, 0.6)",
  success: "#22c55e",
  error: "#ef4444",
} as const;

// Timings da animação morph (em ms)
const TIMING = {
  shrinkDuration: 300, // círculo do spinner encolhe
  expandDelay: 300, // pausa antes do novo círculo crescer
  expandDuration: 400, // novo círculo cresce com bounce
  iconDuration: 350, // duração do desenho do check/X
} as const;

export function PaymentStatusIndicator({
  status,
  size = 120,
  strokeWidth = 6,
  showLabel = true,
  labels = {},
  className = "",
}: PaymentStatusIndicatorProps) {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const center = size / 2;
  const radius = size / 2 - (strokeWidth + 4);
  const circumference = 2 * Math.PI * radius;

  // Fases internas da animação morph
  // 'spinning' → 'shrinking' → 'expanding' → 'final'
  const [phase, setPhase] = useState<
    "spinning" | "shrinking" | "expanding" | "final"
  >(status === "loading" ? "spinning" : "final");

  const prevStatusRef = useRef<PaymentStatus>(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    // loading → success/error: dispara morph
    if (prev === "loading" && status !== "loading") {
      queueMicrotask(() => setPhase("shrinking"));

      const t1 = setTimeout(() => setPhase("expanding"), TIMING.shrinkDuration);
      const t2 = setTimeout(
        () => setPhase("final"),
        TIMING.shrinkDuration + TIMING.expandDelay + TIMING.expandDuration,
      );

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    // success/error → loading: retry (reseta para spinning)
    if (status === "loading") {
      queueMicrotask(() => setPhase("spinning"));
    } else {
      queueMicrotask(() => setPhase("final"));
    }
  }, [status]);

  const checkPath = `M ${size * 0.317} ${size * 0.517} L ${size * 0.45} ${size * 0.65} L ${size * 0.7} ${size * 0.383}`;
  const xPath1 = `M ${size * 0.35} ${size * 0.35} L ${size * 0.65} ${size * 0.65}`;
  const xPath2 = `M ${size * 0.65} ${size * 0.35} L ${size * 0.35} ${size * 0.65}`;
  const checkLength = size * 0.67;
  const xLength = size * 0.46;

  const finalColor = status === "success" ? COLORS.success : COLORS.error;

  // Raio do spinner — encolhe para 0 na fase shrinking
  const spinnerRadius = phase === "spinning" ? radius : 0;

  // Raio do novo círculo colorido — cresce na fase expanding/final
  const newCircleRadius =
    phase === "expanding" || phase === "final" ? radius : 0;

  // Check/X só aparece na fase final
  const checkOffset =
    phase === "final" && status === "success" ? 0 : checkLength;
  const xOffset = phase === "final" && status === "error" ? 0 : xLength;

  // Track só visível durante spinning
  const trackOpacity = phase === "spinning" ? 1 : 0;

  const labelClass =
    status === "loading"
      ? "text-white/70"
      : status === "success"
        ? "text-green-500"
        : "text-red-500";

  return (
    <div
      className={`flex flex-col items-center gap-4 ${className}`}
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes payment-spin {
          from { transform: rotate(-90deg); }
          to { transform: rotate(270deg); }
        }
        .payment-circle-spinning {
          animation: payment-spin 1.2s linear infinite;
        }
      `}</style>

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={mergedLabels[status]}
      >
        {/* Track de fundo — só durante spinning */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={COLORS.loadingTrack}
          strokeWidth={strokeWidth}
          style={{
            opacity: trackOpacity,
            transition: "opacity 0.2s ease",
          }}
        />

        {/* Círculo do spinner (magenta) — encolhe pro centro na transição */}
        <circle
          cx={center}
          cy={center}
          r={spinnerRadius}
          fill="none"
          stroke={COLORS.loading}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.25} ${circumference}`}
          strokeDashoffset={0}
          className={phase === "spinning" ? "payment-circle-spinning" : ""}
          style={{
            transformOrigin: `${center}px ${center}px`,
            transform: phase === "spinning" ? undefined : "rotate(-90deg)",
            transition:
              phase === "spinning"
                ? "none"
                : `r ${TIMING.shrinkDuration}ms cubic-bezier(0.7, 0, 0.84, 0)`,
          }}
        />

        {/* Novo círculo colorido — cresce do centro com bounce */}
        <circle
          cx={center}
          cy={center}
          r={newCircleRadius}
          fill="none"
          stroke={finalColor}
          strokeWidth={strokeWidth}
          style={{
            transition: `r ${TIMING.expandDuration}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${
              phase === "expanding" ? "0ms" : `${TIMING.expandDelay}ms`
            }`,
          }}
        />

        {/* Check (sucesso) */}
        <path
          d={checkPath}
          fill="none"
          stroke={COLORS.success}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={checkLength}
          strokeDashoffset={checkOffset}
          style={{
            transition: `stroke-dashoffset ${TIMING.iconDuration}ms ease-out`,
          }}
        />

        {/* X (erro) — primeira diagonal */}
        <path
          d={xPath1}
          fill="none"
          stroke={COLORS.error}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={xLength}
          strokeDashoffset={xOffset}
          style={{
            transition: `stroke-dashoffset ${TIMING.iconDuration - 50}ms ease-out`,
          }}
        />

        {/* X (erro) — segunda diagonal */}
        <path
          d={xPath2}
          fill="none"
          stroke={COLORS.error}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={xLength}
          strokeDashoffset={xOffset}
          style={{
            transition: `stroke-dashoffset ${TIMING.iconDuration - 50}ms ease-out 150ms`,
          }}
        />
      </svg>

      {showLabel && (
        <p
          className={`text-base font-medium text-center transition-colors duration-300 ${labelClass}`}
        >
          {mergedLabels[status]}
        </p>
      )}
    </div>
  );
}

export default PaymentStatusIndicator;
