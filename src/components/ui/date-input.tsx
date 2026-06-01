"use client";

import { useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "./input";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Normalize sheet or form values to yyyy-mm-dd when possible. */
export function normalizeDateValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${pad2(Number(dmy[2]))}-${pad2(Number(dmy[1]))}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }

  return "";
}

function formatIsoToDisplay(iso: string): string {
  const normalized = normalizeDateValue(iso);
  if (!normalized) return "";

  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function toIsoDateBoundary(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function isWithinRange(iso: string, min: string, max: string): boolean {
  return iso >= min && iso <= max;
}

export type DateInputProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "type" | "value" | "onChange" | "min" | "max"
> & {
  id: string;
  value: string;
  onChange: (value: string) => void;
  minYear?: number;
  maxYear?: number;
};

export function DateInput({
  id,
  value,
  onChange,
  minYear = 1900,
  maxYear = new Date().getFullYear(),
  disabled = false,
  required = false,
  className,
  placeholder = "DD/MM/YYYY",
  ...rest
}: DateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [textValue, setTextValue] = useState(() => formatIsoToDisplay(value));
  const [isEditing, setIsEditing] = useState(false);

  const normalizedValue = normalizeDateValue(value);
  const min = toIsoDateBoundary(minYear, 1, 1);
  const max = toIsoDateBoundary(maxYear, 12, 31);
  const displayedText = isEditing ? textValue : formatIsoToDisplay(value);

  const commitTextValue = (raw: string) => {
    if (!raw.trim()) {
      onChange("");
      setTextValue("");
      return;
    }

    const normalized = normalizeDateValue(raw);
    if (!normalized || !isWithinRange(normalized, min, max)) {
      setTextValue(formatIsoToDisplay(value));
      return;
    }

    onChange(normalized);
    setTextValue(formatIsoToDisplay(normalized));
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker || disabled) return;

    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }

    picker.click();
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={displayedText}
        disabled={disabled}
        required={required}
        className="pr-10"
        onChange={(event) => setTextValue(event.target.value)}
        onFocus={() => {
          setTextValue(formatIsoToDisplay(value));
          setIsEditing(true);
        }}
        onBlur={() => {
          setIsEditing(false);
          commitTextValue(textValue);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commitTextValue(textValue);
          }
        }}
        {...rest}
      />

      <input
        ref={pickerRef}
        type="date"
        value={normalizedValue}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute opacity-0"
        onChange={(event) => {
          onChange(event.target.value);
          setTextValue(formatIsoToDisplay(event.target.value));
        }}
      />

      <button
        type="button"
        disabled={disabled}
        aria-label="Open calendar"
        onClick={openPicker}
        className="text-ex-muted hover:bg-ex-surface hover:text-ex-primary absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarIcon className="size-4" />
      </button>
    </div>
  );
}
