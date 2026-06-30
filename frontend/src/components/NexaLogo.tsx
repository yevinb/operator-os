import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const VARIANTS = {
  full: "h-auto w-52 sm:w-64",
  compact: "h-9 w-auto",
  sidebar: "h-10 w-auto",
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
      width={512}
      height={512}
      priority={priority}
      className={cn(VARIANTS[variant], className)}
    />
  );

  if (href !== false) {
    return (
      <Link href={href} className="inline-flex shrink-0">
        {image}
      </Link>
    );
  }

  return image;
}
