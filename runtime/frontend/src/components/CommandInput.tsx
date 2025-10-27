/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import './CommandInput.css';

type AgentBadgeMode =
  | 'REAL'
  | 'SIMULATED'
  | 'SIMULATED_FALLBACK'
  | 'PENDING'
  | 'ERROR'
  | 'UNKNOWN';

interface CommandInputProps {
  onSubmit: (command: string) => Promise<void> | void;
  isLoading: boolean;
  statusMessage: string;
  statusTone: 'pending' | 'success' | 'warning' | 'error' | 'info';
  helperMessage: string;
  agentMode: AgentBadgeMode;
  isAuthenticated: boolean;
  debugEnabled?: boolean;
  authError?: string | null;
}

export default function CommandInput({
  onSubmit,
  isLoading,
  statusMessage,
  statusTone,
  helperMessage,
  agentMode,
  isAuthenticated,
  debugEnabled,
  authError,
}: CommandInputProps) {
  const [command, setCommand] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      const value = command.trim();
      setCommand('');
      await Promise.resolve(onSubmit(value));
    }
  };

  return (
    <div className="command-input-container">
      <form onSubmit={handleSubmit} className="command-form">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Type a command... (e.g., 'Design a travel itinerary')"
          className="command-input"
          autoFocus
          disabled={isLoading}
        />
        <button
          type="submit"
          className={`command-submit${isLoading ? ' command-submit--loading' : ''}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="command-submit__loading">
              <span className="command-submit__spinner" aria-hidden="true" />
              <span className="command-submit__text">Shaping response...</span>
            </span>
          ) : (
            'Send'
          )}
        </button>
      </form>
      <div className="command-footer">
        <div
          className={`command-status-label command-status-label--${statusTone}`}
        >
          {statusTone === 'pending' && <div className="loading-indicator" />}
          <span>{statusMessage}</span>
          {authError && (
            <span className="command-status-label__error">{authError}</span>
          )}
        </div>
        <div className="command-status-chips">
          <span
            className={`command-status-chip ${
              agentMode === 'REAL'
                ? 'command-status-chip--ready'
                : agentMode === 'SIMULATED_FALLBACK'
                  ? 'command-status-chip--warn'
                  : agentMode === 'SIMULATED'
                    ? 'command-status-chip--info'
                    : agentMode === 'PENDING'
                      ? 'command-status-chip--pending'
                      : agentMode === 'ERROR'
                        ? 'command-status-chip--danger'
                        : 'command-status-chip--idle'
            }`}
            data-tooltip={
              agentMode === 'REAL'
                ? 'Real Gemini agent connected'
                : agentMode === 'SIMULATED'
                  ? 'Simulator mode — authenticate to unlock the real agent'
                  : agentMode === 'SIMULATED_FALLBACK'
                    ? 'Fallback simulator active — check logs for details'
                    : agentMode === 'PENDING'
                      ? 'Connecting to Gemini agent'
                      : agentMode === 'ERROR'
                        ? 'Agent unavailable'
                        : 'Agent status unknown yet'
            }
            aria-label={
              agentMode === 'REAL'
                ? 'Real Gemini agent connected'
                : agentMode === 'SIMULATED'
                  ? 'Simulator mode active'
                  : agentMode === 'SIMULATED_FALLBACK'
                    ? 'Fallback simulator active'
                    : agentMode === 'PENDING'
                      ? 'Connecting to Gemini agent'
                      : agentMode === 'ERROR'
                        ? 'Agent unavailable'
                        : 'Agent status unknown'
            }
            tabIndex={0}
          >
            {agentMode === 'REAL'
              ? '✓'
              : agentMode === 'SIMULATED_FALLBACK'
                ? '!'
                : agentMode === 'SIMULATED'
                  ? '≈'
                  : agentMode === 'PENDING'
                    ? '…'
                    : agentMode === 'ERROR'
                      ? '✗'
                      : '•'}
          </span>
          <span
            className={`command-status-chip ${
              isAuthenticated
                ? 'command-status-chip--ready'
                : 'command-status-chip--warn'
            }`}
            data-tooltip={
              isAuthenticated
                ? 'Gemini CLI authenticated'
                : 'Login required — run npm start and complete authentication'
            }
            aria-label={
              isAuthenticated
                ? 'Gemini CLI authenticated'
                : 'Gemini CLI authentication required'
            }
            tabIndex={0}
          >
            {isAuthenticated ? '✓' : '!'}
          </span>
          {debugEnabled && (
            <span
              className="command-status-chip command-status-chip--info"
              data-tooltip="Debug logs enabled"
              aria-label="Debug logs enabled"
              tabIndex={0}
            >
              ⓘ
            </span>
          )}
        </div>
      </div>
      <div className="command-hint">{helperMessage}</div>
    </div>
  );
}
