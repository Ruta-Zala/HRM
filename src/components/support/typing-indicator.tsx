import { AIBubble } from "./bubble";

export function TypingIndicator() {
  return (
    <AIBubble>
      <div className="flex h-5 items-center gap-1">
        <span className="bg-ex-muted size-1.5 animate-bounce rounded-full [animation-delay:-0.2s]" />
        <span className="bg-ex-muted size-1.5 animate-bounce rounded-full [animation-delay:-0.1s]" />
        <span className="bg-ex-muted size-1.5 animate-bounce rounded-full" />
      </div>
    </AIBubble>
  );
}
