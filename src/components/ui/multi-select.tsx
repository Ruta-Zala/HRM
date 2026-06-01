"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type MultiSelectProps = {
  id?: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  className?: string;
};

export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select options",
  disabled = false,
  emptyMessage = "No options available",
  className,
}: MultiSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
      return;
    }

    onChange([...value, option]);
  };

  const removeOption = (option: string) => {
    onChange(value.filter((item) => item !== option));
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "border-ex-border bg-ex-bg focus-visible:ring-ex-ring dark:bg-ex-surface flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm shadow-inner focus-visible:ring-2 focus-visible:outline-none",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {value.length > 0 ? (
            value.map((item) => (
              <span
                key={item}
                className="border-ex-border bg-ex-surface text-ex-primary dark:bg-ex-bg inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
              >
                <span className="truncate">{item}</span>
                {!disabled ? (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${item}`}
                    className="text-ex-muted hover:text-ex-primary rounded-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeOption(item);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        removeOption(item);
                      }
                    }}
                  >
                    <XIcon className="size-3" />
                  </span>
                ) : null}
              </span>
            ))
          ) : (
            <span className="text-ex-muted">{placeholder}</span>
          )}
        </span>
        <ChevronDownIcon
          className={cn("text-ex-muted size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && !disabled ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="border-ex-border bg-ex-bg dark:bg-ex-surface absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border p-1 shadow-lg"
        >
          {options.length > 0 ? (
            options.map((option) => {
              const selected = value.includes(option);

              return (
                <li key={option} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => toggleOption(option)}
                    className={cn(
                      "hover:bg-ex-surface dark:hover:bg-ex-bg flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                      selected && "bg-ex-surface dark:bg-ex-bg",
                    )}
                  >
                    <span
                      className={cn(
                        "border-ex-border flex size-4 shrink-0 items-center justify-center rounded border",
                        selected && "border-ex-accent bg-ex-accent text-white",
                      )}
                    >
                      {selected ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <span className="truncate">{option}</span>
                  </button>
                </li>
              );
            })
          ) : (
            <li className="text-ex-muted px-3 py-2 text-sm">{emptyMessage}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
