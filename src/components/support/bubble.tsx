import type { ReactNode } from "react";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface BubbleProps {
  children: ReactNode;
}

const CHAT_TURN_TEST_ID = "support-chat-turn" as const;

function Avatar({ variant }: { variant: "human" | "ai" }) {
  return (
    <div
      className={cn(
        "border-ex-border bg-ex-surface flex size-7 shrink-0 items-center justify-center rounded-full border",
        variant === "human" ? "text-ex-primary" : "text-ex-secondary",
      )}
    >
      {variant === "human" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
    </div>
  );
}

export function HumanBubble({ children }: BubbleProps) {
  return (
    <div className="flex items-end justify-end gap-2" data-testid={CHAT_TURN_TEST_ID}>
      <div className="bg-ex-secondary max-w-[80%] rounded-xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed text-white">
        {children}
      </div>
      <Avatar variant="human" />
    </div>
  );
}

export function AIBubble({ children }: BubbleProps) {
  return (
    <div className="flex items-end justify-start gap-2" data-testid={CHAT_TURN_TEST_ID}>
      <Avatar variant="ai" />
      <div className="border-ex-border bg-ex-surface text-ex-primary max-w-[80%] rounded-xl rounded-bl-sm border px-4 py-2.5 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}
