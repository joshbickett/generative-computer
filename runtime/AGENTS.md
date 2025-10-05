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
│   │   ├── src/components/
│   │   │   ├── CommandInput.tsx     # Always-on prompt box (protected from edits)
│   │   │   ├── Desktop.tsx          # Desktop layout and window manager
│   │   │   ├── Window.tsx           # Draggable window wrapper
│   │   │   ├── MyComputer.tsx       # Lists workspace files for humans + agents
│   │   │   ├── MarkdownEditor.tsx   # Dual-pane markdown editor/preview
│   │   │   └── GeneratedContent.tsx # Legacy showcase example (kept for reference)
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
3. The agent can update shared workspace files under `runtime/my-computer/` (markdown notes, task lists, etc.) or craft React components within `runtime/frontend/src/components/`.
4. The frontend watches these locations: markdown files flow into the **My Computer** window and open in a live editor, while React components can be mounted into new desktop windows.

## Working with the shared desktop

- **Markdown first.** Creating or editing `runtime/my-computer/*.md` instantly syncs with the Markdown editor. Give the file a descriptive name (for example `retro-roadmap.md`) so both the human and agent can reference it later.
- **React experiences.** When you need interactivity, create a `.tsx` module beside the other components. Import it from `Desktop` or open it in a dedicated window you compose. The existing `GeneratedContent.tsx` file is a good reference for styling and layout conventions.
- **Name things clearly.** The UI surfaces the exact file name inside the window title bar. If you plan to ask the human to reopen something, tell them the filename they should double-click inside **My Computer**.
- **Keep CommandInput.tsx / Desktop.tsx / Window.tsx untouched.** Those remain protected so the shell stays stable. Compose new UI inside components you create, and wire them up through the desktop window system instead of altering the protected primitives.
