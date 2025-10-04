/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Desktop from './components/Desktop';
import type { WindowData } from './components/Desktop';
import CommandInput from './components/CommandInput';
import GeneratedContent from './components/GeneratedContent';
import DrawingPadApp from './components/DrawingPadApp';
import './App.css';

const API_BASE_URL = 'http://localhost:3001';

type AgentMode =
  | 'REAL'
  | 'SIMULATED'
  | 'SIMULATED_FALLBACK'
  | 'PENDING'
  | 'ERROR'
  | 'UNKNOWN';

interface AgentStatus {
  loading: boolean;
  authenticated: boolean;
  agentMode: AgentMode;
  authError: string | null;
  debugEnabled?: boolean;
}

interface AgentActivity {
  command: string;
  message: string;
  mode: AgentMode;
  error?: string | null;
  debugLogPath?: string | null;
  timestamp: number;
}

function truncate(text: string, max = 60) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function App() {
  const [windows, setWindows] = useState<WindowData[]>([
    {
      id: 'welcome',
      title: 'Generative Computer',
      content: <GeneratedContent />,
    },
  ]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    loading: true,
    authenticated: false,
    agentMode: 'UNKNOWN',
    authError: null,
    debugEnabled: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<AgentActivity | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/status`);
      if (!response.ok) {
        throw new Error(`Status request failed with code ${response.status}`);
      }
      const data = await response.json();

      setAgentStatus({
        loading: false,
        authenticated: Boolean(data.authenticated),
        agentMode: (data.agentMode as AgentMode) ?? 'UNKNOWN',
        authError: data.authError ?? null,
        debugEnabled: Boolean(data.debugEnabled),
      });
    } catch (error) {
      console.error('Unable to fetch agent status:', error);
      setAgentStatus((prev) => ({
        loading: false,
        authenticated: false,
        agentMode: prev.agentMode === 'REAL' ? 'REAL' : 'UNKNOWN',
        authError:
          'Backend status unavailable. Ensure the backend is running on port 3001.',
        debugEnabled: prev.debugEnabled,
      }));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const createCommandWindow = useCallback((request: string) => {
    const newWindow: WindowData = {
      id: `window-${Date.now()}`,
      title: `Request: ${truncate(request, 24)}`,
      content: (
        <div>
          <h3>Preview</h3>
          <p>Request: {request}</p>
          <p>Gemini will replace this window with a tailored experience.</p>
        </div>
      ),
    };

    setWindows((prev) => [...prev, newWindow]);
  }, []);

  const handleCloseWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((window) => window.id !== id));
  }, []);

  const openStaticWindow = useCallback((window: WindowData) => {
    setWindows((prev) => {
      const withoutExisting = prev.filter((item) => item.id !== window.id);
      return [...withoutExisting, window];
    });
  }, []);

  const handleOpenMyComputer = useCallback(() => {
    openStaticWindow({
      id: 'my-computer',
      title: 'My Computer',
      content: (
        <div>
          <h3>Coming Soon</h3>
          <p>
            We&apos;re wiring up system shortcuts and folders. Check back later
            for a fully interactive explorer!
          </p>
        </div>
      ),
      position: { x: 260, y: 160 },
    });
  }, [openStaticWindow]);

  const handleOpenRecycleBin = useCallback(() => {
    openStaticWindow({
      id: 'recycle-bin',
      title: 'Recycle Bin',
      content: (
        <div>
          <h3>Recycle Bin</h3>
          <p>Nothing in here yet. Clean as a whistle!</p>
        </div>
      ),
      position: { x: 320, y: 220 },
    });
  }, [openStaticWindow]);

  const handleOpenDemoVideo = useCallback(() => {
    openStaticWindow({
      id: 'demo-video',
      title: 'Project Demo Video',
      content: (
        <div className="video-window">
          <div className="video-window__embed">
            <iframe
              src="https://www.youtube.com/embed/FzCsDVfPQqk"
              title="Generative Computer demo video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
          <p className="video-window__caption">
            Follow the journey on{' '}
            <a
              href="https://x.com/intent/follow?screen_name=josh_bickett"
              target="_blank"
              rel="noopener noreferrer"
            >
              Twitter
            </a>
            .
          </p>
        </div>
      ),
      position: { x: 420, y: 240 },
    });
  }, [openStaticWindow]);

  const handleOpenDrawingPad = useCallback(() => {
    openStaticWindow({
      id: 'drawing-pad',
      title: 'Neon Sketch',
      content: <DrawingPadApp />,
      position: { x: 520, y: 160 },
    });
  }, [openStaticWindow]);

  const handleCommand = useCallback(
    async (command: string) => {
      console.log('Command received:', command);
      setIsProcessing(true);
      setPendingCommand(command);
      setLastActivity({
        command,
        message: 'Waiting for Gemini agent...',
        mode: 'PENDING',
        timestamp: Date.now(),
      });

      try {
        const response = await fetch(`${API_BASE_URL}/api/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command }),
        });

        const data = await response.json();
        console.log('Response from backend:', data);

        if (!response.ok || data.success === false) {
          throw new Error(data.error || 'Agent request failed');
        }

        const mode =
          (data.mode as AgentMode) ?? agentStatus.agentMode ?? 'UNKNOWN';

        setLastActivity({
          command,
          message: data.message || 'Command processed.',
          mode,
          error: data.error ?? null,
          debugLogPath: data.debugLogPath ?? null,
          timestamp: Date.now(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error sending command:', error);
        setLastActivity({
          command,
          message: 'Agent request failed',
          mode: 'ERROR',
          error: message,
          debugLogPath:
            error instanceof Error && 'debugLogPath' in error
              ? ((error as Error & { debugLogPath?: string }).debugLogPath ??
                null)
              : null,
          timestamp: Date.now(),
        });
        createCommandWindow(command);
      } finally {
        setIsProcessing(false);
        setPendingCommand(null);
        refreshStatus();
      }
    },
    [agentStatus.agentMode, createCommandWindow, refreshStatus],
  );

  const commandHint = useMemo(() => {
    if (agentStatus.loading) {
      return '💡 Checking Gemini agent status...';
    }

    if (!agentStatus.authenticated) {
      return '⚠️ Gemini CLI is not authenticated. Run `npm start`, complete login, then relaunch `./start.sh`.';
    }

    if (isProcessing && pendingCommand) {
      return `⏳ Gemini agent is working on: "${truncate(pendingCommand, 36)}"`;
    }

    if (agentStatus.agentMode === 'REAL') {
      return '💡 Ask for anything! The real Gemini agent can craft interactive layouts, ASCII panels, or other creative desktop widgets.';
    }

    if (agentStatus.agentMode === 'SIMULATED') {
      return 'ℹ️ Simulator mode is active. Authenticate Gemini CLI to enable the real agent.';
    }

    return '💡 This input sends your request to the Gemini agent.';
  }, [agentStatus, isProcessing, pendingCommand]);

  const statusBarMessage = useMemo(() => {
    if (isProcessing && pendingCommand) {
      return {
        text: `Processing "${truncate(pendingCommand, 42)}"`,
        tone: 'pending' as const,
      };
    }

    if (lastActivity) {
      if (lastActivity.error) {
        const tail = lastActivity.debugLogPath
          ? ` (log: ${lastActivity.debugLogPath})`
          : '';
        return {
          text: `Last error: ${lastActivity.error}${tail}`,
          tone: 'error' as const,
        };
      }

      if (lastActivity.debugLogPath) {
        return {
          text: `${lastActivity.message} (log: ${lastActivity.debugLogPath})`,
          tone:
            lastActivity.mode === 'REAL'
              ? 'success'
              : lastActivity.mode === 'SIMULATED_FALLBACK'
                ? 'warning'
                : 'info',
        };
      }

      return {
        text: lastActivity.message,
        tone:
          lastActivity.mode === 'REAL'
            ? 'success'
            : lastActivity.mode === 'SIMULATED_FALLBACK'
              ? 'warning'
              : 'info',
      };
    }

    return {
      text: 'Ready for your first command.',
      tone: 'info' as const,
    };
  }, [isProcessing, lastActivity, pendingCommand]);

  return (
    <div className="App">
      <Desktop
        windows={windows}
        onCloseWindow={handleCloseWindow}
        onOpenMyComputer={handleOpenMyComputer}
        onOpenRecycleBin={handleOpenRecycleBin}
        onOpenDemoVideo={handleOpenDemoVideo}
        onOpenDrawingPad={handleOpenDrawingPad}
      />

      <div className="status-bar">
        <span
          className={`status-pill ${agentStatus.agentMode === 'REAL' ? 'success' : 'warning'}`}
        >
          {agentStatus.agentMode === 'REAL'
            ? 'Real agent connected'
            : agentStatus.agentMode === 'SIMULATED'
              ? 'Simulator mode'
              : 'Agent status unknown'}
        </span>
        <span
          className={`status-pill ${agentStatus.authenticated ? 'success' : 'warning'}`}
        >
          {agentStatus.authenticated ? 'Authenticated' : 'Login required'}
        </span>
        {agentStatus.debugEnabled && (
          <span className="status-pill success">Debug logs enabled</span>
        )}
        <span className={`status-message ${statusBarMessage.tone}`}>
          {statusBarMessage.text}
        </span>
        {agentStatus.authError && (
          <span className="status-message warning">
            {agentStatus.authError}
          </span>
        )}
      </div>

      <CommandInput
        onSubmit={handleCommand}
        isLoading={isProcessing}
        statusMessage={commandHint}
      />
    </div>
  );
}

export default App;
