import { ChatAnthropic } from "@langchain/anthropic";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { SupportAgentContextSchema } from "./context";
import { SUPPORT_AGENT_SYSTEM_PROMPT } from "./prompts";
import { supportMiddlewares } from "../middlewares";
import { supportTools } from "../tools";

const model = new ChatAnthropic({
  model: "claude-haiku-4-5",
  temperature: 0,
});

const checkpointer = new MemorySaver();

export const agent = createAgent({
  model,
  checkpointer,
  contextSchema: SupportAgentContextSchema,
  systemPrompt: SUPPORT_AGENT_SYSTEM_PROMPT,
  middleware: supportMiddlewares,
  tools: supportTools,
});

export default agent;
