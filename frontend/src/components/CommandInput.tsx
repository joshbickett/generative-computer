import { useState } from 'react';
import './CommandInput.css';

interface CommandInputProps {
  onSubmit: (command: string) => void;
}

export default function CommandInput({ onSubmit }: CommandInputProps) {
  const [command, setCommand] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      onSubmit(command);
      setCommand('');
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
        />
        <button type="submit" className="command-submit">
          Send
        </button>
      </form>
      <div className="command-hint">
        💡 This input will send your request to the Gemini agent
      </div>
    </div>
  );
}