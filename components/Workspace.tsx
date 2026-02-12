
import React, { useState, useEffect, useRef } from 'react';
import { BubbleLayer } from './BubbleLayer';
import { RegionLayer } from './RegionLayer';
import { HandleType } from '../types';
import { Maximize, Layers, Image as ImageIcon, Eraser, Trash2, Brush, PaintBucket, MousePointerClick } from 'lucide-react';
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
    brushColor, brushSize, setBrushColor, handlePaintSave, paintMode,
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
  let showMasks = drawTool === 'mask'; 
  
  // Determine if the "Clean" tab should be visible
  const showCleanTab = !!currentImage?.inpaintedUrl || aiConfig.enableInpainting || drawTool === 'brush';

  // Determine if we should show the Paint Canvas
  // ONLY if tool is brush AND we are looking at the 'clean' layer
  const showPaintCanvas = drawTool === 'brush' && activeLayer === 'clean';

  if (currentImage) {
      if (activeLayer === 'original') {
          displayUrl = currentImage.originalUrl || currentImage.url;
          showBubbles = false;
      } else if (activeLayer === 'clean') {
          // Clean layer shows inpainted image if available, otherwise falls back to original (so you can start painting on it)
          displayUrl = currentImage.inpaintedUrl || currentImage.originalUrl || currentImage.url;
          showBubbles = false;
          // When painting, we might want to see masks to know where text was
          if (drawTool === 'brush') showMasks = true; 
      } else if (activeLayer === 'final') {
          displayUrl = currentImage.inpaintedUrl || currentImage.originalUrl || currentImage.url;
          showBubbles = true;
      }
  }

  // --- PAINTING LOGIC ---
  
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

  const fillRegion = (targetX: number, targetY: number, fillColor: string) => {
      const canvas = paintCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Calculate click percentage coordinates
      // targetX/Y are already scaled to canvas dimensions (from getCanvasCoords)
      const clickXPct = (targetX / canvas.width) * 100;
      const clickYPct = (targetY / canvas.height) * 100;

      // 2. Find intersecting Mask Region
      // We search in reverse to find the "top-most" one if overlaps exist, though usually masks don't overlap much.
      // We check if the click point is inside the [center - width/2, center + width/2] box.
      const targetMask = [...maskRegions].reverse().find(m => {
          const left = m.x - m.width / 2;
          const right = m.x + m.width / 2;
          const top = m.y - m.height / 2;
          const bottom = m.y + m.height / 2;
          return clickXPct >= left && clickXPct <= right && clickYPct >= top && clickYPct <= bottom;
      });

      if (targetMask) {
          // 3. Fill the rectangle
          const x = (targetMask.x / 100) * canvas.width;
          const y = (targetMask.y / 100) * canvas.height;
          const w = (targetMask.width / 100) * canvas.width;
          const h = (targetMask.height / 100) * canvas.height;

          ctx.fillStyle = fillColor;
          // Use Math.ceil/floor to avoid sub-pixel gaps? 
          // Standard fillRect is usually fine, maybe slight expansion to cover anti-aliasing
          ctx.fillRect(x - w/2, y - h/2, w, h);
          
          handlePaintSave(currentImage!.id, canvas.toDataURL('image/png'));
      } else {
          // Optional: Feedback that no box was clicked?
          // For now, do nothing as requested "select a range (box) ... and turn it color"
      }
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

      // FILL BOX TOOL
      if (paintMode === 'bucket') {
          fillRegion(x, y, brushColor);
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
                  bubbles: img.bubbles.map(b => b.backgroundColor === 'transparent' ? { ...b, backgroundColor: '#ffffff' } : b)
              };
          }));
      }
  };

  const handleSwitchLayer = (layer: 'original' | 'clean' | 'final') => {
      setActiveLayer(layer);
      if (layer !== 'clean' && drawTool === 'brush') {
          setDrawTool('none');
      }
  };

  const maskImageSrc = currentImage.maskRefinedBase64 
    ? (currentImage.maskRefinedBase64.startsWith('data:') ? currentImage.maskRefinedBase64 : `data:image/png;base64,${currentImage.maskRefinedBase64}`)
    : '';

  // Only show the overlay if: 
  // 1. Inpainting enabled
  // 2. Auto Inpaint Masks sub-switch is ON (New requirement)
  // 3. Mask Tool active
  // 4. Mask data exists
  const showTextMask = aiConfig.enableInpainting && aiConfig.autoInpaintMasks && drawTool === 'mask' && !!maskImageSrc;

  // Generate unique ID for SVG clip path
  const clipPathId = `mask-clip-${currentImage.id}`;

  return (
    <div className="flex-1 overflow-auto flex items-center justify-center p-8 relative bg-[#1a1a1a]">
      
      {/* Layer Tabs - Top Left */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
          {drawTool === 'brush' ? (
              <div className="flex bg-purple-900/90 backdrop-blur border border-purple-500/50 p-2 rounded-lg shadow-xl text-xs text-purple-200 font-bold animate-pulse">
                  {paintMode === 'bucket' ? <MousePointerClick size={14} className="mr-2"/> : <Brush size={14} className="mr-2"/>} 
                  {paintMode === 'bucket' ? 'Click Box to Fill' : 'Painting Mode'}
                  <span className="ml-2 font-normal opacity-70 hidden sm:inline">(Alt+Click to pick color)</span>
              </div>
          ) : null}

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

          {/* Delete Inpaint Button - Only show if layer exists and NOT currently painting (to avoid confusion) or allow user to clear while painting? Let's allow. */}
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
                className={`max-h-[90vh] max-w-full block select-none relative z-20 ${paintMode === 'bucket' ? 'cursor-pointer' : 'cursor-crosshair'}`} // Canvas needs z-index to be clickable
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
            KEY FIX: pointer-events-none ensures clicks pass through to the canvas when not interacting with bubbles/masks.
        */}
        <div className="absolute inset-0 pointer-events-none" style={{ containerType: 'inline-size' } as React.CSSProperties}>
          
          {/* Text Mask Overlay (Visible when Inpainting Enabled, AutoInpaint ON, and in Mask Mode) */}
          {showTextMask && (
              <>
                {/* 
                    Define a clipPath dynamically based on the mask regions (Red Boxes).
                    This ensures the orange text mask is ONLY visible inside the red boxes.
                */}
                <svg width="0" height="0" className="absolute">
                    <defs>
                        <clipPath id={clipPathId} clipPathUnits="objectBoundingBox">
                            {maskRegions.length > 0 ? (
                                maskRegions.map(m => {
                                    // Convert center x/y + width/height % to top-left normalized coordinates (0-1)
                                    // m.x is center percentage (0-100) -> (m.x/100) - (m.width/100)/2
                                    const x = (m.x - m.width/2) / 100;
                                    const y = (m.y - m.height/2) / 100;
                                    const w = m.width / 100;
                                    const h = m.height / 100;
                                    return (
                                        <rect key={m.id} x={x} y={y} width={w} height={h} />
                                    );
                                })
                            ) : (
                                // If no regions, show nothing
                                <rect x="0" y="0" width="0" height="0" />
                            )}
                        </clipPath>
                    </defs>
                </svg>

                <img 
                    src={maskImageSrc}
                    alt="mask overlay"
                    className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20 opacity-80"
                    style={{
                        mixBlendMode: 'screen',
                        filter: 'sepia(1) saturate(500%) hue-rotate(-45deg)',
                        clipPath: `url(#${clipPathId})`, // Apply the dynamic clip
                        WebkitClipPath: `url(#${clipPathId})`
                    }}
                />
              </>
          )}

          {/* Main Interaction Layer (Bubble/Mask creation/resize) - Only active if NOT painting */}
          {!showPaintCanvas && (
              <div
                // KEY FIX: pointer-events-auto re-enables interaction for this specific layer
                className={`absolute inset-0 z-0 pointer-events-auto ${drawTool !== 'none' ? 'cursor-crosshair' : 'cursor-default'}`}
                onMouseDown={onCanvasMouseDown}
              />
          )}

          {/* 
             Pass isInteractive prop to disable bubble selection while painting 
             so you don't accidentally drag a bubble when trying to paint over it.
          */}
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