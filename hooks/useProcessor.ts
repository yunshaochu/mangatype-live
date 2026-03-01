import { useState, useRef, useEffect } from 'react';
import { ImageState, AIConfig, APIEndpoint, MaskRegion, Bubble, mergeEndpointConfig } from '../types';
import { detectAndTypesetComic, fetchRawDetectedRegions } from '../services/geminiService';
import { generateMaskedImage, generateAnnotatedImage, detectBubbleColor, generateInpaintMask } from '../services/exportService';
import { inpaintImage } from '../services/inpaintingService';
import { isBubbleInsideMask } from '../utils/editorUtils';
import {
    EndpointFailureCode,
    EndpointProtectionEventType,
    classifyEndpointFailure,
    createEndpointProtectionEventQueue,
    FAILURE_CODE_UNKNOWN,
    handleEndpointError,
    handleEndpointSuccess,
    isEndpointPaused,
    getRemainingPauseTime,
    formatPauseDuration
} from '../services/apiProtection';
import { reduceEndpointProtectionState } from '../services/apiProtectionReducer';

interface UseProcessorProps {
    images: ImageState[];
    setImages: (newImagesOrUpdater: ImageState[] | ((prev: ImageState[]) => ImageState[]), skipHistory?: boolean) => void;
    aiConfig: AIConfig;
    updateEndpoint?: (endpointId: string, updates: Partial<APIEndpoint>) => void;
}

export const useProcessor = ({ images, setImages, aiConfig, updateEndpoint }: UseProcessorProps) => {
    const [isProcessingBatch, setIsProcessingBatch] = useState(false);
    const [processingType, setProcessingType] = useState<'translate' | 'scan' | 'inpaint' | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Always-fresh reference to latest aiConfig to avoid stale closure inside async workers.
    const aiConfigRef = useRef(aiConfig);
    useEffect(() => { aiConfigRef.current = aiConfig; }, [aiConfig]);
    const protectionEventQueueRef = useRef<ReturnType<typeof createEndpointProtectionEventQueue> | null>(null);
    const endpointEventSeqRef = useRef<Map<string, number>>(new Map());
    const inFlightControllersByEndpointRef = useRef<Map<string, Set<AbortController>>>(new Map());
    const previousEndpointEnabledRef = useRef<Map<string, boolean>>(
        new Map((aiConfig.endpoints || []).map(endpoint => [endpoint.id, endpoint.enabled]))
    );

    useEffect(() => {
        if (!updateEndpoint) {
            protectionEventQueueRef.current = null;
            endpointEventSeqRef.current.clear();
            return;
        }

        protectionEventQueueRef.current = createEndpointProtectionEventQueue({
            getEndpoint: (endpointId: string) => aiConfigRef.current.endpoints.find(ep => ep.id === endpointId),
            commitEndpoint: (endpointId: string, nextEndpoint: APIEndpoint) => {
                aiConfigRef.current = {
                    ...aiConfigRef.current,
                    endpoints: aiConfigRef.current.endpoints.map(ep => ep.id === endpointId ? nextEndpoint : ep),
                };
                updateEndpoint(endpointId, nextEndpoint);
            },
            log: (level, message) => {
                if (level === 'debug') {
                    console.log(message);
                    return;
                }
                console[level](message);
            },
        });

        return () => {
            protectionEventQueueRef.current?.clearAll();
            protectionEventQueueRef.current = null;
            endpointEventSeqRef.current.clear();
            inFlightControllersByEndpointRef.current.clear();
        };
    }, [updateEndpoint]);

    useEffect(() => {
        const activeEndpointIds = new Set((aiConfig.endpoints || []).map(ep => ep.id));
        protectionEventQueueRef.current?.prune(activeEndpointIds);
        for (const endpointId of endpointEventSeqRef.current.keys()) {
            if (!activeEndpointIds.has(endpointId)) {
                endpointEventSeqRef.current.delete(endpointId);
            }
        }

        for (const endpointId of inFlightControllersByEndpointRef.current.keys()) {
            if (!activeEndpointIds.has(endpointId)) {
                abortInFlightByEndpoint(endpointId, 'endpoint_disabled');
                inFlightControllersByEndpointRef.current.delete(endpointId);
            }
        }

        const nextEnabledMap = new Map((aiConfig.endpoints || []).map(endpoint => [endpoint.id, endpoint.enabled]));
        for (const [endpointId, enabled] of nextEnabledMap.entries()) {
            const previousEnabled = previousEndpointEnabledRef.current.get(endpointId);
            if ((previousEnabled ?? enabled) && !enabled) {
                abortInFlightByEndpoint(endpointId, 'endpoint_disabled');
            }
        }
        previousEndpointEnabledRef.current = nextEnabledMap;
    }, [aiConfig.endpoints]);

    const maxRetries = aiConfig.maxRetries || 0;

    const getNextEventSeq = (endpointId: string): number => {
        const endpoint = aiConfigRef.current.endpoints.find(ep => ep.id === endpointId);
        const persistedSeq = endpoint?.lastEventSeq ?? 0;
        const inMemorySeq = endpointEventSeqRef.current.get(endpointId) ?? 0;
        const nextSeq = Math.max(persistedSeq, inMemorySeq) + 1;
        endpointEventSeqRef.current.set(endpointId, nextSeq);
        return nextSeq;
    };

    const dispatchEndpointProtectionUpdate = (
        endpointId: string,
        eventType: EndpointProtectionEventType,
        apply: (endpoint: APIEndpoint) => APIEndpoint
    ): Promise<void> => {
        const queue = protectionEventQueueRef.current;
        if (!queue) return Promise.resolve();
        const eventSeq = getNextEventSeq(endpointId);
        return queue.enqueue({ endpointId, eventSeq, eventType, apply });
    };

    const createMergedAbortSignal = (signals: AbortSignal[]): AbortSignal => {
        const merged = new AbortController();
        const abort = (reason?: any) => {
            if (!merged.signal.aborted) {
                merged.abort(reason);
            }
        };

        for (const sig of signals) {
            if (sig.aborted) {
                abort(sig.reason);
                break;
            }
            sig.addEventListener('abort', () => abort(sig.reason), { once: true });
        }

        return merged.signal;
    };

    const registerInFlightController = (endpointId: string, controller: AbortController) => {
        const existing = inFlightControllersByEndpointRef.current.get(endpointId);
        if (existing) {
            existing.add(controller);
            return;
        }
        inFlightControllersByEndpointRef.current.set(endpointId, new Set([controller]));
    };

    const unregisterInFlightController = (endpointId: string, controller: AbortController) => {
        const existing = inFlightControllersByEndpointRef.current.get(endpointId);
        if (!existing) return;
        existing.delete(controller);
        if (existing.size === 0) {
            inFlightControllersByEndpointRef.current.delete(endpointId);
        }
    };

    const abortInFlightByEndpoint = (endpointId: string, reason: 'endpoint_trip' | 'endpoint_disabled') => {
        const controllers = inFlightControllersByEndpointRef.current.get(endpointId) as Set<AbortController> | undefined;
        if (!controllers || controllers.size === 0) return;
        for (const controller of controllers) {
            controller.abort(reason);
        }
    };

    // --- Core Logic: Process a Single Image (Translate/Bubble) ---
    const runDetectionForImage = async (
        img: ImageState,
        signal?: AbortSignal,
        configOverride?: AIConfig,
        endpointId?: string,
        protectionMode: 'request' | 'batch' = 'request'
    ): Promise<{ ok: boolean; protectableFailure: boolean; failureCode?: EndpointFailureCode; abortedByTrip?: boolean; abortedByDisable?: boolean }> => {
        const effectiveConfig = configOverride || aiConfig;
        const retries = effectiveConfig.maxRetries || maxRetries;

        for (let attempt = 0; attempt <= retries; attempt++) {
            if (signal?.aborted) {
                return {
                    ok: false,
                    protectableFailure: false,
                    abortedByTrip: signal.reason === 'endpoint_trip',
                    abortedByDisable: signal.reason === 'endpoint_disabled',
                };
            }
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'processing', errorMessage: attempt > 0 ? `Retry ${attempt}/${retries}...` : undefined } : p));

            try {
            // Always use original image for detection analysis
            let sourceBase64 = img.originalBase64 || img.base64;
            const useMaskedImage = effectiveConfig.enableMaskedImageMode && img.maskRegions && img.maskRegions.length > 0;
            const useAnnotatedImage = effectiveConfig.useMasksAsHints && effectiveConfig.drawMasksOnImage && img.maskRegions && img.maskRegions.length > 0;

            if (useMaskedImage) {
                sourceBase64 = await generateMaskedImage({ ...img, base64: sourceBase64 }, useAnnotatedImage);
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

            // Success: Reset endpoint error count
            if (protectionMode === 'request' && endpointId && updateEndpoint) {
                dispatchEndpointProtectionUpdate(endpointId, 'BATCH_SUCCEEDED', (endpoint) => handleEndpointSuccess(endpoint));
            }

            return { ok: true, protectableFailure: false }; // Success, exit retry loop

        } catch (e: any) {
            if (e?.name === 'AbortError' || signal?.aborted || (e.message && e.message.includes('Aborted'))) {
                setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'idle', errorMessage: undefined } : p));
                return {
                    ok: false,
                    protectableFailure: false,
                    abortedByTrip: signal?.reason === 'endpoint_trip',
                    abortedByDisable: signal?.reason === 'endpoint_disabled',
                };
            }
            console.error(`AI Error for ${img.name} (attempt ${attempt + 1}/${retries + 1})`, e);

            const protectionEnabled = aiConfigRef.current.apiProtectionEnabled ?? true;
            const failure = classifyEndpointFailure(e);
            const shouldProtectNow = protectionEnabled && failure.shouldProtect;

            // IMPORTANT: Protectable errors (429/503 etc.) should pause immediately and stop retrying,
            // otherwise we keep pressuring the provider.
            if (shouldProtectNow && endpointId && updateEndpoint && protectionMode === 'request') {
                const protectionConfig = {
                    durations: aiConfigRef.current.apiProtectionDurations,
                    disableThreshold: aiConfigRef.current.apiProtectionDisableThreshold,
                };
                dispatchEndpointProtectionUpdate(endpointId, 'REQUEST_FAILED', (endpoint) => {
                    const { updatedEndpoint, shouldDisable } = handleEndpointError(endpoint, e, protectionConfig);
                    if (shouldDisable) {
                        console.warn(`Endpoint ${endpoint.name} auto-disabled due to repeated errors`);
                    }
                    return updatedEndpoint;
                });

                setImages(prev => prev.map(p => p.id === img.id ? {
                    ...p,
                    status: 'error',
                    errorMessage: e.message || 'Rate limited - endpoint paused'
                } : p));
                return { ok: false, protectableFailure: true, failureCode: failure.code };
            }

            if (shouldProtectNow && protectionMode === 'batch') {
                setImages(prev => prev.map(p => p.id === img.id ? {
                    ...p,
                    status: 'error',
                    errorMessage: e.message || 'Rate limited - endpoint paused'
                } : p));
                return { ok: false, protectableFailure: true, failureCode: failure.code };
            }

            // Non-protectable errors: only update protection state on last attempt
            if (attempt === retries && endpointId && updateEndpoint && protectionEnabled && protectionMode === 'request') {
                const protectionConfig = {
                    durations: aiConfigRef.current.apiProtectionDurations,
                    disableThreshold: aiConfigRef.current.apiProtectionDisableThreshold,
                };
                dispatchEndpointProtectionUpdate(endpointId, 'REQUEST_FAILED', (endpoint) => {
                    const { updatedEndpoint } = handleEndpointError(endpoint, e, protectionConfig);
                    return updatedEndpoint;
                });
            }

            if (attempt < retries) {
                // Wait before retry (exponential backoff: 1s, 2s, 4s...)
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                continue;
            }
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, status: 'error', errorMessage: e.message || 'Unknown error occurred' } : p));
            return { ok: false, protectableFailure: shouldProtectNow, failureCode: failure.code };
        }
        } // end retry loop
        return { ok: false, protectableFailure: false };
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
            const enabledEndpoints = (aiConfigRef.current.endpoints || []).filter(ep => ep.enabled);

            const useStateMachineV2 = aiConfigRef.current.apiProtectionStateMachineV2 ?? false;

            if (task === 'translate' && enabledEndpoints.length > 0 && useStateMachineV2) {
                const availableNow = enabledEndpoints.filter(ep => !isEndpointPaused(ep));
                if (availableNow.length === 0) {
                    const pausedInfo = enabledEndpoints.map(ep => {
                        const remaining = getRemainingPauseTime(ep);
                        return `${ep.name}: ${formatPauseDuration(remaining)}`;
                    }).join(', ');
                    alert(`All endpoints are paused. Wait time: ${pausedInfo}`);
                    return;
                }

                const pendingQueue = [...queue];
                const inFlightByEndpoint = new Map<
                    string,
                    Map<string, { img: ImageState; epoch: number; controller: AbortController }>
                >();
                const runtimeByEndpoint = new Map<
                    string,
                    { epoch: number; trippedEpoch: number | null; epochRequestCount: number; successNotifiedEpoch: number | null }
                >();
                const activeTasks = new Set<Promise<void>>();
                let noEnabledEndpointNotified = false;

                const getRuntime = (endpoint: APIEndpoint) => {
                    const existing = runtimeByEndpoint.get(endpoint.id);
                    if (existing) return existing;
                    const created = {
                        epoch: Math.max(1, endpoint.protectionEpoch || 1),
                        trippedEpoch: null as number | null,
                        epochRequestCount: 0,
                        successNotifiedEpoch: null as number | null,
                    };
                    runtimeByEndpoint.set(endpoint.id, created);
                    return created;
                };

                const getInFlight = (endpointId: string) => {
                    const existing = inFlightByEndpoint.get(endpointId);
                    if (existing) return existing;
                    const created = new Map<string, { img: ImageState; epoch: number; controller: AbortController }>();
                    inFlightByEndpoint.set(endpointId, created);
                    return created;
                };

                const startRequest = (endpoint: APIEndpoint, img: ImageState, requestEpoch: number) => {
                    const runtime = getRuntime(endpoint);
                    runtime.epochRequestCount += 1;

                    const endpointInFlight = getInFlight(endpoint.id);
                    const requestController = new AbortController();
                    endpointInFlight.set(img.id, { img, epoch: requestEpoch, controller: requestController });
                    registerInFlightController(endpoint.id, requestController);
                    const mergedSignal = createMergedAbortSignal([signal, requestController.signal]);
                    const mergedConfig = mergeEndpointConfig(aiConfigRef.current, endpoint);

                    const task = (async () => {
                        let result:
                            | { ok: boolean; protectableFailure: boolean; failureCode?: EndpointFailureCode; abortedByTrip?: boolean; abortedByDisable?: boolean }
                            | undefined;
                        try {
                            result = await runDetectionForImage(img, mergedSignal, mergedConfig, endpoint.id, 'batch');
                        } finally {
                            endpointInFlight.delete(img.id);
                            unregisterInFlightController(endpoint.id, requestController);
                        }

                        if (signal.aborted) return;
                        if (!result) return;

                        const latestEndpoint = aiConfigRef.current.endpoints.find(ep => ep.id === endpoint.id);
                        if (!latestEndpoint) return;
                        const latestRuntime = getRuntime(latestEndpoint);

                        if (result.abortedByTrip || result.abortedByDisable) {
                            pendingQueue.unshift(img);
                            return;
                        }

                        if (result.protectableFailure) {
                            if (latestRuntime.trippedEpoch === requestEpoch || latestRuntime.epoch !== requestEpoch) {
                                return;
                            }

                            latestRuntime.trippedEpoch = requestEpoch;
                            const failureCode = result.failureCode || FAILURE_CODE_UNKNOWN;
                            abortInFlightByEndpoint(endpoint.id, 'endpoint_trip');

                            const now = Date.now();
                            const pauseDurationsMs = (aiConfigRef.current.apiProtectionDurations || []).map(d => d * 1000);
                            const disableThreshold = aiConfigRef.current.apiProtectionDisableThreshold || 5;
                            await dispatchEndpointProtectionUpdate(endpoint.id, 'BATCH_FAILED', current =>
                                reduceEndpointProtectionState(current, {
                                    type: 'BATCH_FAILED',
                                    now,
                                    pauseDurationsMs,
                                    disableThreshold,
                                    failureCodes: [failureCode],
                                    failedRequestCount: 1,
                                    totalRequestCount: Math.max(1, latestRuntime.epochRequestCount),
                                })
                            );
                            latestRuntime.epoch += 1;
                            latestRuntime.epochRequestCount = 0;
                            latestRuntime.successNotifiedEpoch = null;
                            return;
                        }

                        if (result.ok) {
                            const refreshedEndpoint = aiConfigRef.current.endpoints.find(ep => ep.id === endpoint.id);
                            if (!refreshedEndpoint) return;
                            const isDegraded = refreshedEndpoint.protectionMode === 'degraded';
                            if (isDegraded && latestRuntime.successNotifiedEpoch !== requestEpoch) {
                                latestRuntime.successNotifiedEpoch = requestEpoch;
                                await dispatchEndpointProtectionUpdate(endpoint.id, 'BATCH_SUCCEEDED', current =>
                                    reduceEndpointProtectionState(current, {
                                        type: 'BATCH_SUCCEEDED',
                                        now: Date.now(),
                                        totalRequestCount: Math.max(1, latestRuntime.epochRequestCount),
                                    })
                                );
                            }
                        }
                    })()
                        .catch((error: any) => {
                            console.error('endpoint request task failed', error);
                        })
                        .finally(() => {
                            activeTasks.delete(task);
                        });

                    activeTasks.add(task);
                };

                while (!signal.aborted) {
                    const availableEndpoints = (aiConfigRef.current.endpoints || [])
                        .filter(ep => ep.enabled && !isEndpointPaused(ep));

                    for (const endpoint of availableEndpoints) {
                        const runtime = getRuntime(endpoint);
                        const endpointInFlight = getInFlight(endpoint.id);
                        if (runtime.trippedEpoch === runtime.epoch) {
                            continue;
                        }
                        const effectiveConcurrency = Math.max(1, endpoint.effectiveConcurrency || endpoint.concurrency || 1);
                        while (endpointInFlight.size < effectiveConcurrency && pendingQueue.length > 0) {
                            const nextImg = pendingQueue.shift();
                            if (!nextImg) break;
                            startRequest(endpoint, nextImg, runtime.epoch);
                        }
                    }

                    const inFlightCount = Array.from(inFlightByEndpoint.values()).reduce((sum, map) => sum + map.size, 0);
                    if (pendingQueue.length === 0 && inFlightCount === 0) {
                        break;
                    }
                    if (pendingQueue.length > 0 && inFlightCount === 0 && availableEndpoints.length === 0) {
                        const hasEnabledEndpoints = (aiConfigRef.current.endpoints || []).some(ep => ep.enabled);
                        if (!hasEnabledEndpoints) {
                            if (!noEnabledEndpointNotified) {
                                alert('No enabled endpoints available');
                                noEnabledEndpointNotified = true;
                            }
                            break;
                        }
                    }

                    await new Promise(r => setTimeout(r, 60));
                }

                if (activeTasks.size > 0) {
                    await Promise.allSettled(Array.from(activeTasks));
                }
            } else if (task === 'translate' && enabledEndpoints.length > 0) {
                const availableNow = enabledEndpoints.filter(ep => !isEndpointPaused(ep));
                if (availableNow.length === 0) {
                    const pausedInfo = enabledEndpoints.map(ep => {
                        const remaining = getRemainingPauseTime(ep);
                        return `${ep.name}: ${formatPauseDuration(remaining)}`;
                    }).join(', ');
                    alert(`All endpoints are paused. Wait time: ${pausedInfo}`);
                    return;
                }

                const inFlight = new Map<string, number>();
                const retryQueue: ImageState[] = [];
                let noEnabledEndpointNotified = false;
                const pickEndpoint = (): APIEndpoint | null => {
                    const latest = (aiConfigRef.current.endpoints || [])
                        .filter(ep => ep.enabled && !isEndpointPaused(ep))
                        .filter(ep => (inFlight.get(ep.id) || 0) < Math.max(1, ep.concurrency || 1));
                    if (latest.length === 0) return null;
                    return latest.reduce((best, ep) =>
                        (inFlight.get(ep.id) || 0) < (inFlight.get(best.id) || 0) ? ep : best
                    );
                };

                const totalWorkers = Math.max(
                    1,
                    enabledEndpoints.reduce((sum, ep) => sum + Math.max(1, ep.concurrency || 1), 0)
                );

                let nextIndex = 0;
                const worker = async () => {
                    while (!signal.aborted) {
                        const endpoint = pickEndpoint();
                        if (!endpoint) {
                            const hasEnabledEndpoints = (aiConfigRef.current.endpoints || []).some(ep => ep.enabled);
                            const inFlightTotal = Array.from(inFlight.values()).reduce((sum, count) => sum + count, 0);
                            if (!hasEnabledEndpoints && inFlightTotal === 0) {
                                if (!noEnabledEndpointNotified) {
                                    alert('No enabled endpoints available');
                                    noEnabledEndpointNotified = true;
                                }
                                return;
                            }
                            await new Promise(r => setTimeout(r, 120));
                            continue;
                        }

                        let img = retryQueue.shift();
                        if (!img) {
                            const idx = nextIndex++;
                            if (idx >= queue.length) {
                                const inFlightTotal = Array.from(inFlight.values()).reduce((sum, count) => sum + count, 0);
                                if (retryQueue.length === 0 && inFlightTotal === 0) return;
                                await new Promise(r => setTimeout(r, 80));
                                continue;
                            }
                            img = queue[idx];
                        }

                        inFlight.set(endpoint.id, (inFlight.get(endpoint.id) || 0) + 1);
                        const requestController = new AbortController();
                        registerInFlightController(endpoint.id, requestController);
                        const mergedSignal = createMergedAbortSignal([signal, requestController.signal]);
                        const mergedConfig = mergeEndpointConfig(aiConfigRef.current, endpoint);
                        try {
                            const result = await runDetectionForImage(img, mergedSignal, mergedConfig, endpoint.id, 'request');
                            if (result.abortedByDisable) {
                                retryQueue.push(img);
                            }
                        } finally {
                            unregisterInFlightController(endpoint.id, requestController);
                            inFlight.set(endpoint.id, Math.max(0, (inFlight.get(endpoint.id) || 1) - 1));
                        }
                    }
                };

                const workers = Array.from({ length: totalWorkers }, () => worker());
                await Promise.all(workers);
            } else {
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
                const firstEndpoint = (aiConfigRef.current.endpoints || []).find(ep => ep.enabled && !isEndpointPaused(ep));

                if (!firstEndpoint) {
                    const pausedEndpoint = (aiConfigRef.current.endpoints || []).find(ep => ep.enabled);
                    if (pausedEndpoint) {
                        const remaining = getRemainingPauseTime(pausedEndpoint);
                        alert(`Endpoint is paused. Wait time: ${formatPauseDuration(remaining)}`);
                    } else {
                        alert('No enabled endpoints available');
                    }
                    return;
                }

                const mergedConfig = mergeEndpointConfig(aiConfigRef.current, firstEndpoint);
                const endpointController = new AbortController();
                registerInFlightController(firstEndpoint.id, endpointController);
                const mergedSignal = createMergedAbortSignal([controller.signal, endpointController.signal]);
                try {
                    await runDetectionForImage(currentImage, mergedSignal, mergedConfig, firstEndpoint.id);
                } finally {
                    unregisterInFlightController(firstEndpoint.id, endpointController);
                }
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
                 bubbles: [],
                 inpaintedUrl: undefined,
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
