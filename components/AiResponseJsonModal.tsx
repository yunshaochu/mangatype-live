import React, { useEffect, useState } from 'react';
import { Check, ClipboardCopy, FileJson, X } from 'lucide-react';

import type { ImageAiResponseDebug } from '../types';
import { formatImageAiResponseSourceKind } from '../services/imageAiResponseDebug';
import { t } from '../services/i18n';

type AiResponseJsonModalProps = {
  debugSnapshot: ImageAiResponseDebug;
  imageName: string;
  lang: string;
  onClose: () => void;
};

const formatTimestamp = (value: number, lang: string) => {
  try {
    return new Date(value).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '-';
  }
};

export const AiResponseJsonModal: React.FC<AiResponseJsonModalProps> = ({
  debugSnapshot,
  imageName,
  lang,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugSnapshot.prettyJson);
      setCopied(true);
    } catch (error) {
      console.warn('Failed to copy AI JSON snapshot', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-gray-800 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_36%)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileJson size={18} className="text-blue-300" />
              <span>{t('aiJsonModalTitle', lang)}</span>
            </div>
            <div className="mt-1 truncate text-xs text-gray-400">{imageName}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-200 transition hover:border-blue-400/40 hover:text-white"
            >
              {copied ? <Check size={14} className="text-emerald-300" /> : <ClipboardCopy size={14} />}
              <span>{copied ? t('aiJsonModalCopied', lang) : t('aiJsonModalCopy', lang)}</span>
            </button>
            <button onClick={onClose} className="text-gray-400 transition-colors hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="grid gap-4 border-b border-gray-800 bg-gray-950/80 px-5 py-4 md:grid-cols-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{t('aiJsonModalSource', lang)}</div>
            <div className="mt-1 text-sm text-gray-100">{formatImageAiResponseSourceKind(debugSnapshot.sourceKind)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{t('aiJsonModalProvider', lang)}</div>
            <div className="mt-1 text-sm text-gray-100">{debugSnapshot.provider || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{t('aiJsonModalModel', lang)}</div>
            <div className="mt-1 truncate text-sm text-gray-100">{debugSnapshot.model || '-'}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{t('aiJsonModalBubbleCount', lang)}</div>
            <div className="mt-1 text-sm text-gray-100">{debugSnapshot.bubbleCount}</div>
          </div>
          <div className="md:col-span-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">{t('aiJsonModalCapturedAt', lang)}</div>
            <div className="mt-1 text-sm text-gray-100">{formatTimestamp(debugSnapshot.capturedAt, lang)}</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-950 p-5">
          <pre className="min-h-full overflow-x-auto rounded-2xl border border-gray-800 bg-black/40 p-4 text-xs leading-6 text-green-300">
            <code>{debugSnapshot.prettyJson}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
