/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type WorkspaceFileKind = 'markdown' | 'tsx' | 'text' | 'file';

export interface WorkspaceFile {
  name: string;
  path: string;
  kind: WorkspaceFileKind;
  size: number;
  updatedAt: string;
}

export interface WorkspaceFileListResponse {
  success: boolean;
  files: WorkspaceFile[];
  error?: string;
}

export interface WorkspaceFileContentResponse {
  success: boolean;
  content: string;
  error?: string;
}

export interface WorkspaceFileSaveResponse {
  success: boolean;
  savedAt: string;
  error?: string;
}
