import Image from "next/image";

type PibLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
};

const SIZE_MAP = {
  sm: { icon: 40, pibFontSize: "28px", pibLineHeight: "32px", tagFontSize: "11px", tagLineHeight: "12px", gap: "8px" },
  md: { icon: 60, pibFontSize: "42px", pibLineHeight: "48px", tagFontSize: "16px", tagLineHeight: "18px", gap: "12px" },
  lg: { icon: 156, pibFontSize: "131.879px", pibLineHeight: "176.1px", tagFontSize: "45.88px", tagLineHeight: "43.1px", gap: "18px" },
} as const;

export default function PibLogo({
  className = "",
  size = "md",
  priority = false,
}: PibLogoProps) {
  const dims = SIZE_MAP[size];

  return (
    <div className={`inline-flex items-center ${className}`} aria-label="PIB">
      <Image
        src="/images/pib-icon.svg"
        alt=""
        width={dims.icon}
        height={Math.round(dims.icon * 1.147)}
        priority={priority}
        aria-hidden="true"
      />
      <div className="flex flex-col" style={{ marginLeft: dims.gap }}>
        <span
          className="font-bold text-black"
          style={{
            fontFamily: "var(--font-inter-var), Montserrat, sans-serif",
            fontSize: dims.pibFontSize,
            lineHeight: dims.pibLineHeight,
            letterSpacing: "-0.07em",
          }}
        >
          PIB
        </span>
        <span
          className="font-semibold text-black"
          style={{
            fontFamily: "var(--font-inter-var), Montserrat, sans-serif",
            fontSize: dims.tagFontSize,
            lineHeight: dims.tagLineHeight,
            letterSpacing: "-0.07em",
          }}
        >
          the new
          <br />
          college
        </span>
      </div>
    </div>
  );
}
