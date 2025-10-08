/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkspaceFile } from '../types/files';
import './MyComputer.css';

interface MyComputerProps {
  files: WorkspaceFile[];
  isLoading: boolean;
  error: string | null;
  onOpenFile: (file: WorkspaceFile) => void;
  onCreateMarkdown: () => void;
  onCreateTextFile: () => void;
  onRefresh: () => void;
  statusMessage?: string | null;
  disableActions?: boolean;
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
  onCreateMarkdown,
  onCreateTextFile,
  onRefresh,
  statusMessage,
  disableActions = false,
}: MyComputerProps) {
  const statusText = isLoading ? 'Loading…' : (statusMessage ?? '');
  const actionsDisabled = disableActions || isLoading;

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
              onClick={onCreateMarkdown}
              disabled={actionsDisabled}
            >
              New Markdown
            </button>
            <button
              type="button"
              className="my-computer__button"
              onClick={onCreateTextFile}
              disabled={actionsDisabled}
            >
              New Text/CSV
            </button>
            <button
              type="button"
              className="my-computer__button my-computer__button--secondary"
              onClick={onRefresh}
              disabled={isLoading || actionsDisabled}
            >
              Refresh
            </button>
          </div>
          <span className="my-computer__status" aria-live="polite">
            {statusText}
          </span>
        </div>
      </div>

      {error ? (
        <div className="my-computer__state my-computer__state--error">
          <p>Unable to load files.</p>
          <p className="my-computer__state-detail">{error}</p>
        </div>
      ) : files.length === 0 ? (
        <div className="my-computer__state">
          <p>No files yet.</p>
          <p className="my-computer__state-detail">
            Ask the agent to create one or use the buttons above to start a new
            file yourself.
          </p>
        </div>
      ) : (
        <div className="my-computer__grid" role="list">
          {files.map((file) => (
            <button
              key={file.path}
              type="button"
              className="my-computer__file"
              onClick={() => onOpenFile(file)}
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
          ))}
        </div>
      )}
    </div>
  );
}
