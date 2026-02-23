import React, { useState } from 'react';
import { X, BookOpen, Command, Sparkles, Import, ImageDown, MousePointer2, Scan, Brush, Eraser, Layers, FileJson, Palette, Settings, Zap, ArrowRight } from 'lucide-react';
import { translations, Language } from '../services/i18n';

interface HelpModalProps {
  onClose: () => void;
  lang: Language;
}

type HelpTab = 'overview' | 'translate' | 'mask' | 'cleanup' | 'edit' | 'export' | 'settings' | 'shortcuts';

export const HelpModal: React.FC<HelpModalProps> = ({ onClose, lang }) => {
  const [activeTab, setActiveTab] = useState<HelpTab>('overview');
  const docs = translations[lang].helpDocs;

  const tabs: { id: HelpTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: docs.tabOverview, icon: <BookOpen size={14} /> },
    { id: 'translate', label: docs.tabTranslate, icon: <Sparkles size={14} /> },
    { id: 'mask', label: docs.tabMask, icon: <Scan size={14} /> },
    { id: 'cleanup', label: docs.tabCleanup, icon: <Eraser size={14} /> },
    { id: 'edit', label: docs.tabEdit, icon: <MousePointer2 size={14} /> },
    { id: 'export', label: docs.tabExport, icon: <ImageDown size={14} /> },
    { id: 'settings', label: docs.tabSettings, icon: <Settings size={14} /> },
    { id: 'shortcuts', label: docs.tabShortcuts, icon: <Command size={14} /> },
  ];

  /* ---- PLACEHOLDER_RENDER_SECTIONS ---- */

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-700 flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl shrink-0">
          <h3 className="font-bold text-white flex items-center gap-2 text-lg">
            <BookOpen size={20} className="text-pink-400" /> {docs.title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="border-b border-gray-700 bg-gray-900/30 px-4 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex gap-1 min-w-max">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2.5 text-xs font-medium rounded-t-md transition-all flex items-center gap-1.5 whitespace-nowrap border-b-2 ${
                  activeTab === tab.id
                    ? 'text-white border-pink-400 bg-gray-800/50'
                    : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/30'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto text-gray-300 leading-relaxed flex-1">
          {activeTab === 'overview' && <OverviewTab docs={docs} />}
          {activeTab === 'translate' && <SectionTab sections={docs.translateSections} />}
          {activeTab === 'mask' && <SectionTab sections={docs.maskSections} />}
          {activeTab === 'cleanup' && <SectionTab sections={docs.cleanupSections} />}
          {activeTab === 'edit' && <SectionTab sections={docs.editSections} />}
          {activeTab === 'export' && <SectionTab sections={docs.exportSections} />}
          {activeTab === 'settings' && <SectionTab sections={docs.settingsSections} />}
          {activeTab === 'shortcuts' && <ShortcutsTab docs={docs} />}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/50 rounded-b-xl flex justify-end shrink-0">
          <button onClick={onClose} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded shadow transition-colors">
            {translations[lang].close}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---- Sub-components ---- */

const OverviewTab: React.FC<{ docs: any }> = ({ docs }) => (
  <div className="space-y-6">
    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
      <p className="text-sm">{docs.intro}</p>
    </div>
    <div className="space-y-4">
      {docs.quickStart.map((step: any, i: number) => {
        const colors = ['blue', 'purple', 'green', 'orange'];
        const icons = [<Import size={20} key="i" />, <Sparkles size={20} key="s" />, <MousePointer2 size={20} key="m" />, <ImageDown size={20} key="d" />];
        const c = colors[i % colors.length];
        return (
          <div key={i} className="flex gap-3">
            <div className={`mt-1 bg-${c}-900/30 p-2 rounded-lg h-fit text-${c}-400 border border-${c}-800/30 shrink-0`}>
              {icons[i % icons.length]}
            </div>
            <div>
              <h4 className="font-bold text-white mb-1">{step.title}</h4>
              <p className="text-sm text-gray-400">{step.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
    {docs.layoutDesc && (
      <>
        <div className="h-px bg-gray-700" />
        <div>
          <h4 className="font-bold text-white mb-3 flex items-center gap-2"><Layers size={16} className="text-gray-400" /> {docs.layoutTitle}</h4>
          <p className="text-sm text-gray-400">{docs.layoutDesc}</p>
        </div>
      </>
    )}
  </div>
);

const SectionTab: React.FC<{ sections: any[] }> = ({ sections }) => (
  <div className="space-y-6">
    {sections.map((sec: any, i: number) => (
      <div key={i} className="space-y-2">
        <h4 className="font-bold text-white flex items-center gap-2">
          {sec.title}
        </h4>
        <p className="text-sm text-gray-400 leading-relaxed">{sec.desc}</p>
        {sec.steps && (
          <ol className="space-y-1.5 text-sm text-gray-400 bg-black/20 p-4 rounded-lg list-decimal list-inside">
            {sec.steps.map((s: string, j: number) => (
              <li key={j} className="leading-relaxed">{s}</li>
            ))}
          </ol>
        )}
        {sec.tip && (
          <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-3 text-xs text-yellow-200/80 flex gap-2">
            <Zap size={14} className="text-yellow-400 shrink-0 mt-0.5" />
            <span>{sec.tip}</span>
          </div>
        )}
        {i < sections.length - 1 && <div className="h-px bg-gray-700/50 mt-4" />}
      </div>
    ))}
  </div>
);

const ShortcutsTab: React.FC<{ docs: any }> = ({ docs }) => (
  <div className="space-y-4">
    {docs.shortcutGroups.map((group: any, i: number) => (
      <div key={i}>
        <h4 className="font-bold text-white mb-2 text-sm">{group.title}</h4>
        <div className="bg-black/20 rounded-lg overflow-hidden">
          {group.items.map((item: any, j: number) => (
            <div key={j} className={`flex items-center justify-between px-4 py-2 text-sm ${j > 0 ? 'border-t border-gray-700/30' : ''}`}>
              <span className="text-gray-400">{item.desc}</span>
              <kbd className="bg-gray-700 text-gray-200 px-2 py-0.5 rounded text-xs font-mono">{item.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);
