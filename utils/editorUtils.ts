import { Bubble, MaskRegion } from '../types';
import type { CSSProperties } from 'react';

export const HANDLE_OFFSET = '-6px';

export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

export const handleStyle = (cursor: string): CSSProperties => ({
    position: 'absolute',
    width: '10px',
    height: '10px',
    backgroundColor: '#ffffff',
    border: '2px solid #3b82f6', // blue-500
    borderRadius: '50%',
    zIndex: 30,
    cursor: cursor,
    pointerEvents: 'auto',
    boxShadow: '0 0 4px rgba(0,0,0,0.4)',
});

export const createBubble = (x: number, y: number, defaultFontSize: number, width = 15, height = 25, isVertical = true): Bubble => ({
  id: crypto.randomUUID(),
  x,
  y,
  width,
  height,
  text: '', // Changed to empty string per user request
  isVertical,
  fontFamily: 'noto', // Changed from 'zhimang' to 'noto'
  fontSize: defaultFontSize,
  color: '#000000',
  strokeColor: '#ffffff',
  backgroundColor: '#ffffff',
  rotation: 0,
  maskFeather: 0,
});

export const createMaskRegion = (x: number, y: number): MaskRegion => ({
    id: crypto.randomUUID(),
    x, y, width: 0, height: 0
});