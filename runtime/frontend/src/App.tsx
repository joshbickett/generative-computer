/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Desktop from './components/Desktop';
import type { WindowData } from './components/Desktop';
import CommandInput from './components/CommandInput';
import GeminiStatsWindow from './components/GeminiStatsWindow';
import DrawingPadApp from './components/DrawingPadApp';
import MyComputer from './components/MyComputer';
import MarkdownEditor from './components/MarkdownEditor';
import TextEditor from './components/TextEditor';
import type { WorkspaceFile, WorkspaceFileDeleteResponse } from './types/files';
import MarkdownViewer from './components/MarkdownViewer';
import { agentWindows as initialAgentWindows } from './agent-manifest';
import type { AgentWindowDescriptor } from './types/windows';
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

type AgentManagedWindow = WindowData & {
  __agentSignature?: string;
  __agentComponent?: unknown;
};

function getAgentWindowSignature(config: AgentWindowDescriptor): string {
  return config.kind === 'markdown'
    ? `markdown:${config.file}`
    : `component:${config.id}`;
}

function renderAgentWindowContent(config: AgentWindowDescriptor) {
  return config.kind === 'component'
    ? createElement(config.component)
    : createElement(MarkdownViewer, {
        filePath: config.file,
        title: config.title,
      });
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
  const [agentWindowConfigs, setAgentWindowConfigs] =
    useState<AgentWindowDescriptor[]>(initialAgentWindows);
  const [dismissedAgentWindowIds, setDismissedAgentWindowIds] = useState<
    string[]
  >([]);
  const previousWorkspaceSetRef = useRef<Set<string>>(new Set());
  const pendingWorkspaceFileToOpenRef = useRef<string | null>(null);
  const workspaceRefreshIntentRef = useRef<'create' | null>(null);
  const [workspaceStatusMessage, setWorkspaceStatusMessage] = useState<
    string | null
  >(null);
  const [isCreatingWorkspaceFile, setIsCreatingWorkspaceFile] = useState(false);

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
      workspaceRefreshIntentRef.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkspaceError(message);
      setWorkspaceStatusMessage('Refresh failed');
      workspaceRefreshIntentRef.current = null;
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  const refreshWorkspaceFilesRef = useRef(refreshWorkspaceFiles);

  useEffect(() => {
    refreshWorkspaceFilesRef.current = refreshWorkspaceFiles;
  }, [refreshWorkspaceFiles]);

  useEffect(() => {
    if (!import.meta.hot) return;
    const acceptHandler = (mod: typeof import('./agent-manifest')) => {
      setAgentWindowConfigs(mod.agentWindows);
    };
    import.meta.hot.accept('./agent-manifest.ts', acceptHandler);
  }, []);

  useEffect(() => {
    setDismissedAgentWindowIds((prev) =>
      prev.filter((id) =>
        agentWindowConfigs.some((config) => `agent:${config.id}` === id),
      ),
    );
  }, [agentWindowConfigs]);

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
    if (id.startsWith('agent:')) {
      setDismissedAgentWindowIds((prev) =>
        prev.includes(id) ? prev : [...prev, id],
      );
    }
  }, []);

  const openStaticWindow = useCallback((window: WindowData) => {
    setWindows((prev) => {
      const withoutExisting = prev.filter((item) => item.id !== window.id);
      return [...withoutExisting, window];
    });
  }, []);

  const handleOpenFile = useCallback((file: WorkspaceFile) => {
    const windowId = `file:${file.path}`;
    const windowContent = (() => {
      if (file.kind === 'markdown') {
        return (
          <MarkdownEditor
            file={file}
            onRefreshFiles={() => refreshWorkspaceFilesRef.current?.()}
          />
        );
      }

      if (file.kind === 'text') {
        return (
          <TextEditor
            file={file}
            onRefreshFiles={() => refreshWorkspaceFilesRef.current?.()}
          />
        );
      }

      return (
        <div className="file-viewer__unsupported">
          <h3>Preview Unavailable</h3>
          <p>
            {file.name} is a <strong>{file.kind}</strong> file. Ask the agent to
            render it in a dedicated window or convert it to markdown.
          </p>
        </div>
      );
    })();

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

  const createWorkspaceFile = useCallback(
    async ({
      targetPath,
      template = '',
    }: {
      targetPath: string;
      template?: string;
    }) => {
      workspaceRefreshIntentRef.current = 'create';
      setIsCreatingWorkspaceFile(true);
      setWorkspaceStatusMessage(`Creating ${targetPath}…`);
      try {
        await requestJson('/api/files/content', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path: targetPath, content: template }),
        });
        pendingWorkspaceFileToOpenRef.current = targetPath;
        await refreshWorkspaceFiles();
        workspaceRefreshIntentRef.current = null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setWorkspaceError(message);
        setWorkspaceStatusMessage(`Failed to create ${targetPath}`);
        console.error(`Unable to create ${targetPath}:`, message);
        workspaceRefreshIntentRef.current = null;
      } finally {
        setIsCreatingWorkspaceFile(false);
      }
    },
    [refreshWorkspaceFiles],
  );

  const handleCreateFile = useCallback(
    ({ path, type }: { path: string; type: 'markdown' | 'text' | 'csv' }) => {
      if (isCreatingWorkspaceFile) {
        return;
      }

      const trimmedPath = path.trim();
      if (!trimmedPath) {
        setWorkspaceStatusMessage('File name cannot be empty');
        return;
      }

      if (trimmedPath.startsWith('/') || trimmedPath.includes('..')) {
        console.warn(
          'Workspace file creation aborted: path must stay inside runtime/my-computer',
        );
        setWorkspaceStatusMessage('Path must stay inside runtime/my-computer');
        return;
      }

      const ensureExtension = (candidate: string, extension: string) => {
        const normalizedExtension = extension.toLowerCase();
        if (candidate.toLowerCase().endsWith(normalizedExtension)) {
          return candidate;
        }
        if (/[.][a-z0-9]+$/i.test(candidate)) {
          return candidate.replace(/[.][a-z0-9]+$/i, extension);
        }
        return `${candidate}${extension}`;
      };

      let targetPath = trimmedPath;
      let template = '';

      if (type === 'markdown') {
        targetPath = ensureExtension(trimmedPath, '.md');
        template = '# New note\n\n';
      } else if (type === 'csv') {
        targetPath = ensureExtension(trimmedPath, '.csv');
        template = 'column_1,column_2\n';
      } else {
        if (!/[.][a-z0-9]+$/i.test(trimmedPath)) {
          targetPath = `${trimmedPath}.txt`;
        }
      }

      const existing = workspaceFiles.find((file) => file.path === targetPath);
      if (existing) {
        const shouldOverwrite = window.confirm(
          `${targetPath} already exists. Do you want to overwrite it?`,
        );
        if (!shouldOverwrite) {
          return;
        }
      }

      void createWorkspaceFile({ targetPath, template });
    },
    [createWorkspaceFile, isCreatingWorkspaceFile, workspaceFiles],
  );

  const handleDeleteFile = useCallback(
    async (file: WorkspaceFile) => {
      const confirmation = window.confirm(
        `Delete ${file.name}? This removes it from runtime/my-computer/ for everyone.`,
      );
      if (!confirmation) {
        return;
      }

      try {
        const response = await requestJson<WorkspaceFileDeleteResponse>(
          '/api/files',
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path: file.path }),
          },
        );

        if (response.success === false) {
          throw new Error(response.error || 'Failed to delete');
        }

        setWorkspaceStatusMessage(`Deleted ${file.name}`);
        await refreshWorkspaceFiles();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Unable to delete workspace file:', message);
        setWorkspaceStatusMessage(`Failed to delete ${file.name}`);
      }
    },
    [refreshWorkspaceFiles],
  );

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
          onCreateFile={handleCreateFile}
          onDeleteFile={handleDeleteFile}
          statusMessage={workspaceStatusMessage}
          disableActions={isCreatingWorkspaceFile}
          isCreatingFile={isCreatingWorkspaceFile}
        />
      ),
      position: { x: 240, y: 150 },
    });
  }, [
    handleOpenFile,
    handleCreateFile,
    handleDeleteFile,
    openStaticWindow,
    isCreatingWorkspaceFile,
    workspaceStatusMessage,
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
    const interval = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      if (!workspaceLoading) {
        refreshWorkspaceFilesRef.current?.();
      }
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [workspaceLoading]);

  useEffect(() => {
    const previous = previousWorkspaceSetRef.current;
    const current = new Set(workspaceFiles.map((file) => file.path));
    const pendingPath = pendingWorkspaceFileToOpenRef.current;

    if (previous.size === 0 && current.size > 0 && !pendingPath) {
      previousWorkspaceSetRef.current = current;
      return;
    }

    if (pendingPath) {
      const pendingFile = workspaceFiles.find(
        (file) => file.path === pendingPath,
      );
      if (pendingFile) {
        handleOpenFile(pendingFile);
        pendingWorkspaceFileToOpenRef.current = null;
        setWorkspaceStatusMessage(`Ready to edit ${pendingFile.name}`);
      }
    } else {
      const newlyAdded = workspaceFiles.filter(
        (file) => !previous.has(file.path),
      );
      if (newlyAdded.length > 0) {
        const previewNames = newlyAdded.slice(0, 2).map((file) => file.name);
        const suffix =
          newlyAdded.length > 2 ? ` +${newlyAdded.length - 2}` : '';
        const label =
          newlyAdded.length === 1
            ? previewNames[0]
            : `${previewNames.join(', ')}${suffix}`;
        setWorkspaceStatusMessage(`Added ${label}`);
      }
    }

    previousWorkspaceSetRef.current = current;
  }, [workspaceFiles, handleOpenFile]);

  useEffect(() => {
    if (initialWorkspaceOpened) return;
    handleOpenMyComputer();
    setInitialWorkspaceOpened(true);
  }, [handleOpenMyComputer, initialWorkspaceOpened]);

  useEffect(() => {
    setWindows((prev) => {
      const currentWindows = prev as AgentManagedWindow[];
      const agentIds = new Set(
        agentWindowConfigs.map((config) => `agent:${config.id}`),
      );
      const dismissed = new Set(dismissedAgentWindowIds);

      let changed = false;

      const trimmed = currentWindows.filter((window) => {
        if (!window.id.startsWith('agent:')) {
          return true;
        }

        if (!agentIds.has(window.id)) {
          changed = true;
          return false;
        }

        if (dismissed.has(window.id)) {
          changed = true;
          return false;
        }

        return true;
      });

      const updated = trimmed.map((window) => {
        if (!window.id.startsWith('agent:')) {
          return window;
        }

        const config = agentWindowConfigs.find(
          (item) => `agent:${item.id}` === window.id,
        );

        if (!config) {
          changed = true;
          return window;
        }

        const signature = getAgentWindowSignature(config);
        const componentRef =
          config.kind === 'component' ? config.component : undefined;

        const titleChanged = window.title !== config.title;
        const signatureChanged = window.__agentSignature !== signature;
        const componentChanged =
          config.kind === 'component' &&
          window.__agentComponent !== componentRef;

        if (!titleChanged && !signatureChanged && !componentChanged) {
          return window;
        }

        changed = true;

        return {
          ...window,
          title: config.title,
          content: renderAgentWindowContent(config),
          __agentSignature: signature,
          __agentComponent: componentRef,
        } as AgentManagedWindow;
      });

      const existingIds = new Set(updated.map((window) => window.id));
      const additions = agentWindowConfigs
        .filter((config) => !dismissed.has(`agent:${config.id}`))
        .filter((config) => !existingIds.has(`agent:${config.id}`))
        .map((config, index) => {
          changed = true;
          const id = `agent:${config.id}`;
          const position = config.position ?? {
            x: 260 + index * 40,
            y: 200 + index * 30,
          };

          return {
            id,
            title: config.title,
            content: renderAgentWindowContent(config),
            position,
            __agentSignature: getAgentWindowSignature(config),
            __agentComponent:
              config.kind === 'component' ? config.component : undefined,
          } as AgentManagedWindow;
        });

      if (!changed) {
        return prev;
      }

      return [...updated, ...additions] as WindowData[];
    });
  }, [agentWindowConfigs, dismissedAgentWindowIds]);

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
                onCreateFile={handleCreateFile}
                onDeleteFile={handleDeleteFile}
                statusMessage={workspaceStatusMessage}
                disableActions={isCreatingWorkspaceFile}
                isCreatingFile={isCreatingWorkspaceFile}
              />
            ),
          };
        }

        if (window.id.startsWith('file:')) {
          const filePath = window.id.slice('file:'.length);
          const file = workspaceFiles.find((item) => item.path === filePath);

          if (file) {
            changed = true;
            return {
              ...window,
              title: file.name,
              content:
                file.kind === 'markdown' ? (
                  <MarkdownEditor
                    file={file}
                    onRefreshFiles={() => refreshWorkspaceFilesRef.current?.()}
                  />
                ) : file.kind === 'text' ? (
                  <TextEditor
                    file={file}
                    onRefreshFiles={() => refreshWorkspaceFilesRef.current?.()}
                  />
                ) : (
                  <div className="file-viewer__unsupported">
                    <h3>Preview Unavailable</h3>
                    <p>
                      {file.name} is a <strong>{file.kind}</strong> file. Ask
                      the agent to render it in a dedicated window or convert it
                      to markdown.
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
    handleCreateFile,
    handleDeleteFile,
    refreshWorkspaceFiles,
    isCreatingWorkspaceFile,
    workspaceStatusMessage,
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
