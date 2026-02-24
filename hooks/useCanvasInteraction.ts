
import React, { useRef, useEffect, useCallback } from 'react';
import { ImageState, HandleType, AIConfig, Bubble } from '../types';
import { createBubble, createMaskRegion, clamp, isBubbleInsideMask } from '../utils/editorUtils';

interface DragState {
    mode: 'move' | 'resize' | 'drawing';
    targetType: 'bubble' | 'mask';
    id: string;
    handle?: HandleType;
    startX: number;
    startY: number;
    startBx: number;
    startBy: number;
    startBw: number;
    startBh: number;
    rotation: number;
    initialSnapshot: ImageState[];
    hasMoved: boolean;
}

interface UseCanvasInteractionProps {
    currentId: string | null;
    images: ImageState[]; // pass history.present
    setImages: (newImagesOrUpdater: ImageState[] | ((prev: ImageState[]) => ImageState[]), skipHistory?: boolean) => void;
    setHistory: React.Dispatch<React.SetStateAction<{ past: ImageState[][]; present: ImageState[]; future: ImageState[][]; }>>;
    aiConfig: AIConfig;
    setSelectedBubbleId: (id: string | null) => void;
    setSelectedMaskId: (id: string | null) => void;
    triggerAutoColorDetection: (id: string) => void;
    drawTool: 'none' | 'bubble' | 'mask' | 'brush';
    paintMode: 'brush' | 'box'; // Add paintMode
}

export const useCanvasInteraction = ({
    currentId,
    images,
    setImages,
    setHistory,
    aiConfig,
    setSelectedBubbleId,
    setSelectedMaskId,
    triggerAutoColorDetection,
    drawTool,
    paintMode // Receive paintMode
}: UseCanvasInteractionProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<DragState | null>(null);

    // Helpers to access current image data safely
    const getCurrentImage = () => images.find(img => img.id === currentId);

    const updateImageBubbles = (imgId: string, newBubbles: Bubble[]) => {
        setImages(prev => prev.map(img => img.id === imgId ? { ...img, bubbles: newBubbles } : img));
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (!currentId || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const startXPct = clamp((e.clientX - rect.left) / rect.width * 100, 0, 100);
        const startYPct = clamp((e.clientY - rect.top) / rect.height * 100, 0, 100);

        const currentImg = getCurrentImage();
        if (!currentImg) return;

        if (drawTool === 'bubble') {
            const newBubble = createBubble(startXPct, startYPct, aiConfig.defaultFontSize, 0, 0);
            
            // Check immediate overlap for new bubble (point overlap)
            const cleanedMasks = (currentImg.maskRegions || []).filter(m => m.isCleaned);
            const overlaps = cleanedMasks.some(m => isBubbleInsideMask(newBubble.x, newBubble.y, m.x, m.y, m.width, m.height));
            if (overlaps) {
                newBubble.backgroundColor = 'transparent';
                newBubble.autoDetectBackground = false;
            }

            updateImageBubbles(currentId, [...currentImg.bubbles, newBubble]);
            setSelectedBubbleId(newBubble.id);
            setSelectedMaskId(null);
            dragRef.current = {
                mode: 'drawing',
                targetType: 'bubble',
                id: newBubble.id,
                startX: e.clientX, startY: e.clientY,
                startBx: startXPct, startBy: startYPct,
                startBw: 0, startBh: 0,
                rotation: 0,
                initialSnapshot: images,
                hasMoved: false
            };
        } else if (drawTool === 'mask' || (drawTool === 'brush' && paintMode === 'box')) {
            // Allow mask creation in Mask mode OR Paint mode (Box sub-mode)
            const newMask = createMaskRegion(startXPct, startYPct);
            setImages(prev => prev.map(img => img.id === currentId ? { ...img, maskRegions: [...(img.maskRegions || []), newMask] } : img));
            setSelectedMaskId(newMask.id);
            setSelectedBubbleId(null);
            dragRef.current = {
                mode: 'drawing',
                targetType: 'mask',
                id: newMask.id,
                startX: e.clientX, startY: e.clientY,
                startBx: startXPct, startBy: startYPct,
                startBw: 0, startBh: 0,
                rotation: 0,
                initialSnapshot: images,
                hasMoved: false
            };
        } else {
            setSelectedBubbleId(null);
            setSelectedMaskId(null);
        }
    };

    const handleLayerMouseDown = (e: React.MouseEvent, id: string, type: 'bubble' | 'mask') => {
        e.stopPropagation();
        e.preventDefault();
        
        const currentImg = getCurrentImage();
        if (!currentImg) return;

        if (type === 'bubble') {
            setSelectedBubbleId(id);
            setSelectedMaskId(null);
            const bubble = currentImg.bubbles.find(b => b.id === id);
            if (!bubble) return;
            dragRef.current = {
                mode: 'move', targetType: 'bubble', id,
                startX: e.clientX, startY: e.clientY,
                startBx: bubble.x, startBy: bubble.y,
                startBw: bubble.width, startBh: bubble.height,
                rotation: bubble.rotation,
                initialSnapshot: images,
                hasMoved: false
            };
        } else {
            // Mask selection valid in Mask tool OR Brush (Box) tool
            if (drawTool !== 'mask' && !(drawTool === 'brush' && paintMode === 'box')) return;
            
            setSelectedMaskId(id);
            setSelectedBubbleId(null);
            const mask = (currentImg.maskRegions || []).find(m => m.id === id);
            if (!mask) return;
            dragRef.current = {
                mode: 'move', targetType: 'mask', id,
                startX: e.clientX, startY: e.clientY,
                startBx: mask.x, startBy: mask.y,
                startBw: mask.width, startBh: mask.height,
                rotation: 0,
                initialSnapshot: images,
                hasMoved: false
            };
        }
    };

    const handleResizeStart = (e: React.MouseEvent, id: string, type: 'bubble' | 'mask', handle: HandleType) => {
        e.stopPropagation();
        e.preventDefault();
        
        const currentImg = getCurrentImage();
        if (!currentImg) return;

        if (type === 'bubble') {
            const bubble = currentImg.bubbles.find(b => b.id === id);
            if (!bubble) return;
            dragRef.current = {
                mode: 'resize', targetType: 'bubble', id: bubble.id, handle,
                startX: e.clientX, startY: e.clientY,
                startBx: bubble.x, startBy: bubble.y,
                startBw: bubble.width, startBh: bubble.height,
                rotation: bubble.rotation,
                initialSnapshot: images,
                hasMoved: false
            };
        } else {
            if (drawTool !== 'mask' && !(drawTool === 'brush' && paintMode === 'box')) return;
            
            const mask = (currentImg.maskRegions || []).find(m => m.id === id);
            if (!mask) return;
            dragRef.current = {
                mode: 'resize', targetType: 'mask', id: mask.id, handle,
                startX: e.clientX, startY: e.clientY,
                startBx: mask.x, startBy: mask.y,
                startBw: mask.width, startBh: mask.height,
                rotation: 0,
                initialSnapshot: images,
                hasMoved: false
            };
        }
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragRef.current || !containerRef.current || !currentId) return;
        const { mode, handle, startX, startY, startBx, startBy, startBw, startBh, targetType, id } = dragRef.current;
        const rect = containerRef.current.getBoundingClientRect();
        const dxPx = e.clientX - startX;
        const dyPx = e.clientY - startY;
        
        if (Math.abs(dxPx) > 1 || Math.abs(dyPx) > 1) dragRef.current.hasMoved = true;

        const checkOverlap = (bubble: Bubble, maskRegions: any[]) => {
            const cleanedMasks = maskRegions.filter(m => m.isCleaned);
            return cleanedMasks.some(m => isBubbleInsideMask(bubble.x, bubble.y, m.x, m.y, m.width, m.height));
        };

        if (mode === 'drawing') {
            const currentXPct = clamp((e.clientX - rect.left) / rect.width * 100, 0, 100);
            const currentYPct = clamp((e.clientY - rect.top) / rect.height * 100, 0, 100);
            const left = Math.min(startBx, currentXPct);
            const top = Math.min(startBy, currentYPct);
            const w = Math.abs(currentXPct - startBx);
            const h = Math.abs(currentYPct - startBy);
            const centerX = left + w / 2;
            const centerY = top + h / 2;

            setImages(prev => {
                const img = prev.find(i => i.id === currentId);
                if (!img) return prev;
                if (targetType === 'bubble') {
                    let newBubble = img.bubbles.find(b => b.id === id);
                    if (!newBubble) return prev; // Should be there
                    
                    newBubble = { ...newBubble, x: centerX, y: centerY, width: Math.max(1, w), height: Math.max(1, h) };
                    
                    // Check overlap on draw
                    if (checkOverlap(newBubble, img.maskRegions || [])) {
                        newBubble.backgroundColor = 'transparent';
                        newBubble.autoDetectBackground = false;
                    }

                    const newBubbles = img.bubbles.map(b => b.id === id ? newBubble : b);
                    return prev.map(p => p.id === currentId ? { ...p, bubbles: newBubbles } : p);
                } else {
                    const newMasks = (img.maskRegions || []).map(m => m.id === id ? { ...m, x: centerX, y: centerY, width: Math.max(1, w), height: Math.max(1, h) } : m);
                    return prev.map(p => p.id === currentId ? { ...p, maskRegions: newMasks } : p);
                }
            }, true); // Skip history during continuous drag
            return;
        }

        if (mode === 'move') {
            const dxPct = (dxPx / rect.width) * 100;
            const dyPct = (dyPx / rect.height) * 100;
            let newX = clamp(startBx + dxPct, startBw / 2, 100 - startBw / 2);
            let newY = clamp(startBy + dyPct, startBh / 2, 100 - startBh / 2);

            setImages(prev => {
                const img = prev.find(i => i.id === currentId);
                if (!img) return prev;
                if (targetType === 'bubble') {
                    let newBubble = img.bubbles.find(b => b.id === id);
                    if (!newBubble) return prev;

                    newBubble = { ...newBubble, x: newX, y: newY };

                    // Check overlap on move
                    if (checkOverlap(newBubble, img.maskRegions || [])) {
                        newBubble.backgroundColor = 'transparent';
                        newBubble.autoDetectBackground = false;
                    }

                    const newBubbles = img.bubbles.map(b => b.id === id ? newBubble : b);
                    return prev.map(p => p.id === currentId ? { ...p, bubbles: newBubbles } : p);
                } else {
                    const newMasks = (img.maskRegions || []).map(m => m.id === id ? { ...m, x: newX, y: newY } : m);
                    return prev.map(p => p.id === currentId ? { ...p, maskRegions: newMasks } : p);
                }
            }, true);
        } else if (mode === 'resize' && handle) {
            const startLeft = startBx - startBw / 2;
            const startTop = startBy - startBh / 2;
            const startRight = startBx + startBw / 2;
            const startBottom = startBy + startBh / 2;
            const deltaXPct = (dxPx / rect.width) * 100;
            const deltaYPct = (dyPx / rect.height) * 100;

            let newLeft = startLeft, newRight = startRight, newTop = startTop, newBottom = startBottom;

            if (handle.includes('e')) newRight = clamp(startRight + deltaXPct, newLeft + 2, 100);
            if (handle.includes('w')) newLeft = clamp(startLeft + deltaXPct, 0, newRight - 2);
            if (handle.includes('s')) newBottom = clamp(startBottom + deltaYPct, newTop + 2, 100);
            if (handle.includes('n')) newTop = clamp(startTop + deltaYPct, 0, newBottom - 2);

            const newW = newRight - newLeft;
            const newH = newBottom - newTop;
            const newX = newLeft + newW / 2;
            const newY = newTop + newH / 2;

            setImages(prev => {
                const img = prev.find(i => i.id === currentId);
                if (!img) return prev;
                if (targetType === 'bubble') {
                    let newBubble = img.bubbles.find(b => b.id === id);
                    if (!newBubble) return prev;

                    newBubble = { ...newBubble, x: newX, y: newY, width: newW, height: newH };

                    // Check overlap on resize
                    if (checkOverlap(newBubble, img.maskRegions || [])) {
                        newBubble.backgroundColor = 'transparent';
                        newBubble.autoDetectBackground = false;
                    }

                    const newBubbles = img.bubbles.map(b => b.id === id ? newBubble : b);
                    return prev.map(p => p.id === currentId ? { ...p, bubbles: newBubbles } : p);
                } else {
                    const newMasks = (img.maskRegions || []).map(m => m.id === id ? { ...m, x: newX, y: newY, width: newW, height: newH } : m);
                    return prev.map(p => p.id === currentId ? { ...p, maskRegions: newMasks } : p);
                }
            }, true);
        }
    }, [currentId, setImages]);

    const handleMouseUp = useCallback(() => {
        const dragData = dragRef.current;
        if (!dragData) return;
        dragRef.current = null;

        const { id, mode, targetType, initialSnapshot, hasMoved } = dragData;

        // Cleanup empty drawn items
        if (mode === 'drawing') {
            setImages(prev => {
                const img = prev.find(i => i.id === currentId);
                if (!img) return prev;
                if (targetType === 'bubble') {
                    const bubble = img.bubbles.find(b => b.id === id);
                    if (bubble && (bubble.width < 1 || bubble.height < 1)) {
                        return prev.map(p => p.id === currentId ? { ...p, bubbles: p.bubbles.filter(b => b.id !== id) } : p);
                    }
                } else {
                    const mask = img.maskRegions?.find(m => m.id === id);
                    if (mask && (mask.width < 1 || mask.height < 1)) {
                        return prev.map(p => p.id === currentId ? { ...p, maskRegions: (p.maskRegions || []).filter(m => m.id !== id) } : p);
                    }
                }
                return prev;
            }, true); // We update history manually below
        }

        // Final overlap check: ensure bubble transparency is correct before committing to history
        if (targetType === 'bubble' && currentId && (hasMoved || mode === 'drawing')) {
            setImages(prev => {
                const img = prev.find(i => i.id === currentId);
                if (!img) return prev;
                const bubble = img.bubbles.find(b => b.id === id);
                if (!bubble) return prev;

                const cleanedMasks = (img.maskRegions || []).filter(m => m.isCleaned);
                const overlaps = cleanedMasks.some(m => isBubbleInsideMask(bubble.x, bubble.y, m.x, m.y, m.width, m.height));

                if (overlaps && bubble.backgroundColor !== 'transparent') {
                    const newBubbles = img.bubbles.map(b => b.id === id ? { ...b, backgroundColor: 'transparent', autoDetectBackground: false } : b);
                    return prev.map(p => p.id === currentId ? { ...p, bubbles: newBubbles } : p);
                }
                return prev;
            }, true);
        }

        // Commit history if changed (skip if no actual movement occurred)
        if (hasMoved) {
            setHistory(curr => ({
                past: [...curr.past, initialSnapshot].slice(-20),
                present: curr.present,
                future: []
            }));
        }

        // Auto color detection triggers
        if (targetType === 'bubble' && currentId && (mode === 'drawing' || mode === 'move' || mode === 'resize')) {
            triggerAutoColorDetection(id);
        }
    }, [currentId, setImages, setHistory, triggerAutoColorDetection]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    return {
        containerRef,
        handleCanvasMouseDown,
        handleLayerMouseDown,
        handleResizeStart
    };
};
