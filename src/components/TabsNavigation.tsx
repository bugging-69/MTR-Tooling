import React from 'react';
import { Terminal, Video, Wrench } from 'lucide-react';

interface TabsNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const TabsNavigation: React.FC<TabsNavigationProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'diagnostics', label: 'System Diagnostics', icon: Terminal, badge: 'Auto-Run Local Checks' },
    { id: 'live-test', label: 'Hardware Diagnostics', icon: Video, badge: 'Mic / Cam / Screen' },
    { id: 'remediation', label: 'Fix Guide', icon: Wrench, badge: 'Troubleshooting' },
  ];

  return (
    <div className="bg-slate-900/95 border-b border-slate-800 sticky top-16 z-40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto py-2.5 scrollbar-none" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  isActive ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
