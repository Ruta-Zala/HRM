import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = {
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, disabled = false, onCheckedChange, className }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={cn(
        "border-ex-border focus-visible:ring-ex-ring relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none",
        checked ? "bg-ex-ring" : "bg-ex-surface",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "bg-ex-bg inline-block h-4 w-4 rounded-full shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  ),
);

Switch.displayName = "Switch";
