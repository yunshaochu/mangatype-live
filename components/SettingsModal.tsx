import React, { useState, useEffect } from 'react';
import { AIConfig } from '../types';
import { Settings, X, Layout, Server, FileText, Scan, Eraser, Paintbrush, ALargeSmall, Zap } from 'lucide-react';
import { t } from '../services/i18n';
import { GeneralTab } from './settings/GeneralTab';
import { ProviderTab } from './settings/ProviderTab';
import { PromptTab } from './settings/PromptTab';
import { DetectionTab } from './settings/DetectionTab';
import { InpaintingTab } from './settings/InpaintingTab';
import { StyleTab } from './settings/StyleTab';
import { AdvancedTab } from './settings/AdvancedTab';
import { FontSizeTab } from './settings/FontSizeTab';

interface SettingsModalProps {
  config: AIConfig;
  onChange: (config: AIConfig) => void;
  onClose: () => void;
}

type TabKey = 'general' | 'provider' | 'prompt' | 'detection' | 'inpainting' | 'style' | 'fontSize' | 'advanced';

export const SettingsModal: React.FC<SettingsModalProps> = ({ config, onChange, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  const lang = config.language;

  // ESC closes the settings modal (bubble phase — sub-modals intercept first via capture)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Wrap onChange to support both direct value and functional updater (used by tabs)
  const handleChange: React.Dispatch<React.SetStateAction<AIConfig>> = (updater) => {
    const newConfig = typeof updater === 'function' ? updater(config) : updater;
    onChange(newConfig);
  };

  const tabs: { id: TabKey; label: string; icon: React.FC<any> }[] = [
    { id: 'general', label: 'General', icon: Layout },
    { id: 'provider', label: 'Provider & Model', icon: Server },
    { id: 'prompt', label: 'Prompts', icon: FileText },
    { id: 'detection', label: 'Detection', icon: Scan },
    { id: 'inpainting', label: 'Inpainting', icon: Eraser },
    { id: 'style', label: 'Styles', icon: Paintbrush },
    { id: 'fontSize', label: 'Font Size', icon: ALargeSmall },
    { id: 'advanced', label: 'Advanced', icon: Zap },
  ];

  const renderTabContent = () => {
    const tabProps = { config, setConfig: handleChange, lang };

    switch (activeTab) {
      case 'general':
        return <GeneralTab {...tabProps} />;
      case 'provider':
        return <ProviderTab {...tabProps} />;
      case 'prompt':
        return <PromptTab {...tabProps} />;
      case 'detection':
        return <DetectionTab {...tabProps} />;
      case 'inpainting':
        return <InpaintingTab {...tabProps} />;
      case 'style':
        return <StyleTab {...tabProps} />;
      case 'fontSize':
        return <FontSizeTab {...tabProps} />;
      case 'advanced':
        return <AdvancedTab {...tabProps} />;
      default:
        return null;
    }
  };

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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 outline-none focus:outline-none ${
                  activeTab === tab.id
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-sm'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 border border-transparent'
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
              {renderTabContent()}
            </div>
          </div>
        </div>

        {/* Footer Close Button */}
        <div className="absolute bottom-6 right-8 flex gap-3 z-10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-all border border-transparent hover:border-gray-700"
          >
            {t('close', lang)}
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
