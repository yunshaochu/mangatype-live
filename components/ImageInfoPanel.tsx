import React from 'react';
import { FileJson, Hash, Layers, Sparkles } from 'lucide-react';

import type { ImageAiResponseDebug, ImageState } from '../types';
import { t } from '../services/i18n';

type ImageInfoPanelProps = {
  image: ImageState;
  debugSnapshot?: ImageAiResponseDebug;
  lang: string;
  onOpenJson?: () => void;
};

const STATUS_META: Record<ImageState['status'], { dot: string; labelKey: 'processing' | 'done' | 'error' | 'imagePanelIdle' }> = {
  idle: { dot: 'bg-gray-500', labelKey: 'imagePanelIdle' },
  processing: { dot: 'bg-blue-400', labelKey: 'processing' },
  done: { dot: 'bg-emerald-400', labelKey: 'done' },
  error: { dot: 'bg-red-400', labelKey: 'error' },
};

const SOURCE_LABELS: Record<NonNullable<ImageAiResponseDebug['sourceKind']>, string> = {
  gemini_function: 'Gemini Function',
  gemini_json: 'Gemini JSON',
  gemini_text: 'Gemini Text',
  openai_tool: 'OpenAI Tool',
  openai_content: 'OpenAI Content',
  manual_import: 'Manual Import',
};

const formatTimestamp = (value: number, lang: string) => {
  try {
    return new Date(value).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
};

export const ImageInfoPanel: React.FC<ImageInfoPanelProps> = ({
  image,
  debugSnapshot,
  lang,
  onOpenJson,
}) => {
  const statusMeta = STATUS_META[image.status];
  const hasDebugSnapshot = Boolean(debugSnapshot);
  const jsonButtonDisabled = !hasDebugSnapshot || !onOpenJson;

  return (
    <div className="flex-1 flex flex-col text-gray-300 select-none p-4 overflow-y-auto">
      <div className="rounded-2xl border border-gray-800 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
        <div className="p-5 border-b border-gray-800 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_38%)]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-300/80">
                <Sparkles size={12} />
                <span>{t('imagePanelTitle', lang)}</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white truncate">{image.name}</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{t('imagePanelHint', lang)}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900/80 px-3 py-1 text-[11px] text-gray-200">
              <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
              <span>{t(statusMeta.labelKey, lang)}</span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-800 bg-gray-900/80 px-3 py-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-gray-500">
                <Hash size={12} />
                <span>{t('imagePanelBubbleCount', lang)}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{image.bubbles.length}</div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/80 px-3 py-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-gray-500">
                <Layers size={12} />
                <span>{t('imagePanelMaskCount', lang)}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{image.maskRegions?.length ?? 0}</div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500">{t('imagePanelLatestSource', lang)}</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {debugSnapshot ? SOURCE_LABELS[debugSnapshot.sourceKind] : t('imagePanelNoDebug', lang)}
                </div>
              </div>
              <div className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${hasDebugSnapshot ? 'bg-emerald-500/12 text-emerald-300 border border-emerald-500/20' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                {hasDebugSnapshot ? t('imagePanelJsonReady', lang) : t('imagePanelJsonEmpty', lang)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{t('imagePanelProvider', lang)}</div>
                <div className="mt-1 text-gray-200">{debugSnapshot?.provider || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{t('imagePanelUpdatedAt', lang)}</div>
                <div className="mt-1 text-gray-200">{debugSnapshot ? formatTimestamp(debugSnapshot.capturedAt, lang) : '-'}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenJson}
              disabled={jsonButtonDisabled}
              className="w-full rounded-xl border border-blue-500/20 bg-blue-500/12 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:border-gray-800 disabled:bg-gray-900 disabled:text-gray-500 hover:not-disabled:border-blue-400/40 hover:not-disabled:bg-blue-500/18"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${jsonButtonDisabled ? 'bg-gray-800 text-gray-500' : 'bg-blue-500/18 text-blue-300'}`}>
                  <FileJson size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold">{t('imagePanelViewJson', lang)}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {hasDebugSnapshot ? t('imagePanelViewJsonHint', lang) : t('imagePanelNoDebugHint', lang)}
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
