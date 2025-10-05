# Agents Overview

The `generative-computer` project is a fork of Gemini-CLI that explores an entirely new way for a person to interact with their machine. It retains the Gemini AI agent backend and layers on a React desktop frontend so the user’s requests travel through a richer, bi-directional loop.

In practice, you type into the browser-based UI, the request is forwarded to the Gemini agent, and the agent can do anything it normally could in a command-line environment. On top of that, it can stream UI back by writing to `/frontend`, which the React app watches and renders. This coupling unlocks a more flexible conversation space for both the AI agent and the user.

```
generative-computer/
├── runtime/
│   ├── AGENTS.md               # Overview of the agent stack and workflows
│   ├── frontend/
│   │   ├── src/components/
│   │   │   ├── CommandInput.tsx    # Always-on prompt box (protected from edits)
│   │   │   ├── Desktop.tsx         # Desktop layout and window manager
│   │   │   ├── Window.tsx          # Draggable window wrapper
│   │   │   └── GeneratedContent.tsx # File Gemini rewrites on every command
│   │   └── package.json
│   └── backend/
│       ├── server.js               # Express API (POST /api/command)
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
3. Gemini edits `GeneratedContent.tsx` (and only that file right now).
4. Vite hot-reloads, so the desktop windows morph in real time.
