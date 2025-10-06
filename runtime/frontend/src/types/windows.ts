/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ComponentType } from 'react';

export type AgentWindowDescriptor =
  | {
      id: string;
      title: string;
      kind: 'component';
      component: ComponentType;
      position?: { x: number; y: number };
    }
  | {
      id: string;
      title: string;
      kind: 'markdown';
      file: string;
      position?: { x: number; y: number };
    };
