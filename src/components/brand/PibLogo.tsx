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

export default function PibLogo({ className = "", size = "md" }: PibLogoProps) {
  const dims = SIZE_MAP[size];
  const iconHeight = Math.round(dims.icon * 1.147);

  return (
    <div className={`inline-flex items-center ${className}`} aria-label="PIB">
      <svg
        width={dims.icon}
        height={iconHeight}
        viewBox="0 0 135.926 155.939"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M30.8543 0V11.2577H82.7646C104.756 11.2577 122.583 29.0851 122.583 51.0764V90.8951H135.926V50.843C135.926 22.7632 113.163 0 85.0827 0H30.8543Z" />
        <path d="M23.6797 19.9102C23.6797 25.8099 18.8971 30.5925 12.9974 30.5925C7.09774 30.5925 2.31511 25.8099 2.31511 19.9102C2.31511 14.0105 7.09774 9.22792 12.9974 9.22792C18.8971 9.22792 23.6797 14.0105 23.6797 19.9102Z" />
        <path d="M0 39.6103V155.939L33.2631 131.903C34.4077 131.076 35.7839 130.631 37.1961 130.631H104.654V118.831H33.0225C31.6128 118.831 30.239 119.274 29.0955 120.099L12.9254 131.756V39.6103H0Z" />
        <path d="M54.7027 92.0927C54.7027 97.9924 49.92 102.775 44.0204 102.775C38.1207 102.775 33.3381 97.9924 33.3381 92.0927C33.3381 86.1931 38.1207 81.4104 44.0204 81.4104C49.92 81.4104 54.7027 86.1931 54.7027 92.0927Z" />
        <path d="M133.114 108.881C133.114 114.78 128.331 119.563 122.432 119.563C116.532 119.563 111.749 114.78 111.749 108.881C111.749 102.981 116.532 98.1982 122.432 98.1982C128.331 98.1982 133.114 102.981 133.114 108.881Z" />
      </svg>
      <div className="flex flex-col" style={{ marginLeft: dims.gap }}>
        <span
          className="font-bold"
          style={{
            color: "currentColor",
            fontFamily: "var(--font-inter-var), Montserrat, sans-serif",
            fontSize: dims.pibFontSize,
            lineHeight: dims.pibLineHeight,
            letterSpacing: "-0.07em",
          }}
        >
          PIB
        </span>
        <span
          className="font-semibold"
          style={{
            color: "currentColor",
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
