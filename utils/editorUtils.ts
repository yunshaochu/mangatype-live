import { Bubble, MaskRegion, AIConfig } from '../types';
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

export const createBubble = (x: number, y: number, config: AIConfig, width = 15, height = 25): Bubble => ({
  id: crypto.randomUUID(),
  x,
  y,
  width,
  height,
  text: '',
  isVertical: config.defaultIsVertical ?? true,
  fontFamily: config.defaultFontFamily ?? 'noto',
  fontSize: config.defaultFontSize,
  color: config.defaultTextColor ?? '#000000',
  strokeColor: config.defaultStrokeColor ?? '#ffffff',
  backgroundColor: config.defaultBackgroundColor ?? '#ffffff',
  rotation: 0,
  maskFeather: config.defaultMaskFeather ?? 0,
  letterSpacing: config.defaultLetterSpacing ?? 0.15,
  lineHeight: config.defaultLineHeight ?? 1.1,
});

export const createMaskRegion = (x: number, y: number): MaskRegion => ({
    id: crypto.randomUUID(),
    x, y, width: 0, height: 0
});

/** Check if bubble center falls inside a mask region (both use % coordinate system, center-origin) */
export const isBubbleInsideMask = (
    bx: number, by: number,
    mx: number, my: number, mw: number, mh: number
): boolean => Math.abs(bx - mx) <= mw / 2 && Math.abs(by - my) <= mh / 2;