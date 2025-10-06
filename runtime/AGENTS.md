# Agents Overview

The `generative-computer` project is a fork of Gemini-CLI that explores an entirely new way for a person to interact with their machine. It retains the Gemini AI agent backend and layers on a React desktop frontend so the user’s requests travel through a richer, bi-directional loop.

In practice, you type into the browser-based UI, the request is forwarded to the Gemini agent, and the agent can do anything it normally could in a command-line environment. On top of that, it can stream UI back by writing to `/frontend`, which the React app watches and renders. This coupling unlocks a more flexible conversation space for both the AI agent and the user.

```
generative-computer/
├── runtime/
│   ├── AGENTS.md               # Overview of the agent stack and workflows
│   ├── my-computer/            # Shared “My Computer” workspace (markdown, notes, etc.)
│   │   └── welcome.md          # Default note opened at boot
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── agent-components/    # Agent-authored React components live here
│   │   │   │   └── .keep
│   │   │   ├── agent-manifest.ts    # AgentWindowDescriptor[] manifest
│   │   │   ├── components/
│   │   │   │   ├── CommandInput.tsx # Always-on prompt box (protected from edits)
│   │   │   │   ├── Desktop.tsx      # Desktop layout and window manager
│   │   │   │   ├── Window.tsx       # Draggable window wrapper
│   │   │   │   ├── MyComputer.tsx   # Lists workspace files for humans + agents
│   │   │   │   └── MarkdownEditor.tsx / MarkdownViewer.tsx
│   │   │   ├── lib/
│   │   │   │   ├── api.ts           # Fetch helper with API base fallbacks
│   │   │   │   └── markdown.ts      # Shared markdown rendering utilities
│   │   │   └── types/windows.ts     # AgentWindowDescriptor definition
│   │   └── package.json
│   └── backend/
│       ├── server.js               # Express API (commands + workspace file CRUD)
│       ├── gemini-agent.js         # Spawns the Gemini CLI bundle with guardrails
│       └── smart-simulator.js      # Deterministic fallback content generator
├── bundle/                     # Output of `npm run build` (gemini.js lives here)
├── computer                    # Thin wrapper that forwards to start.sh
├── start.sh                    # Launch script for auth + both services
└── logs/agent/                 # Populated when DEBUG_AGENT=true
```

## How It Works

A generative computer runs an AI agent on the backend that generates code to render what the user requests in real time.

1. You type a request in the computer (rendered in the browser).
2. The backend forwards the request to the Gemini agent.
3. The agent modifies shared workspace files under `runtime/my-computer/` and, when needed, creates UI components under `runtime/frontend/src/agent-components/` while updating `agent-manifest.ts` to announce new windows.
4. The frontend watches these locations: markdown/data files appear in **My Computer** for collaborative editing, and any manifest entry instantly opens a desktop window (either rendering markdown or a React component).

## Working with the shared desktop

- **Markdown & data first.** Drop collaborative notes, CSVs, JSON blobs, or TODO lists under `runtime/my-computer/`. Files here appear in **My Computer** immediately and can be edited by both the human and the agent.
- **Register windows via the manifest.** To auto-open a document, add `{ id, title, kind: 'markdown', file: 'note.md' }` to `agent-manifest.ts`. For interactive UI, create a component in `src/agent-components/`, import it, and add `{ id, title, kind: 'component', component: MyWidget }`.
- **Use stable identifiers.** Pick descriptive filenames (`project-timeline.md`, `weather-widget.tsx`) and manifest ids so future updates reconcile cleanly.
- **Avoid protected primitives.** Leave `CommandInput`, `Desktop`, and `Window` components untouched. Build new UI in agent components and surface it through the manifest instead of editing core chrome.
- **Avoid protected primitives.** Leave `CommandInput`, `Desktop`, and `Window` components untouched. Build new UI in agent components and surface it through the manifest instead of editing core chrome.

## Agent manifest quickstart

```ts
// runtime/frontend/src/agent-manifest.ts
import type { AgentWindowDescriptor } from './types/windows';
import TravelWidget from './agent-components/TravelWidget';

export const agentWindows: AgentWindowDescriptor[] = [
  {
    id: 'daily-plan',
    title: 'Daily Plan',
    kind: 'markdown',
    file: 'daily-plan.md',
    position: { x: 240, y: 180 },
  },
  {
    id: 'travel-widget',
    title: 'Travel Ideas',
    kind: 'component',
    component: TravelWidget,
  },
];
```

Each descriptor either renders an existing workspace file (`kind: 'markdown'`) or a React component you export from `src/agent-components/`. Use stable IDs so subsequent edits reconcile with existing windows.
