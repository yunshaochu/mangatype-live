

import React, { useState, useEffect, useRef } from 'react';
import { ImageState, AIConfig } from '../types';
import { X, Trash2, Image as ImageIcon, CheckCircle, Loader2, XCircle, Ban } from 'lucide-react';
import { t } from '../services/i18n';

interface GalleryProps {
  images: ImageState[];
  currentId: string | null;
  config: AIConfig;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onToggleSkip: (id: string) => void;
}

export const Gallery: React.FC<GalleryProps> = ({ images, currentId, config, onSelect, onDelete, onClearAll, onToggleSkip }) => {
  const [clearStage, setClearStage] = useState(0); // 0 = normal, 1 = confirm
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lang = config.language || 'zh';

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

  if (images.length === 0) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center p-2 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <span className="text-xs font-semibold text-gray-400">{t('galleryTitle', lang)} ({images.length})</span>
        <button
          onClick={handleClearClick}
          className={`text-xs px-2 py-1 rounded transition-all duration-200 font-bold ${
            clearStage === 1 
              ? 'bg-red-600 text-white animate-pulse' 
              : 'text-gray-500 hover:text-red-400 hover:bg-gray-800'
          }`}
        >
          {clearStage === 1 ? t('sure', lang) : <Trash2 size={14} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 styled-scrollbar">
        <div className="grid grid-cols-2 gap-2">
          {images.map(img => (
            <div 
              key={img.id}
              onClick={() => onSelect(img.id)}
              className={`relative aspect-[2/3] group rounded overflow-hidden border-2 cursor-pointer transition-all ${
                currentId === img.id ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              <img src={img.url} className={`w-full h-full object-cover transition-opacity duration-300 ${img.skipped ? 'opacity-50 grayscale' : ''}`} alt="thumb" />
              
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
                  title={img.skipped ? "已跳过 API 处理 (点击恢复)" : "跳过 API 处理"}
              >
                  <Ban size={12} />
              </button>

              {/* Status Indicator - z-10 to stay above filename overlay */}
              <div 
                className="absolute bottom-1 right-1 z-10"
                title={img.status === 'error' ? (img.errorMessage || 'Error') : ''}
              >
                 {img.status === 'processing' && <Loader2 size={16} className="text-blue-400 animate-spin bg-gray-900/50 rounded-full p-0.5" />}
                 {img.status === 'done' && <CheckCircle size={16} className="text-green-400 bg-gray-900/50 rounded-full" />}
                 {img.status === 'error' && <XCircle size={16} className="text-red-400 bg-gray-900/50 rounded-full" />}
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
    </div>
  );
};