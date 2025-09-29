# Authentication & Startup Flow

This project now has an opinionated startup script and in-app status indicators so you always know whether the real Gemini coding agent is active.

## 1. Requirements

- **Node.js 20+** – the headless Gemini CLI depends on APIs that do not exist in older runtimes. Run `nvm use 20` (or your local equivalent) before launching the stack.
- **Gemini CLI credentials** – stored under `~/.gemini/` once you complete the login flow.
- **Built CLI bundle** – run `npm run build` after pulling new changes so the CLI bundle stays up to date.

## 2. `./start.sh` Flow

The start script now orchestrates everything:

1. Verifies you are on Node 20+ and prints a warning if you are not.
2. Looks for `~/.gemini/oauth_creds.json` (and related files) to determine whether you are already authenticated.
3. When credentials are missing it launches `npm start`, which opens the Gemini CLI so you can complete "Login with Google". Type `/exit` to return to the script once the browser flow finishes.
4. Installs dependencies for the root workspace, backend, and frontend when needed.
5. Builds the Gemini CLI bundle if it is missing.
6. Starts the backend with `USE_REAL_AGENT=true` and then boots the Vite dev server.
7. Prints a final reminder to open `http://localhost:5173`.

Re-run `./start.sh` whenever you want both services running with the real agent.

## 3. Backend Authentication Check

- On boot, when `USE_REAL_AGENT=true`, the backend runs a headless Gemini CLI probe (`--prompt "Reply with AUTH_OK" --yolo`).
- Success sets `authStatus.authenticated=true`. Failures capture detailed error messages (including Node-version mismatches) and automatically fall back to the local simulator for individual commands.
- Every `/api/command` call attempts the real agent first and then transparently uses the simulator if the CLI exits with an error.

## 4. Frontend Feedback Loop

The desktop UI now exposes the agent state:

- A fixed **status bar** shows whether the real agent is connected, whether credentials are present, and the most recent command outcome (including fallback warnings).
- The **command input hint** adapts to the current situation (auth needed, agent thinking, simulator mode, etc.).
- Input controls lock while the agent is processing so you can see when the LLM is editing the project.

If the backend ever drops to simulator mode you will still get generated content, and the status bar will call out that the real agent is unavailable until authentication succeeds.

## 5. Manual Checks

To confirm credentials outside the UI you can run:

```bash
node -e "import('./backend/check-auth.js').then(m => m.checkGeminiAuth().then(console.log))"
```

The command prints a JSON summary highlighting Node version problems, auth failures, or a clean success.

---

With these pieces in place you can focus on iterating with the real Gemini agent. When in doubt, run `./start.sh` from the project root and follow the prompts.
