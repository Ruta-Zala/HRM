import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "accent" | "danger";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "focus-visible:ring-ex-ring focus-visible:ring-offset-ex-bg inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-ex-secondary text-white hover:brightness-95",
        variant === "secondary" &&
          "border-ex-border bg-ex-elevated text-ex-primary hover:bg-ex-surface border",
        variant === "accent" &&
          "bg-ex-accent/15 text-ex-accent hover:bg-ex-accent/25 dark:bg-ex-accent/20 dark:text-ex-accent",
        variant === "ghost" && "hover:bg-ex-surface text-ex-primary bg-transparent",
        variant === "outline" && "border-ex-border bg-ex-elevated hover:bg-ex-surface border",
        variant === "danger" &&
          "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-11 px-5 text-base",
        className,
        "cursor-pointer",
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
