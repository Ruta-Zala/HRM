import { useEffect, useRef } from "react";
import type { Message } from "@langchain/langgraph-sdk";
import { AIBubble, HumanBubble } from "./bubble";
import { contentToText, MarkdownText } from "./markdown-text";
import { TypingIndicator } from "./typing-indicator";

interface ChatContainerProps {
  messages: Message[];
  isStreaming?: boolean;
}

export function ChatContainer({ messages, isStreaming }: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleMessages = messages.filter((message) => contentToText(message.content).trim());

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  return (
    <div
      className="bg-ex-bg/60 dark:bg-ex-bg max-h-96 min-h-64 space-y-4 overflow-y-auto px-4 py-4"
      ref={scrollRef}
    >
      {visibleMessages.map((message) =>
        message.type === "human" ? (
          <HumanBubble key={message.id}>
            <MarkdownText content={message.content} />
          </HumanBubble>
        ) : message.type === "ai" ? (
          <AIBubble key={message.id}>
            <MarkdownText content={message.content} />
          </AIBubble>
        ) : null,
      )}
      {isStreaming ? <TypingIndicator /> : null}
    </div>
  );
}
