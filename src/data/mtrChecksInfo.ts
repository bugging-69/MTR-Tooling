import { MTRCheckResult } from '../types';

export interface MTRCheckMeta {
  key: string;
  name: string;
  category: 'Hardware' | 'Audio/Video' | 'Network' | 'Software/Teams' | 'System/Security';
  description: string;
  psCommand: string;
  expectedValue: string;
  troubleshooting: string;
  fixCommand: string;
}

export const MTR_CHECKS_METADATA: Record<string, MTRCheckMeta> = {
  Display: {
    key: 'Display',
    name: 'Primary & Secondary Displays',
    category: 'Audio/Video',
    description: 'Verifies active display monitors and resolution output via WMI/CIM.',
    psCommand: 'Get-CimInstance -ClassName Win32_DesktopMonitor',
    expectedValue: 'Active monitor detected with 1080p/4K resolution',
    troubleshooting: 'Check HDMI / DisplayPort cables connected to NUC/Compute unit. Verify display is powered on.',
    fixCommand: 'Get-CimInstance Win32_DesktopMonitor | Select-Object Name, ScreenWidth, ScreenHeight'
  },
  DisplayCount: {
    key: 'DisplayCount',
    name: 'Connected Monitor Count',
    category: 'Audio/Video',
    description: 'Microsoft Teams Rooms require 1 or 2 active displays connected.',
    psCommand: '(Get-CimInstance Win32_DesktopMonitor).Count',
    expectedValue: '1 or 2 Displays',
    troubleshooting: 'If count is 0, display EDID is missing or cable unplugged. MTR usually requires dual 1080p displays.',
    fixCommand: 'Get-PnpDevice -Class Monitor | Where-Object Status -eq "OK"'
  },
  Camera: {
    key: 'Camera',
    name: 'Video Capture Camera',
    category: 'Audio/Video',
    description: 'Detects connected USB or integrated MTR camera (Logitech, Poly, Yealink, Crestron, etc.).',
    psCommand: 'Get-PnpDevice -Class Camera, Image | Where-Object Status -eq "OK"',
    expectedValue: 'Camera device status OK',
    troubleshooting: 'Verify USB extension cable, powered hub, or privacy shutter state.',
    fixCommand: 'Get-PnpDevice -Class Camera | Format-Table FriendlyName, Status'
  },
  Microphone: {
    key: 'Microphone',
    name: 'Microphone / Audio Capture',
    category: 'Audio/Video',
    description: 'Checks audio input capture device detection (Table pods, ceiling array, or soundbar mic).',
    psCommand: 'Get-CimInstance Win32_SoundDevice | Where-Object Status -eq "OK"',
    expectedValue: 'Active audio capture device present',
    troubleshooting: 'Verify USB connection to audio DSP or mic pod. Check Windows Privacy settings for Microphone access.',
    fixCommand: 'Get-CimInstance Win32_SoundDevice | Select-Object Name, Status'
  },
  Speakers: {
    key: 'Speakers',
    name: 'Speakers / Audio Playback',
    category: 'Audio/Video',
    description: 'Verifies default audio output playback device for room audio.',
    psCommand: 'Get-CimInstance Win32_SoundDevice | Where-Object Status -eq "OK"',
    expectedValue: 'Active sound output device present',
    troubleshooting: 'Ensure room speakers or soundbar are set as default audio endpoint.',
    fixCommand: 'Get-CimInstance Win32_SoundDevice | Format-List Name, Status'
  },
  VendorDevices: {
    key: 'VendorDevices',
    name: 'Vendor Peripheral Ecosystem',
    category: 'Hardware',
    description: 'Detects certified MTR peripherals (Logitech Tap, Crestron Touch, Poly Trio, Yealink MTouch, etc.).',
    psCommand: 'Get-PnpDevice | Where-Object {$_.FriendlyName -match "Logitech|Crestron|Poly|Yealink|Neat|Lenovo|HP|AudioCodes"}',
    expectedValue: 'Vendor console/touch controller connected',
    troubleshooting: 'Check USB/PoE cable from touch console to compute unit.',
    fixCommand: 'Get-PnpDevice | Where-Object {$_.FriendlyName -match "Logitech|Crestron|Poly|Yealink"} | Select FriendlyName, Status'
  },
  HDMIIngest: {
    key: 'HDMIIngest',
    name: 'HDMI Content Ingest Device',
    category: 'Hardware',
    description: 'Checks presence of HDMI capture card (Magewell, Elgato, AverMedia, Crestron, or vendor video capture).',
    psCommand: 'Get-PnpDevice | Where-Object {$_.FriendlyName -match "Capture|Ingest|Magewell|HDMI|USB Video"}',
    expectedValue: 'HDMI Ingest video capture card status OK',
    troubleshooting: 'Re-plug USB capture card. Ensure display driver or vendor capture software service is installed.',
    fixCommand: 'Get-PnpDevice -Class Media | Where-Object Status -eq "OK"'
  },
  Network: {
    key: 'Network',
    name: 'Active Network Interface',
    category: 'Network',
    description: 'Verifies Ethernet LAN interface status, active IPv4 address, and link speed (>= 100 Mbps).',
    psCommand: 'Get-NetAdapter -Physical | Where-Object Status -eq "Up"',
    expectedValue: 'Physical Ethernet connected @ 1Gbps',
    troubleshooting: 'Check Ethernet RJ45 cable, switch port VLAN, and DHCP lease.',
    fixCommand: 'Get-NetAdapter | Where-Object Status -eq "Up" | Select-Object Name, InterfaceDescription, LinkSpeed'
  },
  Internet: {
    key: 'Internet',
    name: 'Teams Endpoints & Internet Connectivity',
    category: 'Network',
    description: 'Tests HTTPS TCP connection to teams.microsoft.com:443 and outbound internet reachability.',
    psCommand: 'Test-NetConnection -ComputerName "teams.microsoft.com" -Port 443',
    expectedValue: 'TcpTestSucceeded : True',
    troubleshooting: 'Check firewall rules for Microsoft 365 URLs and IPs (Ports 80, 443, 3478-3481 UDP).',
    fixCommand: 'Test-NetConnection -ComputerName "teams.microsoft.com" -Port 443'
  },
  IPv6: {
    key: 'IPv6',
    name: 'IPv6 Stack Configuration',
    category: 'Network',
    description: 'Microsoft Teams Rooms require IPv6 to be enabled on network adapters for dual-stack communication.',
    psCommand: 'Get-NetIPAddress -AddressFamily IPv6 -ErrorAction SilentlyContinue',
    expectedValue: 'IPv6 Enabled on active NIC',
    troubleshooting: 'Ensure IPv6 is not disabled via registry or NIC properties.',
    fixCommand: 'Enable-NetAdapterBinding -Name "*" -ComponentID ms_tcpip6'
  },
  TeamsApp: {
    key: 'TeamsApp',
    name: 'Microsoft Teams Room Application',
    category: 'Software/Teams',
    description: 'Verifies installation of Microsoft.SkypeRoomSystem or Microsoft Teams Rooms UWP app.',
    psCommand: 'Get-AppxPackage -AllUsers -Name "*SkypeRoomSystem*"',
    expectedValue: 'AppxPackage Installed',
    troubleshooting: 'If missing, run Microsoft MTR deployment script to re-register SkypeRoomSystem app package.',
    fixCommand: 'Get-AppxPackage -AllUsers -Name "*SkypeRoomSystem*" | Select-Object Name, Version, Status'
  },
  TeamsVersion: {
    key: 'TeamsVersion',
    name: 'Teams Room App Version',
    category: 'Software/Teams',
    description: 'Checks installed Teams Room app version string (e.g. 5.0+ or modern Teams Rooms client).',
    psCommand: '(Get-AppxPackage -AllUsers -Name "*SkypeRoomSystem*").Version',
    expectedValue: 'v5.0.0 or higher',
    troubleshooting: 'Update MTR app via Microsoft Store or Windows Update, or run manual MTR update script.',
    fixCommand: 'Get-AppxPackage -AllUsers -Name "*SkypeRoomSystem*" | Select-Object Version'
  },
  TeamsSvc: {
    key: 'TeamsSvc',
    name: 'Teams Room System Services',
    category: 'Software/Teams',
    description: 'Verifies SkypeRoomSystem service, Win32 background services, or Microsoft Teams Rooms Services.',
    psCommand: 'Get-Service -Name "SkypeRoomSystem*", "Teams*" -ErrorAction SilentlyContinue',
    expectedValue: 'Services Running',
    troubleshooting: 'Start the service or check Windows Event Viewer (Application log / SkypeRoomSystem log).',
    fixCommand: 'Start-Service -Name "SkypeRoomSystemAutoUpdate" -ErrorAction SilentlyContinue'
  },
  Activation: {
    key: 'Activation',
    name: 'Windows Licensing & Activation',
    category: 'System/Security',
    description: 'Checks Windows IoT Enterprise or Windows 10/11 Enterprise activation status.',
    psCommand: 'Get-CimInstance SoftwareLicensingProduct | Where-Object LicenseStatus -eq 1',
    expectedValue: 'LicenseStatus = 1 (Licensed)',
    troubleshooting: 'Run slmgr.vbs /ato or check KMS/MAK activation key.',
    fixCommand: 'slmgr.vbs /dli'
  },
  NUCModel: {
    key: 'NUCModel',
    name: 'Hardware Compute Model & Manufacturer',
    category: 'Hardware',
    description: 'Queries Computer System manufacturer, model, and BIOS info (e.g., Intel NUC, HP, Lenovo, Dell).',
    psCommand: 'Get-CimInstance Win32_ComputerSystem',
    expectedValue: 'Valid MTR certified compute hardware',
    troubleshooting: 'Ensure BIOS is updated to vendor MTR recommended version.',
    fixCommand: 'Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model'
  },
  TPM: {
    key: 'TPM',
    name: 'Trusted Platform Module (TPM 2.0)',
    category: 'System/Security',
    description: 'Checks TPM presence, enabling, and readiness for Windows 11 / BitLocker compliance.',
    psCommand: 'Get-Tpm',
    expectedValue: 'TpmPresent : True, TpmReady : True',
    troubleshooting: 'Enable TPM 2.0 (Intel PTT or AMD fTPM) in BIOS setup.',
    fixCommand: 'Get-Tpm | Select-Object TpmPresent, TpmReady, TpmEnabled'
  },
  AzureAD: {
    key: 'AzureAD',
    name: 'Entra ID / Azure AD Join Status',
    category: 'System/Security',
    description: 'Checks device registration state with Azure Active Directory / Microsoft Entra ID.',
    psCommand: 'dsregcmd /status',
    expectedValue: 'AzureAdJoined : YES (or DomainJoined : YES)',
    troubleshooting: 'Verify device credentials or re-join device to Azure AD / Intune MDM.',
    fixCommand: 'dsregcmd /status'
  },
  DiskSpace: {
    key: 'DiskSpace',
    name: 'System Drive (C:) Free Disk Space',
    category: 'System/Security',
    description: 'Checks available disk space on C: drive. MTR requires >= 15 GB free for updates and logs.',
    psCommand: 'Get-CimInstance Win32_LogicalDisk -Filter "DeviceID=\'C:\'"',
    expectedValue: '>= 15 GB Free Space',
    troubleshooting: 'Run Windows Disk Cleanup or remove old log files from C:\\Users\\Skype\\AppData\\Local\\Packages.',
    fixCommand: 'Get-CimInstance Win32_LogicalDisk -Filter "DeviceID=\'C:\'" | Select-Object DeviceID, @{N="FreeGB";E={[math]::Round($_.FreeSpace/1GB, 2)}}'
  },
  Updates: {
    key: 'Updates',
    name: 'Windows Update Service Status',
    category: 'Software/Teams',
    description: 'Verifies Windows Update service (wuauserv) and auto-update configuration.',
    psCommand: 'Get-Service -Name "wuauserv"',
    expectedValue: 'Status : Running / Automatic',
    troubleshooting: 'Enable Windows Update service. Ensure Group Policy is not blocking Microsoft Store updates.',
    fixCommand: 'Set-Service -Name "wuauserv" -StartupType Automatic; Start-Service -Name "wuauserv"'
  }
};
