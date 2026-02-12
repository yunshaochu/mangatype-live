
import React, { useState, useEffect, useRef } from 'react';
import { BubbleLayer } from './BubbleLayer';
import { RegionLayer } from './RegionLayer';
import { HandleType } from '../types';
import { Maximize, Layers, Image as ImageIcon, Eraser, Trash2, Brush, MousePointerClick, Square } from 'lucide-react';
import { t } from '../services/i18n';
import { useProjectContext } from '../contexts/ProjectContext';

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
    // Brush
    brushColor, brushSize, setBrushColor, handlePaintSave, paintMode, setPaintMode,
    // Layers
    activeLayer, setActiveLayer
  } = useProjectContext();
  
  // Paint Canvas Ref
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isPainting, setIsPainting] = useState(false);
  const lastPos = useRef<{x: number, y: number} | null>(null);

  const lang = aiConfig.language;
  const bubbles = currentImage?.bubbles || [];
  const maskRegions = currentImage?.maskRegions || [];

  // Determine display URL based strictly on Active Layer
  let displayUrl = currentImage ? (currentImage.originalUrl || currentImage.url) : '';
  let showBubbles = false;
  
  // Show Masks if:
  // 1. Tool is Mask
  // 2. Tool is Brush AND Box Mode
  let showMasks = drawTool === 'mask' || (drawTool === 'brush' && paintMode === 'box');
  
  // Determine if the "Clean" tab should be visible
  // Ensure it stays visible if it's currently selected (activeLayer === 'clean') to allow switching back.
  const showCleanTab = !!currentImage?.inpaintedUrl || aiConfig.enableInpainting || drawTool === 'brush' || activeLayer === 'clean';

  // Determine if we should show the Paint Canvas
  // ONLY if tool is brush AND we are looking at the 'clean' layer
  // NOTE: If in Box mode, we don't draw on canvas with mouse, we manipulate boxes. 
  // Actually, Freehand Brush needs canvas overlay. Box mode works with RegionLayers.
  // So only show paint canvas if paintMode == 'brush'
  const showPaintCanvas = drawTool === 'brush' && paintMode === 'brush' && activeLayer === 'clean';

  if (currentImage) {
      if (activeLayer === 'original') {
          displayUrl = currentImage.originalUrl || currentImage.url;
          showBubbles = false;
      } else if (activeLayer === 'clean') {
          // Clean layer shows inpainted image if available, otherwise falls back to original (so you can start painting on it)
          displayUrl = currentImage.inpaintedUrl || currentImage.originalUrl || currentImage.url;
          showBubbles = false;
          // When painting, we might want to see masks to know where text was
      } else if (activeLayer === 'final') {
          displayUrl = currentImage.inpaintedUrl || currentImage.originalUrl || currentImage.url;
          showBubbles = true;
      }
  }

  // --- PAINTING LOGIC (Freehand Brush Only) ---
  
  // Initialize canvas with current image when entering brush mode
  useEffect(() => {
      if (showPaintCanvas && currentImage && paintCanvasRef.current) {
          const canvas = paintCanvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;

          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.src = displayUrl;
          img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
          };
      }
  }, [showPaintCanvas, currentImage?.id, displayUrl]); // Re-init when visibility or image changes

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

  const handlePaintStart = (e: React.MouseEvent) => {
      if (!showPaintCanvas) return;
      
      const { x, y } = getCanvasCoords(e);
      const ctx = paintCanvasRef.current?.getContext('2d');
      if (!ctx) return;

      // If Alt key is pressed, use Eyedropper behavior
      if (e.altKey) {
          const pixel = ctx.getImageData(x, y, 1, 1).data;
          const hex = "#" + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
          setBrushColor(hex);
          return;
      }

      // BRUSH TOOL
      setIsPainting(true);
      lastPos.current = { x, y };
      
      // Draw a single dot in case it's a click
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = brushColor;
      ctx.fillStyle = brushColor;
      ctx.lineWidth = brushSize;
      
      ctx.beginPath();
      ctx.arc(x, y, brushSize/2, 0, Math.PI * 2);
      ctx.fill();
  };

  const handlePaintMove = (e: React.MouseEvent) => {
      // Only paint if in brush mode
      if (!isPainting || !showPaintCanvas || !paintCanvasRef.current || paintMode !== 'brush') return;
      
      const ctx = paintCanvasRef.current.getContext('2d');
      if (!ctx || !lastPos.current) return;

      const newPos = getCanvasCoords(e);
      
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(newPos.x, newPos.y);
      ctx.stroke();
      
      lastPos.current = newPos;
  };

  const handlePaintEnd = () => {
      if (isPainting && currentImage && paintCanvasRef.current) {
          setIsPainting(false);
          lastPos.current = null;
          // Save the canvas state to the image state
          const newBase64 = paintCanvasRef.current.toDataURL('image/png');
          handlePaintSave(currentImage.id, newBase64);
      }
  };

  // --- End Painting Logic ---

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
              // Already on clean layer: ensure 'bubble' tool is disabled if it was somehow active
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
    <div className="flex-1 overflow-auto flex items-center justify-center p-8 relative bg-[#1a1a1a]">
      
      {/* Layer Tabs - Top Left */}
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

      <div className="relative shadow-2xl inline-block" ref={containerRef} style={{ maxWidth: '100%' }}>
        
        {/* Render Logic: Canvas (if Painting AND on Clean layer) OR Image */}
        {showPaintCanvas ? (
            <canvas 
                ref={paintCanvasRef}
                className={`max-h-[90vh] max-w-full block select-none relative z-20 cursor-crosshair`} 
                onMouseDown={handlePaintStart}
                onMouseMove={handlePaintMove}
                onMouseUp={handlePaintEnd}
                onMouseLeave={handlePaintEnd}
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
          
          {/* Main Interaction Layer (Bubble/Mask creation/resize) - Only active if NOT painting */}
          {!showPaintCanvas && (
              <div
                className={`absolute inset-0 z-0 pointer-events-auto ${drawTool !== 'none' ? 'cursor-crosshair' : 'cursor-default'}`}
                onMouseDown={onCanvasMouseDown}
              />
          )}

          {showMasks && maskRegions.map(region => (
            <RegionLayer
              key={region.id}
              region={region}
              isSelected={selectedMaskId === region.id}
              isInteractive={!showPaintCanvas}
              onMouseDown={(e) => onMaskMouseDown(e, region.id)}
              onResizeStart={(e, handle) => onResizeStart(e, region.id, 'mask', handle)}
              onDelete={() => onDeleteMask(region.id)}
            />
          ))}

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
    </div>
  );
};
