/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Desktop from './components/Desktop';
import type { WindowData } from './components/Desktop';
import CommandInput from './components/CommandInput';
import GeminiStatsWindow from './components/GeminiStatsWindow';
import DrawingPadApp from './components/DrawingPadApp';
import MyComputer from './components/MyComputer';
import MarkdownEditor from './components/MarkdownEditor';
import type { WorkspaceFile } from './types/files';
import { requestJson } from './lib/api';
import './App.css';

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
  const [windows, setWindows] = useState<WindowData[]>([]);
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
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [initialWorkspaceOpened, setInitialWorkspaceOpened] = useState(false);

  const refreshWorkspaceFiles = useCallback(async () => {
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const data = await requestJson<{
        success: boolean;
        files: WorkspaceFile[];
        error?: string;
      }>('/api/files');

      if (data.success === false) {
        throw new Error(data.error || 'Unable to load workspace files');
      }

      setWorkspaceFiles(Array.isArray(data.files) ? data.files : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkspaceError(message);
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  const refreshWorkspaceFilesRef = useRef(refreshWorkspaceFiles);

  useEffect(() => {
    refreshWorkspaceFilesRef.current = refreshWorkspaceFiles;
  }, [refreshWorkspaceFiles]);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await requestJson<{
        authenticated?: boolean;
        agentMode?: AgentMode;
        authError?: string | null;
        debugEnabled?: boolean;
      }>('/api/status');

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

  const handleOpenFile = useCallback((file: WorkspaceFile) => {
    const windowId = `file:${file.path}`;
    const isMarkdown = file.kind === 'markdown';
    const windowContent = isMarkdown ? (
      <MarkdownEditor
        file={file}
        onRefreshFiles={() => refreshWorkspaceFilesRef.current?.()}
      />
    ) : (
      <div className="file-viewer__unsupported">
        <h3>Preview Unavailable</h3>
        <p>
          {file.name} is a <strong>{file.kind}</strong> file. Ask the agent to
          render it in a dedicated window or convert it to markdown.
        </p>
      </div>
    );

    const newWindow: WindowData = {
      id: windowId,
      title: file.name,
      content: windowContent,
      position: { x: 320, y: 160 },
    };

    setWindows((prev) => {
      const withoutExisting = prev.filter((item) => item.id !== windowId);
      return [...withoutExisting, newWindow];
    });
  }, []);

  const handleOpenMyComputer = useCallback(() => {
    openStaticWindow({
      id: 'my-computer',
      title: 'My Computer',
      content: (
        <MyComputer
          files={workspaceFiles}
          isLoading={workspaceLoading}
          error={workspaceError}
          onOpenFile={handleOpenFile}
        />
      ),
      position: { x: 240, y: 150 },
    });
  }, [
    handleOpenFile,
    openStaticWindow,
    workspaceError,
    workspaceFiles,
    workspaceLoading,
  ]);

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

  const handleOpenUsageStats = useCallback(() => {
    openStaticWindow({
      id: 'gemini-usage',
      title: 'Gemini Usage',
      content: <GeminiStatsWindow />,
      position: { x: 180, y: 120 },
    });
  }, [openStaticWindow]);

  useEffect(() => {
    refreshWorkspaceFiles();
  }, [refreshWorkspaceFiles]);

  useEffect(() => {
    if (initialWorkspaceOpened) return;
    handleOpenMyComputer();
    setInitialWorkspaceOpened(true);
  }, [handleOpenMyComputer, initialWorkspaceOpened]);

  useEffect(() => {
    setWindows((prev) => {
      let changed = false;
      const updated = prev.map((window) => {
        if (window.id === 'my-computer') {
          changed = true;
          return {
            ...window,
            content: (
              <MyComputer
                files={workspaceFiles}
                isLoading={workspaceLoading}
                error={workspaceError}
                onOpenFile={handleOpenFile}
              />
            ),
          };
        }

        if (window.id.startsWith('file:')) {
          const filePath = window.id.slice('file:'.length);
          const file = workspaceFiles.find((item) => item.path === filePath);

          if (file) {
            changed = true;
            const isMarkdown = file.kind === 'markdown';
            return {
              ...window,
              title: file.name,
              content: isMarkdown ? (
                <MarkdownEditor
                  file={file}
                  onRefreshFiles={() => refreshWorkspaceFilesRef.current?.()}
                />
              ) : (
                <div className="file-viewer__unsupported">
                  <h3>Preview Unavailable</h3>
                  <p>
                    {file.name} is a <strong>{file.kind}</strong> file. Ask the
                    agent to render it in a dedicated window or convert it to
                    markdown.
                  </p>
                </div>
              ),
            };
          }

          if (window.title === filePath) {
            return window;
          }

          changed = true;
          return {
            ...window,
            title: filePath,
            content: (
              <div className="file-viewer__unsupported">
                <h3>File Not Found</h3>
                <p>
                  The file <strong>{filePath}</strong> no longer exists. Refresh
                  the file list or ask the agent to recreate it.
                </p>
              </div>
            ),
          };
        }

        return window;
      });

      return changed ? updated : prev;
    });
  }, [
    handleOpenFile,
    refreshWorkspaceFiles,
    workspaceError,
    workspaceFiles,
    workspaceLoading,
  ]);

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
        const data = await requestJson<{
          success?: boolean;
          message?: string;
          mode?: AgentMode;
          error?: string | null;
          debugLogPath?: string | null;
        }>('/api/command', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command }),
        });
        console.log('Response from backend:', data);

        if (data.success === false) {
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
        refreshWorkspaceFiles();
      }
    },
    [
      agentStatus.agentMode,
      createCommandWindow,
      refreshStatus,
      refreshWorkspaceFiles,
    ],
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
        onOpenUsageStats={handleOpenUsageStats}
      />

      <CommandInput
        onSubmit={handleCommand}
        isLoading={isProcessing}
        statusMessage={statusBarMessage.text}
        statusTone={statusBarMessage.tone}
        helperMessage={commandHint}
        agentMode={agentStatus.agentMode}
        isAuthenticated={agentStatus.authenticated}
        debugEnabled={agentStatus.debugEnabled}
        authError={agentStatus.authError}
      />
    </div>
  );
}

export default App;
