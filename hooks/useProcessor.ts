import { useState, useRef } from 'react';
import { ImageState, AIConfig, APIEndpoint, MaskRegion, Bubble, mergeEndpointConfig } from '../types';
import { detectAndTypesetComic, fetchRawDetectedRegions } from '../services/geminiService';
import { generateMaskedImage, generateAnnotatedImage, detectBubbleColor, generateInpaintMask } from '../services/exportService';
import { inpaintImage } from '../services/inpaintingService';
import { isBubbleInsideMask } from '../utils/editorUtils';

interface UseProcessorProps {
    images: ImageState[];
    setImages: (newImagesOrUpdater: ImageState[] | ((prev: ImageState[]) => ImageState[]), skipHistory?: boolean) => void;
    aiConfig: AIConfig;
}

export const useProcessor = ({ images, setImages, aiConfig }: UseProcessorProps) => {
    const [isProcessingBatch, setIsProcessingBatch] = useState(false);
    const [processingType, setProcessingType] = useState<'translate' | 'scan' | 'inpaint' | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const maxRetries = aiConfig.maxRetries || 0;

    // --- Core Logic: Process a Single Image (Translate/Bubble) ---
    const runDetectionForImage = async (img: ImageState, signal?: AbortSignal, configOverride?: AIConfig) => {
        const effectiveConfig = configOverride || aiConfig;
        const retries = effectiveConfig.maxRetries || maxRetries;

        for (let attempt = 0; attempt <= retries; attempt++) {
            if (signal?.aborted) return;
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'processing', errorMessage: attempt > 0 ? `Retry ${attempt}/${retries}...` : undefined } : p));

            try {
            // Always use original image for detection analysis
            let sourceBase64 = img.originalBase64 || img.base64;
            const useMaskedImage = effectiveConfig.enableMaskedImageMode && img.maskRegions && img.maskRegions.length > 0;
            const useAnnotatedImage = effectiveConfig.useMasksAsHints && effectiveConfig.drawMasksOnImage && img.maskRegions && img.maskRegions.length > 0;

            if (useMaskedImage) {
                sourceBase64 = await generateMaskedImage({ ...img, base64: sourceBase64 });
            } else if (useAnnotatedImage) {
                sourceBase64 = await generateAnnotatedImage({ ...img, base64: sourceBase64 });
            }

            const detected = await detectAndTypesetComic(sourceBase64, effectiveConfig, signal, img.maskRegions);
            let finalDetected = detected;

            if (effectiveConfig.enableDialogSnap) {
                if (img.maskRegions && img.maskRegions.length > 0) {
                    // Build all (bubble, mask, distance) pairs within threshold
                    const pairs: { bi: number; mi: number; dist: number }[] = [];
                    detected.forEach((b, bi) => {
                        img.maskRegions!.forEach((mask, mi) => {
                            const dist = Math.sqrt(Math.pow(b.x - mask.x, 2) + Math.pow(b.y - mask.y, 2));
                            if (dist < 15) pairs.push({ bi, mi, dist });
                        });
                    });
                    // Sort by distance so closest pairs match first
                    pairs.sort((a, b) => a.dist - b.dist);

                    // Greedy one-to-one matching: each bubble and each mask used at most once
                    const usedBubbles = new Set<number>();
                    const usedMasks = new Set<number>();
                    const bubbleUpdates = new Map<number, MaskRegion>();

                    for (const p of pairs) {
                        if (usedBubbles.has(p.bi) || usedMasks.has(p.mi)) continue;
                        usedBubbles.add(p.bi);
                        usedMasks.add(p.mi);
                        bubbleUpdates.set(p.bi, img.maskRegions![p.mi]);
                    }

                    finalDetected = detected.map((b, i) => {
                        const mask = bubbleUpdates.get(i);
                        if (!mask) return b;
                        const updates: any = { x: mask.x, y: mask.y };
                        if (effectiveConfig.forceSnapSize) {
                            updates.width = mask.width;
                            updates.height = mask.height;
                        }
                        return { ...b, ...updates };
                    });
                }
            }

            // Check for cleaned masks BEFORE color detection to avoid unnecessary work
            const cleanedMasks = (img.maskRegions || []).filter(m => m.isCleaned);

            const processedBubbles = await Promise.all(finalDetected.map(async (d) => {
                // First check if this bubble overlaps with any cleaned mask
                const overlapsCleanedMask = cleanedMasks.some(m => isBubbleInsideMask(d.x, d.y, m.x, m.y, m.width, m.height));

                // If overlapping cleaned mask, skip color detection and use transparent
                let color = '#ffffff';
                if (!overlapsCleanedMask && effectiveConfig.autoDetectBackground !== false) {
                    color = await detectBubbleColor(
                        img.originalUrl || img.url || `data:image/png;base64,${img.base64}`,
                        d.x, d.y, d.width, d.height
                    );
                }

                return {
                    id: crypto.randomUUID(),
                    x: d.x, y: d.y, width: d.width, height: d.height,
                    text: d.text, isVertical: d.isVertical,
                    fontFamily: (d.fontFamily as any) || effectiveConfig.defaultFontFamily || 'noto',
                    fontSize: (() => {
                        if (effectiveConfig.allowAiFontSize !== false) {
                            if (effectiveConfig.fontSizeMode === 'direct' && d.fontSize != null) {
                                return Math.max(0.5, Math.min(5.0, d.fontSize));
                            } else if (d.fontScale) {
                                const entries = effectiveConfig.fontScaleEntries || [
                                    { label: 'tiny', value: 0.5 }, { label: 'small', value: 0.7 },
                                    { label: 'normal', value: 1.0 }, { label: 'large', value: 1.3 },
                                    { label: 'huge', value: 1.8 }, { label: 'extreme', value: 2.5 },
                                ];
                                const match = entries.find(e => e.label === d.fontScale);
                                return match?.value ?? effectiveConfig.defaultFontSize;
                            }
                        }
                        return effectiveConfig.defaultFontSize;
                    })(),
                    color: d.color || effectiveConfig.defaultTextColor || '#000000',
                    strokeColor: d.strokeColor || effectiveConfig.defaultStrokeColor || '#ffffff',
                    backgroundColor: overlapsCleanedMask ? 'transparent' : color,
                    rotation: d.rotation || 0,
                    letterSpacing: effectiveConfig.defaultLetterSpacing ?? 0.15,
                    lineHeight: effectiveConfig.defaultLineHeight ?? 1.1,
                    maskShape: effectiveConfig.defaultMaskShape,
                    maskCornerRadius: effectiveConfig.defaultMaskCornerRadius,
                    maskFeather: effectiveConfig.defaultMaskFeather,
                    autoDetectBackground: false // Explicitly set to prevent later auto-detection from overriding
                } as Bubble;
            }));

            setImages(prev => prev.map(p => p.id === img.id ? {
                ...p,
                bubbles: useMaskedImage ? [...p.bubbles, ...processedBubbles] : processedBubbles,
                status: 'done'
            } : p));
            return; // Success, exit retry loop

        } catch (e: any) {
            if (e.message && e.message.includes('Aborted')) {
                setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'idle', errorMessage: undefined } : p));
                return;
            }
            console.error(`AI Error for ${img.name} (attempt ${attempt + 1}/${retries + 1})`, e);
            if (attempt < retries) {
                // Wait before retry (exponential backoff: 1s, 2s, 4s...)
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                continue;
            }
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'error', errorMessage: e.message || 'Unknown error occurred' } : p));
        }
        } // end retry loop
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

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (signal?.aborted) return;
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
                        const overlaps = relevantMasks.some(mask => isBubbleInsideMask(b.x, b.y, mask.x, mask.y, mask.width, mask.height));
                        if (overlaps) {
                            return { ...b, backgroundColor: 'transparent', autoDetectBackground: false };
                        }
                        return b;
                    });

                    return {
                        ...p,
                        inpaintedBase64: cleanedBase64.replace(/^data:image\/\w+;base64,/, ""),
                        inpaintedUrl: cleanedBase64,
                        bubbles: newBubbles,
                        maskRegions: newMasks,
                        inpaintingStatus: 'done'
                    };
                }));
                return; // Success, exit retry loop

            } catch (e: any) {
                if (e.message?.includes('Aborted')) {
                    setImages(prev => prev.map(p => p.id === img.id ? { ...p, inpaintingStatus: 'idle' } : p));
                    return;
                }
                console.error(`Inpaint Error for ${img.name} (attempt ${attempt + 1}/${maxRetries + 1})`, e);
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                    continue;
                }
                setImages(prev => prev.map(p => p.id === img.id ? { ...p, inpaintingStatus: 'error' } : p));
            }
        } // end retry loop
    };

    // --- Batch Managers ---

    const stopProcessing = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsProcessingBatch(false);
            setProcessingType(null);
        }
    };

    const processQueue = async (queue: ImageState[], task: 'translate' | 'inpaint', concurrency: number) => {
        if (queue.length === 0) return;

        const controller = new AbortController();
        abortControllerRef.current = controller;
        const signal = controller.signal;
        setIsProcessingBatch(true);
        setProcessingType(task);

        try {
            const enabledEndpoints = (aiConfig.endpoints || []).filter(ep => ep.enabled);

            if (task === 'translate' && enabledEndpoints.length > 0) {
                // Worker-per-endpoint round-robin for translation
                let nextIndex = 0;
                const worker = async (endpoint: APIEndpoint) => {
                    while (!signal.aborted) {
                        const idx = nextIndex++;
                        if (idx >= queue.length) return;
                        const mergedConfig = mergeEndpointConfig(aiConfig, endpoint);
                        await runDetectionForImage(queue[idx], signal, mergedConfig);
                    }
                };
                await Promise.all(enabledEndpoints.map(ep => worker(ep)));
            } else {
                // Inpaint or no endpoints: use original chunk-based concurrency
                const batchSize = Math.max(1, concurrency);
                for (let i = 0; i < queue.length; i += batchSize) {
                    if (signal.aborted) break;
                    const chunk = queue.slice(i, i + batchSize);
                    if (task === 'translate') {
                        await Promise.all(chunk.map(img => runDetectionForImage(img, signal)));
                    } else if (task === 'inpaint') {
                        await Promise.all(chunk.map(img => runInpaintingForImage(img, signal, { onlyInpaintMethod: true })));
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessingBatch(false);
            setProcessingType(null);
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
            setProcessingType('translate');
            try {
                const firstEndpoint = (aiConfig.endpoints || []).find(ep => ep.enabled);
                const mergedConfig = firstEndpoint ? mergeEndpointConfig(aiConfig, firstEndpoint) : aiConfig;
                await runDetectionForImage(currentImage, controller.signal, mergedConfig);
            } finally {
                setIsProcessingBatch(false);
                setProcessingType(null);
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
            setProcessingType('inpaint');
            try {
                await runInpaintingForImage(currentImage, controller.signal, { onlyInpaintMethod: true });
            } finally {
                setIsProcessingBatch(false);
                setProcessingType(null);
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
        setProcessingType('scan');

        try {
            const batchSize = Math.max(1, concurrency);
            for (let i = 0; i < targets.length; i += batchSize) {
                if (controller.signal.aborted) break;
                const chunk = targets.slice(i, i + batchSize);

                await Promise.all(chunk.map(async (img) => {
                    for (let attempt = 0; attempt <= maxRetries; attempt++) {
                        if (controller.signal.aborted) return;
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
                            return; // Success
                        } catch (e) {
                            console.error(`Scan error for ${img.name} (attempt ${attempt + 1}/${maxRetries + 1})`, e);
                            if (attempt < maxRetries) {
                                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                                continue;
                            }
                            setImages(prev => prev.map(p => p.id === img.id ? { ...p, detectionStatus: 'error' } : p));
                        }
                    }
                }));
            }
        } finally {
            setIsProcessingBatch(false);
            setProcessingType(null);
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
        processingType,
        handleBatchProcess,
        handleResetStatus,
        handleLocalDetectionScan,
        stopProcessing,
        handleGlobalColorDetection,
        handleBatchInpaint
    };
};