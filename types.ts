

export interface Bubble {
  id: string;
  x: number; // Center X percentage 0-100
  y: number; // Center Y percentage 0-100
  width: number; // Width percentage relative to image width
  height: number; // Height percentage relative to image height
  text: string;
  isVertical: boolean;
  fontFamily: 'noto' | 'zhimang' | 'mashan';
  fontSize: number; // rem
  color: string;
  backgroundColor: string; // For masking original text (e.g., #ffffff)
  rotation: number; // degrees
  isSelected?: boolean;
  autoDetectBackground?: boolean; // Override global setting
  // New Mask Visual Properties
  maskShape?: 'rectangle' | 'rounded' | 'ellipse';
  maskCornerRadius?: number; // 0-50 (percentage)
  maskFeather?: number; // 0-50 (intensity)
}

// Mode 2: Simple selection region without text/style properties
export interface MaskRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedBubble {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isVertical: boolean;
  rotation?: number; // Added rotation support from AI
}

export interface ImageState {
  id: string;
  name: string;
  url: string;
  base64: string; // Cache base64 for AI analysis
  width: number;
  height: number;
  bubbles: Bubble[];
  maskRegions?: MaskRegion[]; // Store Mode 2 regions
  status: 'idle' | 'processing' | 'done' | 'error';
  errorMessage?: string; // Reason for failure
  skipped?: boolean; // If true, skip AI processing but include in export
}

export type FontOption = {
  id: Bubble['fontFamily'];
  name: string;
  preview: string;
};

export const FONTS: FontOption[] = [
  { id: 'noto', name: 'Noto Sans (Standard)', preview: '黑体' },
  { id: 'zhimang', name: 'Zhi Mang Xing (Draft)', preview: '草书风格' },
  { id: 'mashan', name: 'Ma Shan Zheng (Brush)', preview: '毛笔楷体' },
];

export type AIProvider = 'gemini' | 'openai';

export interface CustomMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt?: string;
  defaultFontSize: number;
  // New features
  useTextDetectionApi?: boolean;
  textDetectionApiUrl?: string;
  language: 'zh' | 'en'; 
  allowAiRotation?: boolean; 
  customMessages?: CustomMessage[]; // Pre-request messages
  useMasksAsHints?: boolean; // Send manual red boxes as hints to AI
  autoDetectBackground?: boolean; // New: Toggle for auto background color detection
  enableDialogSnap?: boolean; // New: Snap AI bubbles to manual masks
  forceSnapSize?: boolean; // New: Force snapped bubbles to use mask size
  
  // Global Defaults for Mask Style
  defaultMaskShape: 'rectangle' | 'rounded' | 'ellipse';
  defaultMaskCornerRadius: number;
  defaultMaskFeather: number;
}

// Add EyeDropper API type definition
declare global {
  interface Window {
    EyeDropper: any;
  }
}
