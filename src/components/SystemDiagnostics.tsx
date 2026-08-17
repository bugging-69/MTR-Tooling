import React, { useState } from 'react';
import { Play, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Server, Info, Terminal, DownloadCloud, FileText, Download, Building, MapPin, X, ExternalLink, ShieldCheck, Copy, Check, Sparkles } from 'lucide-react';
import { executeOperation, executionFailureMessage } from '../runtime/executionClient';
import type { OperationId } from '../shared/operations';
import { MTRReport } from '../types';

interface DiagnosticOutput {
  Timestamp: string;
  ComputerName: string;
  OSVersion: string;
  PSVersion: string;
  ResultsHashtable: Record<string, string>;
  Details: Record<string, string>;
}

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' && value !== null &&
  Object.values(value).every((entry) => typeof entry === 'string');

const isDiagnosticOutput = (value: unknown): value is DiagnosticOutput => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<DiagnosticOutput>;
  return typeof candidate.Timestamp === 'string' &&
    typeof candidate.ComputerName === 'string' &&
    typeof candidate.OSVersion === 'string' &&
    typeof candidate.PSVersion === 'string' &&
    isStringRecord(candidate.ResultsHashtable) &&
    isStringRecord(candidate.Details);
};

export const SystemDiagnostics: React.FC<{ advancedToolsEnabled?: boolean }> = ({ advancedToolsEnabled }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<MTRReport | null>(null);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<string>('');

  // Customer & Location Export Log State
  const [showExportModal, setShowExportModal] = useState(false);
  const [customer, setCustomer] = useState('');
  const [location, setLocation] = useState('');

  // Teams Room Offline Update Help Modal State
  const [showUpdateHelpModal, setShowUpdateHelpModal] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const sampleCommand = `PowerShell -ExecutionPolicy Unrestricted "C:\\Users\\Admin\\Downloads\\MTR-Update-4.5.6.7.ps1"`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleExportTxtLog = () => {
    if (!customer.trim() || !location.trim()) return;

    const timestamp = report?.timestamp || new Date().toISOString();
    const computerName = report?.computerName || 'LocalSystem';
    const osVersion = report?.osVersion || 'Windows 10 / 11 MTR';
    const psVersion = report?.powershellVersion || '5.1+';
    const overallStatus = report?.overallStatus || 'Completed';

    let txtContent = `================================================================
MICROSOFT TEAMS ROOMS (MTR) DIAGNOSTIC SYSTEM LOG
================================================================
Customer / Klant : ${customer.trim()}
Location / Room  : ${location.trim()}
Export Date      : ${new Date().toLocaleString()}
Report Generated : ${timestamp}
----------------------------------------------------------------
SYSTEM METADATA
----------------------------------------------------------------
Computer Name    : ${computerName}
OS Version       : ${osVersion}
PowerShell Ver   : ${psVersion}
Overall Status   : ${overallStatus}
================================================================
DIAGNOSTIC CHECK RESULTS (19 PARAMETERS)
================================================================
`;

    if (report?.results) {
      Object.entries(report.results).forEach(([key, statusVal]) => {
        const details = report.checkDetails?.[key] || 'N/A';
        const cleanStatus = typeof statusVal === 'string'
          ? statusVal.replace(/[✅⚠️❌]/g, '').trim() || statusVal
          : String(statusVal);

        txtContent += `${key.padEnd(18)} : [${cleanStatus.padEnd(5)}] - ${details}\n`;
      });
    } else if (rawOutput) {
      txtContent += `CONSOLE OUTPUT:\n${rawOutput}\n`;
    } else {
      txtContent += `Note: Run "Run Diagnostics" to include live parameter status checks.\n`;
    }

    txtContent += `================================================================\nEND OF DIAGNOSTIC LOG\n================================================================\n`;

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeCustomer = customer.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeLocation = location.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `MTR_Log_${safeCustomer}_${safeLocation}_${dateStr}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
  };

  const runOperation = async (operationId: OperationId) => {
    setIsRunning(true);
    setActiveJob(operationId);
    setReport(null);
    setRawOutput(null);
    setError(null);

    try {
      const result = await executeOperation(operationId);
      setRawOutput(result.stdout || null);
      setError(executionFailureMessage(result));

      if (result.success && operationId === 'run-diagnostics') {
        try {
          const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
          const parsed: unknown = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
          if (isDiagnosticOutput(parsed)) {
            const statuses = Object.values(parsed.ResultsHashtable);
            const failed = statuses.some((status) => status.includes('FAIL'));
            const warnings = statuses.some((status) => status.includes('WARN'));
            setReport({
              timestamp: parsed.Timestamp,
              computerName: parsed.ComputerName,
              osVersion: parsed.OSVersion,
              powershellVersion: parsed.PSVersion,
              overallStatus: failed ? 'Critical' : warnings ? 'Warning' : 'Healthy',
              results: parsed.ResultsHashtable,
              checkDetails: parsed.Details,
            });
          }
        } catch (parseError) {
          console.error('Error parsing JSON output:', parseError);
        }
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setIsRunning(false);
      setActiveJob('');
    }
  };

  const renderStatusIcon = (status: string) => {
    if (status.includes('PASS')) return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (status.includes('WARN')) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    if (status.includes('FAIL')) return <XCircle className="w-5 h-5 text-red-500" />;
    return <Info className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Automated System Diagnostics</h2>
          <p className="text-sm text-slate-400">Run the MTR health checks or utilities directly on this machine.</p>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-sm transition shadow-lg shadow-emerald-600/10"
        >
          <FileText className="w-4 h-4" />
          <span>Export Log (.txt)</span>
        </button>
      </div>

      {advancedToolsEnabled ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => runOperation('run-diagnostics')}
            disabled={isRunning}
            className="flex flex-col items-center justify-center p-5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition shadow-sm disabled:opacity-50"
          >
            <Terminal className="w-7 h-7 text-blue-400 mb-2" />
            <span className="font-semibold text-slate-200 text-center text-sm">Run Diagnostics</span>
            <span className="text-xs text-slate-500 mt-1">Read-only 19-point health check</span>
          </button>

          <button
            onClick={() => runOperation('install-mtr-update')}
            disabled={isRunning}
            className="flex flex-col items-center justify-center p-5 bg-slate-900 hover:bg-slate-800 border border-purple-500/40 rounded-xl transition shadow-sm disabled:opacity-50 relative group"
          >
            <Sparkles className="w-7 h-7 text-purple-400 mb-2" />
            <span className="font-semibold text-purple-200 text-center text-sm">Install Newest Teams Room</span>
            <span className="text-xs text-purple-400/80 mt-1">Official App Update</span>
          </button>

          <button
            onClick={() => runOperation('scan-repair-updates')}
            disabled={isRunning}
            className="flex flex-col items-center justify-center p-5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition shadow-sm disabled:opacity-50"
          >
            <DownloadCloud className="w-7 h-7 text-orange-400 mb-2" />
            <span className="font-semibold text-slate-200 text-center text-sm">Scan Updates & Repair MTR App</span>
            <span className="text-xs text-slate-500 mt-1">Requests a scan; does not install updates</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4 my-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <button
              onClick={() => runOperation('run-diagnostics')}
              disabled={isRunning}
              className="flex items-center space-x-3 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl shadow-xl hover:shadow-blue-500/20 transition-all disabled:opacity-50 text-base justify-center"
            >
              {isRunning && activeJob === 'run-diagnostics' ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              <span>{isRunning && activeJob === 'run-diagnostics' ? 'Running Checks...' : 'Run Diagnostics'}</span>
            </button>

            <button
              onClick={() => runOperation('install-mtr-update')}
              disabled={isRunning}
              className="flex items-center space-x-3 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-2xl shadow-xl hover:shadow-purple-500/20 transition-all disabled:opacity-50 text-base justify-center ring-2 ring-purple-400/30"
            >
              {isRunning && activeJob === 'install-mtr-update' ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              <span>{isRunning && activeJob === 'install-mtr-update' ? 'Installing Update...' : 'Install Newest Teams Room'}</span>
            </button>

            <button
              onClick={() => runOperation('scan-repair-updates')}
              disabled={isRunning}
              className="flex items-center space-x-3 bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 px-6 rounded-2xl shadow-xl hover:shadow-orange-500/20 transition-all disabled:opacity-50 text-base justify-center"
            >
              {isRunning && activeJob === 'scan-repair-updates' ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <DownloadCloud className="w-5 h-5" />
              )}
              <span>{isRunning && activeJob === 'scan-repair-updates' ? 'Requesting Scan & Repair...' : 'Scan Updates & Repair MTR App'}</span>
            </button>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setShowUpdateHelpModal(true)}
              className="inline-flex items-center space-x-2 text-xs font-semibold text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 px-3.5 py-1.5 rounded-full transition"
            >
              <Info className="w-3.5 h-3.5" />
              <span>How does Teams Room Offline App Update work? View details & direct link</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-300">Execution Error</h4>
            <pre className="mt-1 whitespace-pre-wrap font-mono text-xs opacity-80">{error}</pre>
          </div>
        </div>
      )}

      {isRunning && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-800"></div>
            <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin absolute inset-0"></div>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-medium text-slate-200">
              {activeJob === 'install-mtr-update' ? 'Downloading & Installing Official Teams Room Update...' : 'Executing Operation...'}
            </h3>
            <p className="text-sm text-slate-400">Please wait while the operation completes on the local system.</p>
          </div>
        </div>
      )}

      {!report && !isRunning && rawOutput && (
         <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-inner flex flex-col">
            <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between text-sm font-mono text-slate-300">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4" />
                <span>Console Output</span>
              </div>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-96">
              {rawOutput}
            </div>
         </div>
      )}

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center space-x-4">
              <div className="p-3 bg-slate-800 rounded-lg">
                <Server className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Hostname</p>
                <p className="text-sm font-bold text-slate-200">{report.computerName}</p>
              </div>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center space-x-4">
               <div className="p-3 bg-slate-800 rounded-lg">
                <Terminal className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">PowerShell</p>
                <p className="text-sm font-bold text-slate-200">{report.powershellVersion}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl col-span-2 flex items-center justify-between">
               <div>
                  <p className="text-xs text-slate-400 font-medium mb-1">System Health Status</p>
                  {report.overallStatus === 'Healthy' && (
                    <span className="inline-flex items-center space-x-1.5 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full font-medium text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>All Systems Operational</span>
                    </span>
                  )}
                  {report.overallStatus === 'Warning' && (
                    <span className="inline-flex items-center space-x-1.5 text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full font-medium text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Minor Warnings Detected</span>
                    </span>
                  )}
                  {report.overallStatus === 'Critical' && (
                    <span className="inline-flex items-center space-x-1.5 text-red-400 bg-red-400/10 px-3 py-1 rounded-full font-medium text-sm">
                      <XCircle className="w-4 h-4" />
                      <span>Critical Issues Found</span>
                    </span>
                  )}
               </div>
               <div className="flex flex-col items-end space-y-2">
                 <div className="text-right">
                   <p className="text-xs text-slate-400 mb-0.5">Report Generated</p>
                   <p className="text-xs font-mono text-slate-300">{new Date(report.timestamp).toLocaleString()}</p>
                 </div>
                 <button
                   onClick={() => setShowExportModal(true)}
                   className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                 >
                   <FileText className="w-3.5 h-3.5" />
                   <span>Export TXT Log</span>
                 </button>
               </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800">
                    <th className="py-4 px-6 font-semibold text-sm text-slate-300 w-1/4">Parameter</th>
                    <th className="py-4 px-6 font-semibold text-sm text-slate-300 w-1/4">Status</th>
                    <th className="py-4 px-6 font-semibold text-sm text-slate-300 w-1/2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {Object.keys(report.results).map((key) => {
                    const statusValue = report.results[key];
                    return <tr key={key} className="hover:bg-slate-800/50 transition">
                      <td className="py-4 px-6 font-medium text-slate-300">{key}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          {renderStatusIcon(statusValue)}
                          <span className="text-sm text-slate-200">
                            {statusValue.replace(/[✅⚠️❌]/g, '').trim() || (
                              statusValue.includes('PASS') ? 'Pass' :
                              statusValue.includes('WARN') ? 'Warn' :
                              statusValue.includes('FAIL') ? 'Fail' : 'Unknown'
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-400">
                        {report.checkDetails?.[key] || 'No details available.'}
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Export Log Modal Window */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
                <FileText className="w-5 h-5" />
                <span>Export Diagnostic Log (.txt)</span>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-300 leading-relaxed">
                Enter the customer details and room location below. Once both parameters are filled in, click <strong className="text-white">Export Log</strong> to download a formatted plain text (<code className="text-emerald-400 font-mono text-xs">.txt</code>) file containing all computer diagnostic information.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                    <Building className="w-3.5 h-3.5 text-blue-400" />
                    <span>Customer / Klant <span className="text-red-400">*</span></span>
                  </label>
                  <input
                    type="text"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="e.g. Acme Corporation / Enterprise Client"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Location / Room <span className="text-red-400">*</span></span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Room 302 / Executive Boardroom"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 transition"
                  />
                </div>
              </div>

              {(!customer.trim() || !location.trim()) && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-3.5 py-2.5 rounded-lg flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Both Customer/Klant and Location/Room must be filled in to enable export.</span>
                </div>
              )}
            </div>

            <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-sm transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportTxtLog}
                disabled={!customer.trim() || !location.trim()}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border disabled:border-slate-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition shadow-lg shadow-emerald-600/20 disabled:shadow-none"
              >
                <Download className="w-4 h-4" />
                <span>Export Log (.txt)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teams Room Offline Update Info Modal */}
      {showUpdateHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-800/80 px-6 py-4 border-b border-slate-700/80 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2 text-purple-400 font-semibold">
                <Sparkles className="w-5 h-5" />
                <span>Microsoft Teams Rooms App Offline Update Guide</span>
              </div>
              <button
                onClick={() => setShowUpdateHelpModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm text-slate-300 leading-relaxed">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-start space-x-3">
                <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-purple-200">Automated Installation Available</p>
                  <p className="text-purple-300/80">
                    Clicking <strong className="text-white">"Install Newest Teams Room"</strong> downloads the script into the private operation directory, requires a valid Microsoft Authenticode signature, then unblocks and executes that exact file as Administrator.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">Step 1: Download Official Script</h4>
                <p className="text-xs text-slate-400 mb-2">
                  First, download the latest official offline app update script directly from Microsoft:
                </p>
                <a
                  href="https://go.microsoft.com/fwlink/?linkid=2151817"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Download Latest MTR Update Script (linkid=2151817)</span>
                </a>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">Step 2: Unblock Downloaded File</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Downloaded files are marked as blocked by Windows. To unblock:
                </p>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 mt-1 font-mono">
                  <li>Right-click file in File Explorer &rarr; Properties &rarr; Check <strong className="text-white">Unblock</strong> &rarr; OK</li>
                  <li>Or run in PowerShell: <code className="text-purple-300 bg-slate-950 px-1.5 py-0.5 rounded">Unblock-File -Path "C:\Users\Admin\Downloads\MTR-Update-*.ps1"</code></li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">Step 3: Run Script with Unrestricted Policy</h4>
                <p className="text-xs text-slate-400 mb-2">
                  Open an elevated Command Prompt or PowerShell while the Skype user is signed in and run:
                </p>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between font-mono text-xs text-emerald-400">
                  <span className="truncate mr-2">{sampleCommand}</span>
                  <button
                    onClick={() => copyToClipboard(sampleCommand)}
                    className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg shrink-0 transition"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">Official Microsoft MTR Deployment Routine</span>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowUpdateHelpModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-sm transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdateHelpModal(false);
                    void runOperation('install-mtr-update');
                  }}
                  className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-5 py-2 rounded-xl text-sm transition shadow-lg shadow-purple-600/20"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Automate Update Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
