/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceFile } from '../types/files';
import './MyComputer.css';

interface MyComputerProps {
  files: WorkspaceFile[];
  isLoading: boolean;
  error: string | null;
  onOpenFile: (file: WorkspaceFile) => void;
  onCreateFile: (options: {
    path: string;
    type: 'markdown' | 'text' | 'csv';
  }) => void;
  onDeleteFile: (file: WorkspaceFile) => void;
  statusMessage?: string | null;
  disableActions?: boolean;
  isCreatingFile: boolean;
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  }

  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

function formatUpdatedAt(isoDate: string): string {
  if (!isoDate) return 'unknown';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return parsed.toLocaleString();
}

function describeKind(kind: WorkspaceFile['kind']): string {
  switch (kind) {
    case 'markdown':
      return 'Markdown document';
    case 'tsx':
      return 'React component';
    case 'text':
      return 'Text file';
    default:
      return 'File';
  }
}

function iconForKind(kind: WorkspaceFile['kind']): string {
  switch (kind) {
    case 'markdown':
      return '📝';
    case 'tsx':
      return '🧩';
    case 'text':
      return '📄';
    default:
      return '📄';
  }
}

export default function MyComputer({
  files,
  isLoading,
  error,
  onOpenFile,
  onCreateFile,
  onDeleteFile,
  statusMessage,
  disableActions = false,
  isCreatingFile,
}: MyComputerProps) {
  const statusText = isLoading ? 'Loading…' : (statusMessage ?? '');
  const actionsDisabled = disableActions || isLoading;
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState('notes/new-file');
  const [newFileType, setNewFileType] = useState<'markdown' | 'text' | 'csv'>(
    'markdown',
  );
  const [submittedWhileOpen, setSubmittedWhileOpen] = useState(false);

  useEffect(() => {
    if (!isCreatingFile && submittedWhileOpen) {
      setIsCreatorOpen(false);
      setSubmittedWhileOpen(false);
      setNewFilePath('notes/new-file');
      setNewFileType('markdown');
    }
  }, [isCreatingFile, submittedWhileOpen]);

  const pathError = useMemo(() => {
    const trimmed = newFilePath.trim();
    if (!trimmed) {
      return 'Enter a file name';
    }
    if (trimmed.startsWith('/') || trimmed.includes('..')) {
      return 'Stay inside runtime/my-computer';
    }
    if (trimmed.endsWith('/')) {
      return 'Provide a file name, not just a folder';
    }
    return null;
  }, [newFilePath]);

  const handleToggleCreator = () => {
    if (actionsDisabled) {
      return;
    }
    if (isCreatorOpen) {
      setIsCreatorOpen(false);
      setSubmittedWhileOpen(false);
      setNewFilePath('notes/new-file');
      setNewFileType('markdown');
      return;
    }
    setIsCreatorOpen(true);
  };

  const handleCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (actionsDisabled || pathError) {
      return;
    }
    setSubmittedWhileOpen(true);
    onCreateFile({ path: newFilePath.trim(), type: newFileType });
  };

  return (
    <div className="my-computer">
      <div className="my-computer__toolbar">
        <p className="my-computer__blurb">
          Shared workspace for you and the agent. Edits here write to disk so
          both of you stay in sync.
        </p>
        <div className="my-computer__toolbar-meta">
          <div className="my-computer__actions">
            <button
              type="button"
              className="my-computer__button"
              onClick={handleToggleCreator}
              disabled={actionsDisabled}
            >
              {isCreatorOpen ? 'Close' : 'Create File'}
            </button>
          </div>
          <span className="my-computer__status" aria-live="polite">
            {statusText}
          </span>
        </div>
      </div>

      {isCreatorOpen ? (
        <form className="my-computer__creator" onSubmit={handleCreateSubmit}>
          <div className="my-computer__creator-row">
            <label className="my-computer__creator-field">
              <span className="my-computer__creator-label">File name</span>
              <input
                type="text"
                value={newFilePath}
                onChange={(event) => setNewFilePath(event.target.value)}
                className="my-computer__creator-input"
                placeholder="notes/new-file"
                disabled={actionsDisabled}
                aria-invalid={pathError ? 'true' : 'false'}
              />
            </label>
            <label className="my-computer__creator-field">
              <span className="my-computer__creator-label">Type</span>
              <select
                value={newFileType}
                onChange={(event) =>
                  setNewFileType(
                    event.target.value as 'markdown' | 'text' | 'csv',
                  )
                }
                className="my-computer__creator-select"
                disabled={actionsDisabled}
              >
                <option value="markdown">Markdown (.md)</option>
                <option value="text">Plain text (.txt)</option>
                <option value="csv">Spreadsheet (.csv)</option>
              </select>
            </label>
          </div>
          {pathError ? (
            <p className="my-computer__creator-error" role="alert">
              {pathError}
            </p>
          ) : (
            <p className="my-computer__creator-hint">
              Files save under <code>runtime/my-computer/</code>
            </p>
          )}
          <div className="my-computer__creator-actions">
            <button
              type="button"
              className="my-computer__button my-computer__button--ghost"
              onClick={handleToggleCreator}
              disabled={isCreatingFile}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="my-computer__button my-computer__button--accent"
              disabled={Boolean(pathError) || actionsDisabled}
            >
              {isCreatingFile ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="my-computer__state my-computer__state--error">
          <p>Unable to load files.</p>
          <p className="my-computer__state-detail">{error}</p>
        </div>
      ) : files.length === 0 ? (
        <div className="my-computer__state">
          <p>No files yet.</p>
          <p className="my-computer__state-detail">
            Ask the agent to create one or use the button above to start a new
            file yourself.
          </p>
        </div>
      ) : (
        <div className="my-computer__grid" role="list">
          {files.map((file) => (
            <div key={file.path} className="my-computer__file" role="listitem">
              <button
                type="button"
                className="my-computer__file-main"
                onClick={() => onOpenFile(file)}
                title={`Open ${file.name}`}
              >
                <span className="my-computer__icon" aria-hidden="true">
                  {iconForKind(file.kind)}
                </span>
                <span className="my-computer__filename">{file.name}</span>
                <span className="my-computer__meta">
                  {describeKind(file.kind)} · {formatSize(file.size)} · Updated{' '}
                  {formatUpdatedAt(file.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                className="my-computer__file-delete"
                onClick={() => onDeleteFile(file)}
                title={`Delete ${file.name}`}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
