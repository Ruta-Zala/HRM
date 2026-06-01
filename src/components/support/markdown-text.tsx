import type { Message } from "@langchain/langgraph-sdk";

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${part}-${index}`}
          className="bg-ex-bg text-ex-primary dark:bg-ex-elevated rounded px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

export function contentToText(content: Message["content"]): string {
  if (typeof content === "string") return content;

  return content
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

export function MarkdownText({ content }: { content: Message["content"] }) {
  const lines = contentToText(content).split(/\r?\n/);
  const elements = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`break-${index}`} className="h-2" />);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      elements.push(
        <div key={`bullet-${index}`} className="flex gap-2">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-70" />
          <span>{renderInline(bullet[1] ?? "")}</span>
        </div>,
      );
      continue;
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      elements.push(
        <div key={`number-${index}`} className="flex gap-2">
          <span className="text-ex-muted shrink-0">{trimmed.split(/\s+/)[0]}</span>
          <span>{renderInline(numbered[1] ?? "")}</span>
        </div>,
      );
      continue;
    }

    elements.push(<p key={`line-${index}`}>{renderInline(trimmed)}</p>);
  }

  return <div className="space-y-1.5 whitespace-pre-wrap">{elements}</div>;
}
