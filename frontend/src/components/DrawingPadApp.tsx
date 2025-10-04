/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import './DrawingPadApp.css';

const DEFAULT_COLOR = '#2d1b69';
const DEFAULT_BRUSH_SIZE = 6;

export default function DrawingPadApp() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const colorRef = useRef(DEFAULT_COLOR);
  const brushSizeRef = useRef(DEFAULT_BRUSH_SIZE);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const { offsetWidth, offsetHeight } = canvas;
      canvas.width = offsetWidth * dpr;
      canvas.height = offsetHeight * dpr;

      const context = canvas.getContext('2d');
      if (!context) return;

      context.scale(dpr, dpr);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = colorRef.current;
      context.lineWidth = brushSizeRef.current;
      contextRef.current = context;
    };

    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  useEffect(() => {
    colorRef.current = color;
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
    }
  }, [color]);

  useEffect(() => {
    brushSizeRef.current = brushSize;
    if (contextRef.current) {
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushSize]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = event.nativeEvent;
    const context = contextRef.current;
    if (!context) return;

    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const handlePointerUp = () => {
    if (!contextRef.current) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = event.nativeEvent;
    const context = contextRef.current;
    if (!context) return;

    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const handlePointerLeave = () => {
    if (isDrawing) {
      handlePointerUp();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="drawing-pad">
      <header className="drawing-pad__header">
        <h3>Neon Sketch</h3>
        <p>
          Paint freely, remix colors, and clear the slate whenever inspiration
          strikes.
        </p>
      </header>

      <div className="drawing-pad__toolbar">
        <label className="drawing-pad__tool">
          <span>Brush</span>
          <input
            type="range"
            min="1"
            max="40"
            value={brushSize}
            onChange={(event) => setBrushSize(Number(event.target.value))}
          />
          <span className="drawing-pad__value">{brushSize}px</span>
        </label>

        <label className="drawing-pad__tool">
          <span>Color</span>
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="drawing-pad__clear"
          onClick={clearCanvas}
        >
          Clear Canvas
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="drawing-pad__canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />
    </div>
  );
}
