"use client";

import { useMemo } from "react";

interface AIReportViewerProps {
  content: string;
}

export default function AIReportViewer({ content }: AIReportViewerProps) {
  const html = useMemo(() => markdownToHtml(content), [content]);

  return (
    <div
      className="prose prose-invert prose-sm max-w-none
        prose-headings:text-text-primary prose-headings:font-semibold
        prose-h1:text-2xl prose-h1:border-b prose-h1:border-surface-3 prose-h1:pb-3
        prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
        prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-text-secondary prose-p:leading-relaxed
        prose-strong:text-text-primary
        prose-li:text-text-secondary
        prose-code:text-brand prose-code:bg-surface-2 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
        prose-blockquote:border-brand prose-blockquote:text-text-secondary
        prose-hr:border-surface-3
        prose-table:text-sm
        prose-th:text-text-primary prose-th:bg-surface-2
        prose-td:border-surface-3"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function markdownToHtml(md: string): string {
  let html = md;

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre class="bg-surface-2 rounded-lg p-4 overflow-x-auto text-sm text-text-secondary"><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  html = html.replace(/⚠/g, '<span class="text-sentiment-negative font-bold">⚠</span>');

  html = html.replace(/^---$/gm, '<hr />');

  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br />');

  html = `<p>${html}</p>`;

  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<h[1-3]>)/g, "$1");
  html = html.replace(/(<\/h[1-3]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");
  html = html.replace(/<p>(<hr \/>)/g, "$1");
  html = html.replace(/(<hr \/>)<\/p>/g, "$1");
  html = html.replace(/<p>(<blockquote>)/g, "$1");
  html = html.replace(/(<\/blockquote>)<\/p>/g, "$1");

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
