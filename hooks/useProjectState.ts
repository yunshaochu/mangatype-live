

import { useState, useRef, useEffect, useCallback } from 'react';
import { ImageState } from '../types';

export const useProjectState = () => {
  const [history, setHistory] = useState<{
    past: ImageState[][];
    present: ImageState[];
    future: ImageState[][];
  }>({ past: [], present: [], future: [] });

  const historyRef = useRef(history);
  historyRef.current = history;

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);

  const images = history.present;
  const currentImage = images.find(img => img.id === currentId);

  // Helper: Smart Setter that manages history
  const setImages = useCallback((
    newImagesOrUpdater: ImageState[] | ((prev: ImageState[]) => ImageState[]),
    skipHistory: boolean = false
  ) => {
    setHistory(curr => {
      const newPresent = typeof newImagesOrUpdater === 'function' ? newImagesOrUpdater(curr.present) : newImagesOrUpdater;
      if (newPresent === curr.present) return curr;
      if (skipHistory) return { ...curr, present: newPresent };
      return {
        past: [...curr.past, curr.present].slice(-20), // Limit history to 20 steps
        present: newPresent,
        future: []
      };
    });
  }, []);

  // Actions
  const handleUndo = useCallback(() => {
    setHistory(curr => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      return {
        past: curr.past.slice(0, curr.past.length - 1),
        present: previous,
        future: [curr.present, ...curr.future]
      };
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistory(curr => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: curr.future.slice(1)
      };
    });
  }, []);

  const deleteCurrentSelection = useCallback(() => {
      if (!currentId) return;
      if (selectedBubbleId) {
          setImages(prev => prev.map(img => img.id === currentId ? { ...img, bubbles: img.bubbles.filter(b => b.id !== selectedBubbleId) } : img));
          setSelectedBubbleId(null);
      } else if (selectedMaskId) {
          setImages(prev => prev.map(img => img.id === currentId ? { ...img, maskRegions: (img.maskRegions || []).filter(m => m.id !== selectedMaskId) } : img));
          setSelectedMaskId(null);
      }
  }, [currentId, selectedBubbleId, selectedMaskId, setImages]);

  const navigateImage = useCallback((direction: 'prev' | 'next') => {
      if (!currentId) return;
      const currentIndex = images.findIndex(img => img.id === currentId);
      if (direction === 'prev' && currentIndex > 0) {
          setCurrentId(images[currentIndex - 1].id);
          setSelectedBubbleId(null); setSelectedMaskId(null);
      } else if (direction === 'next' && currentIndex < images.length - 1) {
          setCurrentId(images[currentIndex + 1].id);
          setSelectedBubbleId(null); setSelectedMaskId(null);
      }
  }, [currentId, images]);

  // File Import Logic
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const processFiles = async (inputFiles: FileList | File[]) => {
    const files = Array.from(inputFiles);
    const newImages: ImageState[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      try {
        const url = URL.createObjectURL(file);
        const base64 = await blobToBase64(file);
        const loadedImgState = await new Promise<ImageState | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve({
              id: crypto.randomUUID(), name: file.name, 
              url, base64, // Current display (starts as original)
              originalUrl: url, originalBase64: base64, // Persistent original
              width: img.width, height: img.height, bubbles: [], maskRegions: [],
              status: 'idle', detectionStatus: 'idle', inpaintingStatus: 'idle', skipped: false
            });
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
        if (loadedImgState) newImages.push(loadedImgState);
      } catch (e) { console.error("Failed to read file", file.name, e); }
    }

    if (newImages.length > 0) {
      setImages(prev => {
        const combined = [...prev, ...newImages];
        return combined.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      });
      if (!currentId && newImages.length > 0) setCurrentId(newImages[0].id);
    }
  };

  // Setup Global Listeners (Paste / DragDrop)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => { if (e.clipboardData?.files?.length) processFiles(e.clipboardData.files); };
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer?.files?.length) processFiles(e.dataTransfer.files); };
    window.addEventListener('paste', handlePaste);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []); // Dependencies empty to run once

  return {
      history,
      setHistory,
      images,
      setImages,
      currentId,
      setCurrentId,
      currentImage,
      selectedBubbleId,
      setSelectedBubbleId,
      selectedMaskId,
      setSelectedMaskId,
      processFiles,
      handleUndo,
      handleRedo,
      deleteCurrentSelection,
      navigateImage,
      historyRef // Exposed for async access if needed
  };
};