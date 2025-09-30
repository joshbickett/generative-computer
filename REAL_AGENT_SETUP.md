# Setting Up the Real Gemini Agent

Currently, Generative Computer uses a **smart simulator** that generates contextual todo lists based on your requests. This works immediately without any setup.

To use the **REAL Gemini CLI agent** that actually thinks and writes code, you need to set up authentication first.

## Why It's Not Working Yet

The Gemini CLI requires authentication to access the AI model. When we tried running it, we got:

```
Error: 404 - Requested entity was not found
```

This means the CLI doesn't have valid credentials.

## Setup Options

### Option 1: Login with Google (Recommended)

1. Run Gemini CLI manually first to authenticate:

   ```bash
   cd /Users/josh/Documents/software/repos/open-imagine
   npm start
   ```

2. Choose "Login with Google" when prompted

3. Complete the OAuth flow in your browser

4. Once authenticated, restart the backend:
   ```bash
   cd backend
   USE_REAL_AGENT=true npm start
   ```

### Option 2: Use Gemini API Key

1. Get an API key from https://aistudio.google.com/apikey

2. Set the environment variable:

   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```

3. Restart the backend:
   ```bash
   cd backend
   USE_REAL_AGENT=true npm start
   ```

### Option 3: Vertex AI (Enterprise)

1. Set up Google Cloud credentials

2. Export environment variables:

   ```bash
   export GOOGLE_API_KEY="your-vertex-key"
   export GOOGLE_GENAI_USE_VERTEXAI=true
   export GOOGLE_CLOUD_PROJECT="your-project-id"
   ```

3. Restart the backend:
   ```bash
   cd backend
   USE_REAL_AGENT=true npm start
   ```

## How the Real Agent Works

When properly authenticated, here's what happens:

1. **User types command** in the browser
2. **Frontend sends to backend** via POST /api/command
3. **Backend spawns Gemini CLI** with the user's prompt
4. **Gemini CLI thinks and writes code** (modifies GeneratedContent.tsx)
5. **Vite's HMR detects the change** and hot-reloads the frontend
6. **User sees the update** instantly

The real agent:

- Actually understands your request
- Generates creative, contextual todo lists
- Can write sophisticated React code
- Takes 3-10 seconds per request (it's thinking!)

## Current Smart Simulator

The simulator is quite intelligent and recognizes:

- Shopping lists (carrots, apples, groceries)
- Blog writing requests
- Code/development tasks
- Travel planning
- Twitter/social media posts
- Generic todos

It generates beautiful, contextual todo lists with:

- Relevant emoji icons
- Contextual tips
- Proper React/TypeScript code
- Inline styles that look great

## Debugging

If the real agent still doesn't work after authentication:

1. Check the backend logs:

   ```bash
   cd backend
   USE_REAL_AGENT=true npm start
   ```

   Look for error messages

2. Test Gemini CLI directly:

   ```bash
   cd /Users/josh/Documents/software/repos/open-imagine
   npm start -- "Write a hello world function"
   ```

3. Check error logs in /var/folders (path shown in error message)

4. Verify your working directory has the frontend/src folder

### Deep debug mode

Set `DEBUG_AGENT=true` when launching `./start.sh` (or the backend) to capture full transcripts:

```bash
DEBUG_AGENT=true ./start.sh
```

- Each Gemini invocation writes a log file under `logs/agent/` containing the user prompt, CLI arguments, stdout, and stderr.
- If the CLI reports an API failure, the backend falls back to the smart simulator and surfaces the debug log path in the JSON response so you can open the transcript immediately.
- Deprecation warnings and ANSI color codes are suppressed to keep the logs easy to read.

## Performance

- **Smart Simulator**: Instant (<100ms)
- **Real Agent**: 3-10 seconds depending on complexity

For demos and quick iteration, the simulator is often preferable!

## Future Improvements

To make the real agent integration more robust:

1. Add a loading indicator in the UI while agent is thinking
2. Stream the agent's progress to the frontend
3. Show the agent's "thought process" as it works
4. Add error handling and retry logic
5. Create a settings UI to toggle modes
6. Add agent memory across requests

---

**For now, enjoy the smart simulator! It's fast, works out of the box, and generates great todo lists.** 🚀
