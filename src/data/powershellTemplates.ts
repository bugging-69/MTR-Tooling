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

#Requires -RunAsAdministrator
[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   MICROSOFT TEAMS ROOMS (MTR) SYSTEM DIAGNOSTIC TEST" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "Host: $env:COMPUTERNAME" -ForegroundColor Gray
Write-Host "OS:   $((Get-CimInstance Win32_OperatingSystem).Caption)" -ForegroundColor Gray
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
    $Details.Camera = "Camera detected with PnP status OK: $camName"
    Write-Host " ✅ Pass ($camName)" -ForegroundColor Green
} else {
    $Results.Camera = "FAIL"
    $Details.Camera = "No camera or webcam active"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 4-5. Audio endpoint tests. MMDevice instance IDs identify capture (0.0.1) and render (0.0.0) roles.
$audioEndpoints = Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue | Where-Object Status -eq 'OK'
$captureEndpoints = $audioEndpoints | Where-Object { $_.InstanceId -and $_.InstanceId.StartsWith('SWD\\MMDEVAPI\\{0.0.1.') }
$renderEndpoints = $audioEndpoints | Where-Object { $_.InstanceId -and $_.InstanceId.StartsWith('SWD\\MMDEVAPI\\{0.0.0.') }

Write-Host "[4/19] Checking Microphone..." -NoNewline
if ($captureEndpoints) {
    $Results.Microphone = "PASS"
    $Details.Microphone = "Active audio capture endpoint: $($captureEndpoints[0].FriendlyName)"
    Write-Host " ✅ Pass" -ForegroundColor Green
} elseif ($audioEndpoints) {
    $Results.Microphone = "WARN"
    $Details.Microphone = "Active audio endpoints exist, but a capture role could not be proven"
    Write-Host " ⚠️ Warning" -ForegroundColor Yellow
} else {
    $Results.Microphone = "FAIL"
    $Details.Microphone = "No active audio endpoint detected"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

Write-Host "[5/19] Checking Speakers..." -NoNewline
if ($renderEndpoints) {
    $Results.Speakers = "PASS"
    $Details.Speakers = "Active audio render endpoint: $($renderEndpoints[0].FriendlyName)"
    Write-Host " ✅ Pass" -ForegroundColor Green
} elseif ($audioEndpoints) {
    $Results.Speakers = "WARN"
    $Details.Speakers = "Active audio endpoints exist, but a render role could not be proven"
    Write-Host " ⚠️ Warning" -ForegroundColor Yellow
} else {
    $Results.Speakers = "FAIL"
    $Details.Speakers = "No active audio endpoint detected"
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
$qualifiedNetwork = foreach ($candidate in $netAdapters) {
    $ipv4 = Get-NetIPAddress -InterfaceIndex $candidate.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -and $_.IPAddress -notlike '169.254.*' -and $_.AddressState -eq 'Preferred' } |
        Select-Object -First 1
    if ($ipv4 -and $candidate.ReceiveLinkSpeed -ge 100000000) {
        [pscustomobject]@{ Adapter = $candidate; IPv4 = $ipv4 }
    }
}
if ($qualifiedNetwork) {
    $network = $qualifiedNetwork | Select-Object -First 1
    $Results.Network = "PASS"
    $Details.Network = "Physical network active: $($network.Adapter.Name), IPv4 $($network.IPv4.IPAddress), $($network.Adapter.LinkSpeed)"
    Write-Host " ✅ Pass ($($network.Adapter.LinkSpeed))" -ForegroundColor Green
} else {
    $Results.Network = "FAIL"
    $Details.Network = "No active physical adapter has both a preferred non-APIPA IPv4 address and at least 100 Mbps link speed"
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
$mtrApp = Get-AppxPackage -AllUsers -Name "Microsoft.SkypeRoomSystem" -ErrorAction SilentlyContinue
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
    $Results.TeamsVersion = "WARN"
    $Details.TeamsVersion = "Installed version: $ver. No minimum version baseline configured; compliance was not evaluated"
    Write-Host " ⚠️ Version reported; no compliance baseline" -ForegroundColor Yellow
} else {
    $Results.TeamsVersion = "FAIL"
    $Details.TeamsVersion = "App version unavailable (SkypeRoomSystem is not installed)"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 13. Teams Services Test
Write-Host "[13/19] Checking Teams Room Services..." -NoNewline
$services = Get-Service -Name "SkypeRoomSystem*" -ErrorAction SilentlyContinue
$runningServices = $services | Where-Object Status -eq 'Running'
if ($runningServices) {
    $Results.TeamsSvc = "PASS"
    $Details.TeamsSvc = "Active service running: $($runningServices[0].Name)"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.TeamsSvc = "WARN"
    $Details.TeamsSvc = "No SkypeRoomSystem service is running"
    Write-Host " ⚠️ Warning" -ForegroundColor Yellow
}

# 14. Windows Activation Test
Write-Host "[14/19] Checking Windows Licensing Activation..." -NoNewline
$licensing = Get-CimInstance SoftwareLicensingProduct -Filter "ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f' AND PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue | Where-Object LicenseStatus -eq 1
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
$tpmInfo = Get-CimInstance -Namespace 'Root\\CIMV2\\Security\\MicrosoftTpm' -ClassName Win32_Tpm -ErrorAction SilentlyContinue
$tpmSpecVersions = @($tpmInfo.SpecVersion -split ',' | ForEach-Object Trim)
if ($tpm.TpmPresent -and $tpm.TpmReady -and $tpmSpecVersions -contains '2.0') {
    $Results.TPM = "PASS"
    $Details.TPM = "TPM 2.0 is present and ready (SpecVersion: $($tpmInfo.SpecVersion))"
    Write-Host " ✅ Pass" -ForegroundColor Green
} elseif ($tpm.TpmPresent -and -not ($tpmSpecVersions -contains '2.0')) {
    $Results.TPM = "FAIL"
    $Details.TPM = "TPM is present, but SpecVersion does not include 2.0 (reported: $($tpmInfo.SpecVersion))"
    Write-Host " ❌ Fail (not TPM 2.0)" -ForegroundColor Red
} elseif ($tpm.TpmPresent) {
    $Results.TPM = "WARN"
    $Details.TPM = "TPM 2.0 is present but not ready"
    Write-Host " ⚠️ Warning" -ForegroundColor Yellow
} else {
    $Results.TPM = "FAIL"
    $Details.TPM = "TPM chip missing or disabled in BIOS"
    Write-Host " ❌ Fail" -ForegroundColor Red
}

# 17. Azure AD / Entra ID Join Test
Write-Host "[17/19] Checking Entra ID / Azure AD Join Status..." -NoNewline
$dsreg = dsregcmd /status 2>&1
$dsregExitCode = $LASTEXITCODE
if ($dsregExitCode -ne 0) {
    $Results.AzureAD = "FAIL"
    $Details.AzureAD = "dsregcmd failed with exit code $dsregExitCode; join status could not be checked"
    Write-Host " ❌ Fail (query error)" -ForegroundColor Red
} elseif ($dsreg -match "AzureAdJoined : YES" -or $dsreg -match "DomainJoined : YES") {
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
$wuSvc = Get-CimInstance Win32_Service -Filter "Name='wuauserv'" -ErrorAction SilentlyContinue
if ($wuSvc.State -eq 'Running' -and $wuSvc.StartMode -eq 'Auto') {
    $Results.Updates = "PASS"
    $Details.Updates = "Windows Update service state is Running and startup mode is Auto"
    Write-Host " ✅ Pass" -ForegroundColor Green
} else {
    $Results.Updates = "WARN"
    $Details.Updates = "Windows Update requires State=Running and StartMode=Auto; found State=$($wuSvc.State), StartMode=$($wuSvc.StartMode)"
    Write-Host " ⚠️ Warning" -ForegroundColor Yellow
}

Write-Host "----------------------------------------------------------" -ForegroundColor Cyan
Write-Host "                  FINAL MTR RESULTS SUMMARY               " -ForegroundColor Yellow
Write-Host "----------------------------------------------------------" -ForegroundColor Cyan

# Return the report through stdout only. File export is handled by the renderer after the read-only operation.
$ReportObject = [pscustomobject]@{
    Timestamp        = (Get-Date -Format 'o')
    ComputerName     = $env:COMPUTERNAME
    OSVersion        = ((Get-CimInstance Win32_OperatingSystem).Caption)
    PSVersion        = $PSVersionTable.PSVersion.ToString()
    ResultsHashtable = $Results
    Details          = $Details
}
$ReportObject | ConvertTo-Json -Depth 4

`;
}

export function generateUpdateScript(): string {
  return `<#
.SYNOPSIS
    Requests a Windows Update scan and repairs existing Teams Rooms app registration.
.DESCRIPTION
    This operation does not install updates or claim that OS, Store, Teams, or firmware versions changed.
#>
$ErrorActionPreference = "Stop"
$OperationFailed = $false

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   WINDOWS UPDATE SCAN & MTR APP REGISTRATION REPAIR" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

Write-Host "[1/2] REQUESTED: Windows Update interactive scan (does not install updates)..." -NoNewline
try {
    $scanProcess = Start-Process -FilePath "UsoClient.exe" -ArgumentList "StartInteractiveScan" -Wait -NoNewWindow -PassThru
    if ($scanProcess.ExitCode -ne 0) {
        throw "UsoClient scan request failed with exit code $($scanProcess.ExitCode)."
    }
    Write-Host " ACCEPTED" -ForegroundColor Green
} catch {
    $OperationFailed = $true
    Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "[2/2] REQUESTED: Re-register existing SkypeRoomSystem package (repair only)..." -NoNewline
try {
    $mtrPackages = @(Get-AppxPackage -AllUsers -Name "Microsoft.SkypeRoomSystem" -ErrorAction Stop)
    if ($mtrPackages.Count -eq 0) {
        throw "SkypeRoomSystem package is not installed; registration repair was not run."
    }
    foreach ($mtrPackage in $mtrPackages) {
        $manifestPath = Join-Path $mtrPackage.InstallLocation "AppXManifest.xml"
        if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
            throw "App manifest was not found at the installed package location."
        }
        Add-AppxPackage -DisableDevelopmentMode -Register $manifestPath -ErrorAction Stop
    }
    Write-Host " COMPLETED (registration repair only; no app version change claimed)" -ForegroundColor Green
} catch {
    $OperationFailed = $true
    Write-Host " FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Requested scan and repair steps finished. No update installation is claimed." -ForegroundColor Cyan
if ($OperationFailed) { exit 1 }
`;
}
