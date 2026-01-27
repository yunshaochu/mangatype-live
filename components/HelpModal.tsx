import React from 'react';
import { X, BookOpen, Command, MousePointer2, ImageDown, Sparkles, Import, ScanText, FileJson, FileStack, Zap } from 'lucide-react';
import { translations, Language } from '../services/i18n';

interface HelpModalProps {
  onClose: () => void;
  lang: Language;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose, lang }) => {
  const docs = translations[lang].helpDocs;

  // Icons for advanced features
  const advIcons = [ScanText, FileJson, FileStack];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl border border-gray-700 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl shrink-0">
          <h3 className="font-bold text-white flex items-center gap-2 text-lg">
            <BookOpen size={20} className="text-pink-400" /> {docs.title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8 text-gray-300 leading-relaxed">
          
          <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
            <p className="text-sm">{docs.intro}</p>
          </div>

          {/* Basic Steps */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="mt-1 bg-blue-900/30 p-2 rounded-lg h-fit text-blue-400 border border-blue-800/30"><Import size={20}/></div>
              <div>
                <h4 className="font-bold text-white mb-1">{docs.step1Title}</h4>
                <p className="text-sm text-gray-400">{docs.step1Desc}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="mt-1 bg-purple-900/30 p-2 rounded-lg h-fit text-purple-400 border border-purple-800/30"><Sparkles size={20}/></div>
              <div>
                <h4 className="font-bold text-white mb-1">{docs.step2Title}</h4>
                <p className="text-sm text-gray-400">{docs.step2Desc}</p>
              </div>
            </div>

            <div className="flex gap-3">
               <div className="mt-1 bg-green-900/30 p-2 rounded-lg h-fit text-green-400 border border-green-800/30"><MousePointer2 size={20}/></div>
              <div>
                <h4 className="font-bold text-white mb-1">{docs.step3Title}</h4>
                <p className="text-sm text-gray-400">{docs.step3Desc}</p>
              </div>
            </div>

            <div className="flex gap-3">
               <div className="mt-1 bg-orange-900/30 p-2 rounded-lg h-fit text-orange-400 border border-orange-800/30"><ImageDown size={20}/></div>
              <div>
                <h4 className="font-bold text-white mb-1">{docs.step4Title}</h4>
                <p className="text-sm text-gray-400">{docs.step4Desc}</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-700"></div>

          {/* Advanced Features */}
          <div>
            <h4 className="font-bold text-white mb-4 flex items-center gap-2 text-lg">
                <Zap size={18} className="text-yellow-400"/> {docs.advancedTitle}
            </h4>
            <div className="grid grid-cols-1 gap-4">
                {docs.advancedFeatures && docs.advancedFeatures.map((feat: any, idx: number) => {
                    const Icon = advIcons[idx % advIcons.length];
                    return (
                        <div key={idx} className="bg-gray-900/30 p-4 rounded-lg border border-gray-700/50 flex gap-3">
                            <div className="mt-0.5 text-gray-400"><Icon size={20}/></div>
                            <div>
                                <h5 className="font-bold text-gray-200 text-sm mb-1">{feat.title}</h5>
                                <p className="text-xs text-gray-400 leading-relaxed">{feat.desc}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>

          <div className="h-px bg-gray-700"></div>

          {/* Shortcuts */}
          <div>
             <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                <Command size={16} className="text-gray-400"/> {docs.tipsTitle}
             </h4>
             <ul className="space-y-2 text-sm text-gray-400 bg-black/20 p-4 rounded-lg">
                {docs.tipsList.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-1.5 shrink-0"></span>
                        <span>{tip}</span>
                    </li>
                ))}
             </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/50 rounded-b-xl flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded shadow transition-colors">
             {translations[lang].close}
          </button>
        </div>

      </div>
    </div>
  );
};
