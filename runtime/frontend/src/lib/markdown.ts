/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function escapeHtml(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(content: string): string {
  let escaped = escapeHtml(content);
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/_([^_]+)_/g, '<em>$1</em>');
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>',
  );
  return escaped;
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;
  let inCode = false;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      if (inCode) {
        html.push('</pre>');
        inCode = false;
      } else {
        closeList();
        inCode = true;
        html.push('<pre class="markdown-block__code">');
      }
      continue;
    }

    if (inCode) {
      html.push(escapeHtml(rawLine));
      continue;
    }

    if (!line) {
      closeList();
      html.push('');
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      closeList();
      const headingLevel = Math.min(line.match(/^#+/)?.[0].length ?? 1, 6);
      const headingText = line.replace(/^#{1,6}\s+/, '');
      html.push(
        `<h${headingLevel}>${renderInlineMarkdown(headingText)}</h${headingLevel}>`,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        inList = true;
        html.push('<ul>');
      }
      const item = line.replace(/^[-*]\s+/, '');
      html.push(`<li>${renderInlineMarkdown(item)}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  closeList();

  if (inCode) {
    html.push('</pre>');
  }

  const filtered = html.filter(
    (segment, index, arr) => !(segment === '' && arr[index - 1] === ''),
  );

  const joined = filtered.join('\n');
  return joined || '<p></p>';
}
