
import React from 'react';
import { MaskRegion, HandleType } from '../types';
import { X } from 'lucide-react';
import { handleStyle, HANDLE_OFFSET } from '../utils/editorUtils';

interface RegionLayerProps {
  region: MaskRegion;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: HandleType) => void;
  onDelete: () => void;
  isInteractive?: boolean;
}

export const RegionLayer: React.FC<RegionLayerProps> = React.memo(({ 
    region, isSelected, onMouseDown, onResizeStart, onDelete, isInteractive = true 
}) => {
    const regionHandleStyle = (cursor: string): React.CSSProperties => ({
        ...handleStyle(cursor),
        borderColor: '#ef4444', 
    });

    return (
        <div
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
            <div className={`absolute inset-0 border-2 border-dashed border-red-500 bg-red-500/10 pointer-events-none transition-opacity ${isSelected ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}></div>

            {isSelected && isInteractive && (
                <>
                    <div 
                        className="absolute -top-12 left-1/2 -translate-x-1/2 cursor-pointer z-40 transform hover:scale-110 transition-transform pointer-events-auto"
                        onMouseDown={(e) => { e.stopPropagation(); onDelete(); }}
                    >
                        <div className="bg-red-500 text-white rounded-full p-1.5 shadow-md border-2 border-white hover:bg-red-600">
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
    return prev.isSelected === next.isSelected && prev.region === next.region && prev.isInteractive === next.isInteractive;
});