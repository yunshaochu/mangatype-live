
import React, { useRef, useEffect } from 'react';
import { MaskRegion, HandleType } from '../types';
import { X } from 'lucide-react';
import { handleStyle, HANDLE_OFFSET, clamp } from '../utils/editorUtils';

interface RegionLayerProps {
  region: MaskRegion;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: HandleType) => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<MaskRegion>) => void;
  isInteractive?: boolean;
}

export const RegionLayer: React.FC<RegionLayerProps> = React.memo(({ 
    region, isSelected, onMouseDown, onResizeStart, onDelete, onUpdate, isInteractive = true 
}) => {
    const divRef = useRef<HTMLDivElement>(null);
    const regionRef = useRef(region);
    regionRef.current = region;

    // Determine color based on method (fill=red, inpaint=purple)
    const isErase = region.method === 'inpaint';
    const mainColor = isErase ? '#a855f7' : '#ef4444'; // purple-500 : red-500
    const mainBg = isErase ? 'bg-purple-500/10' : 'bg-red-500/10';
    const borderColor = isErase ? 'border-purple-500' : 'border-red-500';

    const regionHandleStyle = (cursor: string): React.CSSProperties => ({
        ...handleStyle(cursor),
        borderColor: mainColor, 
    });

    useEffect(() => {
        const el = divRef.current;
        if (!el || !isInteractive) return;

        const handleWheel = (e: WheelEvent) => {
            if (!isSelected) return;

            if (e.altKey) {
                e.preventDefault();
                e.stopPropagation();

                const currentRegion = regionRef.current;
                const delta = e.deltaY > 0 ? -1 : 1;
                
                const scale = delta > 0 ? 1.05 : 0.95;
                let newWidth = currentRegion.width * scale;
                let newHeight = currentRegion.height * scale;
                
                // Allow resizing down to 0.5% for precise masks
                newWidth = clamp(newWidth, 0.5, 100);
                newHeight = clamp(newHeight, 0.5, 100);

                onUpdate({
                    width: parseFloat(newWidth.toFixed(1)),
                    height: parseFloat(newHeight.toFixed(1))
                });
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', handleWheel);
        };
    }, [isSelected, onUpdate, isInteractive]);

    return (
        <div
            ref={divRef}
            onMouseDown={isInteractive ? onMouseDown : undefined}
            className={`absolute select-none z-30 group ${isInteractive ? 'cursor-move pointer-events-auto' : 'pointer-events-none'}`} 
            style={{
                top: `${region.y}%`,
                left: `${region.x}%`,
                width: `${region.width}%`,
                height: `${region.height}%`,
                transform: `translate(-50%, -50%)`, 
            }}
        >
            <div className={`absolute inset-0 border-2 border-dashed ${borderColor} ${mainBg} pointer-events-none transition-opacity ${isSelected ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}></div>

            {isSelected && isInteractive && (
                <>
                    <div 
                        className="absolute -top-12 left-1/2 -translate-x-1/2 cursor-pointer z-40 transform hover:scale-110 transition-transform pointer-events-auto"
                        onMouseDown={(e) => { e.stopPropagation(); onDelete(); }}
                    >
                        <div className="text-white rounded-full p-1.5 shadow-md border-2 border-white hover:opacity-90" style={{ backgroundColor: mainColor }}>
                            <X size={14} strokeWidth={3} />
                        </div>
                    </div>
                    <div style={{ ...regionHandleStyle('nw-resize'), top: HANDLE_OFFSET, left: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'nw')} />
                    <div style={{ ...regionHandleStyle('ne-resize'), top: HANDLE_OFFSET, right: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'ne')} />
                    <div style={{ ...regionHandleStyle('se-resize'), bottom: HANDLE_OFFSET, right: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'se')} />
                    <div style={{ ...regionHandleStyle('sw-resize'), bottom: HANDLE_OFFSET, left: HANDLE_OFFSET }} onMouseDown={(e) => onResizeStart(e, 'sw')} />
                    <div style={{ ...regionHandleStyle('n-resize'), top: HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'n')} />
                    <div style={{ ...regionHandleStyle('e-resize'), top: '50%', right: HANDLE_OFFSET, transform: 'translateY(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'e')} />
                    <div style={{ ...regionHandleStyle('s-resize'), bottom: HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => onResizeStart(e, 's')} />
                    <div style={{ ...regionHandleStyle('w-resize'), top: '50%', left: HANDLE_OFFSET, transform: 'translateY(-50%)' }} onMouseDown={(e) => onResizeStart(e, 'w')} />
                </>
            )}
        </div>
    );
}, (prev, next) => {
    return prev.isSelected === next.isSelected && 
           prev.region === next.region && 
           prev.region.method === next.region.method && // Check for method change
           prev.isInteractive === next.isInteractive;
});
