

import React, { useState, useEffect, useRef } from 'react';
import { AIConfig, AIProvider, CustomMessage } from '../types';
import { Settings, X, RefreshCw, CheckCircle, AlertCircle, Server, RotateCcw, Type, ScanText, Globe, RotateCw, ChevronDown, Check, MessageSquarePlus, Trash2, Plus, Scan, Pipette, Zap, Bot, Layout, Cpu, FileText, Magnet, Paintbrush, Square, Circle, Box, Eye, PenTool } from 'lucide-react';
import { fetchAvailableModels, DEFAULT_SYSTEM_PROMPT } from '../services/geminiService';
import { t } from '../services/i18n';

interface SettingsModalProps {
  config: AIConfig;
  onSave: (config: AIConfig) => void;
  onClose: () => void;
}

// Renamed 'model' to 'prompt' to better reflect new structure
type TabKey = 'general' | 'provider' | 'prompt' | 'detection' | 'style' | 'advanced';

export const SettingsModal: React.FC<SettingsModalProps> = ({ config, onSave, onClose }) => {
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeProviderRef = useRef<string>(config.provider);
  
  const lang = localConfig.language;

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
    activeProviderRef.current = localConfig.provider;
    setLoadingModels(false);
    setError(null);
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
      if (activeProviderRef.current !== currentProvider) return;
      if (models.length > 0) {
        setAvailableModels(models);
        setIsDropdownOpen(true);
        if (!localConfig.model) {
             setLocalConfig(prev => ({ ...prev, model: models[0] }));
        }
      } else {
        setError(localConfig.provider === 'openai' ? t('noModels', lang) : t('failedFetch', lang));
      }
    } catch (e) {
      if (activeProviderRef.current === currentProvider) setError(t('failedFetch', lang));
    } finally {
      if (activeProviderRef.current === currentProvider) setLoadingModels(false);
    }
  };

  const handleProviderChange = (provider: AIProvider) => {
    setLocalConfig(prev => ({
      ...prev,
      provider,
      baseUrl: provider === 'gemini' ? '' : (prev.baseUrl || 'https://api.openai.com/v1'),
      model: provider === 'gemini' ? 'gemini-3-flash-preview' : ''
    }));
  };

  const resetPrompt = () => setLocalConfig(prev => ({ ...prev, systemPrompt: DEFAULT_SYSTEM_PROMPT }));

  const handleUpdateCustomMessage = (index: number, field: keyof CustomMessage, value: string) => {
    setLocalConfig(prev => {
        const newMsgs = [...(prev.customMessages || [])];
        newMsgs[index] = { ...newMsgs[index], [field]: value };
        return { ...prev, customMessages: newMsgs };
    });
  };

  const displayedModels = (() => {
      const current = localConfig.model.trim().toLowerCase();
      if (!current) return availableModels;
      const isExactMatch = availableModels.some(m => m.toLowerCase() === current);
      if (isExactMatch) return availableModels;
      const filtered = availableModels.filter(m => m.toLowerCase().includes(current));
      return filtered.length > 0 ? filtered : availableModels;
  })();

  const tabs: { id: TabKey; label: string; icon: React.FC<any> }[] = [
      { id: 'general', label: 'General', icon: Layout },
      { id: 'provider', label: 'Provider & Model', icon: Server },
      { id: 'prompt', label: 'Prompts', icon: FileText },
      { id: 'detection', label: 'Detection', icon: Scan }, // New Tab
      { id: 'style', label: 'Styles', icon: Paintbrush },
      { id: 'advanced', label: 'Advanced', icon: Zap },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-[#111827] w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl border border-gray-800 flex overflow-hidden ring-1 ring-white/10">
        
        {/* Sidebar */}
        <div className="w-64 bg-[#0f1115] border-r border-gray-800 flex flex-col shrink-0">
            <div className="p-6 border-b border-gray-800/50">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                        <Settings size={20} />
                    </div>
                    {t('settings', lang)}
                </h2>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                            activeTab === tab.id 
                            ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-sm' 
                            : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                        }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-gray-800/50">
                <p className="text-[10px] text-gray-600 text-center">MangaType Live v2.2</p>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#111827]">
             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-2xl mx-auto space-y-8">
                    
                    {/* --- GENERAL TAB --- */}
                    {activeTab === 'general' && (
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
                                                onClick={() => setLocalConfig(prev => ({...prev, language: l as any}))}
                                                className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-all ${
                                                    localConfig.language === l 
                                                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 ring-1 ring-indigo-500/20' 
                                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                                                }`}
                                            >
                                                {l === 'zh' ? '中文 (Chinese)' : 'English'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Default Font Size */}
                                <div className="p-5 bg-gray-800/30 rounded-xl border border-gray-800 space-y-4">
                                     <div className="flex justify-between items-center">
                                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                            <Type size={16} className="text-pink-400" /> {t('defaultFontSize', lang)}
                                        </label>
                                        <span className="text-xs font-mono bg-gray-900 px-2 py-1 rounded-md text-pink-300 border border-gray-700">
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
                                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- PROVIDER & MODEL TAB --- */}
                    {activeTab === 'provider' && (
                        <div className="space-y-8 animate-fade-in-right">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-white">Connection & Model</h3>
                                <p className="text-sm text-gray-500">Configure your AI provider and select the model.</p>
                            </div>

                            {/* 1. Provider Switcher */}
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => handleProviderChange('gemini')}
                                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                                        localConfig.provider === 'gemini' 
                                        ? 'bg-blue-900/10 border-blue-500 ring-1 ring-blue-500/20' 
                                        : 'bg-gray-800/30 border-gray-800 hover:border-gray-600 opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Bot size={20}/></div>
                                        <span className={`font-bold ${localConfig.provider === 'gemini' ? 'text-white' : 'text-gray-300'}`}>Gemini</span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">Google's native SDK. Uses <code>process.env</code> API Key.</p>
                                    {localConfig.provider === 'gemini' && <div className="absolute top-4 right-4 text-blue-500"><CheckCircle size={18} /></div>}
                                </button>

                                <button
                                    onClick={() => handleProviderChange('openai')}
                                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                                        localConfig.provider === 'openai' 
                                        ? 'bg-green-900/10 border-green-500 ring-1 ring-green-500/20' 
                                        : 'bg-gray-800/30 border-gray-800 hover:border-gray-600 opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-green-500/20 rounded-lg text-green-400"><Cpu size={20}/></div>
                                        <span className={`font-bold ${localConfig.provider === 'openai' ? 'text-white' : 'text-gray-300'}`}>OpenAI</span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">Compatible with DeepSeek, Claude, & Local LLMs.</p>
                                    {localConfig.provider === 'openai' && <div className="absolute top-4 right-4 text-green-500"><CheckCircle size={18} /></div>}
                                </button>
                            </div>

                            {/* 2. Credentials Input */}
                            <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-800 space-y-6">
                                {localConfig.provider === 'gemini' ? (
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
                                                    value={localConfig.baseUrl}
                                                    onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value })}
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
                                                value={localConfig.apiKey}
                                                onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
                                                placeholder="sk-..."
                                                className="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-green-500 focus:ring-1 focus:ring-green-500/50 outline-none transition-all placeholder-gray-600"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* 3. Model Selector */}
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
                                            value={localConfig.model}
                                            onChange={(e) => {
                                                setLocalConfig({ ...localConfig, model: e.target.value });
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
                                                        setLocalConfig({ ...localConfig, model: m });
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-blue-600 hover:text-white flex justify-between items-center group transition-colors first:rounded-t-xl last:rounded-b-xl"
                                                >
                                                    <span className="font-mono">{m}</span>
                                                    {localConfig.model === m && <Check size={14} className="text-white" />}
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
                    )}

                    {/* --- PROMPTS TAB --- */}
                    {activeTab === 'prompt' && (
                        <div className="space-y-8 animate-fade-in-right">
                             <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-white">System Prompts</h3>
                                <p className="text-sm text-gray-500">Customize how the AI behaves and translates.</p>
                            </div>

                            <div className="space-y-6">
                                {/* System Prompt */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('systemPrompt', lang)}</label>
                                        <button onClick={resetPrompt} className="text-xs flex items-center gap-1 text-gray-500 hover:text-white transition-colors">
                                            <RotateCcw size={12}/> Reset
                                        </button>
                                    </div>
                                    <textarea
                                        value={localConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT}
                                        onChange={(e) => setLocalConfig({ ...localConfig, systemPrompt: e.target.value })}
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none font-mono leading-relaxed resize-y min-h-[200px]"
                                        spellCheck={false}
                                    />
                                </div>

                                 {/* Pre-request Messages */}
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MessageSquarePlus size={16} className="text-teal-400" />
                                        <label className="text-sm font-medium text-white">{t('preRequestMessages', lang)}</label>
                                    </div>
                                    <p className="text-xs text-gray-500">{t('preRequestHint', lang)}</p>
                                    
                                    <div className="space-y-2 bg-gray-800/20 p-4 rounded-xl border border-gray-800">
                                        {(localConfig.customMessages || []).map((msg, idx) => (
                                            <div key={idx} className="flex items-start gap-2 group">
                                                <select 
                                                    value={msg.role}
                                                    onChange={(e) => handleUpdateCustomMessage(idx, 'role', e.target.value as any)}
                                                    className="bg-gray-800 text-xs text-gray-300 p-2 rounded-lg border border-gray-700 outline-none focus:border-teal-500"
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
                                                    className="flex-1 bg-gray-800 text-xs text-white p-2 rounded-lg border border-gray-700 outline-none focus:border-teal-500 resize-y min-h-[34px]"
                                                />
                                                <button 
                                                    onClick={() => {
                                                        setLocalConfig(prev => ({
                                                            ...prev,
                                                            customMessages: (prev.customMessages || []).filter((_, i) => i !== idx)
                                                        }));
                                                    }}
                                                    className="p-2 text-gray-600 hover:text-red-400 hover:bg-gray-700/50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        
                                        <button 
                                            onClick={() => setLocalConfig(prev => ({
                                                ...prev,
                                                customMessages: [...(prev.customMessages || []), { role: 'user', content: '' }]
                                            }))}
                                            className="w-full py-2 border border-dashed border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-500 hover:bg-gray-800 transition-all flex items-center justify-center gap-1"
                                        >
                                            <Plus size={14} /> {t('addMessage', lang)}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* --- DETECTION TAB (NEW) --- */}
                    {activeTab === 'detection' && (
                        <div className="space-y-8 animate-fade-in-right">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-white">{t('detectionTab', lang)}</h3>
                                <p className="text-sm text-gray-500">{t('detectionTabDesc', lang)}</p>
                            </div>
                            
                            <div className="grid gap-4">
                                {/* 1. Masked Image Mode (New) */}
                                <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-pink-500/30 rounded-xl transition-colors group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3">
                                            <div className="mt-1 p-1.5 bg-pink-500/10 rounded text-pink-400"><Eye size={18}/></div>
                                            <div>
                                                <h4 className="text-sm font-medium text-white mb-1">{t('enableMaskedImageMode', lang)}</h4>
                                                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{t('enableMaskedImageModeHint', lang)}</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={localConfig.enableMaskedImageMode || false}
                                                onChange={(e) => setLocalConfig({...localConfig, enableMaskedImageMode: e.target.checked})}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-pink-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                                        </label>
                                    </div>
                                </div>

                                {/* 2. Use Masks As Hints */}
                                <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-red-500/30 rounded-xl transition-colors group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3">
                                            <div className="mt-1 p-1.5 bg-red-500/10 rounded text-red-400"><Scan size={18}/></div>
                                            <div>
                                                <h4 className="text-sm font-medium text-white mb-1">{t('useMasksAsHints', lang)}</h4>
                                                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">{t('useMasksAsHintsHint', lang)}</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={localConfig.useMasksAsHints || false}
                                                onChange={(e) => setLocalConfig({...localConfig, useMasksAsHints: e.target.checked})}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                        </label>
                                    </div>
                                </div>
                                
                                {/* 3. Local Text Detection */}
                                <div className={`p-4 rounded-xl border transition-colors ${localConfig.useTextDetectionApi ? 'bg-orange-900/10 border-orange-500/30' : 'bg-gray-800/30 border-gray-800 hover:border-orange-500/30'}`}>
                                     <div className="flex justify-between items-start mb-3">
                                        <div className="flex gap-3">
                                            <div className="mt-1 p-1.5 bg-orange-500/10 rounded text-orange-400"><ScanText size={18}/></div>
                                            <div>
                                                <h4 className="text-sm font-medium text-white mb-1 flex items-center gap-2">{t('textDetection', lang)} <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">Beta</span></h4>
                                                <p className="text-xs text-gray-500">Requires local Python service.</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={localConfig.useTextDetectionApi}
                                                onChange={(e) => setLocalConfig({...localConfig, useTextDetectionApi: e.target.checked})}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                        </label>
                                    </div>
                                    
                                    {localConfig.useTextDetectionApi && (
                                        <div className="animate-fade-in-down pl-11">
                                            <input 
                                                type="text" 
                                                value={localConfig.textDetectionApiUrl}
                                                onChange={(e) => setLocalConfig({ ...localConfig, textDetectionApiUrl: e.target.value })}
                                                placeholder="http://localhost:5000"
                                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-xs text-white focus:border-orange-500 outline-none placeholder-gray-600 font-mono"
                                            />
                                            <p className="text-[10px] text-gray-500 mt-1">
                                                Target endpoint. The app will POST to <code>/detect</code>.
                                            </p>
                                        </div>
                                    )}
                                </div>
                                
                                {/* 4. Dialog Snapping */}
                                <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-yellow-500/30 rounded-xl transition-colors group flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3">
                                            <div className="mt-1 p-1.5 bg-yellow-500/10 rounded text-yellow-400"><Magnet size={18}/></div>
                                            <div>
                                                <h4 className="text-sm font-medium text-white mb-1">{t('enableDialogSnap', lang)}</h4>
                                                <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed">{t('enableDialogSnapHint', lang)}</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only peer"
                                                checked={localConfig.enableDialogSnap !== false}
                                                onChange={(e) => setLocalConfig({...localConfig, enableDialogSnap: e.target.checked})}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                                        </label>
                                    </div>

                                    {/* Sub-Switch: Force Size */}
                                    {localConfig.enableDialogSnap !== false && (
                                        <div className="pl-11 pt-2 border-t border-gray-700/50 animate-fade-in-down">
                                             <div className="flex justify-between items-center">
                                                <div>
                                                    <h5 className="text-xs font-medium text-gray-300">{t('forceSnapSize', lang)}</h5>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">{t('forceSnapSizeHint', lang)}</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        className="sr-only peer"
                                                        checked={localConfig.forceSnapSize || false}
                                                        onChange={(e) => setLocalConfig({...localConfig, forceSnapSize: e.target.checked})}
                                                    />
                                                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-yellow-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-600"></div>
                                                </label>
                                             </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- STYLE TAB --- */}
                    {activeTab === 'style' && (
                        <div className="space-y-8 animate-fade-in-right">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-white">{t('maskStyle', lang)}</h3>
                                <p className="text-sm text-gray-500">Set default visual appearance for all speech bubbles.</p>
                            </div>

                            <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-800 space-y-6">
                                {/* Shape Selection */}
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('shape', lang)}</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: 'rectangle', label: t('shapeRect', lang), icon: Square },
                                            { id: 'rounded', label: t('shapeRound', lang), icon: Box },
                                            { id: 'ellipse', label: t('shapeEllipse', lang), icon: Circle },
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setLocalConfig({ ...localConfig, defaultMaskShape: opt.id as any })}
                                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                                    localConfig.defaultMaskShape === opt.id 
                                                    ? 'bg-blue-600/20 border-blue-500 text-blue-300 ring-1 ring-blue-500/30' 
                                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-500'
                                                }`}
                                            >
                                                <opt.icon size={20} className={localConfig.defaultMaskShape === opt.id ? "fill-current opacity-20" : ""} />
                                                <span className="text-xs font-medium">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Corner Radius Slider (Only for Rounded) */}
                                {localConfig.defaultMaskShape === 'rounded' && (
                                    <div className="space-y-2 animate-fade-in-down">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('cornerRadius', lang)}</label>
                                            <span className="text-xs font-mono text-gray-300 bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{localConfig.defaultMaskCornerRadius}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="50"
                                            step="1"
                                            value={localConfig.defaultMaskCornerRadius}
                                            onChange={(e) => setLocalConfig({ ...localConfig, defaultMaskCornerRadius: parseInt(e.target.value) })}
                                            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                    </div>
                                )}

                                {/* Feathering Slider */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('feathering', lang)}</label>
                                        <span className="text-xs font-mono text-gray-300 bg-gray-900 px-2 py-0.5 rounded border border-gray-700">{localConfig.defaultMaskFeather}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="50"
                                        step="1"
                                        value={localConfig.defaultMaskFeather}
                                        onChange={(e) => setLocalConfig({ ...localConfig, defaultMaskFeather: parseInt(e.target.value) })}
                                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                    <p className="text-[10px] text-gray-500">Controls the blur amount of the mask edges.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- ADVANCED TAB --- */}
                    {activeTab === 'advanced' && (
                        <div className="space-y-8 animate-fade-in-right">
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-white">Advanced & Experimental</h3>
                                <p className="text-sm text-gray-500">Power tools and beta features.</p>
                            </div>

                            <div className="grid gap-4">
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
                                                checked={localConfig.autoDetectBackground !== false}
                                                onChange={(e) => setLocalConfig({...localConfig, autoDetectBackground: e.target.checked})}
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
                                                checked={localConfig.allowAiRotation || false}
                                                onChange={(e) => setLocalConfig({...localConfig, allowAiRotation: e.target.checked})}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>
                                </div>

                                {/* Allow AI Font Selection */}
                                <div className="p-4 bg-gray-800/30 border border-gray-800 hover:border-teal-500/30 rounded-xl transition-colors group">
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
                                                checked={localConfig.allowAiFontSelection !== false}
                                                onChange={(e) => setLocalConfig({...localConfig, allowAiFontSelection: e.target.checked})}
                                            />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Footer Actions (Floating or Fixed at bottom right) */}
        <div className="absolute bottom-6 right-8 flex gap-3 z-10">
             <button 
                onClick={onClose} 
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all border border-transparent hover:border-gray-700"
            >
                {t('cancel', lang)}
            </button>
            <button 
                onClick={() => onSave(localConfig)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
            >
                <CheckCircle size={18} /> {t('saveSettings', lang)}
            </button>
        </div>
        
        {/* Close Button Top Right */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-all"
        >
            <X size={20} />
        </button>

      </div>
    </div>
  );
};