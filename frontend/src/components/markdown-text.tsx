import React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal Markdown renderer for LLM output.
 *
 * Models answer in Markdown (`**bold**`, `- bullets`, `1.` lists), but the chat
 * bubbles used to print the raw source, so asterisks leaked into the UI.
 *
 * Deliberately dependency-free and built from React elements only — nothing is
 * passed through `dangerouslySetInnerHTML`, so model output can't inject markup.
 * Covers the subset models actually emit here: headings, bold, italic, inline
 * code, fenced code, ordered/unordered lists, links, rules and paragraphs.
 * It does NOT do tables, images, blockquotes or nested lists — reach for
 * `react-markdown` if those ever matter.
 */

/** Only these schemes may become clickable links. */
const SAFE_HREF = /^(https?:|mailto:)/i;

// One pass over a line, longest/most-specific markers first so `**` wins over `*`.
const INLINE =
  /(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\s]+\))|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith("`")) {
      out.push(
        <code
          key={key}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      const label = token.slice(1, split);
      const href = token.slice(split + 2, -1);
      out.push(
        SAFE_HREF.test(href) ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            {label}
          </a>
        ) : (
          // Unsafe scheme (javascript:, data:, …) — show the label as plain text.
          <span key={key}>{label}</span>
        )
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      out.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      out.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = m.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^(#{1,4})\s+(.*)$/;
const RULE = /^\s*([-*_])\1{2,}\s*$/;

export function MarkdownText({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];

  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let fence: { lang: string; lines: string[] } | null = null;
  let k = 0;

  const flushPara = () => {
    if (!para.length) return;
    blocks.push(
      <p key={`p${k++}`} className="leading-relaxed">
        {renderInline(para.join("\n"), `p${k}`)}
      </p>
    );
    para = [];
  };

  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag
        key={`l${k++}`}
        className={cn(
          "space-y-1.5 pl-1",
          ordered ? "list-inside list-decimal" : ""
        )}
      >
        {items.map((it, idx) =>
          ordered ? (
            <li key={idx} className="leading-relaxed">
              {renderInline(it, `l${k}-${idx}`)}
            </li>
          ) : (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <span className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{renderInline(it, `l${k}-${idx}`)}</span>
            </li>
          )
        )}
      </Tag>
    );
    list = null;
  };

  const flushAll = () => {
    flushPara();
    flushList();
  };

  for (const raw of lines) {
    // Fenced code blocks swallow everything until the closing fence.
    if (raw.trimStart().startsWith("```")) {
      if (fence) {
        blocks.push(
          <pre
            key={`c${k++}`}
            className="hh-scroll overflow-x-auto rounded-lg border bg-muted/60 p-3"
          >
            <code className="font-mono text-[0.85em] leading-relaxed">
              {fence.lines.join("\n")}
            </code>
          </pre>
        );
        fence = null;
      } else {
        flushAll();
        fence = { lang: raw.trim().slice(3), lines: [] };
      }
      continue;
    }
    if (fence) {
      fence.lines.push(raw);
      continue;
    }

    if (!raw.trim()) {
      flushAll();
      continue;
    }

    if (RULE.test(raw)) {
      flushAll();
      blocks.push(<hr key={`r${k++}`} className="border-border" />);
      continue;
    }

    const h = HEADING.exec(raw);
    if (h) {
      flushAll();
      const level = h[1].length;
      blocks.push(
        <p
          key={`h${k++}`}
          className={cn(
            "font-semibold text-foreground",
            level <= 2 ? "text-[1.05em]" : "text-[1em]"
          )}
        >
          {renderInline(h[2], `h${k}`)}
        </p>
      );
      continue;
    }

    const b = BULLET.exec(raw);
    if (b) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(b[1]);
      continue;
    }

    const o = ORDERED.exec(raw);
    if (o) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(o[2]);
      continue;
    }

    flushList();
    para.push(raw);
  }

  // Close anything still open at EOF (e.g. a streamed, unterminated fence).
  if (fence) {
    blocks.push(
      <pre
        key={`c${k++}`}
        className="hh-scroll overflow-x-auto rounded-lg border bg-muted/60 p-3"
      >
        <code className="font-mono text-[0.85em] leading-relaxed">
          {fence.lines.join("\n")}
        </code>
      </pre>
    );
  }
  flushAll();

  return <div className={cn("space-y-3", className)}>{blocks}</div>;
}

export default MarkdownText;
