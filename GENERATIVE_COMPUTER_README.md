# 🎨 Generative Computer

**A generative computer interface powered by Gemini AI**

Generative Computer is a revolutionary coding agent that creates a feedback loop between an AI agent and a live React frontend. The user types commands in the browser, and the Gemini agent rewrites the UI in real-time, creating a truly generative computing experience.

## 🌟 Concept

This project creates a "coding agent to frontend feedback loop":

1. **User inputs command** in the browser text box
2. **Command sent to backend** server
3. **Backend invokes Gemini CLI agent** with instructions
4. **Agent modifies React components** (specifically `GeneratedContent.tsx`)
5. **Frontend hot-reloads** and shows the new UI
6. **User sees changes instantly** and can send another command

Everything is rendered as **todo lists** initially, creating a unique constraint that makes any request (blog posts, code, recipes) appear as an actionable todo list on a desktop-style interface.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React + TypeScript + Vite)               │
│  • Desktop UI with draggable windows                │
│  • Protected CommandInput (never modified)          │
│  • GeneratedContent (modified by agent)             │
│  Port: 5173                                          │
└────────────────┬────────────────────────────────────┘
                 │
                 │ HTTP POST /api/command
                 │
┌────────────────▼────────────────────────────────────┐
│  Backend (Node.js + Express)                        │
│  • Receives commands from frontend                  │
│  • Invokes Gemini CLI agent                         │
│  • Writes to frontend files                         │
│  Port: 3001                                          │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Spawns process
                 │
┌────────────────▼────────────────────────────────────┐
│  Gemini CLI Agent                                   │
│  • Receives user command                            │
│  • Generates todo list content                      │
│  • Writes to GeneratedContent.tsx                   │
└─────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm

### Installation & Running

1. **Clone and navigate to the repo:**

   ```bash
   cd open-imagine
   ```

2. **Run the startup script:**

   ```bash
   ./start.sh
   ```

   This will:
   - Install all dependencies for frontend and backend
   - Start the backend server on `http://localhost:3001`
   - Start the frontend on `http://localhost:5173`

3. **Open your browser:**
   Navigate to `http://localhost:5173`

4. **Start creating!**
   Type commands like:
   - "Create a todo list for planning a vacation"
   - "Write a blog post about AI"
   - "Build a shopping list app"

### Manual Start (Alternative)

If you prefer to run services separately:

```bash
# Terminal 1 - Backend
cd backend
npm install
npm start

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

## 🎮 How to Use

1. **Open the app** in your browser at `http://localhost:5173`
2. **See the desktop interface** with a Windows-like experience
3. **Type a command** in the input box at the bottom
4. **Watch the magic happen** as the Gemini agent rewrites the UI
5. **Content appears in draggable windows** that you can move around
6. **Close windows** with the × button
7. **Send more commands** to keep generating content

## 🔧 Configuration

### Using the Real Gemini Agent

By default, the system uses a **simulated agent** for quick testing. To use the real Gemini CLI:

```bash
cd backend
USE_REAL_AGENT=true npm start
```

### File Structure

```
generative-computer/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── CommandInput.tsx    # Protected input (never modified)
│   │   │   ├── Desktop.tsx         # Desktop container
│   │   │   ├── Window.tsx          # Draggable window component
│   │   │   └── GeneratedContent.tsx # Modified by agent ⚡
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── backend/                # Express server
│   ├── server.js           # Main server
│   ├── gemini-agent.js     # Gemini CLI integration
│   └── package.json
└── start.sh                # Startup script
```

## 🎯 Key Features

- **Desktop UI**: Retro Windows-like interface with draggable windows
- **Real-time Updates**: Vite's HMR instantly reflects agent changes
- **Protected Components**: The input shell never gets rewritten
- **Todo List Everything**: All requests converted to actionable todo lists
- **Proof of Concept**: A demonstration of generative UI possibilities

## 🛡️ Safety & Constraints

The Gemini agent is constrained to:

- ✅ Only modify `GeneratedContent.tsx`
- ✅ Keep the component structure intact
- ✅ Never touch protected components (CommandInput, Desktop, Window)
- ✅ Always output valid React/TypeScript code

## 🎭 Modes

### Simulated Mode (Default)

- Fast testing without invoking real Gemini CLI
- Creates placeholder todo lists
- Good for UI development

### Real Agent Mode

- Invokes actual Gemini CLI
- Generates sophisticated, contextual content
- Requires valid Gemini API access

## 🚧 Future Ideas

- [ ] Multiple agent personas
- [ ] Persistent state across sessions
- [ ] More UI templates beyond todo lists
- [ ] Agent can modify multiple component types
- [ ] Voice input integration
- [ ] Collaborative multi-user mode
- [ ] Agent learns user preferences

## 📝 Notes

This is a **proof of concept** designed to showcase the potential of AI-driven generative UIs. It's meant to be:

- Fun to demo
- Easy to understand
- Visually compelling
- Technically interesting

Perfect for sharing on Twitter or with other developers interested in the future of human-computer interaction!

## 🤝 Built On

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) - The AI coding agent
- React + TypeScript + Vite - Frontend framework
- Express.js - Backend server
- react-draggable - Window dragging functionality

---

**Created as an experiment in generative computing** 🚀
