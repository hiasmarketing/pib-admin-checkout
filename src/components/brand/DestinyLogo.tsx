import Image from "next/image";

type DestinyLogoProps = {
  className?: string;
  priority?: boolean;
};

export default function DestinyLogo({
  className = "",
  priority = false,
}: DestinyLogoProps) {
  return (
    <Image
      src="/images/logo-destiny.png"
      alt="Método Destiny"
      width={135}
      height={84}
      priority={priority}
      className={className}
    />
  );
}
