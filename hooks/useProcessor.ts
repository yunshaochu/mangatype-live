
import { useState, useRef } from 'react';
import { ImageState, AIConfig, MaskRegion, Bubble } from '../types';
import { detectAndTypesetComic, fetchRawDetectedRegions } from '../services/geminiService';
import { generateMaskedImage, detectBubbleColor, generateInpaintMask } from '../services/exportService';
import { inpaintImage } from '../services/inpaintingService';

interface UseProcessorProps {
    images: ImageState[];
    setImages: (newImagesOrUpdater: ImageState[] | ((prev: ImageState[]) => ImageState[]), skipHistory?: boolean) => void;
    aiConfig: AIConfig;
}

export const useProcessor = ({ images, setImages, aiConfig }: UseProcessorProps) => {
    const [isProcessingBatch, setIsProcessingBatch] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- Core Logic: Process a Single Image (Translate/Bubble) ---
    const runDetectionForImage = async (img: ImageState, signal?: AbortSignal) => {
        setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'processing', errorMessage: undefined } : p));
        
        try {
            // Always use original image for detection analysis
            let sourceBase64 = img.originalBase64 || img.base64;
            const useMaskedImage = aiConfig.enableMaskedImageMode && img.maskRegions && img.maskRegions.length > 0;
            
            if (useMaskedImage) {
                sourceBase64 = await generateMaskedImage({ ...img, base64: sourceBase64 });
            }

            const detected = await detectAndTypesetComic(sourceBase64, aiConfig, signal, img.maskRegions);
            let finalDetected = detected;

            if (aiConfig.enableDialogSnap) {
                finalDetected = detected.map(b => {
                    if (!img.maskRegions || img.maskRegions.length === 0) return b;
                    let nearestMask: MaskRegion | null = null; 
                    let minDistance = Infinity;
                    
                    img.maskRegions.forEach(mask => {
                        const dist = Math.sqrt(Math.pow(b.x - mask.x, 2) + Math.pow(b.y - mask.y, 2));
                        if (dist < minDistance) { minDistance = dist; nearestMask = mask; }
                    });

                    if (nearestMask && minDistance < 15) { 
                        const updates: any = { x: (nearestMask as MaskRegion).x, y: (nearestMask as MaskRegion).y };
                        if (aiConfig.forceSnapSize) { 
                            updates.width = (nearestMask as MaskRegion).width; 
                            updates.height = (nearestMask as MaskRegion).height; 
                        }
                        return { ...b, ...updates };
                    }
                    return b;
                });
            }

            const processedBubbles = await Promise.all(finalDetected.map(async (d) => {
                let color = '#ffffff';
                if (aiConfig.autoDetectBackground !== false) {
                    color = await detectBubbleColor(
                        img.originalUrl || img.url || `data:image/png;base64,${img.base64}`, 
                        d.x, d.y, d.width, d.height
                    );
                }
                return {
                    id: crypto.randomUUID(),
                    x: d.x, y: d.y, width: d.width, height: d.height,
                    text: d.text, isVertical: d.isVertical,
                    fontFamily: (d.fontFamily as any) || 'noto',
                    fontSize: aiConfig.defaultFontSize,
                    color: '#0f172a',
                    backgroundColor: color,
                    rotation: d.rotation || 0,
                    maskShape: aiConfig.defaultMaskShape,
                    maskCornerRadius: aiConfig.defaultMaskCornerRadius,
                    maskFeather: aiConfig.defaultMaskFeather
                } as Bubble;
            }));

            // If we have an inpainted layer available, maybe we should make backgrounds transparent if they are white?
            // Per prompt: "when there is b... bubbles (default transparent) appear on b"
            // We implement this as a post-processing step if Inpainting is DONE for this image.
            const adjustedBubbles = processedBubbles.map(b => {
                if (img.inpaintedUrl && b.backgroundColor === '#ffffff') {
                    return { ...b, backgroundColor: 'transparent' };
                }
                return b;
            });

            setImages(prev => prev.map(p => p.id === img.id ? { 
                ...p, 
                bubbles: useMaskedImage ? [...p.bubbles, ...adjustedBubbles] : adjustedBubbles,
                status: 'done' 
            } : p));

        } catch (e: any) {
            if (e.message && e.message.includes('Aborted')) { 
                setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'idle', errorMessage: undefined } : p)); 
                return; 
            }
            console.error("AI Error for " + img.name, e);
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'error', errorMessage: e.message || 'Unknown error occurred' } : p));
        }
    };

    // --- Core Logic: Inpaint a Single Image ---
    // Updated: Supports filtering mask generation by method='inpaint'
    const runInpaintingForImage = async (img: ImageState, signal?: AbortSignal, options: { onlyInpaintMethod?: boolean } = {}) => {
        if (!aiConfig.enableInpainting || !aiConfig.inpaintingUrl) return;
        
        const onlyInpaintMethod = options.onlyInpaintMethod || false;
        
        // Check availability of masks (Filtered if necessary)
        const relevantMasks = onlyInpaintMethod 
            ? (img.maskRegions || []).filter(m => m.method === 'inpaint')
            : (img.maskRegions || []);

        if (relevantMasks.length === 0) return;

        setImages(prev => prev.map(p => p.id === img.id ? { ...p, inpaintingStatus: 'processing' } : p));

        try {
            // Iterative Inpaint: Use existing inpainted image as source if available, otherwise original
            const sourceBase64 = img.inpaintedBase64 || img.originalBase64 || img.base64;
            
            // Generate mask: Pass the onlyInpaintMethod flag
            const maskBase64 = await generateInpaintMask(img, { useRefinedMask: false, onlyInpaintMethod });
            
            const cleanedBase64Raw = await inpaintImage(
                aiConfig.inpaintingUrl,
                sourceBase64,
                maskBase64,
                aiConfig.inpaintingModel
            );

            if (signal?.aborted) throw new Error("Aborted");

            const cleanedBase64 = cleanedBase64Raw.startsWith('data:') 
                ? cleanedBase64Raw 
                : `data:image/png;base64,${cleanedBase64Raw}`;

            // We need to mark only the relevant masks as cleaned
            const affectedMaskIds = new Set(relevantMasks.map(m => m.id));

            setImages(prev => prev.map(p => {
                if (p.id !== img.id) return p;
                
                // Update specific masks to clean
                const newMasks = (p.maskRegions || []).map(m => affectedMaskIds.has(m.id) ? { ...m, isCleaned: true } : m);
                
                // Update bubbles overlapping with newly cleaned masks
                const newBubbles = p.bubbles.map(b => {
                    const overlaps = relevantMasks.some(mask => {
                        const xDiff = Math.abs(b.x - mask.x);
                        const yDiff = Math.abs(b.y - mask.y);
                        const halfW = mask.width / 2;
                        const halfH = mask.height / 2;
                        return xDiff <= halfW && yDiff <= halfH;
                    });
                    if (overlaps) {
                        return { ...b, backgroundColor: 'transparent', autoDetectBackground: false };
                    }
                    return b;
                });

                return {
                    ...p,
                    inpaintedBase64: cleanedBase64.replace(/^data:image\/\w+;base64,/, ""),
                    inpaintedUrl: cleanedBase64,
                    // If view was on "Final" (using url/base64), update them to point to new clean version?
                    // For now, let the Workspace logic handle "which to show", but update bubbles
                    bubbles: newBubbles,
                    maskRegions: newMasks,
                    inpaintingStatus: 'done'
                };
            }));

        } catch (e: any) {
            if (e.message?.includes('Aborted')) {
                setImages(prev => prev.map(p => p.id === img.id ? { ...p, inpaintingStatus: 'idle' } : p));
                return;
            }
            console.error("Inpaint Error for " + img.name, e);
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, inpaintingStatus: 'error' } : p));
        }
    };

    // --- Batch Managers ---

    const stopProcessing = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsProcessingBatch(false);
        }
    };

    const processQueue = async (queue: ImageState[], task: 'translate' | 'inpaint', concurrency: number) => {
        if (queue.length === 0) return;
        
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const signal = controller.signal;
        setIsProcessingBatch(true);

        try {
            const batchSize = Math.max(1, concurrency);
            for (let i = 0; i < queue.length; i += batchSize) {
                if (signal.aborted) break;
                const chunk = queue.slice(i, i + batchSize);
                if (task === 'translate') {
                    await Promise.all(chunk.map(img => runDetectionForImage(img, signal)));
                } else if (task === 'inpaint') {
                    // For batch inpaint, we force "onlyInpaintMethod: true"
                    await Promise.all(chunk.map(img => runInpaintingForImage(img, signal, { onlyInpaintMethod: true })));
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessingBatch(false);
            abortControllerRef.current = null;
        }
    };

    // --- Public Actions ---

    const handleBatchProcess = async (currentImage: ImageState | undefined, onlyCurrent: boolean, concurrency: number) => {
        if (isProcessingBatch) return;

        if (onlyCurrent && currentImage) {
            const controller = new AbortController();
            abortControllerRef.current = controller;
            setIsProcessingBatch(true);
            try {
                await runDetectionForImage(currentImage, controller.signal);
            } finally {
                setIsProcessingBatch(false);
                abortControllerRef.current = null;
            }
        } else {
            const queue = images.filter(img => !img.skipped && (img.status === 'idle' || img.status === 'error'));
            if (queue.length === 0) {
                alert("All images are already processed or skipped.");
                return;
            }
            await processQueue(queue, 'translate', concurrency);
        }
    };

    // Updated: Handle Batch Inpaint (Filtered by method='inpaint')
    const handleBatchInpaint = async (currentImage: ImageState | undefined, onlyCurrent: boolean, concurrency: number) => {
        if (isProcessingBatch) return;
        if (!aiConfig.enableInpainting) return;

        if (onlyCurrent && currentImage) {
            // For current image, we check if there are ANY 'inpaint' method masks
            const hasPurpleMasks = (currentImage.maskRegions || []).some(m => m.method === 'inpaint');

            if (!hasPurpleMasks) {
                alert("No masks marked as 'API Erase' (Purple) found on current image.");
                return;
            }
            const controller = new AbortController();
            abortControllerRef.current = controller;
            setIsProcessingBatch(true);
            try {
                await runInpaintingForImage(currentImage, controller.signal, { onlyInpaintMethod: true });
            } finally {
                setIsProcessingBatch(false);
                abortControllerRef.current = null;
            }
        } else {
            // Filter queue for images that have pending 'inpaint' masks
            const queue = images.filter(img => 
                !img.skipped && 
                (img.maskRegions || []).some(m => m.method === 'inpaint' && !m.isCleaned)
            );
            
            if (queue.length === 0) {
                alert("No images with uncleaned 'API Erase' masks found.");
                return;
            }
            await processQueue(queue, 'inpaint', concurrency);
        }
    };

    const handleResetStatus = () => {
        if (isProcessingBatch) return;
        const targets = images.filter(img => !img.skipped);
        if (targets.length === 0) return;

        const msg = aiConfig.language === 'zh' 
            ? `重置所有 ${targets.length} 张图片的状态？` 
            : `Reset status for all ${targets.length} images?`;

        if (confirm(msg)) {
             setImages(prev => prev.map(img => !img.skipped ? { 
                 ...img, 
                 status: 'idle', 
                 detectionStatus: 'idle',
                 inpaintingStatus: 'idle',
                 inpaintedUrl: undefined, // Reset inpaint layer on full reset? Maybe.
                 inpaintedBase64: undefined,
                 errorMessage: undefined 
             } : img));
        }
    };

    const handleLocalDetectionScan = async (currentImage: ImageState | undefined, batch: boolean, concurrency: number) => {
        if (!aiConfig.useTextDetectionApi || !aiConfig.textDetectionApiUrl) {
            alert("Please enable 'Local Text Detection' in Settings first.");
            return;
        }
        
        const targets = batch 
            ? images.filter(img => !img.skipped && img.detectionStatus !== 'done') 
            : (currentImage ? [currentImage] : []);

        if (targets.length === 0) {
            if (batch) alert("All images already scanned.");
            return;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsProcessingBatch(true);

        try {
            const batchSize = Math.max(1, concurrency);
            for (let i = 0; i < targets.length; i += batchSize) {
                if (controller.signal.aborted) break;
                const chunk = targets.slice(i, i + batchSize);
                
                await Promise.all(chunk.map(async (img) => {
                    setImages(prev => prev.map(p => p.id === img.id ? { ...p, detectionStatus: 'processing' } : p));
                    try {
                        const data = await fetchRawDetectedRegions(img.originalBase64 || img.base64, aiConfig.textDetectionApiUrl!);
                        
                        // Process Rects (Expansion Logic)
                        const expansion = aiConfig.detectionExpansionRatio || 0;
                        const expandedRegions = data.rects.map(r => {
                            const w = r.width * (1 + expansion);
                            const h = r.height * (1 + expansion);
                            return { ...r, width: w, height: h };
                        });

                        const maskRegions: MaskRegion[] = expandedRegions.map(r => ({
                            id: crypto.randomUUID(),
                            x: r.x, y: r.y, width: r.width, height: r.height,
                            method: 'fill' // Default local detection to fill
                        }));

                        // Process Mask (Refined Pixel Mask) - We store it but don't use it for auto-inpaint anymore
                        const maskRefinedBase64 = data.maskBase64;

                        setImages(prev => prev.map(p => p.id === img.id ? { 
                            ...p, 
                            maskRegions: [...(p.maskRegions || []), ...maskRegions],
                            maskRefinedBase64: maskRefinedBase64,
                            detectionStatus: 'done' 
                        } : p));
                    } catch (e) {
                        console.error(e);
                        setImages(prev => prev.map(p => p.id === img.id ? { ...p, detectionStatus: 'error' } : p));
                    }
                }));
            }
        } finally {
            setIsProcessingBatch(false);
            abortControllerRef.current = null;
        }
    };

    const handleGlobalColorDetection = async (concurrency: number = 1) => {
        if (isProcessingBatch) return;
        
        const targets = images.filter(img => !img.skipped && img.bubbles.length > 0);
        if (targets.length === 0) return;

        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsProcessingBatch(true);

        try {
            const batchSize = Math.max(1, concurrency);
            for (let i = 0; i < targets.length; i += batchSize) {
                if (controller.signal.aborted) break;
                const chunk = targets.slice(i, i + batchSize);
                
                await Promise.all(chunk.map(async (img) => {
                    setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'processing' } : p));
                    try {
                        const updatedBubbles = await Promise.all(img.bubbles.map(async (b) => {
                            const color = await detectBubbleColor(
                                img.originalUrl || img.url || `data:image/png;base64,${img.base64}`, 
                                b.x, b.y, b.width, b.height
                            );
                            return { ...b, backgroundColor: color };
                        }));
                        setImages(prev => prev.map(p => p.id === img.id ? { ...p, bubbles: updatedBubbles, status: 'done' } : p));
                    } catch (e) {
                         console.error("Global detection error", e);
                         setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'done' } : p));
                    }
                }));
            }
        } finally {
            setIsProcessingBatch(false);
            abortControllerRef.current = null;
        }
    };

    return {
        isProcessingBatch,
        handleBatchProcess,
        handleResetStatus,
        handleLocalDetectionScan,
        stopProcessing,
        handleGlobalColorDetection,
        handleBatchInpaint
    };
};
