"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";

import { normalizeSkillInput, skillExistsInList } from "@/app/consts/tech-skills";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";

export type SkillsInputProps = {
  id?: string;
  value: string[];
  onChange: (skills: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function SkillsInput({
  id,
  value,
  onChange,
  suggestions = [],
  placeholder = "Type a skill and click Add",
  disabled = false,
  className,
}: SkillsInputProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isSelected = (skill: string) => skillExistsInList(skill, value);

  const filteredSuggestions = useMemo(() => {
    const query = normalizeSkillInput(inputValue).toLowerCase();
    return suggestions.filter((skill) => {
      if (!query) return true;
      return skill.toLowerCase().includes(query);
    });
  }, [inputValue, suggestions]);

  useEffect(() => {
    if (!showSuggestions) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showSuggestions]);

  const addSkill = (raw: string) => {
    const skill = normalizeSkillInput(raw);
    if (!skill || skillExistsInList(skill, value)) {
      setInputValue("");
      setShowSuggestions(true);
      inputRef.current?.focus();
      return;
    }

    onChange([...value, skill]);
    setInputValue("");
    setShowSuggestions(true);
    inputRef.current?.focus();
  };

  const removeSkill = (skill: string) => {
    onChange(value.filter((item) => item !== skill));
  };

  const handleAddClick = () => {
    addSkill(inputValue);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSkill(inputValue);
    } else if (event.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("space-y-3", className)}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            id={id}
            type="text"
            value={inputValue}
            disabled={disabled}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(event) => {
              setInputValue(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onClick={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
          />

          {showSuggestions && !disabled ? (
            <ul
              id={listboxId}
              role="listbox"
              className="border-ex-border bg-ex-bg dark:bg-ex-surface absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border p-1 shadow-lg"
            >
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((skill) => {
                  const selected = isSelected(skill);
                  return (
                    <li key={skill} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => addSkill(skill)}
                        className={cn(
                          "hover:bg-ex-surface dark:hover:bg-ex-bg flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                          selected && "bg-ex-surface dark:bg-ex-bg",
                        )}
                      >
                        <span
                          className={cn(
                            "border-ex-border flex size-4 shrink-0 items-center justify-center rounded border",
                            selected && "border-ex-accent bg-ex-accent text-white",
                          )}
                          aria-hidden
                        >
                          {selected ? <CheckIcon className="size-3" /> : null}
                        </span>
                        <span className="truncate">{skill}</span>
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="text-ex-muted px-3 py-2 text-sm">No matching skills.</li>
              )}
            </ul>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={disabled || !normalizeSkillInput(inputValue)}
          onClick={handleAddClick}
          className="shrink-0"
        >
          <PlusIcon className="size-4" />
          Add
        </Button>
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((skill) => (
            <span
              key={skill}
              className="border-ex-border bg-ex-surface text-ex-primary dark:bg-ex-bg inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs"
            >
              <span className="truncate">{skill}</span>
              {!disabled ? (
                <button
                  type="button"
                  aria-label={`Remove ${skill}`}
                  className="text-ex-muted hover:text-ex-primary rounded-sm"
                  onClick={() => removeSkill(skill)}
                >
                  <XIcon className="size-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-ex-muted text-xs">No skills added yet.</p>
      )}
    </div>
  );
}
