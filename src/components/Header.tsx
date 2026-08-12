import React from 'react';
import { Monitor, ShieldCheck, Lock, Unlock } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  onLockAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, isAdmin, onOpenAdmin, onLockAdmin }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-inner flex items-center justify-center text-white">
            <Monitor className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg tracking-tight text-white">
                MTR Diagnostic Suite
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {isAdmin ? 'Admin Mode' : 'Standard Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Microsoft Teams Rooms (MTR) Functionality Dashboard
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700/60">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>PowerShell Engine</span>
          </div>
          
          {!isAdmin ? (
            <button
              onClick={onOpenAdmin}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-3 py-1.5 rounded-lg text-sm transition-all border border-slate-700"
              title="Unlock Developer Tools"
            >
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Admin Login</span>
            </button>
          ) : (
            <button
              onClick={onLockAdmin}
              className="flex items-center space-x-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 font-medium px-3 py-1.5 rounded-lg text-sm transition-all"
              title="Lock Developer Tools"
            >
              <Unlock className="w-4 h-4" />
              <span className="hidden sm:inline">Lock Session</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
