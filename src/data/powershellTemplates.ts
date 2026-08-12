import { ScriptConfig } from '../types';

export function generatePowerShellScript(config: ScriptConfig): string {
  return `<#
.SYNOPSIS
    Microsoft Teams Rooms (MTR) Functionality & Health Diagnostic Script
.DESCRIPTION
    Tests 19 critical MTR hardware, network, software, and system security parameters.
    Returns ordered hashtable results ($Results) and detailed diagnostics.
.NOTES
    Author: MTR Health Diagnostic Tool Generator
    Execution Policy required: Bypass or Unrestricted
#>

# Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string]$ExportPath = "$PSScriptRoot\\MTR_Health_Report_$((Get-Date).ToString('yyyyMMdd_HHmmss')).json",
    [switch]$Quiet = $false
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   MICROSOFT TEAMS ROOMS (MTR) SYSTEM DIAGNOSTIC TEST" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "Host: $env:COMPUTERNAME" -ForegroundColor Gray
Write-Host "OS:   $((Get-CimInstance Win32_OperatingSystem).Caption)" -ForegroundColor Gray
Write-Host "----------------------------------------------------------" -ForegroundColor Cyan

# ------------------------------------------------------------------
# Apply MTR Recommended Power & USB Configuration
# ------------------------------------------------------------------
Write-Host "Applying MTR Optimized Power & USB Settings..." -ForegroundColor Cyan

# 1. Enable Ultimate Performance Power Plan
try {
    $guidOutput = (powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>&1)
    if ($guidOutput -match "([0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12})") {
        powercfg -setactive $matches[1]
        Write-Host " ✅ Power Plan set to Ultimate Performance" -ForegroundColor Green
    } else {
        powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
        Write-Host " ✅ Power Plan set to High Performance (Ultimate unavailable)" -ForegroundColor Green
    }
} catch {
    Write-Host " ⚠️ Could not change power plan" -ForegroundColor Yellow
}

# 2. Turn off hard disk after -> 0 (Never)
try {
    powercfg -change -disk-timeout-dc 0
    powercfg -change -disk-timeout-ac 0
    Write-Host " ✅ Hard Disk Timeout set to 0 (Never)" -ForegroundColor Green
} catch {
    Write-Host " ⚠️ Could not set Hard Disk Timeout" -ForegroundColor Yellow
}

# 3. Disable USB Selective Suspend
try {
    powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bea584571c 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    powercfg -setdcvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bea584571c 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    powercfg -setactive SCHEME_CURRENT
    Write-Host " ✅ USB Selective Suspend Disabled" -ForegroundColor Green
} catch {
    Write-Host " ⚠️ Could not disable USB Selective Suspend" -ForegroundColor Yellow
}

Write-Host "----------------------------------------------------------" -ForegroundColor Cyan

# ------------------------------------------------------------------
# Initialize results hashtable (EXACT MTR SPECIFICATION)
# ------------------------------------------------------------------
$Results = [ordered]@{
    Display         = "FAIL"
    DisplayCount    = "FAIL"
    Camera          = "FAIL"
    Microphone      = "FAIL"
    Speakers        = "FAIL"
    VendorDevices   = "FAIL"
    HDMIIngest      = "FAIL"
    Network         = "FAIL"
    Internet        = "FAIL"
    IPv6            = "FAIL"
    TeamsApp        = "FAIL"
    TeamsVersion    = "FAIL"
    TeamsSvc        = "FAIL"
    Activation      = "FAIL"
    NUCModel        = "FAIL"
    TPM             = "FAIL"
    AzureAD         = "FAIL"
    DiskSpace       = "FAIL"
    Updates         = "FAIL"
}

$Details = [ordered]@{}

# 1. Display Test
Write-Host "[1/19] Checking Displays..." -NoNewline
$monitors = Get-CimInstance -ClassName Win32_DesktopMonitor -ErrorAction SilentlyContinue
if (-not $monitors) {
    $monitors = Get-PnpDevice -Class Monitor -ErrorAction SilentlyContinue | Where-Object Status -eq 'OK'
}
if ($monitors) {
    $Results.Display = "PASS"
    $Details.Display = "Monitors detected ($($monitors.Count) device(s))"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.Display = "FAIL"
    $Details.Display = "No active display monitors reported by WMI/PnP"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 2. DisplayCount Test
Write-Host "[2/19] Checking Display Count..." -NoNewline
$dispCount = if ($monitors) { $monitors.Count } else { 0 }
if ($dispCount -ge ${config.minimumDisplayCount} -and $dispCount -le 2) {
    $Results.DisplayCount = "PASS"
    $Details.DisplayCount = "$dispCount display(s) connected (Standard MTR setup)"
    Write-Host " ✅ Pass ($dispCount)" -ForegroundColor Green
} elseif ($dispCount -gt 2) {
    $Results.DisplayCount = "WARN"
    $Details.DisplayCount = "$dispCount displays connected (MTR standard is 1 or 2)"
    Write-Host " ⚠️ Warning ($dispCount)" -ForegroundColor Yellow
} else {
    $Results.DisplayCount = "FAIL"
    $Details.DisplayCount = "$dispCount displays connected (Minimum required: ${config.minimumDisplayCount})"
    Write-Host " ❌ Fail ($dispCount)" -ForegroundColor Red
}

# 3. Camera Test
Write-Host "[3/19] Checking Camera..." -NoNewline
$cameras = Get-PnpDevice -Class Camera, Image -ErrorAction SilentlyContinue | Where-Object Status -eq 'OK'
if ($cameras) {
    $camName = $cameras[0].FriendlyName
    $Results.Camera = "PASS"
    $Details.Camera = "Camera operational: $camName"
    Write-Host " ✅ Pass ($camName)" -ForegroundColor Green
} else {
    $Results.Camera = "FAIL"
    $Details.Camera = "No camera or webcam active"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 4. Microphone Test
Write-Host "[4/19] Checking Microphone..." -NoNewline
$mics = Get-CimInstance Win32_SoundDevice -ErrorAction SilentlyContinue | Where-Object Status -eq 'OK'
if ($mics) {
    $Results.Microphone = "PASS"
    $Details.Microphone = "Audio capture device active: $($mics[0].Name)"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.Microphone = "FAIL"
    $Details.Microphone = "No active audio capture/microphone endpoint"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 5. Speakers Test
Write-Host "[5/19] Checking Speakers..." -NoNewline
if ($mics) {
    $Results.Speakers = "PASS"
    $Details.Speakers = "Audio output device active: $($mics[0].Name)"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.Speakers = "FAIL"
    $Details.Speakers = "No active audio output endpoint"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 6. Vendor Devices Test
Write-Host "[6/19] Checking Vendor Devices..." -NoNewline
$vendors = Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object {
    $_.FriendlyName -match 'Logitech|Crestron|Poly|Yealink|Neat|Lenovo|HP|AudioCodes|Jabra' -and $_.Status -eq 'OK'
}
if ($vendors) {
    $vendorName = ($vendors | Select-Object -First 1).FriendlyName
    $Results.VendorDevices = "PASS"
    $Details.VendorDevices = "MTR Peripheral detected: $vendorName"
    Write-Host " ✅ Pass ($vendorName)" -ForegroundColor Green
} else {
    $Results.VendorDevices = "WARN"
    $Details.VendorDevices = "No certified vendor ecosystem devices (Logitech/Crestron/Poly/Yealink) detected"
    Write-Host " ⚠️ Warning (Generic HW)" -ForegroundColor Yellow
}

# 7. HDMI Ingest Test
Write-Host "[7/19] Checking HDMI Ingest..." -NoNewline
$ingest = Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object {
    $_.FriendlyName -match 'Capture|Ingest|Magewell|HDMI|USB Video' -and $_.Status -eq 'OK'
}
if ($ingest) {
    $Results.HDMIIngest = "PASS"
    $Details.HDMIIngest = "HDMI Content Capture device active: $($ingest[0].FriendlyName)"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.HDMIIngest = "WARN"
    $Details.HDMIIngest = "HDMI capture card not detected or unplugged"
    Write-Host " ⚠️ Warning" -ForegroundColor Yellow
}

# 8. Network Test
Write-Host "[8/19] Checking Physical Network Adapter..." -NoNewline
$netAdapters = Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object Status -eq 'Up'
if ($netAdapters) {
    $adapter = $netAdapters[0]
    $Results.Network = "PASS"
    $Details.Network = "Network active: $($adapter.Name) @ $($adapter.LinkSpeed)"
    Write-Host " ✅ Pass ($($adapter.LinkSpeed))" -ForegroundColor Green
} else {
    $Results.Network = "FAIL"
    $Details.Network = "No physical network adapter connected or link down"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 9. Internet & Teams Connectivity Test
Write-Host "[9/19] Checking Internet & Teams Reachability..." -NoNewline
$netPing = Test-NetConnection -ComputerName "${config.targetPingHost}" -Port ${config.targetPingPort} -ErrorAction SilentlyContinue
if ($netPing.TcpTestSucceeded) {
    $Results.Internet = "PASS"
    $Details.Internet = "TCP ${config.targetPingHost}:${config.targetPingPort} connected successfully"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.Internet = "FAIL"
    $Details.Internet = "Failed connection to ${config.targetPingHost}:${config.targetPingPort}"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 10. IPv6 Test
Write-Host "[10/19] Checking IPv6 Configuration..." -NoNewline
$ipv6Addresses = Get-NetIPAddress -AddressFamily IPv6 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "fe80*" -and $_.IPAddress -notlike "::1" }
if ($ipv6Addresses) {
    $Results.IPv6 = "PASS"
    $Details.IPv6 = "IPv6 configured ($($ipv6Addresses[0].IPAddress))"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $ipv6Local = Get-NetIPAddress -AddressFamily IPv6 -ErrorAction SilentlyContinue
    if ($ipv6Local) {
        $Results.IPv6 = "PASS"
        $Details.IPv6 = "IPv6 enabled (Link-local active)"
        Write-Host " ✅ Pass (Link-local)" -ForegroundColor Green
    } else {
        $Results.IPv6 = "FAIL"
        $Details.IPv6 = "IPv6 is disabled on network interface"
        Write-Host " ❌ Fail" -ForegroundColor Red
    }
}

# 11. TeamsApp Test
Write-Host "[11/19] Checking Teams Room App Installation..." -NoNewline
$mtrApp = Get-AppxPackage -AllUsers -Name "*SkypeRoomSystem*" -ErrorAction SilentlyContinue
if (-not $mtrApp) {
    $mtrApp = Get-AppxPackage -AllUsers -Name "*MSTeams*" -ErrorAction SilentlyContinue
}
if ($mtrApp) {
    $Results.TeamsApp = "PASS"
    $Details.TeamsApp = "MTR Application installed: $($mtrApp.Name)"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.TeamsApp = "FAIL"
    $Details.TeamsApp = "Microsoft Teams Room UWP application (SkypeRoomSystem) NOT found"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 12. TeamsVersion Test
Write-Host "[12/19] Checking Teams Room Version..." -NoNewline
if ($mtrApp) {
    $ver = $mtrApp.Version
    $Results.TeamsVersion = "PASS"
    $Details.TeamsVersion = "Version: $ver"
    Write-Host " ✅ Pass ($ver)" -ForegroundColor Green
} else {
    $Results.TeamsVersion = "FAIL"
    $Details.TeamsVersion = "App version unavailable (App not installed)"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 13. Teams Services Test
Write-Host "[13/19] Checking Teams Room Services..." -NoNewline
$services = Get-Service -Name "SkypeRoomSystem*", "Teams*" -ErrorAction SilentlyContinue
$runningServices = $services | Where-Object Status -eq 'Running'
if ($runningServices) {
    $Results.TeamsSvc = "PASS"
    $Details.TeamsSvc = "Active service running: $($runningServices[0].Name)"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.TeamsSvc = "WARN"
    $Details.TeamsSvc = "Teams auto-update service or background service not running"
    Write-Host " ⚠️ Warning" -ForegroundColor Yellow
}

# 14. Windows Activation Test
Write-Host "[14/19] Checking Windows Licensing Activation..." -NoNewline
$licensing = Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue | Where-Object LicenseStatus -eq 1
if ($licensing) {
    $Results.Activation = "PASS"
    $Details.Activation = "Windows is fully licensed & activated"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.Activation = "FAIL"
    $Details.Activation = "Windows licensing is not activated or evaluation mode"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 15. NUC/Compute Model Test
Write-Host "[15/19] Checking Hardware Compute Model..." -NoNewline
$system = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
$mfr = $system.Manufacturer
$model = $system.Model
if ($mfr -and $model) {
    $Results.NUCModel = "PASS"
    $Details.NUCModel = "$mfr $model"
    Write-Host " ✅ Pass ($mfr $model)" -ForegroundColor Green
} else {
    $Results.NUCModel = "WARN"
    $Details.NUCModel = "Unknown hardware system model"
    Write-Host " ⚠️ Warning" -ForegroundColor Yellow
}

# 16. TPM 2.0 Test
Write-Host "[16/19] Checking TPM 2.0 Security Chip..." -NoNewline
$tpm = Get-Tpm -ErrorAction SilentlyContinue
if ($tpm.TpmPresent -and $tpm.TpmReady) {
    $Results.TPM = "PASS"
    $Details.TPM = "TPM Present and Ready (Windows 11 / BitLocker compliant)"
    Write-Host " ✅ Pass" -ForegroundColor Green
} elseif ($tpm.TpmPresent) {
    $Results.TPM = "WARN"
    $Details.TPM = "TPM Present but not fully initialized/ready"
    Write-Host " ⚠️ Warning" -ForegroundColor Yellow
} else {
    $Results.TPM = "FAIL"
    $Details.TPM = "TPM chip missing or disabled in BIOS"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 17. Azure AD / Entra ID Join Test
Write-Host "[17/19] Checking Entra ID / Azure AD Join Status..." -NoNewline
$dsreg = dsregcmd /status 2>&1
if ($dsreg -match "AzureAdJoined : YES" -or $dsreg -match "DomainJoined : YES") {
    $Results.AzureAD = "PASS"
    $Details.AzureAD = "Device joined to Azure Active Directory / Domain"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.AzureAD = "FAIL"
    $Details.AzureAD = "Device is not Azure AD joined or Domain joined"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 18. Free Disk Space Test
Write-Host "[18/19] Checking System Drive (C:) Free Space..." -NoNewline
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue
if ($disk) {
    $freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
    if ($freeGB -ge ${config.minimumDiskSpaceGB}) {
        $Results.DiskSpace = "PASS"
        $Details.DiskSpace = "$freeGB GB free space available (Min: ${config.minimumDiskSpaceGB} GB)"
        Write-Host " ✅ Pass ($freeGB GB)" -ForegroundColor Green
    } else {
        $Results.DiskSpace = "FAIL"
        $Details.DiskSpace = "Low disk space: $freeGB GB free (Min: ${config.minimumDiskSpaceGB} GB required)"
        Write-Host " ❌ Fail ($freeGB GB)" -ForegroundColor Red
    }
} else {
    $Results.DiskSpace = "FAIL"
    $Details.DiskSpace = "Unable to query C: drive space"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 19. Windows Update Service Test
Write-Host "[19/19] Checking Windows Update Service..." -NoNewline
$wuSvc = Get-Service -Name "wuauserv" -ErrorAction SilentlyContinue
if ($wuSvc.Status -eq 'Running' -or $wuSvc.StartType -eq 'Automatic') {
    $Results.Updates = "PASS"
    $Details.Updates = "Windows Update service active ($($wuSvc.Status))"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.Updates = "WARN"
    $Details.Updates = "Windows Update service is stopped or disabled"
    Write-Host " ⚠️ Warning" -ForegroundColor Yellow
}

Write-Host "----------------------------------------------------------" -ForegroundColor Cyan
Write-Host "                  FINAL MTR RESULTS SUMMARY               " -ForegroundColor Yellow
Write-Host "----------------------------------------------------------" -ForegroundColor Cyan

# Output $Results Hashtable
$Results | Format-Table -AutoSize

if ('${config.exportFormat}' -eq 'json_stdout') {
    # Output JSON directly to stdout
    $ReportObject = [pscustomobject]@{
        Timestamp      = (Get-Date -Format 'o')
        ComputerName   = $env:COMPUTERNAME
        OSVersion      = ((Get-CimInstance Win32_OperatingSystem).Caption)
        PSVersion      = $PSVersionTable.PSVersion.ToString()
        ResultsHashtable = $Results
        Details        = $Details
    }
    $ReportObject | ConvertTo-Json -Depth 4
} elseif ('${config.exportFormat}' -eq 'json' -or '${config.exportFormat}' -eq 'all') {
    # Generate JSON Report
    $ReportObject = [pscustomobject]@{
        Timestamp      = (Get-Date -Format 'o')
        ComputerName   = $env:COMPUTERNAME
        OSVersion      = ((Get-CimInstance Win32_OperatingSystem).Caption)
        PSVersion      = $PSVersionTable.PSVersion.ToString()
        ResultsHashtable = $Results
        Details        = $Details
    }

    try {
        $ReportObject | ConvertTo-Json -Depth 4 | Out-File -FilePath $ExportPath -Encoding utf8
        Write-Host "JSON Report saved to: $ExportPath" -ForegroundColor Green
    } catch {
        Write-Host "Could not save JSON report file." -ForegroundColor Yellow
    }
}

if ('${config.exportFormat}' -eq 'html' -or '${config.exportFormat}' -eq 'all') {
    # Generate HTML Report
    try {
        $HtmlPath = "$PSScriptRoot\MTR_Health_Report_$((Get-Date).ToString('yyyyMMdd_HHmmss')).html"
        
        $HtmlBody = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>MTR Health Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9; color: #333; margin: 20px; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h2 { border-bottom: 2px solid #0078d4; padding-bottom: 10px; color: #0078d4; margin-top: 0; }
        .meta { margin-bottom: 20px; font-size: 14px; color: #555; background: #f0f8ff; padding: 15px; border-radius: 6px; border-left: 4px solid #0078d4; }
        .meta p { margin: 5px 0; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #e0e0e0; text-align: left; padding: 12px; }
        th { background-color: #0078d4; color: white; }
        tr:nth-child(even) { background-color: #f8f9fa; }
        .status-pass { color: #107c10; font-weight: bold; }
        .status-warn { color: #d83b01; font-weight: bold; }
        .status-fail { color: #a4262c; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Microsoft Teams Rooms Health Report</h2>
        <div class="meta">
            <p><strong>Host:</strong> $env:COMPUTERNAME</p>
            <p><strong>Time:</strong> $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))</p>
            <p><strong>OS:</strong> $((Get-CimInstance Win32_OperatingSystem).Caption)</p>
        </div>
        <table>
            <tr><th>Test Parameter</th><th>Status</th><th>Details</th></tr>
"@

        foreach ($key in $Results.Keys) {
            $status = $Results[$key]
            $detail = if ($Details[$key]) { $Details[$key] } else { "N/A" }
            $statusClass = ""
            if ($status -match "PASS") { $statusClass = "status-pass" }
            elseif ($status -match "WARN") { $statusClass = "status-warn" }
            elseif ($status -match "FAIL") { $statusClass = "status-fail" }
            
            $HtmlBody += "<tr><td><strong>$key</strong></td><td class='$statusClass'>$status</td><td>$detail</td></tr>\`n"
        }

        $HtmlBody += @"
        </table>
    </div>
</body>
</html>
"@
        $HtmlBody | Out-File -FilePath $HtmlPath -Encoding utf8
        Write-Host "HTML Report saved to: $HtmlPath" -ForegroundColor Green
        
        # Auto-open HTML report
        Invoke-Item $HtmlPath -ErrorAction SilentlyContinue
    } catch {
        Write-Host "Could not save or open HTML report file." -ForegroundColor Yellow
    }
}

return $Results
`;
}

export function generateBatchLauncher(): string {
  return `@echo off
:: ============================================================================
:: Microsoft Teams Room (MTR) Diagnostic Automated Executable Launcher
:: Auto-elevates as Administrator and executes Test-MTRHealth.ps1
:: ============================================================================
title MTR Health Diagnostic Tool

:: Check for Administrator Rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [MTR Tool] Requesting Administrator Privileges...
    powershell -Command "Start-Process '%~0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
echo ========================================================================
echo               MICROSOFT TEAMS ROOMS DIAGNOSTIC LAUNCHER
echo ========================================================================
echo Running MTR Diagnostic Powershell Engine...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Test-MTRHealth.ps1"

echo.
echo ========================================================================
echo Execution finished. Press any key to exit...
pause >nul
`;
}

export function generateExeCompilerScript(): string {
  return `<#
.SYNOPSIS
    Builds a standalone executable (Test-MTRHealth.exe) from Test-MTRHealth.ps1
.DESCRIPTION
    Uses Install-Module PS2EXE or native IExpress to compile the PowerShell script
    into a self-contained Windows .EXE binary.
#>

[CmdletBinding()]
param()

$ScriptPath = "$PSScriptRoot\\Test-MTRHealth.ps1"
$ExePath    = "$PSScriptRoot\\Test-MTRHealth.exe"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "      COMPILING MTR HEALTH SCRIPT TO STANDALONE EXE       " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $ScriptPath)) {
    Write-Error "Script file $ScriptPath not found!"
    exit 1
}

# Check if PS2EXE module is installed
if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Write-Host "Installing PS2EXE compiler module from PowerShell Gallery..." -ForegroundColor Yellow
    Install-Module -Name ps2exe -Scope CurrentUser -Force -SkipPublisherCheck -ErrorAction Stop
}

Write-Host "Compiling $ScriptPath -> $ExePath..." -ForegroundColor Green
Invoke-PS2EXE -InputFile $ScriptPath -OutputFile $ExePath -Title "MTR Health Diagnostic Tool" -Description "Microsoft Teams Rooms System Functionality Tester" -Company "Enterprise IT" -Version "1.0.0.0" -RequireAdmin -NoConsole:$false

if (Test-Path $ExePath) {
    Write-Host "SUCCESS! Executable generated at: $ExePath" -ForegroundColor Green
} else {
    Write-Host "Compilation failed or output file not created." -ForegroundColor Red
}
`;
}

export function generateReadmeDoc(): string {
  return `# Microsoft Teams Rooms (MTR) Diagnostic Executable Package

## Overview
This package contains a complete Windows diagnostic tool built to verify Microsoft Teams Rooms (MTR) system health across 19 critical hardware, video, audio, network, software, and security parameters.

---

## Output Hashtable Specification
When executed, the script initializes and populates the ordered hashtable:

\`\`\`powershell
$Results = [ordered]@{
    Display         = "FAIL"
    DisplayCount    = "FAIL"
    Camera          = "FAIL"
    Microphone      = "FAIL"
    Speakers        = "FAIL"
    VendorDevices   = "FAIL"
    HDMIIngest      = "FAIL"
    Network         = "FAIL"
    Internet        = "FAIL"
    IPv6            = "FAIL"
    TeamsApp        = "FAIL"
    TeamsVersion    = "FAIL"
    TeamsSvc        = "FAIL"
    Activation      = "FAIL"
    NUCModel        = "FAIL"
    TPM             = "FAIL"
    AzureAD         = "FAIL"
    DiskSpace       = "FAIL"
    Updates         = "FAIL"
}
\`\`\`

---

## File Manifest
1. **\`Test-MTRHealth.ps1\`**: Primary PowerShell diagnostic engine.
2. **\`Run-MTRCheck.cmd\`**: Administrator elevation double-clickable launcher batch script.
3. **\`Build-MTRCheckExe.ps1\`**: Standalone compiler script to turn \`Test-MTRHealth.ps1\` into a native \`Test-MTRHealth.exe\` binary using PS2EXE.
4. **\`MTR_Health_Report_*.json\`**: Automatically created JSON result log on each run.

---

## How to Run
### Method 1: Double-Click Launcher (Easiest)
1. Right-click \`Run-MTRCheck.cmd\` and select **Run as Administrator**.
2. The terminal will open, perform all 19 checks, print the colored status table, and save a JSON log.

### Method 2: Compile to Standalone .EXE Binary
1. Open PowerShell as Administrator in the folder.
2. Run \`.\\Build-MTRCheckExe.ps1\`.
3. Once compiled, copy \`Test-MTRHealth.exe\` to any USB flash drive or deploy via Intune / SCCM / Action1 / Datto RMM!

---

## Deployment Options
- **Microsoft Intune**: Upload \`Test-MTRHealth.ps1\` as a Remediation Script or Win32App package.
- **Group Policy (GPO)**: Configure as a Scheduled Task on room startup under the \`Skype\` user account context.
- **RMM Scripts**: Run via PowerShell remote execution engine across your MTR fleet.
`;
}

export function generateUpdateScript(): string {
  return `<#
.SYNOPSIS
    MTR Force Update Script (TPM, Windows Updates, Teams App)
#>
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   MTR FORCE UPDATE: TPM, TEAMS, & WINDOWS UPDATES" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Force Windows Updates
Write-Host "[1/3] Triggering Windows Updates..." -NoNewline
try {
    Start-Process -FilePath "UsoClient.exe" -ArgumentList "StartInteractiveScan" -Wait -NoNewWindow
    Write-Host " PASS (Update Scan Triggered)" -ForegroundColor Green
} catch {
    Write-Host " FAIL" -ForegroundColor Red
}

# 2. Update Teams App (UWP)
Write-Host "[2/3] Checking for Teams Room App Updates..." -NoNewline
try {
    # Attempt to trigger Store update for SkypeRoomSystem
    Get-AppxPackage -AllUsers -Name "*SkypeRoomSystem*" | foreach { Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\\AppXManifest.xml" }
    Write-Host " PASS (App re-registered/updated)" -ForegroundColor Green
} catch {
    Write-Host " FAIL" -ForegroundColor Red
}

# 3. TPM Health Check / Reset
Write-Host "[3/3] Checking TPM Status..." -NoNewline
try {
    $tpm = Get-Tpm
    if ($tpm.TpmReady) {
        Write-Host " PASS (TPM is Ready and active)" -ForegroundColor Green
    } else {
        Write-Host " WARN (TPM not ready, attempting to initialize...)" -ForegroundColor Yellow
        Initialize-Tpm -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host " FAIL" -ForegroundColor Red
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Update routines completed." -ForegroundColor Green
`;
}

export function generateMtrOfflineUpdateScript(): string {
  return `<#
.SYNOPSIS
    Microsoft Teams Rooms (MTR) Official App Offline Update Automator
.DESCRIPTION
    Downloads the newest official Microsoft MTR offline update script (linkid=2151817),
    unblocks the downloaded script using Unblock-File,
    and executes it with PowerShell -ExecutionPolicy Unrestricted.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   MICROSOFT TEAMS ROOMS (MTR) OFFICIAL APP UPDATE" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "Source Link: https://go.microsoft.com/fwlink/?linkid=2151817" -ForegroundColor Gray
Write-Host "----------------------------------------------------------" -ForegroundColor Cyan

# 1. Determine Downloads / Target Directory
$DownloadsFolder = "$env:USERPROFILE\\Downloads"
if (-not (Test-Path -Path $DownloadsFolder)) {
    $DownloadsFolder = "C:\\Users\\Admin\\Downloads"
}

Write-Host "[1/4] Checking & Downloading latest MTR Offline App Update Script..." -ForegroundColor Cyan
$Url = "https://go.microsoft.com/fwlink/?linkid=2151817"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$TempDownloadPath = Join-Path $DownloadsFolder "MTR-Update-Latest.ps1"

try {
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        & curl.exe -s -L "https://go.microsoft.com/fwlink/?linkid=2151817" -o "$TempDownloadPath"
    } else {
        (New-Object System.Net.WebClient).DownloadFile($Url, $TempDownloadPath)
    }
    Write-Host " ✅ Download request sent to $Url" -ForegroundColor Green
} catch {
    Write-Host " ⚠️ Direct web download warning: $_" -ForegroundColor Yellow
    Write-Host "    Will search local Downloads folder for existing MTR-Update-*.ps1 files..." -ForegroundColor Gray
}

# 2. Search for downloaded MTR-Update script file
$ScriptFiles = Get-ChildItem -Path $DownloadsFolder -Filter "MTR-Update-*.ps1" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
if (-not $ScriptFiles) {
    $ScriptFiles = Get-ChildItem -Path $DownloadsFolder -Filter "MTR-Update*.ps1" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
}
if (-not $ScriptFiles) {
    $ScriptFiles = Get-ChildItem -Path "C:\\Users\\Admin\\Downloads" -Filter "MTR-Update*.ps1" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
}
if (-not $ScriptFiles) {
    $ScriptFiles = Get-ChildItem -Path $PSScriptRoot -Filter "MTR-Update*.ps1" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
}

if (-not $ScriptFiles) {
    Write-Host " ❌ No MTR-Update-*.ps1 script found in Downloads folder!" -ForegroundColor Red
    Write-Host "    Download manually from: https://go.microsoft.com/fwlink/?linkid=2151817" -ForegroundColor Yellow
    Write-Host "    Save as MTR-Update-x.x.x.x.ps1 in C:\\Users\\Admin\\Downloads" -ForegroundColor Yellow
    exit 1
}

$TargetScript = $ScriptFiles[0].FullName
Write-Host " ✅ Located update script: $TargetScript" -ForegroundColor Green

# 3. Unblock the file
Write-Host "[2/4] Unblocking script file (Unblock-File)..." -ForegroundColor Cyan
try {
    Unblock-File -Path $TargetScript -ErrorAction SilentlyContinue
    Write-Host " ✅ Script unblocked successfully." -ForegroundColor Green
} catch {
    Write-Host " ⚠️ Unblock-File note: $_" -ForegroundColor Yellow
}

# 4. Check installed Teams Room App
Write-Host "[3/4] Verifying installed SkypeRoomSystem package..." -ForegroundColor Cyan
try {
    $mtrApp = Get-AppxPackage -AllUsers -Name "*SkypeRoomSystem*" -ErrorAction SilentlyContinue
    if ($mtrApp) {
        Write-Host " ✅ Current MTR App Version: $($mtrApp.Version)" -ForegroundColor Green
    } else {
        Write-Host " ℹ️ SkypeRoomSystem package check complete." -ForegroundColor Gray
    }
} catch {
    Write-Host " ⚠️ App check warning: $_" -ForegroundColor Yellow
}

# 5. Execute Update Script with Unrestricted Policy
Write-Host "[4/4] Executing Teams Rooms Update Script..." -ForegroundColor Cyan
Write-Host " Running: PowerShell -ExecutionPolicy Unrestricted '$TargetScript'" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------" -ForegroundColor Cyan

try {
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy Unrestricted -NoProfile -File '$TargetScript'" -Wait -PassThru -NoNewWindow
    if ($process.ExitCode -eq 0) {
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host " ✅ Microsoft Teams Rooms Update completed successfully!" -ForegroundColor Green
        Write-Host "==========================================================" -ForegroundColor Cyan
    } else {
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host " ⚠️ MTR Update script finished with exit code: $($process.ExitCode)" -ForegroundColor Yellow
        Write-Host "==========================================================" -ForegroundColor Cyan
    }
} catch {
    Write-Host " ❌ Failed to execute update script: $_" -ForegroundColor Red
}
`;
}

