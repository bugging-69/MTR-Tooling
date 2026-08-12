export type CheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface MTRCheckResult {
  id: string;
  name: string;
  key: string; // Exact match to user's hashtable key, e.g. "Display", "TeamsApp"
  status: CheckStatus;
  value: string;
  details: string;
  recommendation?: string;
  category: 'Hardware' | 'Audio/Video' | 'Network' | 'Software/Teams' | 'System/Security';
}

export interface MTRReport {
  timestamp: string;
  computerName: string;
  osVersion: string;
  powershellVersion: string;
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  results: Record<string, string>; // e.g. { Display: "✅ Pass (2 Monitors, 1920x1080)", ... }
  checkDetails: MTRCheckResult[];
}

export interface ScriptConfig {
  minimumDiskSpaceGB: number;
  minimumDisplayCount: number;
  targetPingHost: string;
  targetPingPort: number;
  requireIPv6: boolean;
  requireTPM: boolean;
  requireAzureAD: boolean;
  exportFormat: 'hashtable' | 'json' | 'html' | 'csv' | 'all' | 'json_stdout';
  autoElevateAdmin: boolean;
  logToEventLog: boolean;
  webhookUrl: string;
}

export interface MTRProfilePreset {
  id: string;
  name: string;
  vendor: string;
  model: string;
  description: string;
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  results: Record<string, string>;
  checkDetails: MTRCheckResult[];
}
