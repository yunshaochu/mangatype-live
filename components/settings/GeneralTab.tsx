import React, { useRef } from 'react';
import { Globe, Download, Upload, FolderArchive, RotateCcw } from 'lucide-react';
import { t } from '../../services/i18n';
import { TabProps } from './types';

const STORAGE_KEY = 'mangatype_live_settings_v1';

export const GeneralTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleResetToDefaults = () => {
    if (!confirm(t('resetToDefaultsConfirm', lang))) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const handleExport = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mangatype-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (typeof parsed !== 'object' || parsed === null || !('provider' in parsed || 'language' in parsed || 'endpoints' in parsed)) {
          alert(t('configImportError', lang));
          return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        alert(t('configImported', lang));
        window.location.reload();
      } catch {
        alert(t('configImportError', lang));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">General Settings</h3>
        <p className="text-sm text-gray-500">Configure language and interface preferences.</p>
      </div>

      <div className="grid gap-6">
        {/* Language */}
        <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-800 space-y-3">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Globe size={16} className="text-indigo-400"/> {t('language', lang)}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {['zh', 'en'].map((l) => (
              <button
                key={l}
                onClick={() => setConfig(prev => ({...prev, language: l as any}))}
                className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
                  config.language === l
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 ring-1 ring-indigo-500/20'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                }`}
              >
                {l === 'zh' ? '中文 (Chinese)' : 'English'}
              </button>
            ))}
          </div>
        </div>

        {/* Config Backup & Restore */}
        <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-800 space-y-3">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <FolderArchive size={16} className="text-amber-400"/> {t('configBackupRestore', lang)}
          </label>
          <p className="text-xs text-gray-500">{t('configBackupRestoreHint', lang)}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium border bg-gray-900 border-gray-700 text-gray-300 hover:border-emerald-500/50 hover:text-emerald-300 hover:bg-emerald-600/10 transition-all"
            >
              <Download size={16} /> {t('exportConfig', lang)}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium border bg-gray-900 border-gray-700 text-gray-300 hover:border-blue-500/50 hover:text-blue-300 hover:bg-blue-600/10 transition-all"
            >
              <Upload size={16} /> {t('importConfig', lang)}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {/* Reset to Factory Defaults */}
        <div className="p-5 bg-gray-800/30 rounded-xl border border-red-900/30 space-y-3">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <RotateCcw size={16} className="text-red-400"/> {t('resetToDefaults', lang)}
          </label>
          <p className="text-xs text-gray-500">{t('resetToDefaultsHint', lang)}</p>
          <button
            onClick={handleResetToDefaults}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium border bg-gray-900 border-red-900/50 text-red-400 hover:border-red-500/50 hover:text-red-300 hover:bg-red-600/10 transition-all"
          >
            <RotateCcw size={16} /> {t('resetToDefaultsBtn', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
