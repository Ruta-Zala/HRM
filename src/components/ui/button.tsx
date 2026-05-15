import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "accent";
  size?: "sm" | "md" | "lg";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ex-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ex-bg disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-ex-primary text-ex-bg hover:opacity-90 dark:bg-ex-elevated dark:text-ex-primary",
        variant === "secondary" &&
          "bg-ex-secondary text-white hover:opacity-90",
        variant === "accent" && "bg-ex-accent text-ex-primary hover:opacity-90",
        variant === "ghost" &&
          "bg-transparent hover:bg-ex-surface text-ex-primary",
        variant === "outline" &&
          "border border-ex-border bg-ex-elevated hover:bg-ex-surface",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-11 px-5 text-base",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
