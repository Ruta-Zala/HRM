"use client";

import { useMemo, useState } from "react";
import { Bot, ChevronDown, Maximize2, Minimize2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatContainer } from "@/components/support/chat-container";
import { ChatInput } from "@/components/support/chat-input";
import { useSupportStream } from "@/components/support/use-support-stream";

export function SupportBot() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [draft, setDraft] = useState("");
  const { messages, isStreaming, sendMessage, newChat } = useSupportStream();

  const panelTitle = useMemo(
    () => (minimized ? "Support bot minimized" : "Support bot"),
    [minimized],
  );

  async function submitMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed) return;

    setDraft("");
    setMinimized(false);
    await sendMessage(trimmed);
  }

  async function startNewChat() {
    setDraft("");
    setMinimized(false);
    await newChat();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-ex-border bg-ex-secondary focus-visible:ring-ex-ring focus-visible:ring-offset-ex-bg fixed right-5 bottom-5 z-50 inline-flex size-12 items-center justify-center rounded-full border text-white shadow-lg transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label="Open support bot"
      >
        <Bot className="size-5" />
      </button>
    );
  }

  return (
    <section
      aria-label={panelTitle}
      className={cn(
        "border-ex-border bg-ex-elevated fixed right-5 bottom-5 z-50 w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl border shadow-xl sm:w-[25rem] dark:shadow-none",
        minimized && "sm:w-80",
      )}
    >
      <header className="border-ex-border bg-ex-surface/70 flex items-center gap-3 border-b px-4 py-3">
        <div className="border-ex-border bg-ex-elevated text-ex-secondary flex size-9 shrink-0 items-center justify-center rounded-full border">
          <Bot className="size-5" />
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void startNewChat()}
          className="text-ex-muted hover:bg-ex-elevated hover:text-ex-primary inline-flex size-8 items-center justify-center rounded-lg transition"
          aria-label="Start new support chat"
        >
          <Plus className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setMinimized((value) => !value)}
          className="text-ex-muted hover:bg-ex-elevated hover:text-ex-primary inline-flex size-8 items-center justify-center rounded-lg transition"
          aria-label={minimized ? "Expand support bot" : "Minimize support bot"}
        >
          {minimized ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-ex-muted hover:bg-ex-elevated hover:text-ex-primary inline-flex size-8 items-center justify-center rounded-lg transition"
          aria-label="Close support bot"
        >
          <X className="size-4" />
        </button>
      </header>

      {!minimized ? (
        <>
          <ChatContainer messages={messages} isStreaming={isStreaming} />
          <ChatInput
            value={draft}
            onChange={setDraft}
            onSubmit={() => void submitMessage(draft)}
            disabled={isStreaming}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="text-ex-muted hover:bg-ex-surface hover:text-ex-primary flex w-full items-center justify-end px-4 py-3"
        >
          <ChevronDown className="size-4 -rotate-90" />
        </button>
      )}
    </section>
  );
}
