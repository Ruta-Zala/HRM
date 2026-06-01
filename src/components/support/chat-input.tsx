import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSubmit, disabled }: ChatInputProps) {
  return (
    <div className="border-ex-border bg-ex-elevated border-t px-4 py-3">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          rows={2}
          disabled={disabled}
          className="border-ex-border bg-ex-bg text-ex-primary focus-visible:ring-ex-ring dark:bg-ex-surface max-h-32 min-h-11 flex-1 resize-none rounded-xl border px-4 py-3 text-sm leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
        />
        <Button
          type="submit"
          size="md"
          className="size-11 shrink-0 rounded-xl px-0"
          aria-label="Send support message"
          disabled={disabled || !value.trim()}
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
