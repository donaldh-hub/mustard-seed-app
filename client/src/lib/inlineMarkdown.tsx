import React, { Fragment } from "react";

/**
 * Renders a small, safe subset of inline markdown (**bold** and *italic*)
 * as React nodes. Jai's responses are plain LLM text that occasionally
 * includes markdown emphasis; the chat/journal/rebuild surfaces render
 * text as-is, so unrendered "**word**" markers show up literally.
 */
export function renderInlineMarkdown(text: string): React.ReactNode {
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return segments.map((segment, i) => {
    if (segment.startsWith("**") && segment.endsWith("**") && segment.length > 4) {
      return <strong key={i}>{segment.slice(2, -2)}</strong>;
    }
    if (segment.startsWith("*") && segment.endsWith("*") && segment.length > 2) {
      return <em key={i}>{segment.slice(1, -1)}</em>;
    }
    return <Fragment key={i}>{segment}</Fragment>;
  });
}
