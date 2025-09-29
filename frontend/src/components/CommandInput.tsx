/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import './CommandInput.css';

interface CommandInputProps {
  onSubmit: (command: string) => Promise<void> | void;
  isLoading: boolean;
  statusMessage: string;
}

export default function CommandInput({
  onSubmit,
  isLoading,
  statusMessage,
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
          placeholder="Type a command... (e.g., 'Create a todo list')"
          className="command-input"
          autoFocus
          disabled={isLoading}
        />
        <button type="submit" className="command-submit" disabled={isLoading}>
          {isLoading ? 'Thinking...' : 'Send'}
        </button>
      </form>
      <div className="command-hint">{statusMessage}</div>
    </div>
  );
}
