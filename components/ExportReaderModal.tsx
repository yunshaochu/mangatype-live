import React, { useState } from 'react';
import { BookOpen, FileCode, FolderArchive, Image, Loader2 } from 'lucide-react';
import { useProjectContext } from '../contexts/ProjectContext';
import { HtmlExportOptions, exportAsHtmlReader, importFromHtmlReader } from '../services/htmlExportService';

interface Props {
  onClose: () => void;
}

export const ExportReaderModal: React.FC<Props> = ({ onClose }) => {
  const { images, setImages, aiConfig, setIsZipping, setZipProgress, flushPendingCommands } = useProjectContext();
  const lang = aiConfig.language;

  const [mode, setMode] = useState<'single' | 'folder'>('folder');
  const [imageQuality, setImageQuality] = useState(80);
  const [reduceImageSize, setReduceImageSize] = useState(false);
  const [maxImageDim, setMaxImageDim] = useState(1600);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    if (images.length === 0) return;
    setIsExporting(true);
    setIsZipping(true);
    setProgress({ current: 0, total: images.length });

    try {
      await flushPendingCommands();
      await exportAsHtmlReader(
        images,
        {
          mode,
          imageQuality: imageQuality / 100,
          reduceImageSize,
          maxImageDimension: maxImageDim,
        },
        (current, total) => {
          setProgress({ current, total });
          setZipProgress({ current, total });
        }
      );
    } catch (e) {
      console.error('Export reader failed', e);
      alert('Export failed: ' + (e as Error).message);
    } finally {
      setIsExporting(false);
      setIsZipping(false);
      setZipProgress({ current: 0, total: 0 });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await importFromHtmlReader(file);
      if (result && result.images.length > 0) {
        setImages(result.images);
        onClose();
      }
    } catch (e) {
      console.error('Import failed', e);
      alert('Import failed: ' + (e as Error).message);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {lang === 'zh' ? '导出阅读器' : 'Export Reader'}
            </h2>
            <p className="text-xs text-gray-400">
              {lang === 'zh' ? `${images.length} 页漫画` : `${images.length} pages`}
            </p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Export Mode */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
              {lang === 'zh' ? '导出格式' : 'Export Format'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('folder')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === 'folder'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                <FolderArchive size={20} className={mode === 'folder' ? 'text-indigo-400' : 'text-gray-500'} />
                <div className="mt-2 text-xs font-bold">
                  {lang === 'zh' ? 'HTML + 文件夹 (ZIP)' : 'HTML + Folder (ZIP)'}
                </div>
                <div className="text-[10px] mt-1 text-gray-500">
                  {lang === 'zh' ? '图片独立存放，体积正常' : 'Images stored separately, normal size'}
                </div>
              </button>
              <button
                onClick={() => setMode('single')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === 'single'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                <FileCode size={20} className={mode === 'single' ? 'text-indigo-400' : 'text-gray-500'} />
                <div className="mt-2 text-xs font-bold">
                  {lang === 'zh' ? '单HTML文件' : 'Single HTML File'}
                </div>
                <div className="text-[10px] mt-1 text-gray-500">
                  {lang === 'zh' ? '图片内嵌，文件较大' : 'Images embedded, larger file'}
                </div>
              </button>
            </div>
          </div>

          {/* Image Quality (for single HTML mode) */}
          {mode === 'single' && (
            <div className="space-y-3 animate-fade-in">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {lang === 'zh' ? 'JPEG 压缩质量' : 'JPEG Quality'}
                  </label>
                  <span className="text-xs text-gray-400">{imageQuality}%</span>
                </div>
                <input
                  type="range" min={30} max={100} step={5}
                  value={imageQuality}
                  onChange={(e) => setImageQuality(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                  <span>{lang === 'zh' ? '小文件' : 'Small'}</span>
                  <span>{lang === 'zh' ? '高质量' : 'High'}</span>
                </div>
              </div>

              {/* Reduce image size */}
              <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                <div className="flex items-center gap-2">
                  <Image size={14} className="text-gray-400" />
                  <div>
                    <div className="text-xs text-gray-300">
                      {lang === 'zh' ? '缩小图片尺寸' : 'Reduce Image Size'}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {lang === 'zh' ? `最大边长 ${maxImageDim}px` : `Max dimension ${maxImageDim}px`}
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer"
                    checked={reduceImageSize}
                    onChange={(e) => setReduceImageSize(e.target.checked)}
                  />
                  <div className="w-8 h-4 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>

              {reduceImageSize && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {lang === 'zh' ? '最大边长 (px)' : 'Max Dimension (px)'}
                    </label>
                    <span className="text-xs text-gray-400">{maxImageDim}px</span>
                  </div>
                  <input
                    type="range" min={600} max={3000} step={200}
                    value={maxImageDim}
                    onChange={(e) => setMaxImageDim(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Reader Features Description */}
          <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-800">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              {lang === 'zh' ? '阅读器功能' : 'Reader Features'}
            </div>
            <ul className="text-[10px] text-gray-400 space-y-1">
              <li>• {lang === 'zh' ? '从右往左 / 从左往右 / 上下滑动 三种阅读模式' : 'RTL / LTR / Scroll reading modes'}</li>
              <li>• {lang === 'zh' ? '点击图片中央切换翻译气泡显示' : 'Tap center to toggle translation bubbles'}</li>
              <li>• {lang === 'zh' ? '默认显示原图，点击显示翻译' : 'Default shows original, tap to see translation'}</li>
              <li>• {lang === 'zh' ? '键盘方向键 / 触摸滑动翻页' : 'Keyboard arrows / touch swipe navigation'}</li>
              <li>• {lang === 'zh' ? '可导入恢复编辑状态' : 'Importable to restore editing state'}</li>
            </ul>
          </div>

          {/* Progress (during export) */}
          {isExporting && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>{lang === 'zh' ? '正在处理...' : 'Processing...'}</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex gap-2">
          {/* Import Button */}
          <label className={`flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl text-xs font-medium cursor-pointer transition-all ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
            <input type="file" accept=".html,.htm,.zip" onChange={handleImport} className="hidden" />
            {isImporting ? <Loader2 size={14} className="animate-spin" /> : null}
            {lang === 'zh' ? '导入项目' : 'Import Project'}
          </label>

          <div className="flex-1" />

          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-all"
          >
            {lang === 'zh' ? '取消' : 'Cancel'}
          </button>

          <button
            onClick={handleExport}
            disabled={images.length === 0 || isExporting}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <><Loader2 size={14} className="animate-spin" /> {lang === 'zh' ? '导出中...' : 'Exporting...'}</>
            ) : (
              <><BookOpen size={14} /> {lang === 'zh' ? '导出阅读器' : 'Export Reader'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
