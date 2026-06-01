/** LangGraph API URL exposed to the browser (same origin via Next.js proxy). */
export function getLangGraphPublicApiUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/langgraph`;
  }

  return "/api/langgraph";
}

/** LangGraph dev server URL (server-side proxy target only). */
export function getLangGraphInternalApiUrl(): string {
  return (process.env.LANGGRAPH_INTERNAL_URL ?? "http://127.0.0.1:2024").replace(/\/$/, "");
}
