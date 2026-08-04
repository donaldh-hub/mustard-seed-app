import { Link } from "wouter";

// Minimal markdown renderer for static legal pages.
// Supports the small subset used by our legal docs: headings, bold/italic,
// horizontal rules, unordered lists, links, and paragraphs.
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      const href = match[2];
      if (href.startsWith("/")) {
        nodes.push(
          <Link
            key={key++}
            href={href}
            className="text-emerald-700 underline hover:text-emerald-800"
          >
            {match[1]}
          </Link>
        );
      } else {
        nodes.push(
          <a
            key={key++}
            href={href}
            className="text-emerald-700 underline hover:text-emerald-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            {match[1]}
          </a>
        );
      }
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={key++}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key++}>{match[4]}</em>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export default function MarkdownLegal({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={key++} className="list-disc pl-6 space-y-1 text-stone-700 mb-4">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      flushList();
      continue;
    }
    if (line.trim() === "---") {
      flushList();
      blocks.push(<hr key={key++} className="my-6 border-stone-200" />);
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      blocks.push(
        <h1 key={key++} className="font-serif text-2xl font-bold text-stone-900 mb-4">
          {renderInline(line.slice(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      blocks.push(
        <h2 key={key++} className="font-serif text-xl font-bold text-stone-900 mt-8 mb-3">
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      blocks.push(
        <h3 key={key++} className="font-semibold text-stone-900 mt-5 mb-2">
          {renderInline(line.slice(4))}
        </h3>
      );
      continue;
    }
    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      continue;
    }
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      listItems.push(orderedMatch[1]);
      continue;
    }

    flushList();
    blocks.push(
      <p key={key++} className="text-stone-700 leading-relaxed mb-4">
        {renderInline(line)}
      </p>
    );
  }
  flushList();

  return <div>{blocks}</div>;
}
