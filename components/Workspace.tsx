
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BubbleLayer } from './BubbleLayer';
import { RegionLayer } from './RegionLayer';
import { HandleType } from '../types';
import { Maximize, Layers, Image as ImageIcon, Eraser, Trash2, Brush, MousePointerClick, Square } from 'lucide-react';
import { t } from '../services/i18n';
import { useProjectContext } from '../contexts/ProjectContext';
import { getFillOverlayMode } from '../utils/editorUtils';

type StrokeCommand = {
  tool: 'paint' | 'restore';
  color: string;
  size: number;
  compositeMode: GlobalCompositeOperation;
  pointsHigh: Array<{ x: number; y: number }>;
};

interface WorkspaceProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onCanvasMouseDown: (e: React.MouseEvent) => void;
  onMaskMouseDown: (e: React.MouseEvent, id: string) => void;
  onBubbleMouseDown: (e: React.MouseEvent, id: string) => void;
  onResizeStart: (e: React.MouseEvent, id: string, type: 'bubble' | 'mask', handle: HandleType) => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  containerRef, onCanvasMouseDown, onMaskMouseDown, onBubbleMouseDown, onResizeStart
}) => {
  const { 
    currentImage, drawTool, setDrawTool, selectedMaskId, selectedBubbleId, aiConfig, 
    setImages, currentId, setSelectedMaskId, setSelectedBubbleId,
    updateBubble, triggerAutoColorDetection,
    updateMaskRegion, // Added
    registerPaintFlushHandler,
    // Brush
    brushColor, brushSize, setBrushColor, handlePaintSave, paintMode, setPaintMode,
    brushType, // 'paint' | 'restore'
    // Layers
    activeLayer, setActiveLayer
  } = useProjectContext();
  
  // Paint Canvas Ref
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null); // Store original image for restoring
  const originalPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workingCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const phase2ScaleRef = useRef(1);
  const readbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const readbackCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const brushCursorRef = useRef<HTMLDivElement>(null);
  const brushCursorRafRef = useRef<number | null>(null);
  const brushCursorPendingRef = useRef<{ x: number; y: number; d: number } | null>(null);
  const paintSaveSeqRef = useRef(0);
  const [isPainting, setIsPainting] = useState(false);
  const [paintSaveError, setPaintSaveError] = useState<string | null>(null);
  const [legacyBrushCursorPos, setLegacyBrushCursorPos] = useState<{ x: number; y: number; d: number } | null>(null);
  const lastPos = useRef<{x: number, y: number} | null>(null);

  // --- Zoom / Pan State ---
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const spaceHeld = useRef(false);
  const [isPanMode, setIsPanMode] = useState(false);
  const isPanningRef = useRef(false);
  const panStart = useRef<{x: number, y: number, panX: number, panY: number} | null>(null);
  const panRef = useRef({ x: 0, y: 0 });

  // Keep panRef in sync
  panRef.current = { x: panX, y: panY };

  const lang = aiConfig.language;
  const phase1Enabled = aiConfig.freehandPerfPhase1Enabled !== false;
  const phase2Enabled = aiConfig.freehandPerfPhase2Enabled === true;
  const perfFlagsRef = useRef({ phase1Enabled, phase2Enabled });
  const bubbles = currentImage?.bubbles || [];
  const maskRegions = currentImage?.maskRegions || [];
  const contours = currentImage?.contours || [];
  const phase2LowResThresholdPixels = Math.max(1, aiConfig.freehandLowResThresholdMp ?? 4) * 1_000_000;
  const phase2PreviewTargetPixels = Math.max(250_000, aiConfig.freehandPreviewTargetPixels ?? 1_500_000);
  const phase2ReplayBatchSize = Math.max(8, aiConfig.freehandReplayBatchSize ?? 120);
  const strokeLogRef = useRef<StrokeCommand[]>([]);
  const activeStrokeRef = useRef<StrokeCommand | null>(null);
  const replayQueueRef = useRef<StrokeCommand[]>([]);
  const replayingRef = useRef(false);
  const replayPromiseRef = useRef<Promise<void> | null>(null);

  const contourPreviewLayers = useMemo(() => {
    const preparedContours = contours
      .map((contour) => {
        if (!contour.base64) return null;
        const contourX = contour.anchor?.x;
        const contourY = contour.anchor?.y;
        const contourW = contour.size?.w;
        const contourH = contour.size?.h;
        if (
          typeof contourX !== 'number' || typeof contourY !== 'number' ||
          typeof contourW !== 'number' || typeof contourH !== 'number' ||
          contourW <= 0 || contourH <= 0
        ) {
          return null;
        }
        const left = contourX - contourW / 2;
        const top = contourY - contourH / 2;
        return {
          id: contour.id,
          sourceMaskId: contour.sourceMaskId,
          base64: contour.base64,
          contourX,
          contourY,
          contourW,
          contourH,
          left,
          top,
          right: left + contourW,
          bottom: top + contourH,
        };
      })
      .filter((contour): contour is {
        id: string;
        sourceMaskId?: string;
        base64: string;
        contourX: number;
        contourY: number;
        contourW: number;
        contourH: number;
        left: number;
        top: number;
        right: number;
        bottom: number;
      } => contour !== null);
    if (preparedContours.length === 0 || maskRegions.length === 0) return [];

    const layers: Array<{
      key: string;
      contourX: number;
      contourY: number;
      contourW: number;
      contourH: number;
      clipValue: string;
      contourBase64: string;
    }> = [];

    for (const region of maskRegions) {
      const maskLeft = region.x - region.width / 2;
      const maskTop = region.y - region.height / 2;
      const maskRight = maskLeft + region.width;
      const maskBottom = maskTop + region.height;

      for (const contour of preparedContours) {
        if (contour.sourceMaskId && contour.sourceMaskId !== region.id) continue;
        const contourLeft = contour.left;
        const contourTop = contour.top;
        const contourRight = contour.right;
        const contourBottom = contour.bottom;
        const contourW = contour.contourW;
        const contourH = contour.contourH;
        const contourX = contour.contourX;
        const contourY = contour.contourY;

        const interLeft = Math.max(contourLeft, maskLeft);
        const interTop = Math.max(contourTop, maskTop);
        const interRight = Math.min(contourRight, maskRight);
        const interBottom = Math.min(contourBottom, maskBottom);
        if (interRight <= interLeft || interBottom <= interTop) continue;

        const insetLeft = Math.max(0, Math.min(100, ((interLeft - contourLeft) / contourW) * 100));
        const insetRight = Math.max(0, Math.min(100, ((contourRight - interRight) / contourW) * 100));
        const insetTop = Math.max(0, Math.min(100, ((interTop - contourTop) / contourH) * 100));
        const insetBottom = Math.max(0, Math.min(100, ((contourBottom - interBottom) / contourH) * 100));
        const clipValue = `inset(${insetTop}% ${insetRight}% ${insetBottom}% ${insetLeft}%)`;

        layers.push({
          key: `contour-preview-${region.id}-${contour.id}`,
          contourX,
          contourY,
          contourW,
          contourH,
          clipValue,
          contourBase64: contour.base64,
        });
      }
    }

    return layers;
  }, [maskRegions, contours]);

  // Determine display URL based strictly on Active Layer
  let displayUrl = currentImage ? (currentImage.originalUrl || currentImage.url) : '';
  let showBubbles = false;
  let showFilledMasks = false; // Flag to show instant filled masks overlay
  
  // Show Masks if:
  // 1. Tool is Mask
  // 2. Tool is Brush AND Box Mode
  let showMasks = drawTool === 'mask' || (drawTool === 'brush' && paintMode === 'box');
  
  // Determine if the "Clean" tab should be visible
  const showCleanTab = !!currentImage?.inpaintedUrl || aiConfig.enableInpainting || drawTool === 'brush' || activeLayer === 'clean';

  // Determine if we should show the Paint Canvas
  const showPaintCanvas = drawTool === 'brush' && paintMode === 'brush' && activeLayer === 'clean';

  if (currentImage) {
      if (activeLayer === 'original') {
          displayUrl = currentImage.originalUrl || currentImage.url;
          showBubbles = false;
          showFilledMasks = false; // Don't show fills on original layer
      } else if (activeLayer === 'clean') {
          // Clean layer shows inpainted image if available, otherwise falls back to original
          // PLUS the metadata fills
          displayUrl = currentImage.inpaintedUrl || currentImage.originalUrl || currentImage.url;
          showBubbles = false;
          showFilledMasks = true; 
      } else if (activeLayer === 'final') {
          displayUrl = currentImage.inpaintedUrl || currentImage.originalUrl || currentImage.url;
          showBubbles = true;
          showFilledMasks = true; 
      }
  }

  // Hide DOM filled masks if we are painting (because we draw them on the canvas instead)
  if (showPaintCanvas) {
      showFilledMasks = false;
  }

  useEffect(() => {
      const prev = perfFlagsRef.current;
      if (prev.phase1Enabled !== phase1Enabled || prev.phase2Enabled !== phase2Enabled) {
          console.info('[freehand-perf] flags:changed', {
              phase1Enabled,
              phase2Enabled,
              rollbackToLegacy: !phase1Enabled,
          });
      }
      perfFlagsRef.current = { phase1Enabled, phase2Enabled };
  }, [phase1Enabled, phase2Enabled]);

  // --- PAINTING LOGIC (Freehand Brush Only) ---
  
  // Initialize canvas with current image when entering brush mode
  useEffect(() => {
      if (showPaintCanvas && currentImage && paintCanvasRef.current) {
          const canvas = paintCanvasRef.current;
          const ctx = phase1Enabled
              ? canvas.getContext('2d')
              : canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;

          workingCanvasRef.current = null;
          workingCtxRef.current = null;
          originalPreviewCanvasRef.current = null;
          phase2ScaleRef.current = 1;
          strokeLogRef.current = [];
          activeStrokeRef.current = null;
          replayQueueRef.current = [];
          replayingRef.current = false;
          replayPromiseRef.current = null;

          // 1. Load the current "Clean" layer as the base for the canvas
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.src = displayUrl;
          img.onload = () => {
              const sourcePixels = img.width * img.height;
              const usePhase2LowRes = phase2Enabled && sourcePixels > phase2LowResThresholdPixels;
              const previewScale = usePhase2LowRes
                  ? Math.max(0.2, Math.min(1, Math.sqrt(phase2PreviewTargetPixels / sourcePixels)))
                  : 1;

              const previewWidth = Math.max(1, Math.round(img.width * previewScale));
              const previewHeight = Math.max(1, Math.round(img.height * previewScale));
              phase2ScaleRef.current = previewScale;

              canvas.width = previewWidth;
              canvas.height = previewHeight;
              ctx.drawImage(img, 0, 0, previewWidth, previewHeight);

              if (phase2Enabled) {
                  const workingCanvas = document.createElement('canvas');
                  workingCanvas.width = img.width;
                  workingCanvas.height = img.height;
                  const workingCtx = workingCanvas.getContext('2d');
                  if (workingCtx) {
                      workingCtx.drawImage(img, 0, 0);
                      workingCanvasRef.current = workingCanvas;
                      workingCtxRef.current = workingCtx;
                  }
              }

              // 2. COMPOSITE METADATA FILLS ONTO CANVAS
              // This allows the brush to see and paint over "Box Tool" fills.
              // Precise fills are already baked into the image pixels (inpaintedUrl),
              // so we only need to handle rect-mode metadata fills here.
              if (currentImage.maskRegions) {
                  currentImage.maskRegions.forEach(region => {
                      if (getFillOverlayMode(region) === 'rect') {
                          // Only rect-mode overlay fills are composited before brush save.
                          const x = (region.x / 100) * canvas.width;
                          const y = (region.y / 100) * canvas.height;
                          const w = (region.width / 100) * canvas.width;
                          const h = (region.height / 100) * canvas.height;
                          ctx.fillStyle = region.fillColor || '#ffffff';
                          ctx.fillRect(x - w / 2, y - h / 2, w, h);

                          if (workingCtxRef.current) {
                              const wx = (region.x / 100) * workingCtxRef.current.canvas.width;
                              const wy = (region.y / 100) * workingCtxRef.current.canvas.height;
                              const ww = (region.width / 100) * workingCtxRef.current.canvas.width;
                              const wh = (region.height / 100) * workingCtxRef.current.canvas.height;
                              workingCtxRef.current.fillStyle = region.fillColor || '#ffffff';
                              workingCtxRef.current.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
                          }
                      }
                  });
              }
          };

          // 2. Pre-load the ORIGINAL image for the "Restore" brush
          // This is what we will paint *from* when in Restore mode.
          if (currentImage.originalUrl || currentImage.url) {
              const orig = new Image();
              orig.crossOrigin = "Anonymous";
              orig.src = currentImage.originalUrl || currentImage.url;
              orig.onload = () => {
                  originalImageRef.current = orig;
                  if (phase2Enabled && phase2ScaleRef.current < 1) {
                      const previewOriginalCanvas = document.createElement('canvas');
                      previewOriginalCanvas.width = Math.max(1, Math.round(orig.width * phase2ScaleRef.current));
                      previewOriginalCanvas.height = Math.max(1, Math.round(orig.height * phase2ScaleRef.current));
                      const previewOriginalCtx = previewOriginalCanvas.getContext('2d');
                      if (previewOriginalCtx) {
                          previewOriginalCtx.drawImage(orig, 0, 0, previewOriginalCanvas.width, previewOriginalCanvas.height);
                          originalPreviewCanvasRef.current = previewOriginalCanvas;
                      }
                  }
              };
          }
      }
  }, [showPaintCanvas, currentImage?.id, displayUrl, phase1Enabled, phase2Enabled, phase2LowResThresholdPixels, phase2PreviewTargetPixels]); // Re-init when visibility or image/phase changes

  const getCanvasCoords = (e: React.MouseEvent) => {
      if (!paintCanvasRef.current) return { x: 0, y: 0 };
      const rect = paintCanvasRef.current.getBoundingClientRect();
      const scaleX = paintCanvasRef.current.width / rect.width;
      const scaleY = paintCanvasRef.current.height / rect.height;
      return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
      };
  };

  const getBrushStyle = (ctx: CanvasRenderingContext2D, target: 'preview' | 'working' = 'preview') => {
      if (brushType === 'restore' && originalImageRef.current) {
          if (target === 'preview' && phase2Enabled && originalPreviewCanvasRef.current) {
              return ctx.createPattern(originalPreviewCanvasRef.current, 'no-repeat');
          }
          // Create a pattern from the original image. 
          // Since the canvas size matches the image size 1:1, 'no-repeat' draws it aligned at 0,0.
          // This effectively "reveals" the original image under the brush stroke.
          return ctx.createPattern(originalImageRef.current, 'no-repeat');
      }
      return brushColor;
  };

  const toWorkingCoords = useCallback((point: { x: number; y: number }) => {
      const scale = phase2ScaleRef.current || 1;
      return {
          x: point.x / scale,
          y: point.y / scale,
      };
  }, []);

  const replayStrokeCommand = useCallback((command: StrokeCommand) => {
      return new Promise<void>((resolve, reject) => {
          const ctx = workingCtxRef.current;
          if (!ctx) {
              resolve();
              return;
          }
          try {
              const drawStyle =
                  command.tool === 'restore'
                      ? (originalImageRef.current ? ctx.createPattern(originalImageRef.current, 'no-repeat') : null)
                      : command.color;
              if (!drawStyle || command.pointsHigh.length === 0) {
                  resolve();
                  return;
              }
              ctx.globalCompositeOperation = command.compositeMode;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.strokeStyle = drawStyle;
              ctx.fillStyle = drawStyle;
              ctx.lineWidth = command.size;

              const first = command.pointsHigh[0];
              ctx.beginPath();
              ctx.arc(first.x, first.y, command.size / 2, 0, Math.PI * 2);
              ctx.fill();

              let index = 1;
              const step = () => {
                  if (!workingCtxRef.current) {
                      resolve();
                      return;
                  }
                  const end = Math.min(index + phase2ReplayBatchSize, command.pointsHigh.length);
                  if (index < end) {
                      ctx.beginPath();
                      for (; index < end; index += 1) {
                          const prev = command.pointsHigh[index - 1];
                          const next = command.pointsHigh[index];
                          ctx.moveTo(prev.x, prev.y);
                          ctx.lineTo(next.x, next.y);
                      }
                      ctx.stroke();
                  }
                  if (index < command.pointsHigh.length) {
                      setTimeout(step, 0);
                      return;
                  }
                  resolve();
              };
              step();
          } catch (error) {
              reject(error);
          }
      });
  }, [phase2ReplayBatchSize]);

  const processReplayQueue = useCallback(() => {
      if (!phase2Enabled) return Promise.resolve();
      if (replayingRef.current && replayPromiseRef.current) return replayPromiseRef.current;
      if (replayQueueRef.current.length === 0) return Promise.resolve();

      replayingRef.current = true;
      const startAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      console.info('[freehand-perf] replay:start', {
          queueLength: replayQueueRef.current.length,
      });

      const run = (async () => {
          while (replayQueueRef.current.length > 0) {
              const command = replayQueueRef.current.shift();
              if (!command) continue;
              await replayStrokeCommand(command);
          }
          const endAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
          console.info('[freehand-perf] replay:done', {
              durationMs: Math.round(endAt - startAt),
              strokeLogSize: strokeLogRef.current.length,
          });
      })()
          .catch((error) => {
              console.error('[freehand-perf] replay:failed', {
                  reason: error instanceof Error ? error.message : String(error),
              });
          })
          .finally(() => {
              replayingRef.current = false;
              replayPromiseRef.current = null;
          });

      replayPromiseRef.current = run;
      return run;
  }, [phase2Enabled, replayStrokeCommand]);

  const flushPendingCommandsLocal = useCallback(async () => {
      if (!phase2Enabled) return;
      await processReplayQueue();
      while (replayQueueRef.current.length > 0 || replayingRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          await processReplayQueue();
      }
  }, [phase2Enabled, processReplayQueue]);

  useEffect(() => {
      if (!currentImage?.id) return;
      const handler = phase2Enabled ? flushPendingCommandsLocal : null;
      registerPaintFlushHandler(currentImage.id, handler);
      return () => {
          registerPaintFlushHandler(currentImage.id, null);
      };
  }, [currentImage?.id, flushPendingCommandsLocal, phase2Enabled, registerPaintFlushHandler]);

  const hideBrushCursor = useCallback(() => {
      brushCursorPendingRef.current = null;
      if (brushCursorRafRef.current !== null) {
          cancelAnimationFrame(brushCursorRafRef.current);
          brushCursorRafRef.current = null;
      }
      const cursorEl = brushCursorRef.current;
      if (cursorEl) {
          cursorEl.style.display = 'none';
      }
  }, []);

  const queueBrushCursorUpdate = useCallback((nextPos: { x: number; y: number; d: number }) => {
      brushCursorPendingRef.current = nextPos;
      if (brushCursorRafRef.current !== null) return;
      brushCursorRafRef.current = requestAnimationFrame(() => {
          brushCursorRafRef.current = null;
          const cursorEl = brushCursorRef.current;
          const pending = brushCursorPendingRef.current;
          if (!cursorEl || !pending) return;
          cursorEl.style.display = 'block';
          cursorEl.style.width = `${pending.d}px`;
          cursorEl.style.height = `${pending.d}px`;
          cursorEl.style.transform = `translate(${pending.x}px, ${pending.y}px) translate(-50%, -50%)`;
      });
  }, []);

  const samplePaintPixel = useCallback((x: number, y: number, source: 'preview' | 'workingHigh' | 'sourceHigh' = 'preview') => {
      const previewCanvas = paintCanvasRef.current;
      if (!previewCanvas) return null;

      if (!readbackCanvasRef.current) {
          readbackCanvasRef.current = document.createElement('canvas');
          readbackCanvasRef.current.width = 1;
          readbackCanvasRef.current.height = 1;
      }
      if (!readbackCtxRef.current) {
          readbackCtxRef.current = readbackCanvasRef.current.getContext('2d', { willReadFrequently: true });
      }
      const readCtx = readbackCtxRef.current;
      if (!readCtx) return null;

      if (source === 'sourceHigh' && originalImageRef.current) {
          const samplePoint = toWorkingCoords({ x, y });
          const px = Math.max(0, Math.min(originalImageRef.current.width - 1, Math.floor(samplePoint.x)));
          const py = Math.max(0, Math.min(originalImageRef.current.height - 1, Math.floor(samplePoint.y)));
          readCtx.clearRect(0, 0, 1, 1);
          readCtx.drawImage(originalImageRef.current, px, py, 1, 1, 0, 0, 1, 1);
          return readCtx.getImageData(0, 0, 1, 1).data;
      }

      if (source === 'workingHigh' && workingCanvasRef.current) {
          const samplePoint = toWorkingCoords({ x, y });
          const px = Math.max(0, Math.min(workingCanvasRef.current.width - 1, Math.floor(samplePoint.x)));
          const py = Math.max(0, Math.min(workingCanvasRef.current.height - 1, Math.floor(samplePoint.y)));
          readCtx.clearRect(0, 0, 1, 1);
          readCtx.drawImage(workingCanvasRef.current, px, py, 1, 1, 0, 0, 1, 1);
          return readCtx.getImageData(0, 0, 1, 1).data;
      }

      const px = Math.max(0, Math.min(previewCanvas.width - 1, Math.floor(x)));
      const py = Math.max(0, Math.min(previewCanvas.height - 1, Math.floor(y)));
      readCtx.clearRect(0, 0, 1, 1);
      readCtx.drawImage(previewCanvas, px, py, 1, 1, 0, 0, 1, 1);
      return readCtx.getImageData(0, 0, 1, 1).data;
  }, [toWorkingCoords]);

  useEffect(() => {
      if (!showPaintCanvas) {
          hideBrushCursor();
          setLegacyBrushCursorPos(null);
      }
  }, [showPaintCanvas, hideBrushCursor]);

  useEffect(() => () => {
      hideBrushCursor();
      readbackCtxRef.current = null;
      readbackCanvasRef.current = null;
      workingCtxRef.current = null;
      workingCanvasRef.current = null;
      originalPreviewCanvasRef.current = null;
      phase2ScaleRef.current = 1;
      activeStrokeRef.current = null;
      replayQueueRef.current = [];
      replayingRef.current = false;
      replayPromiseRef.current = null;
  }, [hideBrushCursor]);

  const canvasToPngBlob = useCallback((canvas: HTMLCanvasElement) => {
      return new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
              if (!blob) {
                  reject(new Error('canvas.toBlob returned null'));
                  return;
              }
              resolve(blob);
          }, 'image/png');
      });
  }, []);

  const blobToDataUrl = useCallback((blob: Blob) => {
      return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              if (typeof reader.result !== 'string') {
                  reject(new Error('FileReader returned non-string result'));
                  return;
              }
              resolve(reader.result);
          };
          reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
          reader.readAsDataURL(blob);
      });
  }, []);

  const startPaintSave = useCallback((imageId: string, canvas: HTMLCanvasElement) => {
      const saveSeq = ++paintSaveSeqRef.current;
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      console.info('[freehand-perf] flush:start', { imageId, saveSeq, phase1Enabled });
      setPaintSaveError(null);
      setImages(prev => prev.map(img => img.id === imageId ? { ...img, inpaintingStatus: 'processing' } : img));
      void (async () => {
          try {
              if (phase2Enabled) {
                  await flushPendingCommandsLocal();
              }
              const blob = await canvasToPngBlob(canvas);
              const newBase64 = await blobToDataUrl(blob);
              if (saveSeq !== paintSaveSeqRef.current) return;
              handlePaintSave(imageId, newBase64);
              setPaintSaveError(null);
              const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
              console.info('[freehand-perf] flush:done', {
                  imageId,
                  saveSeq,
                  durationMs: Math.round(finishedAt - startedAt),
              });
          } catch (err) {
              if (saveSeq !== paintSaveSeqRef.current) return;
              const failedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
              console.error('[freehand-perf] flush:failed', {
                  imageId,
                  saveSeq,
                  durationMs: Math.round(failedAt - startedAt),
                  reason: err instanceof Error ? err.message : String(err),
              });
              setImages(prev => prev.map(img => img.id === imageId ? { ...img, inpaintingStatus: 'error' } : img));
              setPaintSaveError('Paint save failed. Please retry.');
          }
      })();
  }, [blobToDataUrl, canvasToPngBlob, flushPendingCommandsLocal, handlePaintSave, phase1Enabled, phase2Enabled, setImages]);

  const handlePaintStart = (e: React.MouseEvent) => {
      if (!showPaintCanvas) return;
      
      const { x, y } = getCanvasCoords(e);
      const ctx = paintCanvasRef.current?.getContext('2d');
      if (!ctx) return;

      // If Alt key is pressed, use Eyedropper behavior
      if (e.altKey && brushType === 'paint') {
          const sampleSource = phase2Enabled
              ? (e.shiftKey ? 'sourceHigh' : 'workingHigh')
              : 'preview';
          const pixel = phase1Enabled
              ? samplePaintPixel(x, y, sampleSource)
              : ctx.getImageData(x, y, 1, 1).data;
          if (!pixel) return;
          const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
          setBrushColor(hex);
          return;
      }

      // BRUSH TOOL
      setIsPainting(true);
      lastPos.current = { x, y };
      if (phase2Enabled) {
          activeStrokeRef.current = {
              tool: brushType,
              color: brushColor,
              size: brushSize / (phase2ScaleRef.current || 1),
              compositeMode: 'source-over',
              pointsHigh: [toWorkingCoords({ x, y })],
          };
      } else {
          activeStrokeRef.current = null;
      }
      
      const style = getBrushStyle(ctx, 'preview');
      if (!style) return;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = style;
      ctx.fillStyle = style;
      ctx.lineWidth = brushSize;
      
      // Draw a single dot in case it's a click
      ctx.beginPath();
      ctx.arc(x, y, brushSize/2, 0, Math.PI * 2);
      ctx.fill();
  };

  const handlePaintMove = (e: React.MouseEvent) => {
      // Always update brush cursor
      if (paintCanvasRef.current) {
          const rect = paintCanvasRef.current.getBoundingClientRect();
          const scale = rect.width > 0 ? paintCanvasRef.current.width / rect.width : 1;
          const nextCursor = { x: e.clientX, y: e.clientY, d: Math.max(4, brushSize / scale) };
          if (phase1Enabled) {
              queueBrushCursorUpdate(nextCursor);
          } else {
              setLegacyBrushCursorPos(nextCursor);
          }
      }
      // Only paint if in brush mode
      if (!isPainting || !showPaintCanvas || !paintCanvasRef.current || paintMode !== 'brush') return;
      
      const ctx = paintCanvasRef.current.getContext('2d');
      if (!ctx || !lastPos.current) return;

      const newPos = getCanvasCoords(e);
      
      const style = getBrushStyle(ctx, 'preview');
      if (!style) return;

      ctx.strokeStyle = style;
      ctx.lineWidth = brushSize;

      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(newPos.x, newPos.y);
      ctx.stroke();
      if (phase2Enabled && activeStrokeRef.current) {
          activeStrokeRef.current.pointsHigh.push(toWorkingCoords(newPos));
      }
      
      lastPos.current = newPos;
  };

  const handlePaintEnd = () => {
      if (isPainting && currentImage && paintCanvasRef.current) {
          setIsPainting(false);
          lastPos.current = null;
          if (phase2Enabled && activeStrokeRef.current) {
              const command = activeStrokeRef.current;
              activeStrokeRef.current = null;
              strokeLogRef.current.push(command);
              replayQueueRef.current.push(command);
              void processReplayQueue();
          }
          const saveCanvas = phase2Enabled && workingCanvasRef.current ? workingCanvasRef.current : paintCanvasRef.current;
          if (phase1Enabled) {
              // Save asynchronously to avoid blocking the main thread on pen-up.
              startPaintSave(currentImage.id, saveCanvas);
          } else {
              console.info('[freehand-perf] flush:legacy-sync', { imageId: currentImage.id });
              const newBase64 = saveCanvas.toDataURL('image/png');
              handlePaintSave(currentImage.id, newBase64);
              setPaintSaveError(null);
          }
      }
  };

  // --- End Painting Logic ---

  // --- Zoom / Pan Logic ---

  // Reset zoom/pan when switching images
  useEffect(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, [currentId]);

  // Wheel zoom (anchor to mouse position)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Space + Wheel = canvas zoom
      if (!spaceHeld.current) return;

      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      e.preventDefault();
      e.stopPropagation();
      const rect = wrapper.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setZoom(prevZoom => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newZoom = Math.min(5, Math.max(0.25, prevZoom * factor));

        // Adjust pan so the point under the mouse stays fixed
        const { x: curPanX, y: curPanY } = panRef.current;
        const imgX = (mouseX - curPanX) / prevZoom;
        const imgY = (mouseY - curPanY) / prevZoom;
        setPanX(mouseX - imgX * newZoom);
        setPanY(mouseY - imgY * newZoom);

        return newZoom;
      });
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Space key for panning mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if (!e.repeat) {
          spaceHeld.current = true;
          setIsPanMode(true);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
        setIsPanMode(false);
        isPanningRef.current = false;
        panStart.current = null;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Pan mouse handlers
  const handlePanMouseDown = useCallback((e: MouseEvent) => {
    if (!spaceHeld.current) return;
    if (!wrapperRef.current?.contains(e.target as Node)) return;
    e.preventDefault();
    e.stopPropagation();
    isPanningRef.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
  }, []);

  const handlePanMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanningRef.current || !panStart.current) return;
    setPanX(panStart.current.panX + (e.clientX - panStart.current.x));
    setPanY(panStart.current.panY + (e.clientY - panStart.current.y));
  }, []);

  const handlePanMouseUp = useCallback(() => {
    isPanningRef.current = false;
    panStart.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousedown', handlePanMouseDown, true);
    window.addEventListener('mousemove', handlePanMouseMove);
    window.addEventListener('mouseup', handlePanMouseUp);
    return () => {
      window.removeEventListener('mousedown', handlePanMouseDown, true);
      window.removeEventListener('mousemove', handlePanMouseMove);
      window.removeEventListener('mouseup', handlePanMouseUp);
    };
  }, [handlePanMouseDown, handlePanMouseMove, handlePanMouseUp]);

  const resetZoom = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Only reset if clicking the wrapper background, not a child element
    if (e.target === wrapperRef.current) {
      resetZoom();
    }
  };

  // --- End Zoom / Pan Logic ---

  if (!currentImage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 select-none">
        <Maximize size={64} className="mx-auto mb-4" />
        <h2 className="text-2xl font-bold">{t('noImageSelected', lang)}</h2>
        <p className="mt-2 text-sm">{t('dragDrop', lang)}</p>
      </div>
    );
  }

  // Wrappers to handle deletion from within workspace
  const onDeleteMask = (id: string) => {
    if (!currentId) return;
    setImages(prev => prev.map(img => img.id === currentId ? { ...img, maskRegions: (img.maskRegions || []).filter(m => m.id !== id) } : img));
    setSelectedMaskId(null);
  };

  const onDeleteBubble = (id: string) => {
    if (!currentId) return;
    setImages(prev => prev.map(img => img.id === currentId ? { ...img, bubbles: img.bubbles.filter(b => b.id !== id) } : img));
    setSelectedBubbleId(null);
  };

  const handleDeleteInpaintLayer = () => {
      if (!currentId) return;
      if (confirm(lang === 'zh' ? '确定删除当前图片的擦除层吗？所有气泡背景将重置为白色。' : 'Delete inpaint layer? All bubble backgrounds will reset to white.')) {
          setImages(prev => prev.map(img => {
              if (img.id !== currentId) return img;
              return {
                  ...img,
                  inpaintedUrl: undefined,
                  inpaintedBase64: undefined,
                  inpaintingStatus: 'idle',
                  // Revert bubbles to white if they were transparent
                  bubbles: img.bubbles.map(b => b.backgroundColor === 'transparent' ? { ...b, backgroundColor: '#ffffff' } : b),
                  // Reset all masks cleaned status
                  maskRegions: (img.maskRegions || []).map(m => ({ ...m, isCleaned: false }))
              };
          }));
      }
  };

  const handleSwitchLayer = (layer: 'original' | 'clean' | 'final') => {
      if (layer === 'clean') {
          // If switching TO clean layer from another layer, auto-select Paint -> Box tool
          if (activeLayer !== 'clean') {
              setDrawTool('brush');
              setPaintMode('box');
          } else {
              if (drawTool === 'bubble') setDrawTool('none');
          }
      } else {
          // If switching AWAY from clean layer (to original or final), and we were painting, reset tool
          if (drawTool === 'brush') {
              setDrawTool('none');
          }
      }
      setActiveLayer(layer);
  };

  return (
    <div
      ref={wrapperRef}
      className={`flex-1 overflow-hidden flex items-center justify-center p-8 relative bg-[#1a1a1a] ${isPanMode ? 'cursor-grab' : ''}`}
      onDoubleClick={handleDoubleClick}
    >
      
      {/* Layer Tabs */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
          <div className="flex bg-gray-900/90 backdrop-blur border border-gray-700 p-1 rounded-lg shadow-xl">
                <button
                    onClick={() => handleSwitchLayer('original')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeLayer === 'original' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                >
                    <ImageIcon size={14} /> {t('layerOriginal', lang)}
                </button>
                
                {showCleanTab && (
                    <button
                        onClick={() => handleSwitchLayer('clean')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeLayer === 'clean' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    >
                        <Eraser size={14} /> {t('layerClean', lang)}
                    </button>
                )}

                <button
                    onClick={() => handleSwitchLayer('final')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${activeLayer === 'final' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                >
                    <Layers size={14} /> {t('layerFinal', lang)}
                </button>
          </div>

          {currentImage.inpaintedUrl && drawTool !== 'brush' && (
              <button
                onClick={handleDeleteInpaintLayer}
                className="self-start flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] bg-red-900/30 border border-red-800/50 text-red-300 hover:bg-red-900/50 hover:text-red-100 transition-colors animate-fade-in"
                title={t('deleteInpaint', lang)}
              >
                  <Trash2 size={12} /> {t('deleteInpaint', lang)}
              </button>
          )}
      </div>

      <div className="relative shadow-2xl inline-block" ref={containerRef} style={{
        maxWidth: '100%',
        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
        transformOrigin: '0 0',
      }}>

        {/* Render Logic: Canvas (if Painting AND on Clean layer) OR Image */}
        {showPaintCanvas ? (
            <canvas
                ref={paintCanvasRef}
                className={`max-h-[90vh] max-w-full block select-none relative z-20 cursor-none`}
                onMouseDown={handlePaintStart}
                onMouseMove={handlePaintMove}
                onMouseUp={handlePaintEnd}
                onMouseLeave={() => {
                  handlePaintEnd();
                  if (phase1Enabled) {
                    hideBrushCursor();
                  } else {
                    setLegacyBrushCursorPos(null);
                  }
                }}
            />
        ) : (
            <img
            src={displayUrl}
            alt="Workspace"
            className="max-h-[90vh] max-w-full block select-none pointer-events-none transition-opacity duration-300"
            />
        )}

        {/* 
            Overlay Container 
        */}
        <div className="absolute inset-0 pointer-events-none" style={{ containerType: 'inline-size' } as React.CSSProperties}>
          
          {/* Filled Masks (Instant Render) - z-1: Above image, below everything else */}
          {/* We ONLY render these if we are NOT painting. If painting, they are drawn on canvas. */}
          {showFilledMasks && maskRegions.map(region => {
              const overlayMode = getFillOverlayMode(region);
              return (
                overlayMode !== 'hidden' && (
                  overlayMode === 'contour' && region.maskContourW !== undefined && region.maskContourH !== undefined ? (
                      region.maskContourRects && region.maskContourRects.length > 0 ? (
                          // useCharRects=true: per-character bounding rects
                          <React.Fragment key={`filled-${region.id}`}>
                              {region.maskContourRects.map((r, i) => {
                                  const maskLeft = region.x - region.maskContourW! / 2;
                                  const maskTop  = region.y - region.maskContourH! / 2;
                                  return (
                                      <div
                                          key={i}
                                          className="absolute z-[1] pointer-events-none"
                                          style={{
                                              left:   `${maskLeft + r.x * region.maskContourW!}%`,
                                              top:    `${maskTop  + r.y * region.maskContourH!}%`,
                                              width:  `${r.w * region.maskContourW!}%`,
                                              height: `${r.h * region.maskContourH!}%`,
                                              backgroundColor: region.fillColor || '#ffffff',
                                          }}
                                      />
                                  );
                              })}
                          </React.Fragment>
                      ) : (
                          // useCharRects=false: dilated contour via CSS mask-image
                          (() => {
                              const contourSrc = region.maskContourDilatedBase64 || region.maskContourBase64;
                              return contourSrc ? (
                                  <div
                                      key={`filled-${region.id}`}
                                      className="absolute z-[1] pointer-events-none"
                                      style={{
                                          top: `${region.y}%`,
                                          left: `${region.x}%`,
                                          width: `${region.maskContourW}%`,
                                          height: `${region.maskContourH}%`,
                                          transform: 'translate(-50%, -50%)',
                                          WebkitMaskImage: `url(data:image/png;base64,${contourSrc})`,
                                          maskImage: `url(data:image/png;base64,${contourSrc})`,
                                          WebkitMaskSize: '100% 100%',
                                          maskSize: '100% 100%',
                                          WebkitMaskMode: 'luminance',
                                          maskMode: 'luminance',
                                          backgroundColor: region.fillColor || '#ffffff',
                                      } as React.CSSProperties}
                                  />
                              ) : (
                                  <div
                                      key={`filled-${region.id}`}
                                      className="absolute z-[1]"
                                      style={{
                                          top: `${region.y}%`,
                                          left: `${region.x}%`,
                                          width: `${region.width}%`,
                                          height: `${region.height}%`,
                                          transform: `translate(-50%, -50%)`,
                                          backgroundColor: region.fillColor || '#ffffff',
                                      }}
                                  />
                              );
                          })()
                      )
                  ) : (
                      <div
                          key={`filled-${region.id}`}
                          className="absolute z-[1]"
                          style={{
                              top: `${region.y}%`,
                              left: `${region.x}%`,
                              width: `${region.width}%`,
                              height: `${region.height}%`,
                              transform: `translate(-50%, -50%)`,
                              backgroundColor: region.fillColor || '#ffffff',
                          }}
                      />
                  )
                )
              );
          })}

                    {/* Contour Preview Overlay - independent anchor + clip to current red box */}
          {/* Not gated by showFilledMasks: contour preview is informational and visible on non-original layers */}
          {activeLayer !== 'original' && aiConfig.usePreciseFill && aiConfig.showContourPreview && contourPreviewLayers.map(layer => (
              <div
                  key={layer.key}
                  className="absolute z-[2] pointer-events-none"
                  style={{
                      top: `${layer.contourY}%`,
                      left: `${layer.contourX}%`,
                      width: `${layer.contourW}%`,
                      height: `${layer.contourH}%`,
                      transform: 'translate(-50%, -50%)',
                      clipPath: layer.clipValue,
                      WebkitClipPath: layer.clipValue,
                      WebkitMaskImage: `url(data:image/png;base64,${layer.contourBase64})`,
                      maskImage: `url(data:image/png;base64,${layer.contourBase64})`,
                      WebkitMaskSize: '100% 100%',
                      maskSize: '100% 100%',
                      WebkitMaskMode: 'luminance',
                      maskMode: 'luminance',
                      backgroundColor: '#FF6600',
                      opacity: 0.65,
                  } as React.CSSProperties}
              />
          ))}

          {/* Main Interaction Layer */}
          {!showPaintCanvas && (
              <div
                className={`absolute inset-0 z-0 pointer-events-auto ${isPanMode ? 'cursor-grab' : drawTool !== 'none' ? 'cursor-crosshair' : 'cursor-default'}`}
                onMouseDown={(e) => { if (!spaceHeld.current) onCanvasMouseDown(e); }}
              />
          )}

          {/* Interactive Selection Masks - z-30 */}
          {showMasks && maskRegions.map(region => (
            <RegionLayer
              key={region.id}
              region={region}
              isSelected={selectedMaskId === region.id}
              isInteractive={!showPaintCanvas}
              onMouseDown={(e) => onMaskMouseDown(e, region.id)}
              onResizeStart={(e, handle) => onResizeStart(e, region.id, 'mask', handle)}
              onDelete={() => onDeleteMask(region.id)}
              onUpdate={(updates) => updateMaskRegion(region.id, updates)}
            />
          ))}

          {/* Text Bubbles - z-10 (Usually above fill, but logic handles it) */}
          {showBubbles && bubbles.map(bubble => (
            <BubbleLayer
              key={bubble.id}
              bubble={bubble}
              config={aiConfig}
              isSelected={selectedBubbleId === bubble.id}
              isInteractive={!showPaintCanvas}
              onMouseDown={(e) => onBubbleMouseDown(e, bubble.id)}
              onResizeStart={(e, handle) => onResizeStart(e, bubble.id, 'bubble', handle)}
              onUpdate={updateBubble}
              onDelete={() => onDeleteBubble(bubble.id)}
              onTriggerAutoColor={triggerAutoColorDetection}
            />
          ))}
        </div>
      </div>

      {/* Brush cursor ring */}
      {showPaintCanvas && phase1Enabled && (
        <div ref={brushCursorRef} style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          display: 'none',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.7)',
          pointerEvents: 'none',
          zIndex: 9999,
          willChange: 'transform,width,height',
        }} />
      )}

      {showPaintCanvas && !phase1Enabled && legacyBrushCursorPos && (
        <div style={{
          position: 'fixed',
          left: legacyBrushCursorPos.x,
          top: legacyBrushCursorPos.y,
          width: legacyBrushCursorPos.d,
          height: legacyBrushCursorPos.d,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.7)',
          pointerEvents: 'none',
          zIndex: 9999,
        }} />
      )}

      {paintSaveError && (
        <div className="absolute top-4 right-4 z-50 rounded-md border border-red-700/60 bg-red-950/85 px-3 py-1.5 text-xs font-semibold text-red-200">
          {paintSaveError}
        </div>
      )}

      {/* Zoom Indicator */}
      {zoom !== 1 && (
        <button
          onClick={resetZoom}
          className="absolute bottom-4 right-4 z-50 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-gray-900/80 backdrop-blur border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
          title={t('zoomReset', lang)}
        >
          {Math.round(zoom * 100)}%
        </button>
      )}
    </div>
  );
};

