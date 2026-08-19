import React, { useState } from 'react';
import { MTR_CHECKS_METADATA } from '../data/mtrChecksInfo';
import { Search, Copy, Check, Terminal, ExternalLink, Wrench, ShieldAlert, Cpu, Network, Video, AppWindow } from 'lucide-react';

export const RemediationGuide: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const checksList = Object.values(MTR_CHECKS_METADATA);

  const handleCopyReferenceCommand = (key: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredList = checksList.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.troubleshooting.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.referenceCommand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              MTR 19-Point Troubleshooting & Reference Guide
            </h2>
            <p className="text-xs text-slate-400">
              Check-specific troubleshooting guidance with read-only PowerShell reference commands.
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative pt-2">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search checks, descriptions, troubleshooting, or reference commands..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-4">
        {filteredList.map((item) => (
          <div
            key={item.key}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20 font-semibold">
                  $Results.{item.key}
                </span>
                <h3 className="font-bold text-slate-100 text-sm">{item.name}</h3>
              </div>
              <span className="text-[11px] font-medium text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                {item.category}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Check Logic & WMI Command */}
              <div className="space-y-2">
                <div className="text-slate-400 font-semibold text-[11px]">Diagnostic Logic & PowerShell Query:</div>
                <p className="text-slate-300 leading-relaxed">{item.description}</p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-blue-300 select-all">
                  {item.psCommand}
                </div>
              </div>

              {/* Troubleshooting & Reference Command */}
              <div className="space-y-2">
                <div className="text-amber-400 font-semibold text-[11px] flex items-center justify-between">
                  <span>Troubleshooting & Reference:</span>
                  <button
                    onClick={() => handleCopyReferenceCommand(item.key, item.referenceCommand)}
                    className="text-slate-400 hover:text-white flex items-center space-x-1 font-normal text-[10px]"
                    title="Copy read-only PowerShell reference command"
                  >
                    {copiedKey === item.key ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedKey === item.key ? 'Copied!' : 'Copy Reference Command'}</span>
                  </button>
                </div>
                <p className="text-slate-300 leading-relaxed">{item.troubleshooting}</p>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300 select-all">
                  {item.referenceCommand}
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
