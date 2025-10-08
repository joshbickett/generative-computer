/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorkspaceFile } from '../types/files';
import { requestJson } from '../lib/api';
import './TextEditor.css';

interface TextEditorProps {
  file: WorkspaceFile;
  onSaved?: (savedAt: string) => void;
  onRefreshFiles: () => void;
}

interface FileContentResponse {
  success: boolean;
  content: string;
  error?: string;
}

interface FileSaveResponse {
  success: boolean;
  savedAt?: string;
  error?: string;
}

export default function TextEditor({
  file,
  onSaved,
  onRefreshFiles,
}: TextEditorProps) {
  const [value, setValue] = useState('');
  const [originalValue, setOriginalValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const isDirty = useMemo(
    () => value !== originalValue,
    [value, originalValue],
  );

  const loadFile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await requestJson<FileContentResponse>(
        `/api/files/content?path=${encodeURIComponent(file.path)}`,
      );

      if (!data.success) {
        throw new Error(data.error || 'Unable to load file');
      }

      const content = typeof data.content === 'string' ? data.content : '';
      setValue(content);
      setOriginalValue(content);
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

  const handleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const data = await requestJson<FileSaveResponse>('/api/files/content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: file.path, content: value }),
      });

      if (!data.success) {
        throw new Error(data.error || 'Unable to save file');
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
  }, [file.path, isSaving, onRefreshFiles, onSaved, value]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!isSaving) {
          void handleSave();
        }
      }
    },
    [handleSave, isSaving],
  );

  if (isLoading) {
    return (
      <div className="text-editor text-editor--loading">
        <p>Loading {file.name}…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-editor text-editor--error">
        <p className="text-editor__error-heading">Unable to open {file.name}</p>
        <p className="text-editor__error-detail">{error}</p>
        <button type="button" onClick={loadFile} className="text-editor__retry">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="text-editor">
      <div className="text-editor__toolbar">
        <div>
          <span className="text-editor__filename">{file.name}</span>
          {savedAt ? (
            <span className="text-editor__meta">
              Last saved {new Date(savedAt).toLocaleString()}
            </span>
          ) : null}
          {isDirty ? (
            <span className="text-editor__meta text-editor__meta--dirty">
              Unsaved changes
            </span>
          ) : null}
        </div>
        <div className="text-editor__actions">
          <button
            type="button"
            className="text-editor__save"
            onClick={() => void handleSave()}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <textarea
        className="text-editor__textarea"
        value={value}
        spellCheck={false}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={`${file.name} contents`}
      />
    </div>
  );
}
