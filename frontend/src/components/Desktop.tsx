/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Window from './Window';
import './Desktop.css';

export interface WindowData {
  id: string;
  title: string;
  content: React.ReactNode;
  position?: { x: number; y: number };
}

interface DesktopProps {
  windows: WindowData[];
  onCloseWindow: (id: string) => void;
}

export default function Desktop({ windows, onCloseWindow }: DesktopProps) {
  return (
    <div className="desktop">
      <div className="desktop-icons">
        <div className="desktop-icon">
          <div className="icon-image">📁</div>
          <div className="icon-label">My Computer</div>
        </div>
        <div className="desktop-icon">
          <div className="icon-image">🗑️</div>
          <div className="icon-label">Recycle Bin</div>
        </div>
        <div className="desktop-icon">
          <div className="icon-image">📄</div>
          <div className="icon-label">Documents</div>
        </div>
      </div>

      {windows.map((window, index) => (
        <Window
          key={window.id}
          id={window.id}
          title={window.title}
          onClose={() => onCloseWindow(window.id)}
          initialPosition={
            window.position || {
              x: 100 + index * 30,
              y: 100 + index * 30,
            }
          }
        >
          {window.content}
        </Window>
      ))}
    </div>
  );
}
