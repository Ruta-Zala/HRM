"use client";

import { cn } from "@/lib/utils";

/**
 * Normalizes stored or pasted input to at most 10 national digits (mobile).
 * Strips non-digits and optional leading country code 91 or trunk 0.
 */
export function parseIndianMobileDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return "";

  if (digits.startsWith("91") && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

type IndianPhoneInputProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "onChange" | "value" | "type" | "size"
> & {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

export function IndianPhoneInput({
  id,
  value,
  onChange,
  className,
  disabled,
  placeholder = "98765 43210",
  ...rest
}: IndianPhoneInputProps) {
  const digits = parseIndianMobileDigits(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseIndianMobileDigits(e.target.value));
  };

  return (
    <div
      className={cn(
        "border-ex-border bg-ex-bg focus-within:ring-ex-ring dark:bg-ex-surface flex h-10 w-full overflow-hidden rounded-lg border shadow-inner focus-within:ring-2 focus-within:outline-none",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <span
        className="border-ex-border bg-ex-surface text-ex-muted dark:bg-ex-bg flex shrink-0 items-center border-r px-3 text-sm tabular-nums"
        aria-hidden
      >
        +91
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={placeholder}
        value={digits}
        onChange={handleChange}
        disabled={disabled}
        className="placeholder:text-ex-muted min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm outline-none"
        aria-label="Indian mobile number (10 digits)"
        {...rest}
      />
    </div>
  );
}
