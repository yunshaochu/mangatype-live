import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, AlertCircle, Globe, ChevronDown, Check, Bot, Cpu, Plus, Trash2, Pencil, Power, ChevronUp } from 'lucide-react';
import { t } from '../../services/i18n';
import { fetchAvailableModels } from '../../services/geminiService';
import { AIProvider, APIEndpoint, mergeEndpointConfig } from '../../types';
import { TabProps } from './types';

const EndpointEditor: React.FC<{
  endpoint: APIEndpoint;
  config: any;
  lang: 'zh' | 'en';
  onSave: (ep: APIEndpoint) => void;
  onCancel: () => void;
}> = ({ endpoint, config, lang, onSave, onCancel }) => {
  const [draft, setDraft] = useState<APIEndpoint>({ ...endpoint });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFetchModels = async () => {
    setLoadingModels(true);
    setError(null);
    try {
      const merged = mergeEndpointConfig(config, draft);
      const models = await fetchAvailableModels(merged);
      if (models.length > 0) {
        setAvailableModels(models);
        setIsDropdownOpen(true);
      } else {
        setError(draft.provider === 'openai' ? t('noModels', lang) : t('failedFetch', lang));
      }
    } catch (e) {
      setError(t('failedFetch', lang));
    } finally {
      setLoadingModels(false);
    }
  };
  const displayedModels = (() => {
    const current = draft.model.trim().toLowerCase();
    if (!current) return availableModels;
    const filtered = availableModels.filter(m => m.toLowerCase().includes(current));
    return filtered.length > 0 ? filtered : availableModels;
  })();

  return (
    <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4">
      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{lang === 'zh' ? '名称' : 'Name'}</label>
        <input type="text" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
          className="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none" />
      </div>

      {/* Provider Toggle */}
      <div className="grid grid-cols-2 gap-3">
        {(['gemini', 'openai'] as AIProvider[]).map(prov => (
          <button key={prov} onClick={() => setDraft({ ...draft, provider: prov, baseUrl: prov === 'gemini' ? '' : (draft.baseUrl || 'https://api.openai.com/v1'), model: prov === 'gemini' ? 'gemini-3-flash-preview' : draft.model })}
            className={`p-3 rounded-lg border-2 text-left transition-all ${draft.provider === prov ? (prov === 'gemini' ? 'bg-blue-900/10 border-blue-500' : 'bg-green-900/10 border-green-500') : 'bg-gray-800/30 border-gray-800 hover:border-gray-600 opacity-60 hover:opacity-100'}`}>
            <div className="flex items-center gap-2">
              {prov === 'gemini' ? <Bot size={16} className="text-blue-400" /> : <Cpu size={16} className="text-green-400" />}
              <span className="text-sm font-bold text-white">{prov === 'gemini' ? 'Gemini' : 'OpenAI'}</span>
            </div>
          </button>
        ))}
      </div>

      {/* API Key */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">API Key</label>
        <input type="password" value={draft.apiKey} onChange={e => setDraft({ ...draft, apiKey: e.target.value })}
          placeholder={draft.provider === 'gemini' ? (lang === 'zh' ? '留空则使用环境变量' : 'Leave empty for env variable') : 'sk-...'}
          className="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none placeholder-gray-600" />
      </div>

      {/* Base URL (OpenAI only) */}
      {draft.provider === 'openai' && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Base URL</label>
          <div className="relative group">
            <input type="text" value={draft.baseUrl} onChange={e => setDraft({ ...draft, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-green-500 focus:ring-1 focus:ring-green-500/50 outline-none placeholder-gray-600" />
            <div className="absolute right-3 top-2.5 text-gray-600"><Globe size={16}/></div>
          </div>
        </div>
      )}
      {/* Model Selector */}
      <div className="space-y-1" ref={dropdownRef}>
        <div className="flex justify-between items-end">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{lang === 'zh' ? '模型' : 'Model'}</label>
          <button onClick={handleFetchModels} disabled={loadingModels}
            className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors">
            <RefreshCw size={12} className={loadingModels ? 'animate-spin' : ''} />
            {loadingModels ? t('fetching', lang) : t('refreshModels', lang)}
          </button>
        </div>
        <div className="relative">
          <input type="text" value={draft.model}
            onChange={e => { setDraft({ ...draft, model: e.target.value }); setIsDropdownOpen(true); }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Select or type model name..."
            className="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-2.5 pr-10 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none placeholder-gray-600" />
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white rounded-md hover:bg-gray-700" tabIndex={-1}>
            <ChevronDown size={16} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isDropdownOpen && availableModels.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1f2937] border border-gray-700 rounded-xl shadow-2xl max-h-44 overflow-y-auto z-50 styled-scrollbar">
              {displayedModels.map(m => (
                <button key={m} onClick={() => { setDraft({ ...draft, model: m }); setIsDropdownOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-blue-600 hover:text-white flex justify-between items-center first:rounded-t-xl last:rounded-b-xl">
                  <span className="font-mono">{m}</span>
                  {draft.model === m && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <div className="text-xs text-red-400 flex items-center gap-1 mt-1"><AlertCircle size={12}/> {error}</div>}
      </div>

      {/* Capabilities */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
          <input type="checkbox" checked={draft.modelSupportsFunctionCalling !== false}
            onChange={e => setDraft({ ...draft, modelSupportsFunctionCalling: e.target.checked ? undefined : false })}
            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500" />
          Function Calling
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
          <input type="checkbox" checked={draft.modelSupportsJsonMode !== false}
            onChange={e => setDraft({ ...draft, modelSupportsJsonMode: e.target.checked ? undefined : false })}
            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500" />
          JSON Mode
        </label>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSave(draft)}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-xs font-bold transition-colors">
          {lang === 'zh' ? '保存' : 'Save'}
        </button>
        <button onClick={onCancel}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg py-2 text-xs transition-colors">
          {lang === 'zh' ? '取消' : 'Cancel'}
        </button>
      </div>
    </div>
  );
};
export const ProviderTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  const endpoints = config.endpoints || [];
  const enabledCount = endpoints.filter(ep => ep.enabled).length;

  const updateEndpoints = (newEndpoints: APIEndpoint[]) => {
    const first = newEndpoints.find(ep => ep.enabled) || newEndpoints[0];
    setConfig(prev => ({
      ...prev,
      endpoints: newEndpoints,
      // Keep top-level fields in sync with first enabled endpoint for backward compat
      ...(first ? { provider: first.provider, apiKey: first.apiKey, baseUrl: first.baseUrl, model: first.model,
        modelSupportsFunctionCalling: first.modelSupportsFunctionCalling, modelSupportsJsonMode: first.modelSupportsJsonMode } : {}),
    }));
  };

  const handleAdd = () => {
    const newEp: APIEndpoint = {
      id: crypto.randomUUID(),
      name: `Endpoint ${endpoints.length + 1}`,
      enabled: true,
      provider: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: '',
    };
    updateEndpoints([...endpoints, newEp]);
    setEditingId(newEp.id);
  };

  const handleSave = (ep: APIEndpoint) => {
    updateEndpoints(endpoints.map(e => e.id === ep.id ? ep : e));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    updateEndpoints(endpoints.filter(e => e.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const handleToggle = (id: string) => {
    updateEndpoints(endpoints.map(e => e.id === id ? { ...e, enabled: !e.enabled } : e));
  };

  return (
    <div className="space-y-6 animate-fade-in-right">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">API Endpoints</h3>
          <p className="text-sm text-gray-500">
            {lang === 'zh' ? '配置多个API端点，批量翻译时自动并发分配。' : 'Configure multiple API endpoints for concurrent batch translation.'}
          </p>
        </div>
        <button onClick={handleAdd}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-2 text-xs font-bold transition-colors">
          <Plus size={14} /> {lang === 'zh' ? '添加端点' : 'Add Endpoint'}
        </button>
      </div>

      {/* Endpoint List */}
      <div className="space-y-3">
        {endpoints.map(ep => (
          <div key={ep.id}>
            {editingId === ep.id ? (
              <EndpointEditor endpoint={ep} config={config} lang={lang} onSave={handleSave} onCancel={() => setEditingId(null)} />
            ) : (
              <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${ep.enabled ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-900/30 border-gray-800 opacity-50'}`}>
                {/* Enable toggle */}
                <button onClick={() => handleToggle(ep.id)} title={ep.enabled ? 'Disable' : 'Enable'}
                  className={`p-1.5 rounded-lg transition-colors ${ep.enabled ? 'text-green-400 hover:bg-green-900/30' : 'text-gray-600 hover:bg-gray-800'}`}>
                  <Power size={16} />
                </button>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{ep.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${ep.provider === 'gemini' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                      {ep.provider === 'gemini' ? 'Gemini' : 'OpenAI'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate font-mono">{ep.model || '(no model)'}</p>
                </div>
                {/* Actions */}
                <button onClick={() => setEditingId(ep.id)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(ep.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}

        {endpoints.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            {lang === 'zh' ? '没有端点。点击"添加端点"开始配置。' : 'No endpoints. Click "Add Endpoint" to get started.'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-blue-900/10 border border-blue-800/30 rounded-lg">
        <p className="text-xs text-blue-300/80 leading-relaxed">
          <strong className="text-blue-200">{lang === 'zh' ? '并发模式' : 'Concurrency'}:</strong>{' '}
          {lang === 'zh'
            ? `当前启用 ${enabledCount} 个端点。批量翻译时，图片将自动轮流分配给各启用端点。`
            : `${enabledCount} endpoint(s) active. During batch translation, images are distributed round-robin across enabled endpoints.`}
        </p>
      </div>
    </div>
  );
};
