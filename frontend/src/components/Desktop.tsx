/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';
import Window from './Window';
import './Desktop.css';

export interface WindowData {
  id: string;
  title: string;
  content: ReactNode;
  position?: { x: number; y: number };
}

interface DesktopProps {
  windows: WindowData[];
  onCloseWindow: (id: string) => void;
  onOpenMyComputer: () => void;
  onOpenRecycleBin: () => void;
}

export default function Desktop({
  windows,
  onCloseWindow,
  onOpenMyComputer,
  onOpenRecycleBin,
}: DesktopProps) {
  return (
    <div className="desktop">
      <div className="desktop-icons">
        <button
          type="button"
          className="desktop-icon"
          onClick={onOpenMyComputer}
        >
          <div className="icon-image">📁</div>
          <div className="icon-label">My Computer</div>
        </button>
        <button
          type="button"
          className="desktop-icon"
          onClick={onOpenRecycleBin}
        >
          <div className="icon-image">🗑️</div>
          <div className="icon-label">Recycle Bin</div>
        </button>
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
