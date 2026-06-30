import type { ReactNode } from "react";
import { clsx } from "clsx";

export function cn(...inputs: (string | boolean | undefined | null)[]) {
  return clsx(inputs);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variant === "primary" &&
          "bg-accent hover:bg-accent-bright text-white shadow-lg shadow-accent/25 hover:shadow-accent/40",
        variant === "secondary" &&
          "bg-surface-2 hover:bg-surface-3 text-text border border-border",
        variant === "ghost" && "hover:bg-surface-2 text-text-2 hover:text-text",
        variant === "danger" && "bg-danger/10 hover:bg-danger/20 text-danger",
        size === "sm" && "px-3 py-1.5 text-sm gap-1.5",
        size === "md" && "px-5 py-2.5 text-sm gap-2",
        size === "lg" && "px-8 py-3.5 text-base gap-2",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
