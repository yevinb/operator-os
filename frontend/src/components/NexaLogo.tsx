import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const VARIANTS = {
  /** Hero — full lockup with tagline */
  full: "h-auto w-56 sm:w-64 md:w-72",
  /** Top nav */
  compact: "h-11 sm:h-12 w-auto",
  /** Dashboard sidebar */
  sidebar: "h-12 w-auto",
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
      src="/nexa-logo.png"
      alt="Nexa — Your AI Operating System"
      width={1024}
      height={1024}
      priority={priority}
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
