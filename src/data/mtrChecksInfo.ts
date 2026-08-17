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
    description: 'Checks whether a monitor is reported by WMI or as an OK monitor PnP device.',
    psCommand: 'Get-CimInstance -ClassName Win32_DesktopMonitor; Get-PnpDevice -Class Monitor',
    expectedValue: 'Monitor reported by WMI or PnP',
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
    description: 'Checks an active AudioEndpoint whose MMDevice instance ID proves the capture role; otherwise reports WARN when only unclassified endpoints exist.',
    psCommand: 'Get-PnpDevice -Class AudioEndpoint | Where-Object {$_.Status -eq "OK" -and $_.InstanceId -like "SWD\\MMDEVAPI\\{0.0.1.*"}',
    expectedValue: 'Active MMDevice capture endpoint present',
    troubleshooting: 'Verify USB connection to audio DSP or mic pod. Check Windows Privacy settings for Microphone access.',
    fixCommand: 'Get-PnpDevice -Class AudioEndpoint | Select-Object FriendlyName, Status, InstanceId'
  },
  Speakers: {
    key: 'Speakers',
    name: 'Speakers / Audio Playback',
    category: 'Audio/Video',
    description: 'Checks an active AudioEndpoint whose MMDevice instance ID proves the render role; it does not claim which endpoint is the Windows default.',
    psCommand: 'Get-PnpDevice -Class AudioEndpoint | Where-Object {$_.Status -eq "OK" -and $_.InstanceId -like "SWD\\MMDEVAPI\\{0.0.0.*"}',
    expectedValue: 'Active MMDevice render endpoint present',
    troubleshooting: 'Ensure room speakers or soundbar are enabled and configured for room audio.',
    fixCommand: 'Get-PnpDevice -Class AudioEndpoint | Select-Object FriendlyName, Status, InstanceId'
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
    description: 'Requires one up physical adapter with a preferred non-APIPA active IPv4 address and at least 100 Mbps receive link speed.',
    psCommand: 'Get-NetAdapter -Physical | Where-Object Status -eq "Up"; Get-NetIPAddress -AddressFamily IPv4',
    expectedValue: 'Active IPv4 address and at least 100 Mbps on the same physical adapter',
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
    psCommand: 'Get-AppxPackage -AllUsers -Name "Microsoft.SkypeRoomSystem"',
    expectedValue: 'Exact Microsoft.SkypeRoomSystem Appx package installed',
    troubleshooting: 'If missing, run Microsoft MTR deployment script to re-register SkypeRoomSystem app package.',
    fixCommand: 'Get-AppxPackage -AllUsers -Name "Microsoft.SkypeRoomSystem" | Select-Object Name, Version, Status'
  },
  TeamsVersion: {
    key: 'TeamsVersion',
    name: 'Teams Room App Version',
    category: 'Software/Teams',
    description: 'Reports the installed SkypeRoomSystem version without claiming compliance because no explicit baseline is configured.',
    psCommand: '(Get-AppxPackage -AllUsers -Name "Microsoft.SkypeRoomSystem").Version',
    expectedValue: 'WARN: No minimum version baseline configured; version is informational only',
    troubleshooting: 'Compare the reported version with the current baseline approved for your deployment.',
    fixCommand: 'Get-AppxPackage -AllUsers -Name "Microsoft.SkypeRoomSystem" | Select-Object Version'
  },
  TeamsSvc: {
    key: 'TeamsSvc',
    name: 'Teams Room System Services',
    category: 'Software/Teams',
    description: 'Checks whether a SkypeRoomSystem service is currently running.',
    psCommand: 'Get-Service -Name "SkypeRoomSystem*" -ErrorAction SilentlyContinue',
    expectedValue: 'Services Running',
    troubleshooting: 'Start the service or check Windows Event Viewer (Application log / SkypeRoomSystem log).',
    fixCommand: 'Start-Service -Name "SkypeRoomSystemAutoUpdate" -ErrorAction SilentlyContinue'
  },
  Activation: {
    key: 'Activation',
    name: 'Windows Licensing & Activation',
    category: 'System/Security',
    description: 'Checks Windows IoT Enterprise or Windows 10/11 Enterprise activation status.',
    psCommand: 'Get-CimInstance SoftwareLicensingProduct -Filter "ApplicationID=\'55c92734-d682-4d71-983e-d6ec3f16059f\' AND PartialProductKey IS NOT NULL" | Where-Object LicenseStatus -eq 1',
    expectedValue: 'Windows licensing ApplicationID has LicenseStatus = 1',
    troubleshooting: 'Run slmgr.vbs /ato or check KMS/MAK activation key.',
    fixCommand: 'slmgr.vbs /dli'
  },
  NUCModel: {
    key: 'NUCModel',
    name: 'Hardware Compute Model & Manufacturer',
    category: 'Hardware',
    description: 'Queries Computer System manufacturer and model; it does not certify the model.',
    psCommand: 'Get-CimInstance Win32_ComputerSystem',
    expectedValue: 'Manufacturer and model values are available',
    troubleshooting: 'Ensure BIOS is updated to vendor MTR recommended version.',
    fixCommand: 'Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model'
  },
  TPM: {
    key: 'TPM',
    name: 'Trusted Platform Module (TPM 2.0)',
    category: 'System/Security',
    description: 'Requires TPM presence and readiness plus a Win32_Tpm SpecVersion value that includes 2.0.',
    psCommand: 'Get-Tpm; Get-CimInstance -Namespace "Root\\CIMV2\\Security\\MicrosoftTpm" -ClassName Win32_Tpm',
    expectedValue: 'TpmPresent=True, TpmReady=True, and SpecVersion includes 2.0',
    troubleshooting: 'Enable TPM 2.0 (Intel PTT or AMD fTPM) in BIOS setup.',
    fixCommand: 'Get-Tpm; Get-CimInstance -Namespace "Root\\CIMV2\\Security\\MicrosoftTpm" -ClassName Win32_Tpm | Select-Object SpecVersion'
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
    description: 'Checks both the Windows Update service runtime state and startup configuration.',
    psCommand: 'Get-CimInstance Win32_Service -Filter "Name=\'wuauserv\'"',
    expectedValue: 'State = Running and StartMode = Auto',
    troubleshooting: 'Enable Windows Update service. Ensure Group Policy is not blocking Microsoft Store updates.',
    fixCommand: 'Set-Service -Name "wuauserv" -StartupType Automatic; Start-Service -Name "wuauserv"'
  }
};
