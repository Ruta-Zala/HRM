"use client";

import { useMemo, useState } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { useAuth } from "@/contexts/auth-provider";
import { getLangGraphPublicApiUrl } from "@/lib/langgraph/config";
import {
  clearStoredSupportThreadId,
  deleteSupportThread,
  getStoredSupportThreadId,
  storeSupportThreadId,
} from "./support-chat-history";

type SupportAgentState = {
  messages: Message[];
};

const SUPPORT_AGENT_ID = "support_agent";

export function useSupportStream() {
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<string | null>(getStoredSupportThreadId);

  const stream = useStream<SupportAgentState>({
    assistantId: SUPPORT_AGENT_ID,
    apiUrl: getLangGraphPublicApiUrl(),
    messagesKey: "messages",
    fetchStateHistory: false,
    threadId,
    onThreadId(nextThreadId) {
      setThreadId(nextThreadId);
      storeSupportThreadId(nextThreadId);
    },
    onError(error) {
      console.error("Support agent stream error:", error);
    },
  });

  const messages = useMemo(
    () => stream.messages.filter((message) => message.type === "human" || message.type === "ai"),
    [stream.messages],
  );

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || stream.isLoading) return;

    await stream.submit(
      {
        messages: [{ type: "human", content: trimmed }],
      },
      {
        context: {
          user: user ?? undefined,
        },
      },
    );
  }

  async function newChat() {
    const currentThreadId = threadId;

    if (stream.isLoading) {
      await stream.stop();
    }

    try {
      if (currentThreadId) {
        await deleteSupportThread(currentThreadId);
      }
    } catch (error) {
      console.error("Unable to delete support chat thread:", error);
    } finally {
      clearStoredSupportThreadId();
      setThreadId(null);
      stream.switchThread(null);
    }
  }

  return {
    messages,
    isStreaming: stream.isLoading,
    error: stream.error,
    sendMessage,
    newChat,
    stop: stream.stop,
  };
}
