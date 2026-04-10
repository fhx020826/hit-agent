"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

function normalizeContent(input: string) {
  const normalized = input
    .replace(/\\n/g, "\n")
    .replace(/\/n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Handle escaped delimiters produced by some model outputs.
  // e.g. "\\(" -> "\(" and "\\[" -> "\["
  return normalized
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");
}

function normalizeMathDelimiters(input: string) {
  // Convert LaTeX \( ... \) and \[ ... \] into remark-math friendly delimiters.
  return input
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_all, expr: string) => `$$\n${String(expr).trim()}\n$$`)
    .replace(/\\\((.+?)\\\)/g, (_all, expr: string) => `$${String(expr).trim()}$`);
}

export function RichAnswer({ content, className = "" }: { content: string; className?: string }) {
  const normalized = normalizeMathDelimiters(normalizeContent(content));
  if (!normalized) return null;

  return (
    <div className={`space-y-3 leading-7 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
