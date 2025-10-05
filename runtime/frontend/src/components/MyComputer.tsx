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
    default:
      return '📄';
  }
}

export default function MyComputer({
  files,
  isLoading,
  error,
  onOpenFile,
}: MyComputerProps) {
  return (
    <div className="my-computer">
      <div className="my-computer__toolbar">
        <p className="my-computer__blurb">
          Shared workspace for you and the agent. Edits here write to disk so
          both of you stay in sync.
        </p>
        <span className="my-computer__status" aria-live="polite">
          {isLoading ? 'Loading…' : ''}
        </span>
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
            Ask the agent to create one or start a fresh markdown note.
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
