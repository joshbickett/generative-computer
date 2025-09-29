import { useState } from 'react';
import Desktop from './components/Desktop';
import type { WindowData } from './components/Desktop';
import CommandInput from './components/CommandInput';
import GeneratedContent from './components/GeneratedContent';
import './App.css';

function App() {
  const [windows, setWindows] = useState<WindowData[]>([
    {
      id: 'welcome',
      title: 'Welcome to Open Imagine',
      content: <GeneratedContent />
    }
  ]);

  const handleCommand = async (command: string) => {
    console.log('Command received:', command);

    // Send command to backend
    try {
      const response = await fetch('http://localhost:3001/api/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      const data = await response.json();
      console.log('Response from backend:', data);

      // The agent will modify the GeneratedContent.tsx file
      // which will trigger a hot reload

    } catch (error) {
      console.error('Error sending command:', error);
      // For now, create a placeholder window
      createTodoWindow(command);
    }
  };

  const createTodoWindow = (request: string) => {
    const newWindow: WindowData = {
      id: `window-${Date.now()}`,
      title: `Todo: ${request.substring(0, 30)}...`,
      content: (
        <div>
          <h3>Todo List</h3>
          <p>Request: {request}</p>
          <ul>
            <li>✅ Task 1</li>
            <li>⬜ Task 2</li>
            <li>⬜ Task 3</li>
          </ul>
        </div>
      )
    };
    setWindows([...windows, newWindow]);
  };

  const handleCloseWindow = (id: string) => {
    setWindows(windows.filter(w => w.id !== id));
  };

  return (
    <div className="App">
      <Desktop windows={windows} onCloseWindow={handleCloseWindow} />
      <CommandInput onSubmit={handleCommand} />
    </div>
  );
}

export default App;