
export type FontFamily = 
  | 'noto'      // 黑体 - 标准对话
  | 'noto-bold' // 粗黑体 - 喊叫/强调
  | 'serif'     // 宋体 - 正式/内心独白
  | 'happy'     // 可爱体 - Q版/喜剧
  | 'xiaowei'   // 小薇体 - 温柔/圆润
  | 'mashan'    // 毛笔 - 古风/武侠
  | 'zhimang'   // 狂草 - 手写/狂野
  | 'longcang'  // 龙藏体 - 手写日记
  | 'liujian';  // 流浪毛草 - 草书艺术

export interface Bubble {
  id: string;
  x: number; // Center X percentage 0-100
  y: number; // Center Y percentage 0-100
  width: number; // Width percentage relative to image width
  height: number; // Height percentage relative to image height
  text: string;
  isVertical: boolean;
  fontFamily: FontFamily;
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
  isCleaned?: boolean; // True if this region has been Inpainted or Filled
  method?: 'fill' | 'inpaint'; // New: Tag to determine batch processing method. Default is 'fill'.
  fillColor?: string; // New: Store color for instant rendering
}

export interface DetectedBubble {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isVertical: boolean;
  rotation?: number; // Added rotation support from AI
  fontFamily?: FontFamily; // Added font support from AI
}

export interface ImageState {
  id: string;
  name: string;
  // Primary display/export URL (usually the translated background)
  url: string; 
  base64: string; 
  
  // Storage for layers
  originalUrl: string;
  originalBase64: string;
  inpaintedUrl?: string;
  inpaintedBase64?: string;

  width: number;
  height: number;
  bubbles: Bubble[];
  maskRegions?: MaskRegion[]; // Store Mode 2 regions (Red Boxes)
  
  // New: Pixel-perfect mask from detection API (Base64 string)
  maskRefinedBase64?: string; 
  
  // Translation (AI) Status
  status: 'idle' | 'processing' | 'done' | 'error';
  errorMessage?: string; 
  
  // Local Detection Status (Separate)
  detectionStatus?: 'idle' | 'processing' | 'done' | 'error';

  // Inpainting Status (Separate)
  inpaintingStatus?: 'idle' | 'processing' | 'done' | 'error';
  
  skipped?: boolean; // If true, skip AI processing but include in export
}

export type FontOption = {
  id: Bubble['fontFamily'];
  name: string;
  preview: string;
};

export const FONTS: FontOption[] = [
  // 对话类
  { id: 'noto', name: 'Noto Sans 黑体', preview: '标准对话' },
  { id: 'noto-bold', name: 'Noto Sans 粗黑', preview: '喊叫强调' },
  { id: 'serif', name: 'Noto Serif 宋体', preview: '正式独白' },
  // 可爱类
  { id: 'happy', name: 'ZCOOL KuaiLe', preview: '快乐Q版' },
  { id: 'xiaowei', name: 'ZCOOL XiaoWei', preview: '温柔圆润' },
  // 手写类
  { id: 'longcang', name: 'Long Cang 龙藏', preview: '手写日记' },
  { id: 'zhimang', name: 'Zhi Mang Xing', preview: '狂草手写' },
  { id: 'liujian', name: 'Liu Jian Mao Cao', preview: '流浪毛草' },
  // 古风类
  { id: 'mashan', name: 'Ma Shan Zheng', preview: '毛笔古风' },
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
  
  // Detection & Masks Tab
  enableMaskedImageMode?: boolean; // New: Only send masked parts if regions exist
  useMasksAsHints?: boolean; // Send manual red boxes as hints to AI
  useTextDetectionApi?: boolean; // Toggle Local OCR
  textDetectionApiUrl?: string;
  detectionExpansionRatio?: number; // New: 0.0 - 0.5 (Expansion rate for detected boxes)
  enableDialogSnap?: boolean; // Snap AI bubbles to manual masks
  forceSnapSize?: boolean; // Force snapped bubbles to use mask size
  
  // Inpainting (Cleanup) Tab
  enableInpainting?: boolean;
  inpaintingUrl?: string;
  inpaintingModel?: string;
  // autoInpaintMasks Removed per user request

  language: 'zh' | 'en'; 
  allowAiRotation?: boolean; 
  allowAiFontSelection?: boolean; // New: Toggle AI font selection
  customMessages?: CustomMessage[]; // Pre-request messages
  autoDetectBackground?: boolean; // New: Toggle for auto background color detection
  
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

export type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type ViewLayer = 'original' | 'clean' | 'final';
