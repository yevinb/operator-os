"use client";

import Link from "next/link";
import { useMemo } from "react";
import { assetPath } from "@/lib/asset-path";
import { cn } from "@/lib/utils";

const VARIANTS = {
  full: "h-auto w-72 sm:w-80 md:w-96 max-w-[min(90vw,24rem)]",
  compact: "h-14 sm:h-16 w-auto",
  sidebar: "h-16 w-auto",
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
  const src = useMemo(() => {
    const built = assetPath("/nexa-logo.png");
    if (built !== "/nexa-logo.png") return built;
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/operator-os")) {
      return "/operator-os/nexa-logo.png";
    }
    return "/nexa-logo.png";
  }, []);

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Nexa — Your AI Operating System"
      width={1024}
      height={1024}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn(VARIANTS[variant], "object-contain", className)}
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
