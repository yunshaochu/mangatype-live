export type FontScale = 'small' | 'normal' | 'large';

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
  strokeColor?: string; // Text stroke/outline color
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
  color?: string; // Added color support from AI
  strokeColor?: string; // Added stroke color support from AI
  fontScale?: FontScale; // Scale mode output from AI
  fontSize?: number; // Direct mode output from AI (beta)
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
  cssStack: string; // CSS font-family value for rendering
  googleFontName: string; // Google Fonts API name for preloading
};

export const FONTS: FontOption[] = [
  // 对话类
  { id: 'noto', name: 'Noto Sans 黑体', preview: '标准对话', cssStack: "'Noto Sans SC', sans-serif", googleFontName: 'Noto Sans SC' },
  { id: 'noto-bold', name: 'Noto Sans 粗黑', preview: '喊叫强调', cssStack: "'Noto Sans SC', sans-serif", googleFontName: 'Noto Sans SC' },
  { id: 'serif', name: 'Noto Serif 宋体', preview: '正式独白', cssStack: "'Noto Serif SC', serif", googleFontName: 'Noto Serif SC' },
  // 可爱类
  { id: 'happy', name: 'ZCOOL KuaiLe', preview: '快乐Q版', cssStack: "'ZCOOL KuaiLe', cursive", googleFontName: 'ZCOOL KuaiLe' },
  { id: 'xiaowei', name: 'ZCOOL XiaoWei', preview: '温柔圆润', cssStack: "'ZCOOL XiaoWei', cursive", googleFontName: 'ZCOOL XiaoWei' },
  // 手写类
  { id: 'longcang', name: 'Long Cang 龙藏', preview: '手写日记', cssStack: "'Long Cang', cursive", googleFontName: 'Long Cang' },
  { id: 'zhimang', name: 'Zhi Mang Xing', preview: '狂草手写', cssStack: "'Zhi Mang Xing', cursive", googleFontName: 'Zhi Mang Xing' },
  { id: 'liujian', name: 'Liu Jian Mao Cao', preview: '流浪毛草', cssStack: "'Liu Jian Mao Cao', cursive", googleFontName: 'Liu Jian Mao Cao' },
  // 古风类
  { id: 'mashan', name: 'Ma Shan Zheng', preview: '毛笔古风', cssStack: "'Ma Shan Zheng', cursive", googleFontName: 'Ma Shan Zheng' },
];

// Helper: Get CSS font stack from fontFamily ID
export const getFontStack = (fontFamily: FontFamily): string => {
  const font = FONTS.find(f => f.id === fontFamily);
  return font?.cssStack || "'Noto Sans SC', sans-serif";
};

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
  appendMasksToManualJson?: boolean; // Append mask coordinates to manual JSON prompt
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
  fontSelectionPrompt?: string; // Custom font selection prompt (Chinese)
  allowAiColorSelection?: boolean; // New: Toggle AI color selection
  colorSelectionPrompt?: string; // Custom color selection prompt (Chinese)
  allowAiFontSize?: boolean; // Toggle AI font size control
  fontSizeMode?: 'scale' | 'direct'; // 'scale' (default) or 'direct' (beta)
  fontScaleSmall?: number; // rem value for 'small' (default: 0.7)
  fontScaleNormal?: number; // rem value for 'normal' (default: 1.0)
  fontScaleLarge?: number; // rem value for 'large' (default: 1.5)
  fontSizePrompt?: string; // Custom prompt for direct mode
  customMessages?: CustomMessage[]; // Pre-request messages
  autoDetectBackground?: boolean; // New: Toggle for auto background color detection

  // Model Capabilities (Manual Override)
  modelSupportsFunctionCalling?: boolean; // If set, skip Function Calling tier
  modelSupportsJsonMode?: boolean; // If set, skip JSON Mode tier
  
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
