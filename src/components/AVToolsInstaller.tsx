import React from 'react';
import { Download, Terminal, Shield, Cpu } from 'lucide-react';

const downloadFile = (filename: string, content: string) => {
  const element = document.createElement('a');
  const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

export const AVToolsInstaller: React.FC = () => {
  const downloadScript = () => {
    const rawPowerShellScript = `# =====================================================
# Auto Elevation
# =====================================================

$currentUser = New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent()
)

if (-not $currentUser.IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator))
{
    Write-Host "Elevating privileges..." -ForegroundColor Yellow

    Start-Process PowerShell \`
        -Verb RunAs \`
        -ArgumentList "-ExecutionPolicy Bypass -NoProfile -File \`"$PSCommandPath\`""

    exit
}

# =====================================================
# Configuration
# =====================================================

$ErrorActionPreference = "Continue"

$AvexFolder = "C:\\AVEX"
if (-not (Test-Path $AvexFolder))
{
    New-Item -Path $AvexFolder -ItemType Directory -Force | Out-Null
}

# =====================================================
# Logging
# =====================================================

$LogFolder = "C:\\Logs"

if (-not (Test-Path $LogFolder))
{
    New-Item -Path $LogFolder -ItemType Directory -Force | Out-Null
}

$TimeStamp = Get-Date -Format "yyyyMMdd_HHmmss"

$MainLog = Join-Path $LogFolder "AV_Tool_Installation_$TimeStamp.log"

function Write-Log
{
    param(
        [string]$Message
    )

    $Entry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $Message"

    $Entry | Tee-Object -FilePath $MainLog -Append
}

Write-Log "================================================="
Write-Log "AV Tool Installation Started"
Write-Log "================================================="

# =====================================================
# Update Winget Sources
# =====================================================

Write-Host ""
Write-Host "Updating Winget sources..." -ForegroundColor Yellow

try
{
    winget source update

    if ($LASTEXITCODE -eq 0)
    {
        Write-Log "Winget sources updated successfully."
    }
    else
    {
        Write-Log "Winget source update returned exit code $LASTEXITCODE."
    }
}
catch
{
    Write-Log "Failed to update Winget sources: $($_.Exception.Message)"
}

# =====================================================
# Banner
# =====================================================

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "    AV Tools Automated Installation" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# =====================================================
# Applications
# =====================================================

$Applications = @(
    @{
        Name = "TeamViewer"
        Id   = "TeamViewer.TeamViewer"
    },
    @{
        Name = "Poly Lens"
        Id   = "Poly.PolyLens"
    },
    @{
        Name = "Yealink USB Connect"
        Id   = "Yealink.YealinkUSBConnect.CN"
    },
    @{
        Name = "Logitech Sync"
        Id   = "Logitech.Sync"
    }
)

# =====================================================
# Installation Loop
# =====================================================

foreach ($App in $Applications)
{
    Write-Host "--------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host "Checking $($App.Name)" -ForegroundColor Yellow
    Write-Host "--------------------------------------------------" -ForegroundColor DarkCyan

    Write-Log "Checking $($App.Name)"

    try
    {
        $Installed = winget list --exact --id $App.Id 2>$null

        if ($LASTEXITCODE -eq 0 -and $Installed)
        {
            Write-Host "$($App.Name) is already installed. Skipping." -ForegroundColor Green
            Write-Log "SKIPPED - Already Installed: $($App.Name)"
            continue
        }

        Write-Host "Installing $($App.Name)..." -ForegroundColor Yellow
        Write-Log "Starting installation of $($App.Name)"

        $AppInstallPath = Join-Path $AvexFolder $App.Name

        winget install \`
            --exact \`
            --id $App.Id \`
            --silent \`
            --disable-interactivity \`
            --accept-package-agreements \`
            --accept-source-agreements \`
            --location "$AppInstallPath"

        if ($LASTEXITCODE -eq 0)
        {
            Write-Host "$($App.Name) installed successfully." -ForegroundColor Green
            Write-Log "SUCCESS - Installed $($App.Name)"
        }
        else
        {
            Write-Host "$($App.Name) installation returned exit code $LASTEXITCODE" -ForegroundColor Red
            Write-Log "FAILED - $($App.Name) returned exit code $LASTEXITCODE"
        }
    }
    catch
    {
        Write-Host "Failed to install $($App.Name)" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red

        Write-Log "ERROR - $($App.Name): $($_.Exception.Message)"
    }

    Write-Host ""
}

# =====================================================
# Completion
# =====================================================

Write-Log "================================================="
Write-Log "AV Tool Installation Completed"
Write-Log "================================================="

Write-Host ""
Write-Host "Installation complete." -ForegroundColor Green
Write-Host "Log file: $MainLog" -ForegroundColor Cyan

Write-Host ""
Write-Host "Review any messages above for installation errors." -ForegroundColor Yellow
Write-Host "Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")`;

    const batWrapper = `@echo off
set "TempScript=%TEMP%\\AV_Tools_Installer.ps1"
powershell -NoProfile -Command "Get-Content '%~f0' | Select-Object -Skip 5 | Out-File -FilePath '%TempScript%' -Encoding UTF8"
powershell -NoProfile -ExecutionPolicy Bypass -File "%TempScript%"
exit /b
${rawPowerShellScript}`;

    downloadFile('Install-AVTools.cmd', batWrapper);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold text-slate-100">AV Tools Installer</h2>
        <p className="text-sm text-slate-400">
          Automated one-click installation script for unified communications peripherals.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative mt-8">
        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
        
        <div className="p-8 sm:p-10">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2 mb-2">
                  <Cpu size={20} className="text-cyan-400" />
                  AV Tools Batch Installer
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Downloads a self-elevating PowerShell script that automatically installs TeamViewer, Poly Lens, Yealink USB Connect, and Logitech Sync via Windows Package Manager.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Shield size={18} className="text-slate-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-300">Enforces local Administrator privileges automatically before attempting any installations.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Terminal size={18} className="text-slate-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-300">Skips packages that are already installed, ensuring idempotency.</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center bg-slate-950/50 p-8 rounded-lg border border-slate-800/60 w-full md:w-80">
              <Download size={32} className="text-cyan-500 mb-6" />
              <button 
                onClick={downloadScript}
                className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-4 rounded-md font-medium transition-colors shadow-lg shadow-cyan-900/20 text-lg"
              >
                Download & Run
              </button>
              <p className="text-xs text-slate-500 mt-4 text-center">
                Generates Install-AVTools.cmd
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
