



import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, CheckCircle, Loader2, XCircle, Ban, FilePlus, FolderPlus, ScanText, AlertTriangle, Eraser, Check, Download, RefreshCw, CheckSquare } from 'lucide-react';
import { t } from '../services/i18n';
import { useProjectContext } from '../contexts/ProjectContext';
import { downloadAllAsZip, ExportOptions } from '../services/exportService';

interface GalleryProps {
  onAddFile: () => void;
  onAddFolder: () => void;
}

export const Gallery: React.FC<GalleryProps> = ({ onAddFile, onAddFolder }) => {
  const {
    images, currentId, setCurrentId, setImages,
    aiConfig,
  } = useProjectContext();

  const [clearStage, setClearStage] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lang = aiConfig.language || 'zh';
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedId = useRef<string | null>(null);

  // Clean up selectedIds when images change (e.g. external deletion)
  useEffect(() => {
    setSelectedIds(prev => {
      const imageIdSet = new Set(images.map(i => i.id));
      const filtered = new Set([...prev].filter(id => imageIdSet.has(id)));
      if (filtered.size === 0 && selectMode) { /* keep mode even if empty */ }
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [images]);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleThumbnailClick = (e: React.MouseEvent, id: string) => {
    // Ctrl/Meta click: enter select mode + toggle
    if (e.ctrlKey || e.metaKey) {
      if (!selectMode) setSelectMode(true);
      toggleSelect(id);
      lastClickedId.current = id;
      return;
    }
    // Shift click: enter select mode + range select
    if (e.shiftKey && lastClickedId.current) {
      if (!selectMode) setSelectMode(true);
      const ids = images.map(i => i.id);
      const a = ids.indexOf(lastClickedId.current);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [start, end] = a < b ? [a, b] : [b, a];
        const range = ids.slice(start, end + 1);
        setSelectedIds(prev => {
          const next = new Set(prev);
          range.forEach(rid => next.add(rid));
          return next;
        });
      }
      return;
    }
    // In select mode: plain click toggles selection
    if (selectMode) {
      toggleSelect(id);
      lastClickedId.current = id;
      return;
    }
    // Normal mode: switch current image
    setCurrentId(id);
    lastClickedId.current = id;
  };

  const onDelete = (id: string) => {
    setImages(prev => prev.filter(i => i.id !== id));
    if (currentId === id) setCurrentId(null);
  };

  const onToggleSkip = (id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, skipped: !img.skipped } : img));
  };

  const onClearAll = () => { setImages([]); setCurrentId(null); exitSelectMode(); };

  // Batch operations
  const handleBatchDelete = () => {
    setImages(prev => prev.filter(i => !selectedIds.has(i.id)));
    if (currentId && selectedIds.has(currentId)) setCurrentId(null);
    setSelectedIds(new Set());
    // Stay in select mode after delete
  };

  const handleBatchSkip = () => {
    const selectedImages = images.filter(i => selectedIds.has(i.id));
    const allSkipped = selectedImages.every(i => i.skipped);
    setImages(prev => prev.map(img => selectedIds.has(img.id) ? { ...img, skipped: !allSkipped } : img));
  };

  const handleBatchExport = async () => {
    const selectedImages = images.filter(i => selectedIds.has(i.id));
    if (selectedImages.length === 0) return;
    await downloadAllAsZip(selectedImages, undefined, {
        defaultMaskShape: aiConfig.defaultMaskShape,
        defaultMaskCornerRadius: aiConfig.defaultMaskCornerRadius,
        defaultMaskFeather: aiConfig.defaultMaskFeather,
        exportMethod: aiConfig.exportMethod || 'canvas',
        screenshotPunctuationOffsets: aiConfig.screenshotPunctuationOffsets,
    });
  };

  const handleBatchResetStatus = () => {
    setImages(prev => prev.map(img => selectedIds.has(img.id) ? {
      ...img,
      status: 'idle',
      detectionStatus: 'idle',
      inpaintingStatus: 'idle',
      errorMessage: undefined
    } : img));
  };

  const enterSelectMode = () => {
    if (images.length === 0) return;
    setSelectMode(true);
  };

  const handleClearClick = () => {
    if (clearStage === 0) {
      setClearStage(1);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setClearStage(0);
      }, 3000);
    } else {
      onClearAll();
      setClearStage(0);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  };

  useEffect(() => {
    return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Auto-scroll to current thumbnail when currentId changes (e.g. arrow key navigation)
  useEffect(() => {
    if (!currentId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-gallery-id="${currentId}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentId]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Batch action bar */}
      {selectMode ? (
        <div className="flex items-center gap-1.5 p-2 border-b border-blue-700 bg-blue-900/60 sticky top-0 z-10 shrink-0">
          <span className="text-xs font-bold text-blue-200 mr-auto">{selectedIds.size > 0 ? t('selectedCount', lang).replace('{n}', String(selectedIds.size)) : t('batchSelect', lang)}</span>
          <button onClick={handleBatchDelete} disabled={selectedIds.size === 0} className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-200 hover:bg-red-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={t('deleteSelected', lang)}>
            <Trash2 size={12} />
          </button>
          <button onClick={handleBatchSkip} disabled={selectedIds.size === 0} className="text-xs px-2 py-1 rounded bg-yellow-900/50 text-yellow-200 hover:bg-yellow-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={images.filter(i => selectedIds.has(i.id)).every(i => i.skipped) ? t('unskipSelected', lang) : t('skipSelected', lang)}>
            <Ban size={12} />
          </button>
          <button onClick={handleBatchExport} disabled={selectedIds.size === 0} className="text-xs px-2 py-1 rounded bg-green-900/50 text-green-200 hover:bg-green-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={t('exportSelected', lang)}>
            <Download size={12} />
          </button>
          <button onClick={handleBatchResetStatus} disabled={selectedIds.size === 0} className="text-xs px-2 py-1 rounded bg-blue-900/50 text-blue-200 hover:bg-blue-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title={t('resetStatusSelected', lang)}>
            <RefreshCw size={12} />
          </button>
          <button onClick={exitSelectMode} className="text-xs px-1.5 py-1 rounded text-gray-300 hover:bg-gray-700 transition-colors" title={t('cancelSelection', lang)}>
            <X size={12} />
          </button>
        </div>
      ) : (
      <div className="flex justify-between items-center p-3 border-b border-gray-800 bg-gray-900 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('galleryTitle', lang)} ({images.length})</span>
        </div>
        <div className="flex items-center gap-1">
            <button 
                onClick={onAddFile}
                className="text-gray-500 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors"
                title={t('addFiles', lang)}
            >
                <FilePlus size={14} />
            </button>
            <button
                onClick={onAddFolder}
                className="text-gray-500 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors"
                title={t('addFolder', lang)}
            >
                <FolderPlus size={14} />
            </button>
            {images.length > 0 && (
              <button
                onClick={enterSelectMode}
                className="text-gray-500 hover:text-blue-400 p-1.5 rounded hover:bg-gray-800 transition-colors"
                title={t('batchSelect', lang)}
              >
                <CheckSquare size={14} />
              </button>
            )}
            <div className="w-px h-3 bg-gray-800 mx-1"></div>
            <button
            onClick={handleClearClick}
            className={`text-xs p-1.5 rounded transition-all duration-200 font-bold ${
                clearStage === 1 
                ? 'bg-red-900/50 text-red-200 animate-pulse' 
                : 'text-gray-500 hover:text-red-400 hover:bg-gray-800'
            }`}
            title={t('clearAll', lang)}
            >
            {clearStage === 1 ? t('sure', lang) : <Trash2 size={14} />}
            </button>
        </div>
      </div>
      )}

      {images.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-6 text-center space-y-4">
             <div className="p-4 rounded-full bg-gray-800/50 border border-gray-700/50 border-dashed">
                <FilePlus size={24} className="opacity-50" />
             </div>
             <div>
                <p className="text-xs font-medium text-gray-500 mb-1">{t('noImageSelected', lang)}</p>
                <p className="text-[10px] text-gray-600 max-w-[150px] mx-auto leading-relaxed">{t('dragDrop', lang)}</p>
             </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 styled-scrollbar">
            <div className="grid grid-cols-2 gap-2">
            {images.map(img => (
                <div
                key={img.id}
                data-gallery-id={img.id}
                onClick={(e) => handleThumbnailClick(e, img.id)}
                className={`relative aspect-[2/3] group rounded overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedIds.has(img.id) ? 'border-blue-500 ring-2 ring-blue-500/30' :
                    currentId === img.id ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-gray-700 hover:border-gray-500'
                }`}
                >
                <img src={img.url} className={`w-full h-full object-cover transition-opacity duration-300 ${img.skipped ? 'opacity-50 grayscale' : ''}`} alt="thumb" />

                {/* Selection checkbox - bottom left */}
                {selectMode && (
                  <div className={`absolute bottom-5 left-1 z-20 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedIds.has(img.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-400 bg-black/40'
                  }`}>
                    {selectedIds.has(img.id) && <Check size={10} className="text-white" />}
                  </div>
                )}
                
                {/* Skip Button - Top Left */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSkip(img.id);
                    }}
                    className={`absolute top-1 left-1 p-1 rounded-full z-20 transition-all ${
                        img.skipped 
                        ? 'bg-red-500/80 text-white opacity-100 hover:bg-red-600' 
                        : 'bg-black/50 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-black/70 hover:text-white'
                    }`}
                    title={img.skipped ? t('skippedRestore', lang) : t('skipAPI', lang)}
                >
                    <Ban size={12} />
                </button>

                {/* Status Indicators - Bottom Right */}
                <div className="absolute bottom-1 right-1 z-10 flex gap-1 bg-gray-900/70 p-0.5 rounded-full backdrop-blur-sm">
                    {/* Inpainting Status (Purple/Red) */}
                    {img.inpaintingStatus === 'processing' && <Loader2 size={14} className="text-purple-400 animate-spin" />}
                    {img.inpaintingStatus === 'done' && <Eraser size={14} className="text-purple-400" />}
                    {img.inpaintingStatus === 'error' && <AlertTriangle size={14} className="text-red-500" />}

                    {/* Detection Status (Orange) */}
                    {img.detectionStatus === 'processing' && <Loader2 size={14} className="text-orange-400 animate-spin" />}
                    {img.detectionStatus === 'done' && <ScanText size={14} className="text-orange-400" />}
                    {img.detectionStatus === 'error' && <AlertTriangle size={14} className="text-orange-500" />}

                    {/* Translation Status (Blue/Green/Red) */}
                    {img.status === 'processing' && <Loader2 size={14} className="text-blue-400 animate-spin" />}
                    {img.status === 'done' && <CheckCircle size={14} className="text-green-400" />}
                    {img.status === 'error' && <XCircle size={14} className="text-red-400" />}
                </div>

                {/* Delete Overlay */}
                <button
                    onClick={(e) => {
                    e.stopPropagation();
                    onDelete(img.id);
                    }}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                    <X size={12} />
                </button>
                
                {/* Name Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] text-gray-300 px-1 truncate">
                    {img.name}
                </div>
                </div>
            ))}
            </div>
        </div>
      )}
    </div>
  );
};