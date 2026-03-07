import React, { useState } from 'react';
import { Pipette, RotateCw, PenTool, RotateCcw, Palette, Camera, Loader2, CheckCircle, Download } from 'lucide-react';
import { t } from '../../services/i18n';
import { DEFAULT_FONT_SELECTION_PROMPT, DEFAULT_COLOR_SELECTION_PROMPT } from '../../services/geminiService';
import { initScreenshotContainer, isScreenshotReady } from '../../services/exportService';
import { TabProps } from './types';

export const AdvancedTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  const isScreenshotMode = config.exportMethod === 'screenshot';
  const [fontStatus, setFontStatus] = useState<'idle' | 'loading' | 'ready'>(isScreenshotReady() ? 'ready' : 'idle');

  const handlePreloadFonts = async () => {
    if (fontStatus === 'loading' || fontStatus === 'ready') return;
    setFontStatus('loading');
    // Let the UI update before starting the blocking work
    await new Promise(r => setTimeout(r, 50));
    await initScreenshotContainer();
    setFontStatus('ready');
  };

  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">Advanced & Experimental</h3>
        <p className="text-sm text-gray-500">Power tools and beta features.</p>
      </div>

      <div className="grid gap-4">
        {/* Export Method */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-green-500/30 rounded-xl transition-colors group">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-green-500/10 rounded text-green-400"><Camera size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('exportMethod', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed">{t('exportMethodHint', lang)}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setConfig({...config, exportMethod: 'canvas'})}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                (config.exportMethod || 'canvas') === 'canvas'
                  ? 'bg-green-600 text-white shadow'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {t('exportMethodCanvas', lang)}
            </button>
            <button
              onClick={() => setConfig({...config, exportMethod: 'screenshot'})}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                config.exportMethod === 'screenshot'
                  ? 'bg-green-600 text-white shadow'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {t('exportMethodScreenshot', lang)}
            </button>
          </div>
          {isScreenshotMode && (
            <div className="mt-3">
              {fontStatus === 'ready' ? (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle size={12}/> {lang === 'zh' ? '字体已就绪，可以保存设置' : 'Fonts ready, you can save settings'}
                </div>
              ) : (
                <button
                  onClick={handlePreloadFonts}
                  disabled={fontStatus === 'loading'}
                  className={`w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    fontStatus === 'loading'
                      ? 'bg-yellow-600/20 text-yellow-400 cursor-wait'
                      : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                  }`}
                >
                  {fontStatus === 'loading'
                    ? <><Loader2 size={12} className="animate-spin"/> {lang === 'zh' ? '正在加载字体，请等待约10秒…' : 'Loading fonts, please wait ~10s…'}</>
                    : <><Download size={12}/> {lang === 'zh' ? '预加载字体（首次需要下载）' : 'Preload fonts (download required first time)'}</>
                  }
                </button>
              )}
            </div>
          )}
        </div>

        {/* Freehand Perf Rollout Flags */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-amber-500/30 rounded-xl transition-colors group">
          <div className="flex justify-between items-start gap-4">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-amber-500/10 rounded text-amber-400"><RotateCw size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">
                  {lang === 'zh' ? '自由涂抹性能' : 'Freehand Performance'}
                </h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed">
                  {lang === 'zh'
                    ? '只影响画笔、擦除、还原这类手动涂抹操作。详细说明按需展开查看。'
                    : 'Only affects manual paint, erase, and restore actions. Expand the details only when you need them.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-gray-700/70 bg-gray-900/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-gray-100">
                      {lang === 'zh' ? '流畅画笔模式' : 'Smooth Brush Mode'}
                    </p>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      {lang === 'zh' ? '推荐' : 'Recommended'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                    {lang === 'zh'
                      ? '让画笔更跟手，并减少抬笔保存时的卡顿。'
                      : 'Makes the brush feel more responsive and reduces hitching after pen-up.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.freehandPerfPhase1Enabled !== false}
                    onChange={(e) => setConfig({ ...config, freehandPerfPhase1Enabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
              <details className="mt-3 rounded-lg border border-gray-800 bg-black/10 px-3 py-2 text-[11px] text-gray-400">
                <summary className="cursor-pointer select-none text-gray-300 hover:text-white">
                  {lang === 'zh' ? '了解更多' : 'Learn more'}
                </summary>
                <div className="mt-2 space-y-1 leading-relaxed">
                  <p>
                    {lang === 'zh'
                      ? '开启后，自由涂抹会走更轻量的绘制路径，画笔移动更顺。'
                      : 'When enabled, freehand drawing uses a lighter rendering path for smoother brush movement.'}
                  </p>
                  <p>
                    {lang === 'zh'
                      ? '抬笔后的保存会改到后台处理，减少“抬笔卡一下”的感觉。'
                      : 'Saving after pen-up runs in the background to reduce the visible hitch right after you finish a stroke.'}
                  </p>
                  <p>
                    {lang === 'zh'
                      ? '短时间内连续的小涂抹会合并成一次撤销记录。关闭后会回到旧的兼容路径。'
                      : 'Short back-to-back strokes are merged into a cleaner undo step. Turning it off falls back to the older compatibility path.'}
                  </p>
                </div>
              </details>
            </div>

            <div className="rounded-xl border border-gray-700/70 bg-gray-900/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-gray-100">
                      {lang === 'zh' ? '大图加速模式' : 'Large Image Acceleration'}
                    </p>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                      {lang === 'zh' ? '实验' : 'Experimental'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                    {lang === 'zh'
                      ? '大图时先在缩小预览上即时显示笔迹，再后台同步到高清图。'
                      : 'On large images, strokes appear first on a smaller preview and sync to the full-resolution image in the background.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.freehandPerfPhase2Enabled === true}
                    onChange={(e) => setConfig({ ...config, freehandPerfPhase2Enabled: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
              <details className="mt-3 rounded-lg border border-gray-800 bg-black/10 px-3 py-2 text-[11px] text-gray-400">
                <summary className="cursor-pointer select-none text-gray-300 hover:text-white">
                  {lang === 'zh' ? '了解更多' : 'Learn more'}
                </summary>
                <div className="mt-2 space-y-1 leading-relaxed">
                  <p>
                    {lang === 'zh'
                      ? '这个模式只在超大图片上更明显：你看到的是更轻的预览层，后台会把同样的笔迹补到原始高清图。'
                      : 'This is most noticeable on very large images: you interact with a lighter preview layer while the same stroke is replayed in the background on the original full-resolution image.'}
                  </p>
                  <p>
                    {lang === 'zh'
                      ? '最终保存仍以高清图为准，不会把成品降清晰度。'
                      : 'Final saves still use the full-resolution image, so output quality is not reduced.'}
                  </p>
                  <p>
                    {lang === 'zh'
                      ? '代价是极大图片上可能会有很短暂的后台补算延迟；如果感觉异常，直接关闭即可。'
                      : 'The tradeoff is a brief background catch-up delay on extremely large images. If it feels off, just turn it off.'}
                  </p>
                </div>
              </details>
            </div>
          </div>

          {config.freehandPerfPhase2Enabled === true ? (
            <div className="mt-3 rounded-xl border border-gray-700/70 bg-gray-900/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-100">
                    {lang === 'zh' ? '大图加速参数' : 'Acceleration Settings'}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {lang === 'zh'
                      ? '不确定怎么调时，保持默认值通常最稳。'
                      : 'If you are unsure, the default values are usually the safest choice.'}
                  </p>
                </div>
                <span className="rounded-full bg-gray-800 px-2 py-1 text-[10px] text-gray-400">
                  {lang === 'zh' ? '仅实验模式生效' : 'Used only in experimental mode'}
                </span>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-gray-200">
                    {lang === 'zh' ? '启用阈值（MP）' : 'Threshold (MP)'}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={config.freehandLowResThresholdMp ?? 4}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(64, Number(e.target.value) || 4));
                      setConfig({ ...config, freehandLowResThresholdMp: v });
                    }}
                    className="h-8 w-full rounded border border-gray-600 bg-gray-800 px-2 text-xs text-gray-200 outline-none focus:border-amber-500"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-gray-200">
                    {lang === 'zh' ? '预览清晰度' : 'Preview Clarity'}
                  </span>
                  <input
                    type="number"
                    min={250000}
                    step={50000}
                    value={config.freehandPreviewTargetPixels ?? 1500000}
                    onChange={(e) => {
                      const v = Math.max(250000, Number(e.target.value) || 1500000);
                      setConfig({ ...config, freehandPreviewTargetPixels: v });
                    }}
                    className="h-8 w-full rounded border border-gray-600 bg-gray-800 px-2 text-xs text-gray-200 outline-none focus:border-amber-500"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-gray-200">
                    {lang === 'zh' ? '补算速度' : 'Catch-up Speed'}
                  </span>
                  <input
                    type="number"
                    min={8}
                    max={4096}
                    value={config.freehandReplayBatchSize ?? 120}
                    onChange={(e) => {
                      const v = Math.max(8, Math.min(4096, Number(e.target.value) || 120));
                      setConfig({ ...config, freehandReplayBatchSize: v });
                    }}
                    className="h-8 w-full rounded border border-gray-600 bg-gray-800 px-2 text-xs text-gray-200 outline-none focus:border-amber-500"
                  />
                </label>
              </div>

              <details className="mt-3 rounded-lg border border-gray-800 bg-black/10 px-3 py-2 text-[11px] text-gray-400">
                <summary className="cursor-pointer select-none text-gray-300 hover:text-white">
                  {lang === 'zh' ? '参数说明' : 'What these settings mean'}
                </summary>
                <div className="mt-2 space-y-1 leading-relaxed">
                  <p>
                    {lang === 'zh'
                      ? '启用阈值：图片超过这个大小后，才会启用“先低清预览、后台补高清”的模式。'
                      : 'Threshold: acceleration starts only when the image is larger than this size.'}
                  </p>
                  <p>
                    {lang === 'zh'
                      ? '预览清晰度：数值越高，编辑时看到的预览越清楚，但也更吃性能。'
                      : 'Preview Clarity: higher values make the preview look sharper, but use more performance.'}
                  </p>
                  <p>
                    {lang === 'zh'
                      ? '补算速度：数值越高，后台把笔迹补到高清图上的速度越快，但也可能更占资源。'
                      : 'Catch-up Speed: higher values replay strokes to the full-resolution image faster, but may use more resources.'}
                  </p>
                </div>
              </details>
            </div>
          ) : null}
        </div>

        {/* Skipped Export Behavior */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-emerald-500/30 rounded-xl transition-colors group">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-emerald-500/10 rounded text-emerald-400"><Download size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('exportSkippedAsOriginal', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed">{t('exportSkippedAsOriginalHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.exportSkippedAsOriginal === true}
                onChange={(e) => setConfig({ ...config, exportSkippedAsOriginal: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        {/* Auto Detect Background */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-cyan-500/30 rounded-xl transition-colors group">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-cyan-500/10 rounded text-cyan-400"><Pipette size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('autoDetectBackground', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed">{t('autoDetectBackgroundHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.autoDetectBackground !== false}
                onChange={(e) => setConfig({...config, autoDetectBackground: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
            </label>
          </div>
        </div>

        {/* AI Rotation */}
        <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-purple-500/30 rounded-xl transition-colors group">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-purple-500/10 rounded text-purple-400"><RotateCw size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('allowAiRotation', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{t('allowAiRotationHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.allowAiRotation || false}
                onChange={(e) => setConfig({...config, allowAiRotation: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>

        {/* Allow AI Font Selection */}
        <div className={`p-4 rounded-xl border transition-colors ${config.allowAiFontSelection !== false ? 'bg-teal-900/10 border-teal-500/30' : 'bg-gray-800/30 border-gray-800 hover:border-teal-500/30'}`}>
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-teal-500/10 rounded text-teal-400"><PenTool size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('allowAiFontSelection', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{t('allowAiFontSelectionHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.allowAiFontSelection !== false}
                onChange={(e) => setConfig({...config, allowAiFontSelection: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>

          {config.allowAiFontSelection !== false && (
            <div className="mt-4 pt-4 border-t border-gray-700/50 animate-fade-in-down">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('fontSelectionPrompt', lang)}</label>
                <button
                  onClick={() => setConfig({...config, fontSelectionPrompt: DEFAULT_FONT_SELECTION_PROMPT})}
                  className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors"
                >
                  <RotateCcw size={12}/> Reset
                </button>
              </div>
              <textarea
                value={config.fontSelectionPrompt || DEFAULT_FONT_SELECTION_PROMPT}
                onChange={(e) => setConfig({...config, fontSelectionPrompt: e.target.value})}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 outline-none font-mono leading-relaxed resize-y min-h-[180px]"
                spellCheck={false}
              />
              <p className="text-[10px] text-gray-500 mt-1">{t('fontSelectionPromptHint', lang)}</p>
            </div>
          )}
        </div>

        {/* Allow AI Color Selection */}
        <div className={`p-4 rounded-xl border transition-colors ${config.allowAiColorSelection !== false ? 'bg-orange-900/10 border-orange-500/30' : 'bg-gray-800/30 border-gray-800 hover:border-orange-500/30'}`}>
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="mt-1 p-1.5 bg-orange-500/10 rounded text-orange-400"><Palette size={18}/></div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">{t('allowAiColorSelection', lang)}</h4>
                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{t('allowAiColorSelectionHint', lang)}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.allowAiColorSelection !== false}
                onChange={(e) => setConfig({...config, allowAiColorSelection: e.target.checked})}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>

          {config.allowAiColorSelection !== false && (
            <div className="mt-4 pt-4 border-t border-gray-700/50 animate-fade-in-down">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('colorSelectionPrompt', lang)}</label>
                <button
                  onClick={() => setConfig({...config, colorSelectionPrompt: DEFAULT_COLOR_SELECTION_PROMPT})}
                  className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors"
                >
                  <RotateCcw size={12}/> Reset
                </button>
              </div>
              <textarea
                value={config.colorSelectionPrompt || DEFAULT_COLOR_SELECTION_PROMPT}
                onChange={(e) => setConfig({...config, colorSelectionPrompt: e.target.value})}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none font-mono leading-relaxed resize-y min-h-[180px]"
                spellCheck={false}
              />
              <p className="text-[10px] text-gray-500 mt-1">{t('colorSelectionPromptHint', lang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
