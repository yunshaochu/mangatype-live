import { AIConfig } from '../../types';

export interface TabProps {
  config: AIConfig;
  setConfig: (config: AIConfig | ((prev: AIConfig) => AIConfig)) => void;
  lang: 'zh' | 'en';
}
