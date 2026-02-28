import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, AlertCircle, Globe, ChevronDown, Check, Bot, Cpu, Plus, Trash2, Pencil, Power, ChevronUp, Clock, AlertTriangle, TestTube, Settings, X, RotateCcw } from 'lucide-react';
import { t } from '../../services/i18n';
import { fetchAvailableModels } from '../../services/geminiService';
import { AIProvider, APIEndpoint, mergeEndpointConfig } from '../../types';
import { TabProps } from './types';
import { isEndpointPaused, getRemainingPauseTime, formatPauseDuration, DEFAULT_API_PROTECTION_CONFIG } from '../../services/apiProtection';
import { testEndpointProtection, formatTestResults } from '../../services/apiProtectionTest';

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

      {/* Concurrency */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{lang === 'zh' ? '并发数' : 'Concurrency'}</label>
        <input type="number" min={1} max={10}
          value={draft.concurrency || 1}
          onChange={e => setDraft({ ...draft, concurrency: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })}
          className="w-20 bg-[#0f1115] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        <p className="text-[11px] text-gray-500">{lang === 'zh' ? '该端点同时处理的最大请求数' : 'Max parallel requests for this endpoint'}</p>
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
    updateEndpoints(endpoints.map(e => {
      if (e.id === id) {
        // When re-enabling a disabled endpoint, clear error state
        if (!e.enabled) {
          return { ...e, enabled: true, consecutiveErrors: 0, pausedUntil: undefined, lastError: undefined };
        }
        return { ...e, enabled: false };
      }
      return e;
    }));
  };

  // Test API Protection
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testResults, setTestResults] = useState<string>('');
  const [showProtectionSettings, setShowProtectionSettings] = useState(false);

  const runTest = (endpointId: string, scenario: 'single_error' | 'repeated_errors' | 'success_recovery' | 'auto_disable') => {
    const endpoint = endpoints.find(ep => ep.id === endpointId);
    if (!endpoint) return;

    const { steps, summary } = testEndpointProtection(endpoint, scenario);
    const resultsText = formatTestResults(steps, lang);

    setTestResults(`${summary}\n${resultsText}`);

    // Apply the final state to the endpoint
    if (steps.length > 0) {
      const finalStep = steps[steps.length - 1];
      updateEndpoints(endpoints.map(e => e.id === endpointId ? finalStep.result : e));
    }
  };

  const resetEndpoint = (endpointId: string) => {
    updateEndpoints(endpoints.map(e =>
      e.id === endpointId
        ? { ...e, consecutiveErrors: 0, pausedUntil: undefined, lastError: undefined }
        : e
    ));
    setTestResults('');
  };

  const resetProtectionSettings = () => {
    setConfig(prev => ({
      ...prev,
      apiProtectionEnabled: DEFAULT_API_PROTECTION_CONFIG.enabled,
      apiProtectionDurations: DEFAULT_API_PROTECTION_CONFIG.durations,
      apiProtectionDisableThreshold: DEFAULT_API_PROTECTION_CONFIG.disableThreshold,
      showApiProtectionTest: false,
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in-right">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">API Endpoints</h3>
            {endpoints.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-md bg-blue-500/20 text-blue-300 font-semibold">
                  {lang === 'zh' ? `${enabledCount} 个端点` : `${enabledCount} endpoint${enabledCount !== 1 ? 's' : ''}`}
                </span>
                <span className="text-xs px-2 py-1 rounded-md bg-green-500/20 text-green-300 font-semibold">
                  {lang === 'zh' ? `${endpoints.filter(ep => ep.enabled).reduce((sum, ep) => sum + Math.max(1, ep.concurrency || 1), 0)} 并发` : `${endpoints.filter(ep => ep.enabled).reduce((sum, ep) => sum + Math.max(1, ep.concurrency || 1), 0)} workers`}
                </span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {lang === 'zh' ? '配置多个API端点，批量翻译时自动并发分配。' : 'Configure multiple API endpoints for concurrent batch translation.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProtectionSettings(true)}
            className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 py-2 text-xs font-bold transition-colors"
            title={lang === 'zh' ? 'API 保护设置' : 'API Protection Settings'}
          >
            <Settings size={14} />
          </button>
          <button onClick={handleAdd}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-2 text-xs font-bold transition-colors">
            <Plus size={14} /> {lang === 'zh' ? '添加端点' : 'Add Endpoint'}
          </button>
        </div>
      </div>

      {/* API Protection Settings Modal */}
      {showProtectionSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d24] rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-[#1a1d24] z-10">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-blue-400" />
                <h3 className="text-lg font-semibold text-white">
                  {lang === 'zh' ? 'API 保护设置' : 'API Protection Settings'}
                </h3>
              </div>
              <button
                onClick={() => setShowProtectionSettings(false)}
                className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div>
                  <label className="text-sm font-semibold text-white">
                    {lang === 'zh' ? '启用 API 保护' : 'Enable API Protection'}
                  </label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {lang === 'zh' ? '自动检测并处理 429/503 等错误' : 'Automatically detect and handle 429/503 errors'}
                  </p>
                </div>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, apiProtectionEnabled: !(prev.apiProtectionEnabled ?? true) }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    (config.apiProtectionEnabled ?? true) ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    (config.apiProtectionEnabled ?? true) ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>

              {/* Disable Threshold */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  {lang === 'zh' ? '自动停用阈值' : 'Auto-Disable Threshold'}
                </label>
                <p className="text-xs text-gray-400">
                  {lang === 'zh' ? '第几次连续错误后自动停用端点（同时决定需要配置多少个暂停时间）' : 'Which consecutive error triggers auto-disable (also determines number of pause durations)'}
                </p>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.apiProtectionDisableThreshold || DEFAULT_API_PROTECTION_CONFIG.disableThreshold}
                  onChange={(e) => {
                    const newThreshold = parseInt(e.target.value) || 5;
                    const currentDurations = config.apiProtectionDurations || DEFAULT_API_PROTECTION_CONFIG.durations;

                    // Adjust durations array to match new threshold
                    let newDurations = [...currentDurations];
                    if (newThreshold > newDurations.length) {
                      // Add more durations (use last duration or 600 as default)
                      const lastDuration = newDurations[newDurations.length - 1] || 600;
                      while (newDurations.length < newThreshold) {
                        newDurations.push(lastDuration);
                      }
                    } else if (newThreshold < newDurations.length) {
                      // Remove extra durations
                      newDurations = newDurations.slice(0, newThreshold);
                    }

                    setConfig(prev => ({
                      ...prev,
                      apiProtectionDisableThreshold: newThreshold,
                      apiProtectionDurations: newDurations
                    }));
                  }}
                  className="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none"
                />
              </div>

              {/* Pause Durations */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">
                  {lang === 'zh' ? '暂停时间（秒）' : 'Pause Durations (seconds)'}
                </label>
                <p className="text-xs text-gray-400">
                  {lang === 'zh'
                    ? `每次错误后的暂停时间，共 ${config.apiProtectionDisableThreshold || DEFAULT_API_PROTECTION_CONFIG.disableThreshold} 个（对应阈值）`
                    : `Pause time after each error, ${config.apiProtectionDisableThreshold || DEFAULT_API_PROTECTION_CONFIG.disableThreshold} total (matches threshold)`}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: config.apiProtectionDisableThreshold || DEFAULT_API_PROTECTION_CONFIG.disableThreshold }).map((_, index) => {
                    const durations = config.apiProtectionDurations || DEFAULT_API_PROTECTION_CONFIG.durations;
                    const duration = durations[index] || 600;

                    return (
                      <div key={index} className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase">
                          {lang === 'zh' ? `第${index + 1}次` : `${index + 1}${['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th', 'th'][index]}`}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={duration}
                          onChange={(e) => {
                            const newDurations = [...(config.apiProtectionDurations || DEFAULT_API_PROTECTION_CONFIG.durations)];
                            // Ensure array is long enough
                            while (newDurations.length <= index) {
                              newDurations.push(600);
                            }
                            newDurations[index] = parseInt(e.target.value) || 1;
                            setConfig(prev => ({ ...prev, apiProtectionDurations: newDurations }));
                          }}
                          className="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-2 text-xs text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Show Test Tool */}
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div>
                  <label className="text-sm font-semibold text-white">
                    {lang === 'zh' ? '显示测试工具' : 'Show Test Tool'}
                  </label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {lang === 'zh' ? '在主界面显示 API 保护测试工具' : 'Show API protection test tool in main panel'}
                  </p>
                </div>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, showApiProtectionTest: !prev.showApiProtectionTest }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config.showApiProtectionTest ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    config.showApiProtectionTest ? 'translate-x-6' : ''
                  }`} />
                </button>
              </div>

              {/* Reset Button */}
              <button
                onClick={resetProtectionSettings}
                className="w-full flex items-center justify-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
              >
                <RotateCcw size={16} />
                {lang === 'zh' ? '恢复默认设置' : 'Reset to Defaults'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    {(ep.concurrency || 1) > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-yellow-500/20 text-yellow-400">
                        ×{ep.concurrency}
                      </span>
                    )}
                    {/* API Protection Status */}
                    {isEndpointPaused(ep) && (
                      <>
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold bg-orange-500/20 text-orange-400" title={ep.lastError || 'Rate limited'}>
                          <Clock size={10} />
                          {formatPauseDuration(getRemainingPauseTime(ep))}
                        </span>
                        {ep.consecutiveErrors && ep.consecutiveErrors > 0 && (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-400" title={`${ep.consecutiveErrors} consecutive errors`}>
                            <AlertTriangle size={10} />
                            {ep.consecutiveErrors}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate font-mono">{ep.model || '(no model)'}</p>
                  {isEndpointPaused(ep) && ep.lastError && (
                    <p className="text-[10px] text-red-400/70 truncate mt-0.5" title={ep.lastError}>
                      {ep.lastError}
                    </p>
                  )}
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

      {/* Test Panel */}
      {endpoints.length > 0 && config.showApiProtectionTest && (
        <div className="border border-purple-800/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowTestPanel(!showTestPanel)}
            className="w-full flex items-center justify-between p-3 bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TestTube size={16} className="text-purple-400" />
              <span className="text-sm font-semibold text-purple-300">
                {lang === 'zh' ? 'API 保护测试工具' : 'API Protection Test Tool'}
              </span>
            </div>
            {showTestPanel ? <ChevronUp size={16} className="text-purple-400" /> : <ChevronDown size={16} className="text-purple-400" />}
          </button>

          {showTestPanel && (
            <div className="p-4 bg-purple-900/5 space-y-4">
              <p className="text-xs text-gray-400">
                {lang === 'zh'
                  ? '模拟各种 API 错误场景，测试保护机制，无需消耗真实 token。'
                  : 'Simulate various API error scenarios to test protection without burning tokens.'}
              </p>

              {/* Endpoint Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase">
                  {lang === 'zh' ? '选择端点' : 'Select Endpoint'}
                </label>
                <select
                  id="test-endpoint"
                  className="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-2.5 text-sm text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none"
                >
                  {endpoints.map(ep => (
                    <option key={ep.id} value={ep.id}>
                      {ep.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Test Scenarios */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const select = document.getElementById('test-endpoint') as HTMLSelectElement;
                    runTest(select.value, 'single_error');
                  }}
                  className="p-2 bg-orange-900/20 hover:bg-orange-900/30 border border-orange-800/30 rounded-lg text-xs text-orange-300 transition-colors"
                >
                  {lang === 'zh' ? '单次错误 (30s)' : 'Single Error (30s)'}
                </button>

                <button
                  onClick={() => {
                    const select = document.getElementById('test-endpoint') as HTMLSelectElement;
                    runTest(select.value, 'repeated_errors');
                  }}
                  className="p-2 bg-orange-900/20 hover:bg-orange-900/30 border border-orange-800/30 rounded-lg text-xs text-orange-300 transition-colors"
                >
                  {lang === 'zh' ? '连续错误 (3次)' : 'Repeated Errors (3x)'}
                </button>

                <button
                  onClick={() => {
                    const select = document.getElementById('test-endpoint') as HTMLSelectElement;
                    runTest(select.value, 'success_recovery');
                  }}
                  className="p-2 bg-green-900/20 hover:bg-green-900/30 border border-green-800/30 rounded-lg text-xs text-green-300 transition-colors"
                >
                  {lang === 'zh' ? '恢复测试' : 'Success Recovery'}
                </button>

                <button
                  onClick={() => {
                    const select = document.getElementById('test-endpoint') as HTMLSelectElement;
                    runTest(select.value, 'auto_disable');
                  }}
                  className="p-2 bg-red-900/20 hover:bg-red-900/30 border border-red-800/30 rounded-lg text-xs text-red-300 transition-colors"
                >
                  {lang === 'zh' ? '自动停用 (5次)' : 'Auto-Disable (5x)'}
                </button>
              </div>

              {/* Reset Button */}
              <button
                onClick={() => {
                  const select = document.getElementById('test-endpoint') as HTMLSelectElement;
                  resetEndpoint(select.value);
                }}
                className="w-full p-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
              >
                {lang === 'zh' ? '重置端点状态' : 'Reset Endpoint State'}
              </button>

              {/* Test Results */}
              {testResults && (
                <div className="p-3 bg-[#0f1115] border border-gray-700 rounded-lg">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{testResults}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="space-y-3">
        <div className="p-3 bg-blue-900/10 border border-blue-800/30 rounded-lg">
          <p className="text-xs text-blue-300/80 leading-relaxed">
            <strong className="text-blue-200">{lang === 'zh' ? '并发模式' : 'Concurrency'}:</strong>{' '}
            {lang === 'zh'
              ? `当前启用 ${enabledCount} 个端点，总并发 ${endpoints.filter(ep => ep.enabled).reduce((sum, ep) => sum + Math.max(1, ep.concurrency || 1), 0)}。批量翻译时，每个端点按其并发数分配任务。`
              : `${enabledCount} endpoint(s) active, ${endpoints.filter(ep => ep.enabled).reduce((sum, ep) => sum + Math.max(1, ep.concurrency || 1), 0)} total workers. Each endpoint processes up to its concurrency limit.`}
          </p>
        </div>

        <div className="p-3 bg-orange-900/10 border border-orange-800/30 rounded-lg">
          <p className="text-xs text-orange-300/80 leading-relaxed">
            <strong className="text-orange-200">{lang === 'zh' ? 'API 保护' : 'API Protection'}:</strong>{' '}
            {lang === 'zh'
              ? '当端点遇到 429/503 等错误时，会自动暂停使用（30秒→1分钟→2分钟→5分钟→10分钟）。暂停时间超过 5 分钟后，端点将自动停用。'
              : 'Endpoints are automatically paused when encountering 429/503 errors (30s→1m→2m→5m→10m). Endpoints are auto-disabled after 5+ minutes of pause time.'}
          </p>
        </div>
      </div>
    </div>
  );
};
