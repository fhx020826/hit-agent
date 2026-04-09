"use client";

function normalizeContent(input: string) {
  return input
    .replace(/\\n/g, "\n")
    .replace(/\/n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isBullet(line: string) {
  return /^(\-|\*|•|\d+[.)]|[一二三四五六七八九十]+[、.])\s*/.test(line.trim());
}

function stripBullet(line: string) {
  return line.replace(/^(\-|\*|•|\d+[.)]|[一二三四五六七八九十]+[、.])\s*/, "").trim();
}

export function RichAnswer({ content, className = "" }: { content: string; className?: string }) {
  const normalized = normalizeContent(content);
  if (!normalized) return null;
  const blocks = normalized.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((item) => item.trim()).filter(Boolean);
        const bulletLike = lines.length > 1 && lines.every(isBullet);
        if (bulletLike) {
          return (
            <ul key={`${block}-${index}`} className="list-disc space-y-2 pl-5">
              {lines.map((line) => <li key={line}>{stripBullet(line)}</li>)}
            </ul>
          );
        }
        return <p key={`${block}-${index}`} className="whitespace-pre-wrap">{block}</p>;
      })}
    </div>
  );
}
