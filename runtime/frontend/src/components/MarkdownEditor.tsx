/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorkspaceFile } from '../types/files';
import { requestJson } from '../lib/api';
import './MarkdownEditor.css';

interface MarkdownEditorProps {
  file: WorkspaceFile;
  onSaved?: (savedAt: string) => void;
  onRefreshFiles: () => void;
}

function escapeHtml(content: string): string {
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

function renderMarkdown(markdown: string): string {
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
        html.push('<pre class="markdown-editor__code">');
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
  return joined;
}

function htmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function serialize(node: Node, options: { listDepth: number }): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      return text.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ');
    }

    if (!(node instanceof HTMLElement)) {
      return '';
    }

    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes)
      .map((child) => serialize(child, options))
      .join('');

    switch (tag) {
      case 'strong':
      case 'b':
        return children.trim() ? `**${children.trim()}**` : '';
      case 'em':
      case 'i':
        return children.trim() ? `*${children.trim()}*` : '';
      case 'code': {
        if (node.parentElement?.tagName.toLowerCase() === 'pre') {
          return children;
        }
        return children.trim() ? `\`${children.trim()}\`` : '';
      }
      case 'pre': {
        const content = node.textContent ?? '';
        const trimmed = content.replace(/^\n+|\n+$/g, '');
        return trimmed ? `\n\n\`\`\`\n${trimmed}\n\`\`\`\n\n` : '';
      }
      case 'a': {
        const href = node.getAttribute('href');
        const label = children.trim();
        if (!href) return label;
        return `[${label || href}](${href})`;
      }
      case 'br':
        return '\n';
      case 'p':
      case 'div': {
        const value = children.trim();
        return value;
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = Number(tag.slice(1));
        const heading = children.trim();
        return heading ? `${'#'.repeat(level)} ${heading}` : '';
      }
      case 'ul': {
        const items = Array.from(node.children)
          .map((item) => serialize(item, { listDepth: options.listDepth + 1 }))
          .filter(Boolean)
          .join('\n');
        return items;
      }
      case 'li': {
        const indent = '  '.repeat(options.listDepth - 1);
        const content = Array.from(node.childNodes)
          .map((child) => serialize(child, { listDepth: options.listDepth }))
          .join('')
          .trim();

        return content
          ? `${indent}- ${content.replace(/\n+/g, `\n${indent}  `)}`
          : '';
      }
      case 'span':
      case 'section':
      case 'article':
      case 'body':
        return children;
      default:
        return children;
    }
  }

  const blocks = Array.from(doc.body.childNodes)
    .map((child) => serialize(child, { listDepth: 1 }).trim())
    .filter(Boolean);

  const markdown = blocks.join('\n\n');
  return markdown.trim();
}

export default function MarkdownEditor({
  file,
  onSaved,
  onRefreshFiles,
}: MarkdownEditorProps) {
  const [value, setValue] = useState('');
  const [originalValue, setOriginalValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [htmlValue, setHtmlValue] = useState('<p></p>');
  const editorRef = useRef<HTMLDivElement | null>(null);

  const isDirty = value !== originalValue;

  const loadFile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await requestJson<{
        success: boolean;
        content: string;
        error?: string;
      }>(`/api/files/content?path=${encodeURIComponent(file.path)}`);

      if (data.success === false) {
        throw new Error(data.error || 'Failed to load file');
      }

      const content = typeof data.content === 'string' ? data.content : '';
      const rendered = renderMarkdown(content);
      setValue(content);
      setOriginalValue(content);
      setHtmlValue(rendered);
      setSavedAt(file.updatedAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [file.path, file.updatedAt]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== htmlValue) {
      editorRef.current.innerHTML = htmlValue;
    }
  }, [htmlValue]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const data = await requestJson<{
        success: boolean;
        savedAt?: string;
        error?: string;
      }>('/api/files/content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: file.path, content: value }),
      });

      if (data.success === false) {
        throw new Error(data.error || 'Failed to save file');
      }
      const timestamp = data.savedAt || new Date().toISOString();
      setOriginalValue(value);
      setSavedAt(timestamp);
      onRefreshFiles();
      onSaved?.(timestamp);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }, [file.path, onRefreshFiles, onSaved, value]);

  const handleRevert = useCallback(() => {
    setValue(originalValue);
    setHtmlValue(renderMarkdown(originalValue));
  }, [originalValue]);

  const statusMessage = useMemo(() => {
    if (isSaving) return 'Saving…';
    if (isLoading) return 'Loading file…';
    if (error) return `Error: ${error}`;
    if (isDirty) return 'Unsaved changes';
    if (savedAt) {
      const date = new Date(savedAt);
      if (!Number.isNaN(date.getTime())) {
        return `Saved ${date.toLocaleTimeString()}`;
      }
    }
    return 'All changes saved';
  }, [error, isDirty, isLoading, isSaving, savedAt]);

  const focusEditor = useCallback(() => {
    const node = editorRef.current;
    if (!node) return;
    if (document.activeElement === node) return;
    node.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.selectAllChildren(node);
    selection.collapseToEnd();
  }, []);

  const handleInput = useCallback(() => {
    const node = editorRef.current;
    if (!node) return;
    const newHtml = node.innerHTML;
    const newMarkdown = htmlToMarkdown(newHtml);
    if (newHtml !== htmlValue) {
      setHtmlValue(newHtml);
    }
    setValue(newMarkdown);
  }, [htmlValue]);

  const applyCommand = useCallback(
    (command: string, value?: string) => {
      focusEditor();
      document.execCommand(command, false, value);
      handleInput();
    },
    [focusEditor, handleInput],
  );

  const handleHeading = useCallback(
    (level: number) => {
      focusEditor();
      document.execCommand('formatBlock', false, `h${level}`);
      handleInput();
    },
    [focusEditor, handleInput],
  );

  const handleList = useCallback(() => {
    focusEditor();
    document.execCommand('insertUnorderedList');
    handleInput();
  }, [focusEditor, handleInput]);

  const handleLink = useCallback(() => {
    focusEditor();
    const url = window.prompt('Link URL');
    if (!url) return;
    document.execCommand('createLink', false, url);
    handleInput();
  }, [focusEditor, handleInput]);

  const handleCodeBlock = useCallback(() => {
    focusEditor();
    document.execCommand('formatBlock', false, 'pre');
    handleInput();
  }, [focusEditor, handleInput]);

  const handleInlineCode = useCallback(() => {
    focusEditor();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const contents = range.cloneContents();
    const temp = document.createElement('div');
    temp.appendChild(contents);
    const selectedText = temp.textContent || '';

    if (!selectedText) {
      document.execCommand('insertHTML', false, '<code></code>');
    } else {
      document.execCommand(
        'insertHTML',
        false,
        `<code>${escapeHtml(selectedText)}</code>`,
      );
    }
    handleInput();
  }, [focusEditor, handleInput]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        document.execCommand('insertText', false, '  ');
        handleInput();
      }
    },
    [handleInput],
  );

  return (
    <div className="markdown-editor">
      <div className="markdown-editor__heading">
        <div>
          <h2 className="markdown-editor__title">{file.name}</h2>
          <p className="markdown-editor__path">{file.path}</p>
        </div>
        <div className="markdown-editor__actions">
          <button
            type="button"
            className="markdown-editor__button"
            onClick={handleRevert}
            disabled={!isDirty || isSaving}
          >
            Revert
          </button>
          <button
            type="button"
            className="markdown-editor__button markdown-editor__button--accent"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && !isDirty && (
        <div className="markdown-editor__error">{error}</div>
      )}

      <div className="markdown-editor__body">
        <div className="markdown-editor__label-row">
          <span className="markdown-editor__label">Document</span>
          <span className="markdown-editor__hint">Rich text editor</span>
        </div>
        <div className="rich-editor">
          <div className="rich-editor__toolbar">
            <button
              type="button"
              className="rich-editor__button rich-editor__button--wide"
              onClick={() => applyCommand('bold')}
              disabled={isLoading || isSaving}
            >
              Bold
            </button>
            <button
              type="button"
              className="rich-editor__button rich-editor__button--wide"
              onClick={() => applyCommand('italic')}
              disabled={isLoading || isSaving}
            >
              Italic
            </button>
            <button
              type="button"
              className="rich-editor__button"
              onClick={() => handleHeading(2)}
              disabled={isLoading || isSaving}
            >
              H2
            </button>
            <button
              type="button"
              className="rich-editor__button"
              onClick={() => handleHeading(3)}
              disabled={isLoading || isSaving}
            >
              H3
            </button>
            <button
              type="button"
              className="rich-editor__button"
              onClick={handleList}
              disabled={isLoading || isSaving}
            >
              Bullet list
            </button>
            <button
              type="button"
              className="rich-editor__button"
              onClick={handleLink}
              disabled={isLoading || isSaving}
            >
              Link
            </button>
            <button
              type="button"
              className="rich-editor__button"
              onClick={handleCodeBlock}
              disabled={isLoading || isSaving}
            >
              Code block
            </button>
            <button
              type="button"
              className="rich-editor__button"
              onClick={handleInlineCode}
              disabled={isLoading || isSaving}
            >
              Inline code
            </button>
          </div>
          <div
            ref={editorRef}
            className="rich-editor__area"
            contentEditable={!isLoading && !isSaving}
            suppressContentEditableWarning
            onInput={handleInput}
            onBlur={handleInput}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className="markdown-editor__status">{statusMessage}</div>
    </div>
  );
}
