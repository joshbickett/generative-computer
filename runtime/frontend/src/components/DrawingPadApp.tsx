/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useEffect, useState } from 'react';
import './DrawingPadApp.css';

export interface DrawingCommand {
  shape: 'line' | 'circle' | 'rectangle';
  color: string;
  positions: number[];
}

interface DrawingPadAppProps {
  initialCommands?: DrawingCommand[];
}

const COLORS = ['#00f6ff', '#ff00ff', '#5eff00', '#ffff00', '#ff8000'];

export default function DrawingPadApp({
  initialCommands = [],
}: DrawingPadAppProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  const getCanvasContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  };

  useEffect(() => {
    const ctx = getCanvasContext();
    if (!ctx) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
  }, [color]);

  useEffect(() => {
    const ctx = getCanvasContext();
    if (!ctx || !initialCommands.length) return;

    for (const command of initialCommands) {
      ctx.strokeStyle = command.color;
      ctx.shadowColor = command.color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 10;

      ctx.beginPath();
      if (command.shape === 'line' && command.positions.length >= 4) {
        const [x1, y1, ...rest] = command.positions;
        ctx.moveTo(x1, y1);
        for (let i = 0; i < rest.length; i += 2) {
          ctx.lineTo(rest[i], rest[i + 1]);
        }
      } else if (command.shape === 'circle' && command.positions.length >= 3) {
        const [x, y, radius] = command.positions;
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
      } else if (
        command.shape === 'rectangle' &&
        command.positions.length >= 4
      ) {
        const [x, y, width, height] = command.positions;
        ctx.rect(x, y, width, height);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = color;
    ctx.shadowColor = color;
  }, [initialCommands, color]);

  const getPointerPosition = (
    e: React.MouseEvent | React.TouchEvent,
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPointerPosition(e);
    if (!pos) return;

    setDrawing(true);
    setLastPos(pos);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;

    const ctx = getCanvasContext();
    const pos = getPointerPosition(e);
    if (!ctx || !pos || !lastPos) return;

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    setLastPos(pos);
  };

  const stopDrawing = () => {
    setDrawing(false);
    setLastPos(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="drawing-pad-app">
      <canvas
        ref={canvasRef}
        width="480"
        height="360"
        className="drawing-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="drawing-controls">
        <div className="color-palette">
          {COLORS.map((swatch) => (
            <div
              key={swatch}
              className={`color-swatch ${color === swatch ? 'active' : ''}`}
              style={
                {
                  '--swatch-color': swatch,
                  backgroundColor: swatch,
                } as React.CSSProperties
              }
              onClick={() => setColor(swatch)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setColor(swatch);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Set color to ${swatch}`}
            />
          ))}
        </div>
        <button type="button" className="clear-button" onClick={clearCanvas}>
          Clear
        </button>
      </div>
    </div>
  );
}
