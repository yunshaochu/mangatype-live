
import React, { useRef, useEffect } from 'react';
import { Bubble, AIConfig, HandleType } from '../types';
import { X } from 'lucide-react';
import { handleStyle, HANDLE_OFFSET, clamp } from '../utils/editorUtils';

interface BubbleLayerProps {
  bubble: Bubble;
  isSelected: boolean;
  config: AIConfig;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: HandleType) => void;
  onUpdate: (id: string, updates: Partial<Bubble>) => void;
  onDelete: () => void;
  onTriggerAutoColor: (id: string) => void;
  isInteractive?: boolean;
}

export const BubbleLayer: React.FC<BubbleLayerProps> = React.memo(({ 
    bubble, isSelected, config, onMouseDown, onResizeStart, onUpdate, onDelete, onTriggerAutoColor, isInteractive = true 
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef(bubble);
  bubbleRef.current = bubble;

  const shape = bubble.maskShape || config.defaultMaskShape || 'ellipse';
  const radiusVal = bubble.maskCornerRadius !== undefined ? bubble.maskCornerRadius : (config.defaultMaskCornerRadius || 15);
  const featherVal = bubble.maskFeather !== undefined ? bubble.maskFeather : (config.defaultMaskFeather || 10);

  let borderRadius = '0%';
  if (shape === 'ellipse') borderRadius = '50%';
  else if (shape === 'rounded') borderRadius = `${radiusVal}%`;
  
  const blur = `calc(${featherVal * 0.15}cqw)`;
  const spread = `calc(${featherVal * 0.08}cqw)`;
  const boxShadow = (bubble.backgroundColor !== 'transparent' && featherVal > 0)
    ? `0 0 ${blur} ${spread} ${bubble.backgroundColor}` 
    : 'none';

  useEffect(() => {
    const el = divRef.current;
    if (!el || !isInteractive) return;

    const handleWheel = (e: WheelEvent) => {
      if (!isSelected) return;

      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault(); 
        e.stopPropagation(); 

        const currentBubble = bubbleRef.current;
        const delta = e.deltaY > 0 ? -1 : 1;

        if (e.ctrlKey || e.metaKey) {
            const step = 0.1;
            const newSize = Math.max(0.5, Math.min(10, currentBubble.fontSize + (delta * step)));
            onUpdate(currentBubble.id, { fontSize: parseFloat(newSize.toFixed(1)) });
        } else if (e.altKey) {
            const scale = delta > 0 ? 1.05 : 0.95;
            let newWidth = currentBubble.width * scale;
            let newHeight = currentBubble.height * scale;
            newWidth = clamp(newWidth, 0, 100);
            newHeight = clamp(newHeight, 0, 100);
            onUpdate(currentBubble.id, {
                width: parseFloat(newWidth.toFixed(1)),
                height: parseFloat(newHeight.toFixed(1))
            });
            onTriggerAutoColor(currentBubble.id);
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isSelected, onUpdate, onTriggerAutoColor, isInteractive]);

  return (
    <div
      ref={divRef}
      onMouseDown={isInteractive ? onMouseDown : undefined}
      className={`absolute select-none z-10 group ${isInteractive ? 'cursor-move pointer-events-auto' : 'pointer-events-none'}`}
      style={{
        top: `${bubble.y}%`,
        left: `${bubble.x}%`,
        width: `${bubble.width}%`,
        height: `${bubble.height}%`,
        transform: `translate(-50%, -50%) rotate(${bubble.rotation}deg)`,
      }}
    >
      <div 
        className="absolute inset-0 transition-colors duration-200"
        style={{ 
          backgroundColor: bubble.backgroundColor,
          borderRadius: borderRadius,
          boxShadow: boxShadow
        }}
      />

      {isSelected && isInteractive && (
        <>
            <div 
                className="absolute inset-0 border-2 border-blue-500 pointer-events-none z-20 opacity-80 shadow-sm"
                style={{ borderRadius: borderRadius }}
            ></div>
            <div 
              className="absolute -top-12 left-1/2 -translate-x-1/2 cursor-pointer z-40 transform hover:scale-110 transition-transform pointer-events-auto"
              onMouseDown={(e) => { e.stopPropagation(); onDelete(); }}
            >
               <div className="bg-red-500 text-white rounded-full p-1.5 shadow-md border-2 border-white hover:bg-red-600">
                 <X size={14} strokeWidth={3} />
               </div>
            </div>
            <div style={{ ...handleStyle('nw-resize'), top: HANDLE_OFFSET, left: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'nw')} />
            <div style={{ ...handleStyle('ne-resize'), top: HANDLE_OFFSET, right: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'ne')} />
            <div style={{ ...handleStyle('se-resize'), bottom: HANDLE_OFFSET, right: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'se')} />
            <div style={{ ...handleStyle('sw-resize'), bottom: HANDLE_OFFSET, left: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'sw')} />
            <div style={{ ...handleStyle('n-resize'), top: HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'n')} />
            <div style={{ ...handleStyle('e-resize'), top: '50%', right: HANDLE_OFFSET, transform: 'translateY(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'e')} />
            <div style={{ ...handleStyle('s-resize'), bottom: HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => onResizeStart(e, 's')} />
            <div style={{ ...handleStyle('w-resize'), top: '50%', left: HANDLE_OFFSET, transform: 'translateY(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'w')} />
        </>
      )}
      
      <div
        className={`absolute inset-0 flex items-center justify-center font-${bubble.fontFamily} leading-[1.2] overflow-visible`}
        style={{
          fontSize: `${bubble.fontSize * 2}cqw`,
          fontWeight: bubble.fontFamily === 'noto-bold' ? 900 : 'bold',
          color: bubble.color,
          writingMode: bubble.isVertical ? 'vertical-rl' : 'horizontal-tb',
          textOrientation: bubble.isVertical ? 'mixed' : undefined,
          whiteSpace: 'pre',
          letterSpacing: `${bubble.letterSpacing ?? 0.15}em`,
          lineHeight: String(bubble.lineHeight ?? 1.1),
          textAlign: bubble.isVertical ? 'start' : 'center',
          WebkitTextStroke: bubble.strokeColor && bubble.strokeColor !== 'transparent' ? `3px ${bubble.strokeColor}` : '3px #ffffff',
          paintOrder: 'stroke fill',
        }}
      >
        {bubble.text}
      </div>
    </div>
  );
}, (prev, next) => {
    return (
        prev.isSelected === next.isSelected && 
        prev.bubble === next.bubble &&
        prev.config.defaultMaskShape === next.config.defaultMaskShape &&
        prev.config.defaultMaskCornerRadius === next.config.defaultMaskCornerRadius &&
        prev.config.defaultMaskFeather === next.config.defaultMaskFeather &&
        prev.isInteractive === next.isInteractive
    );
});
