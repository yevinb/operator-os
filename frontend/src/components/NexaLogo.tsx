import Image from "next/image";
import Link from "next/link";
import { assetPath } from "@/lib/asset-path";
import { cn } from "@/lib/utils";

const LOGO_SRC = assetPath("/nexa-logo.png");

const VARIANTS = {
  /** Hero — full lockup with tagline */
  full: "h-auto w-64 sm:w-72 md:w-80 max-w-[90vw]",
  /** Top nav */
  compact: "h-12 sm:h-14 w-auto max-w-[140px] sm:max-w-[160px]",
  /** Dashboard sidebar */
  sidebar: "h-14 w-auto max-w-[160px]",
} as const;

type NexaLogoProps = {
  variant?: keyof typeof VARIANTS;
  href?: string | false;
  className?: string;
  priority?: boolean;
};

export function NexaLogo({
  variant = "compact",
  href = "/",
  className,
  priority = false,
}: NexaLogoProps) {
  const image = (
    <Image
      src={LOGO_SRC}
      alt="Nexa — Your AI Operating System"
      width={1024}
      height={1024}
      priority={priority}
      unoptimized
      className={cn(VARIANTS[variant], className)}
    />
  );

  if (href !== false) {
    return (
      <Link href={href} className="inline-flex shrink-0 items-center">
        {image}
      </Link>
    );
  }

  return image;
}
