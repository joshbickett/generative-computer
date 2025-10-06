/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This file is intentionally simple so both humans and agents can edit it.
 *
 * ✨ How agents should use this manifest:
 * - Import any React components you create under `src/agent-components/`
 * - Export window descriptors via the `agentWindows` array
 * - Use `kind: 'markdown'` to render an existing file from `runtime/my-computer`
 * - Use `kind: 'component'` to mount a React component
 * - Choose a stable `id` so the UI can track and re-open the window reliably
 */

import type { AgentWindowDescriptor } from './types/windows';

export const agentWindows: AgentWindowDescriptor[] = [
  // Example (remove when adding your own):
  // {
  //   id: 'welcome-note',
  //   title: 'Workspace Welcome',
  //   kind: 'markdown',
  //   file: 'welcome.md',
  //   position: { x: 220, y: 180 },
  // },
];
