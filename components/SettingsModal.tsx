

import React, { useState, useEffect, useRef } from 'react';
import { AIConfig, AIProvider, CustomMessage } from '../types';
import { Settings, X, RefreshCw, CheckCircle, AlertCircle, Server, RotateCcw, Type, ScanText, Globe, RotateCw, ChevronDown, Check, MessageSquarePlus, Trash2, Plus, Scan } from 'lucide-react';
import { fetchAvailableModels, DEFAULT_SYSTEM_PROMPT } from '../services/geminiService';
import { t } from '../services/i18n';

interface SettingsModalProps {
  config: AIConfig;
  onSave: (config: AIConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ config, onSave, onClose }) => {
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Track the current provider to prevent race conditions with async fetches
  const activeProviderRef = useRef<string>(config.provider);
  
  const lang = localConfig.language;

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Provider Switching effects
  useEffect(() => {
    activeProviderRef.current = localConfig.provider;
    
    // Reset state immediately when switching providers
    setLoadingModels(false);
    setError(null);

    // Disable automatic fetch. Only clear if not Gemini (since Gemini might use defaults or user can refresh manually).
    if (localConfig.provider !== 'gemini') {
        setAvailableModels([]);
    }
  }, [localConfig.provider]);

  const handleFetchModels = async () => {
    const currentProvider = localConfig.provider;
    setLoadingModels(true);
    setError(null);
    
    try {
      const models = await fetchAvailableModels(localConfig);
      
      // If user switched provider while fetching, ignore results
      if (activeProviderRef.current !== currentProvider) return;

      if (models.length > 0) {
        setAvailableModels(models);
        // Auto-open dropdown to show results
        setIsDropdownOpen(true);
        
        // If current model is empty, select the first one
        if (!localConfig.model) {
             setLocalConfig(prev => ({ ...prev, model: models[0] }));
        }
      } else {
        if (localConfig.provider === 'openai') {
            setError(t('noModels', lang));
        } else {
            setError(t('failedFetch', lang));
        }
      }
    } catch (e) {
      if (activeProviderRef.current === currentProvider) {
        setError(t('failedFetch', lang));
      }
    } finally {
      if (activeProviderRef.current === currentProvider) {
        setLoadingModels(false);
      }
    }
  };

  const handleProviderChange = (provider: AIProvider) => {
    setLocalConfig(prev => ({
      ...prev,
      provider,
      baseUrl: provider === 'gemini' ? '' : (prev.baseUrl || 'https://api.openai.com/v1'),
      // Remove default model for OpenAI, keep for Gemini
      model: provider === 'gemini' ? 'gemini-3-flash-preview' : ''
    }));
  };

  const resetPrompt = () => {
      setLocalConfig(prev => ({ ...prev, systemPrompt: DEFAULT_SYSTEM_PROMPT }));
  };

  const handleAddCustomMessage = () => {
    setLocalConfig(prev => ({
      ...prev,
      customMessages: [
        ...(prev.customMessages || []),
        { role: 'user', content: '' }
      ]
    }));
  };

  const handleRemoveCustomMessage = (index: number) => {
    setLocalConfig(prev => ({
      ...prev,
      customMessages: (prev.customMessages || []).filter((_, i) => i !== index)
    }));
  };

  const handleUpdateCustomMessage = (index: number, field: keyof CustomMessage, value: string) => {
    setLocalConfig(prev => {
        const newMsgs = [...(prev.customMessages || [])];
        newMsgs[index] = { ...newMsgs[index], [field]: value };
        return { ...prev, customMessages: newMsgs };
    });
  };

  // Logic to determine which models to display in the list
  const getDisplayedModels = () => {
      const current = localConfig.model.trim().toLowerCase();
      if (!current) return availableModels;

      const isExactMatch = availableModels.some(m => m.toLowerCase() === current);
      if (isExactMatch) return availableModels;

      const filtered = availableModels.filter(m => m.toLowerCase().includes(current));
      return filtered.length > 0 ? filtered : availableModels;
  };

  const displayedModels = getDisplayedModels();

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Settings size={18} /> {t('aiSettings', lang)}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Language Selection */}
          <div className="space-y-2">
             <label className="text-sm text-gray-400 font-medium flex items-center gap-2">
                <Globe size={16}/> {t('language', lang)}
             </label>
             <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700">
                <button
                    onClick={() => setLocalConfig(prev => ({...prev, language: 'zh'}))}
                    className={`flex-1 py-1 text-sm rounded-md transition-all ${localConfig.language === 'zh' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    中文
                </button>
                <button
                    onClick={() => setLocalConfig(prev => ({...prev, language: 'en'}))}
                    className={`flex-1 py-1 text-sm rounded-md transition-all ${localConfig.language === 'en' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    English
                </button>
             </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-medium">{t('aiProvider', lang)}</label>
            <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700">
              <button
                onClick={() => handleProviderChange('gemini')}
                className={`flex-1 py-2 text-sm rounded-md transition-all flex items-center justify-center gap-2 ${localConfig.provider === 'gemini' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <div className="flex flex-col items-center leading-none">
                  <span>Gemini Native</span>
                  <span className="text-[10px] opacity-75 font-light">Uses Env Var</span>
                </div>
              </button>
              <button
                onClick={() => handleProviderChange('openai')}
                className={`flex-1 py-2 text-sm rounded-md transition-all flex items-center justify-center gap-2 ${localConfig.provider === 'openai' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
              >
                 <div className="flex flex-col items-center leading-none">
                  <span>OpenAI Compatible</span>
                  <span className="text-[10px] opacity-75 font-light">Custom Base URL</span>
                </div>
              </button>
            </div>
          </div>

          {/* Configuration Fields */}
          {localConfig.provider === 'gemini' ? (
             <div className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg space-y-2">
                <div className="flex items-start gap-3">
                    <Server className="text-blue-400 mt-1" size={18} />
                    <div>
                        <h4 className="text-sm font-semibold text-blue-100">{t('envConfigured', lang)}</h4>
                        <p className="text-xs text-blue-300 mt-1">
                            This app is using the built-in Gemini API key provided by the environment (<code className="bg-blue-900 px-1 rounded">process.env.API_KEY</code>).
                        </p>
                    </div>
                </div>
             </div>
          ) : (
            <>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium">{t('baseUrl', lang)}</label>
                  <input
                    type="text"
                    value={localConfig.baseUrl}
                    onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-green-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                     {t('baseUrlHint', lang)}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 font-medium">{t('apiKey', lang)}</label>
                  <input
                    type="password"
                    value={localConfig.apiKey}
                    onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-green-500 outline-none"
                  />
                </div>
            </>
          )}

          {/* Model Selection (Custom Combobox) */}
          <div className="space-y-2" ref={dropdownRef}>
            <div className="flex justify-between items-end">
                <label className="text-sm text-gray-400 font-medium">{t('modelSelection', lang)}</label>
                <button 
                  onClick={handleFetchModels}
                  disabled={loadingModels}
                  className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  <RefreshCw size={12} className={loadingModels ? 'animate-spin' : ''}/>
                  {loadingModels ? t('fetching', lang) : t('refreshModels', lang)}
                </button>
            </div>
            
            <div className="relative">
                <div className="relative">
                    <input
                        type="text"
                        value={localConfig.model}
                        onChange={(e) => {
                            setLocalConfig({ ...localConfig, model: e.target.value });
                            setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder="Select or type model name..."
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 pr-8 text-sm text-white focus:border-blue-500 outline-none placeholder-gray-600"
                    />
                    <button 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        tabIndex={-1}
                    >
                        <ChevronDown size={16} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Custom Dropdown */}
                {isDropdownOpen && availableModels.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 styled-scrollbar">
                        {displayedModels.map(m => (
                            <button
                                key={m}
                                onClick={() => {
                                    setLocalConfig({ ...localConfig, model: m });
                                    setIsDropdownOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white flex justify-between items-center group"
                            >
                                <span>{m}</span>
                                {localConfig.model === m && <Check size={14} className="text-green-500" />}
                            </button>
                        ))}
                        {displayedModels.length === 0 && (
                             <div className="px-3 py-2 text-xs text-gray-500 italic text-center">
                                No matches found in list
                             </div>
                        )}
                    </div>
                )}
            </div>
            {error && <div className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={12}/> {error}</div>}
            <p className="text-[10px] text-gray-500 mt-1">
               {t('modelFilterHint', lang)}
            </p>
          </div>

          {/* Pre-request Messages (Custom Conversation History) */}
          <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
             <div className="flex justify-between items-center mb-2">
                 <div className="flex items-center gap-2">
                    <MessageSquarePlus size={16} className="text-teal-400" />
                    <label className="text-sm text-gray-300 font-medium">{t('preRequestMessages', lang)}</label>
                 </div>
             </div>
             <p className="text-[10px] text-gray-500 mb-2">
                {t('preRequestHint', lang)}
             </p>
             
             <div className="space-y-2">
                {(localConfig.customMessages || []).map((msg, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-gray-800 p-2 rounded border border-gray-700">
                        <select 
                            value={msg.role}
                            onChange={(e) => handleUpdateCustomMessage(idx, 'role', e.target.value as any)}
                            className="bg-gray-700 text-xs text-white p-1.5 rounded border border-gray-600 outline-none w-24 shrink-0 focus:border-teal-500"
                        >
                            <option value="user">User</option>
                            <option value="system">System</option>
                            <option value="assistant">Assistant</option>
                        </select>
                        <textarea
                            rows={1}
                            value={msg.content}
                            onChange={(e) => handleUpdateCustomMessage(idx, 'content', e.target.value)}
                            placeholder={t('msgContent', lang)}
                            className="flex-1 bg-gray-700 text-xs text-white p-1.5 rounded border border-gray-600 outline-none focus:border-teal-500 resize-y min-h-[30px]"
                            style={{ minHeight: '30px' }}
                        />
                        <button 
                            onClick={() => handleRemoveCustomMessage(idx)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                
                <button 
                    onClick={handleAddCustomMessage}
                    className="w-full py-1.5 border border-dashed border-gray-600 rounded text-xs text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800 transition-colors flex items-center justify-center gap-1"
                >
                    <Plus size={12} /> {t('addMessage', lang)}
                </button>
             </div>
          </div>

          {/* AI Rotation Toggle */}
          <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <RotateCw size={16} className="text-purple-400" />
                    <label className="text-sm text-gray-300 font-medium">{t('allowAiRotation', lang)}</label>
                 </div>
                 <div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in">
                    <input 
                      type="checkbox" 
                      name="toggle-rot" 
                      id="ai-rotation-toggle" 
                      checked={localConfig.allowAiRotation || false}
                      onChange={(e) => setLocalConfig({...localConfig, allowAiRotation: e.target.checked})}
                      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-5 checked:border-purple-500"
                    />
                    <label htmlFor="ai-rotation-toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors ${localConfig.allowAiRotation ? 'bg-purple-500' : 'bg-gray-600'}`}></label>
                 </div>
             </div>
             <p className="text-[10px] text-gray-500">
                {t('allowAiRotationHint', lang)}
             </p>
          </div>

          {/* Manual Masks as Hints (NEW) */}
           <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <Scan size={16} className="text-red-400" />
                    <label className="text-sm text-gray-300 font-medium">{t('useMasksAsHints', lang)}</label>
                 </div>
                 <div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in">
                    <input 
                      type="checkbox" 
                      name="toggle-masks" 
                      id="use-masks-hints-toggle" 
                      checked={localConfig.useMasksAsHints || false}
                      onChange={(e) => setLocalConfig({...localConfig, useMasksAsHints: e.target.checked})}
                      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-5 checked:border-red-500"
                    />
                    <label htmlFor="use-masks-hints-toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors ${localConfig.useMasksAsHints ? 'bg-red-500' : 'bg-gray-600'}`}></label>
                 </div>
             </div>
             <p className="text-[10px] text-gray-500">
                {t('useMasksAsHintsHint', lang)}
             </p>
          </div>

          {/* EXPERIMENTAL: Text Detection API */}
          <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
             <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <ScanText size={16} className="text-orange-400" />
                    <label className="text-sm text-gray-300 font-medium">{t('textDetection', lang)}</label>
                 </div>
                 <div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in">
                    <input 
                      type="checkbox" 
                      name="toggle" 
                      id="text-detect-toggle" 
                      checked={localConfig.useTextDetectionApi}
                      onChange={(e) => setLocalConfig({...localConfig, useTextDetectionApi: e.target.checked})}
                      className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-5 checked:border-green-500"
                    />
                    <label htmlFor="text-detect-toggle" className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors ${localConfig.useTextDetectionApi ? 'bg-green-500' : 'bg-gray-600'}`}></label>
                 </div>
             </div>
             {localConfig.useTextDetectionApi && (
               <div className="space-y-2 animate-fade-in">
                  <input 
                    type="text" 
                    value={localConfig.textDetectionApiUrl}
                    onChange={(e) => setLocalConfig({ ...localConfig, textDetectionApiUrl: e.target.value })}
                    placeholder="http://localhost:5000"
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-xs text-white focus:border-orange-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-500">
                    Will call <code>/detect</code> endpoint to provide spatial hints to the LLM.
                  </p>
               </div>
             )}
          </div>

          {/* NEW: Default Font Size Control */}
          <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-300 font-medium flex items-center gap-2">
                <Type size={16} className="text-pink-400" /> {t('defaultFontSize', lang)}
              </label>
              <span className="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded text-pink-300">
                {localConfig.defaultFontSize.toFixed(2)}rem
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.05"
              value={localConfig.defaultFontSize}
              onChange={(e) => setLocalConfig({ ...localConfig, defaultFontSize: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
            />
          </div>

          {/* System Prompt Editor */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
                 <label className="text-sm text-gray-400 font-medium">{t('systemPrompt', lang)}</label>
                 <button 
                  onClick={resetPrompt}
                  className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors"
                  title="Reset to default prompt"
                 >
                   <RotateCcw size={12}/> Reset
                 </button>
            </div>
            <textarea
              value={localConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT}
              onChange={(e) => setLocalConfig({ ...localConfig, systemPrompt: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-xs text-gray-300 focus:border-purple-500 outline-none font-mono leading-relaxed"
              rows={6}
              spellCheck={false}
            />
          </div>

        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-900/50 rounded-b-xl flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            {t('cancel', lang)}
          </button>
          <button 
            onClick={() => onSave(localConfig)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-bold rounded shadow-lg flex items-center gap-2"
          >
            <CheckCircle size={16} /> {t('saveSettings', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
