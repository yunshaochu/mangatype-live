import React, { useState, useEffect, useRef } from 'react';
import { Server, RefreshCw, CheckCircle, AlertCircle, Globe, ChevronDown, Check, Bot, Cpu } from 'lucide-react';
import { t } from '../../services/i18n';
import { fetchAvailableModels } from '../../services/geminiService';
import { AIProvider } from '../../types';
import { TabProps } from './types';

export const ProviderTab: React.FC<TabProps> = ({ config, setConfig, lang }) => {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeProviderRef = useRef<string>(config.provider);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    activeProviderRef.current = config.provider;
    setLoadingModels(false);
    setError(null);
    if (config.provider !== 'gemini') {
      setAvailableModels([]);
    }
  }, [config.provider]);

  const handleFetchModels = async () => {
    const currentProvider = config.provider;
    setLoadingModels(true);
    setError(null);
    try {
      const models = await fetchAvailableModels(config);
      if (activeProviderRef.current !== currentProvider) return;
      if (models.length > 0) {
        setAvailableModels(models);
        setIsDropdownOpen(true);
        if (!config.model) {
          setConfig(prev => ({ ...prev, model: models[0] }));
        }
      } else {
        setError(config.provider === 'openai' ? t('noModels', lang) : t('failedFetch', lang));
      }
    } catch (e) {
      if (activeProviderRef.current === currentProvider) setError(t('failedFetch', lang));
    } finally {
      if (activeProviderRef.current === currentProvider) setLoadingModels(false);
    }
  };

  const handleProviderChange = (provider: AIProvider) => {
    setConfig(prev => ({
      ...prev,
      provider,
      baseUrl: provider === 'gemini' ? '' : (prev.baseUrl || 'https://api.openai.com/v1'),
      model: provider === 'gemini' ? 'gemini-3-flash-preview' : ''
    }));
  };

  const displayedModels = (() => {
    const current = config.model.trim().toLowerCase();
    if (!current) return availableModels;
    const isExactMatch = availableModels.some(m => m.toLowerCase() === current);
    if (isExactMatch) return availableModels;
    const filtered = availableModels.filter(m => m.toLowerCase().includes(current));
    return filtered.length > 0 ? filtered : availableModels;
  })();

  return (
    <div className="space-y-8 animate-fade-in-right">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-white">Connection & Model</h3>
        <p className="text-sm text-gray-500">Configure your AI provider and select the model.</p>
      </div>

      {/* Provider Switcher */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleProviderChange('gemini')}
          className={`relative p-4 rounded-xl border-2 text-left transition-all ${
            config.provider === 'gemini'
            ? 'bg-blue-900/10 border-blue-500 ring-1 ring-blue-500/20'
            : 'bg-gray-800/30 border-gray-800 hover:border-gray-600 opacity-60 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Bot size={20}/></div>
            <span className={`font-bold ${config.provider === 'gemini' ? 'text-white' : 'text-gray-300'}`}>Gemini</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">Google's native SDK. Uses <code>process.env</code> API Key.</p>
          {config.provider === 'gemini' && <div className="absolute top-4 right-4 text-blue-500"><CheckCircle size={18} /></div>}
        </button>

        <button
          onClick={() => handleProviderChange('openai')}
          className={`relative p-4 rounded-xl border-2 text-left transition-all ${
            config.provider === 'openai'
            ? 'bg-green-900/10 border-green-500 ring-1 ring-green-500/20'
            : 'bg-gray-800/30 border-gray-800 hover:border-gray-600 opacity-60 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg text-green-400"><Cpu size={20}/></div>
            <span className={`font-bold ${config.provider === 'openai' ? 'text-white' : 'text-gray-300'}`}>OpenAI</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">Compatible with DeepSeek, Claude, & Local LLMs.</p>
          {config.provider === 'openai' && <div className="absolute top-4 right-4 text-green-500"><CheckCircle size={18} /></div>}
        </button>
      </div>

      {/* Credentials Input */}
      <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-800 space-y-6">
        {config.provider === 'gemini' ? (
          <div className="flex gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg h-fit"><Server className="text-blue-400" size={20} /></div>
            <div>
              <h4 className="text-sm font-semibold text-blue-100 mb-1">{t('envConfigured', lang)}</h4>
              <p className="text-xs text-blue-300/70 leading-relaxed">
                The application is configured to use the API key injected via environment variables.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Base URL</label>
              <div className="relative group">
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-green-500 focus:ring-1 focus:ring-green-500/50 outline-none transition-all placeholder-gray-600"
                />
                <div className="absolute right-3 top-3 text-gray-600 group-focus-within:text-green-500 transition-colors"><Globe size={16}/></div>
              </div>
              <p className="text-[10px] text-gray-500">{t('baseUrlHint', lang)}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">API Key</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-green-500 focus:ring-1 focus:ring-green-500/50 outline-none transition-all placeholder-gray-600"
              />
            </div>
          </>
        )}
      </div>

      {/* Model Selector */}
      <div className="space-y-2" ref={dropdownRef}>
        <div className="flex justify-between items-end">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('modelSelection', lang)}</label>
          <button
            onClick={handleFetchModels}
            disabled={loadingModels}
            className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={loadingModels ? 'animate-spin' : ''}/>
            {loadingModels ? t('fetching', lang) : t('refreshModels', lang)}
          </button>
        </div>

        <div className="relative">
          <div className="relative group">
            <input
              type="text"
              value={config.model}
              onChange={(e) => {
                setConfig({ ...config, model: e.target.value });
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder="Select or type model name..."
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-3 pr-10 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none placeholder-gray-600 transition-all"
            />
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white rounded-md hover:bg-gray-700 transition-all"
              tabIndex={-1}
            >
              <ChevronDown size={16} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {isDropdownOpen && availableModels.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1f2937] border border-gray-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-50 styled-scrollbar animate-in fade-in zoom-in-95 duration-100">
              {displayedModels.map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setConfig({ ...config, model: m });
                    setIsDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-blue-600 hover:text-white flex justify-between items-center group transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="font-mono">{m}</span>
                  {config.model === m && <Check size={14} className="text-white" />}
                </button>
              ))}
              {displayedModels.length === 0 && (
                <div className="px-4 py-3 text-xs text-gray-500 italic text-center">No matches found</div>
              )}
            </div>
          )}
        </div>
        {error && <div className="text-xs text-red-400 flex items-center gap-1 mt-2 bg-red-900/10 p-2 rounded border border-red-900/20"><AlertCircle size={12}/> {error}</div>}
      </div>
    </div>
  );
};
