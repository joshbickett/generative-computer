/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { requestJson } from '../lib/api';
import { renderMarkdown } from '../lib/markdown';
import './MarkdownViewer.css';

interface MarkdownViewerProps {
  filePath: string;
  title?: string;
}

interface FileContentResponse {
  success: boolean;
  content: string;
  error?: string;
}

export default function MarkdownViewer({
  filePath,
  title,
}: MarkdownViewerProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await requestJson<FileContentResponse>(
        `/api/files/content?path=${encodeURIComponent(filePath)}`,
      );

      if (!data.success) {
        throw new Error(data.error || 'Unable to load file');
      }

      setContent(typeof data.content === 'string' ? data.content : '');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const rendered = useMemo(() => renderMarkdown(content), [content]);

  if (isLoading) {
    return (
      <div className="markdown-viewer">
        <p className="markdown-viewer__meta">Loading {title ?? filePath}…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="markdown-viewer markdown-viewer--error">
        <p className="markdown-viewer__meta">
          Unable to load {title ?? filePath}.
        </p>
        <p className="markdown-viewer__detail">{error}</p>
      </div>
    );
  }

  return (
    <div className="markdown-viewer">
      <div
        className="markdown-viewer__content"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    </div>
  );
}
