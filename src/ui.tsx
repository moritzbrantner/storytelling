import type { ButtonHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]) {
  return twMerge(values.filter(Boolean).join(" "));
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "default" | "sm";
  variant?: "default" | "secondary" | "outline" | "ghost";
};

export function Button({
  className,
  size = "default",
  variant = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-sm" : "h-9 px-4 text-sm",
        variant === "default" &&
          "border-primary bg-primary text-primary-foreground hover:opacity-90",
        variant === "secondary" &&
          "border-secondary bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "outline" && "border-border bg-background text-foreground hover:bg-muted",
        variant === "ghost" && "border-transparent bg-transparent text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}
