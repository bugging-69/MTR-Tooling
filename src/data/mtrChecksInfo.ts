export interface MTRCheckMeta {
  key: string;
  name: string;
  category: 'Hardware' | 'Audio/Video' | 'Network' | 'Software/Teams' | 'System/Security';
  description: string;
  psCommand: string;
  expectedValue: string;
  troubleshooting: string;
  referenceCommand: string;
}

export const MTR_CHECKS_METADATA: Record<string, MTRCheckMeta> = {
  Display: {
    key: 'Display',
    name: 'Reported Display Devices',
    category: 'Audio/Video',
    description: 'Passes when WMI reports any Win32_DesktopMonitor object. Only when WMI reports none does it fall back to a monitor PnP device with status OK; this does not prove that a display is active or showing video.',
    psCommand: '$monitors = Get-CimInstance Win32_DesktopMonitor; if (-not $monitors) { $monitors = Get-PnpDevice -Class Monitor | Where-Object Status -eq "OK" }',
    expectedValue: 'At least one WMI monitor, or one OK PnP monitor when WMI returns none',
    troubleshooting: 'If neither source reports a monitor, inspect display power, cabling, adapters, drivers, and the Windows display inventory. Confirm video output separately.',
    referenceCommand: 'Get-CimInstance Win32_DesktopMonitor | Select-Object Name, ScreenWidth, ScreenHeight'
  },
  DisplayCount: {
    key: 'DisplayCount',
    name: 'Reported Monitor Count',
    category: 'Audio/Video',
    description: 'Counts the Display check result: all WMI monitor objects when present, otherwise OK monitor PnP devices. It does not verify active topology, resolution, or video output.',
    psCommand: '$monitors = Get-CimInstance Win32_DesktopMonitor; if (-not $monitors) { $monitors = Get-PnpDevice -Class Monitor | Where-Object Status -eq "OK" }; $monitors.Count',
    expectedValue: '1 or 2 reported devices (minimum is configurable; default is 1)',
    troubleshooting: 'Compare the reported inventory with the intended room topology. If it differs, inspect power, cabling, adapters, drivers, and Windows display settings.',
    referenceCommand: 'Get-PnpDevice -Class Monitor | Select-Object FriendlyName, Status, InstanceId'
  },
  Camera: {
    key: 'Camera',
    name: 'Video Capture Camera',
    category: 'Audio/Video',
    description: 'Detects a camera or image-class PnP device whose status is OK; it does not test a video stream.',
    psCommand: 'Get-PnpDevice -Class Camera, Image | Where-Object Status -eq "OK"',
    expectedValue: 'Camera or image-class PnP device status OK',
    troubleshooting: 'Verify the expected device appears in Windows, then inspect its USB connection, powered hub, driver, and privacy shutter. Test video separately.',
    referenceCommand: 'Get-PnpDevice -Class Camera, Image | Format-Table FriendlyName, Status, InstanceId'
  },
  Microphone: {
    key: 'Microphone',
    name: 'Microphone / Audio Capture',
    category: 'Audio/Video',
    description: 'Checks an active AudioEndpoint whose MMDevice instance ID proves the capture role; otherwise reports WARN when only unclassified endpoints exist.',
    psCommand: 'Get-PnpDevice -Class AudioEndpoint | Where-Object {$_.Status -eq "OK" -and $_.InstanceId -like "SWD\\MMDEVAPI\\{0.0.1.*"}',
    expectedValue: 'Active MMDevice capture endpoint present',
    troubleshooting: 'Verify the USB connection to the audio DSP or mic pod and check Windows microphone privacy settings. Test capture separately.',
    referenceCommand: 'Get-PnpDevice -Class AudioEndpoint | Select-Object FriendlyName, Status, InstanceId'
  },
  Speakers: {
    key: 'Speakers',
    name: 'Speakers / Audio Playback',
    category: 'Audio/Video',
    description: 'Checks an active AudioEndpoint whose MMDevice instance ID proves the render role; it does not claim which endpoint is the Windows default.',
    psCommand: 'Get-PnpDevice -Class AudioEndpoint | Where-Object {$_.Status -eq "OK" -and $_.InstanceId -like "SWD\\MMDEVAPI\\{0.0.0.*"}',
    expectedValue: 'Active MMDevice render endpoint present',
    troubleshooting: 'Confirm the intended room speakers or soundbar appear in Windows and are selected by the room configuration. Test playback separately.',
    referenceCommand: 'Get-PnpDevice -Class AudioEndpoint | Select-Object FriendlyName, Status, InstanceId'
  },
  VendorDevices: {
    key: 'VendorDevices',
    name: 'Recognized Vendor-Named PnP Device',
    category: 'Hardware',
    description: 'Looks for any OK PnP device whose friendly name contains one of the configured vendor terms. A match does not prove that the device is an MTR-certified peripheral or touch console.',
    psCommand: 'Get-PnpDevice | Where-Object {$_.FriendlyName -match "Logitech|Crestron|Poly|Yealink|Neat|Lenovo|HP|AudioCodes|Jabra" -and $_.Status -eq "OK"}',
    expectedValue: 'At least one status-OK PnP device with a configured vendor term; no match is a warning',
    troubleshooting: 'Review the matched device name and status against the intended room hardware. A generic or differently named supported peripheral may not match this heuristic.',
    referenceCommand: 'Get-PnpDevice | Where-Object {$_.FriendlyName -match "Logitech|Crestron|Poly|Yealink|Neat|Lenovo|HP|AudioCodes|Jabra"} | Select-Object FriendlyName, Status, InstanceId'
  },
  HDMIIngest: {
    key: 'HDMIIngest',
    name: 'Possible HDMI Content Ingest Device',
    category: 'Hardware',
    description: 'Looks for an OK PnP device whose friendly name contains Capture, Ingest, Magewell, HDMI, or USB Video. This name heuristic does not prove HDMI ingest capability or a working content stream.',
    psCommand: 'Get-PnpDevice | Where-Object {$_.FriendlyName -match "Capture|Ingest|Magewell|HDMI|USB Video" -and $_.Status -eq "OK"}',
    expectedValue: 'At least one status-OK PnP device matching an ingest-related name; no match is a warning',
    troubleshooting: 'Confirm the expected capture hardware and driver in the complete PnP inventory, then test content sharing end to end. A differently named device may not match this heuristic.',
    referenceCommand: 'Get-PnpDevice | Where-Object {$_.FriendlyName -match "Capture|Ingest|Magewell|HDMI|USB Video"} | Select-Object FriendlyName, Class, Status, InstanceId'
  },
  Network: {
    key: 'Network',
    name: 'Active Network Interface',
    category: 'Network',
    description: 'Requires one up physical adapter with a preferred non-APIPA IPv4 address on that same interface and at least 100 Mbps receive link speed.',
    psCommand: 'Get-NetAdapter -Physical | Where-Object Status -eq "Up" | ForEach-Object { $candidate = $_; $ipv4 = Get-NetIPAddress -InterfaceIndex $candidate.InterfaceIndex -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "169.254.*" -and $_.AddressState -eq "Preferred"} | Select-Object -First 1; if ($ipv4 -and $candidate.ReceiveLinkSpeed -ge 100000000) { [pscustomobject]@{Adapter=$candidate.Name; IPv4=$ipv4.IPAddress; ReceiveLinkSpeed=$candidate.ReceiveLinkSpeed} } }',
    expectedValue: 'Preferred non-APIPA IPv4 address and at least 100 Mbps on the same physical adapter',
    troubleshooting: 'Inspect the Ethernet cable, switch port/VLAN, DHCP lease, adapter state, and negotiated link speed.',
    referenceCommand: 'Get-NetAdapter -Physical | Select-Object Name, Status, InterfaceDescription, LinkSpeed'
  },
  Internet: {
    key: 'Internet',
    name: 'Configured Teams Host TCP Reachability',
    category: 'Network',
    description: 'Tests only a TCP connection to the configured host and port (teams.microsoft.com:443 by default). It does not prove general internet access, all Microsoft 365 endpoints, or UDP/media reachability.',
    psCommand: 'Test-NetConnection -ComputerName "teams.microsoft.com" -Port 443',
    expectedValue: 'TcpTestSucceeded : True for the configured host and TCP port',
    troubleshooting: 'On failure, inspect DNS resolution, proxy routing, and firewall access for the tested TCP endpoint. Validate required Microsoft 365 URLs and UDP media ports separately with appropriate network tooling.',
    referenceCommand: 'Test-NetConnection -ComputerName "teams.microsoft.com" -Port 443'
  },
  IPv6: {
    key: 'IPv6',
    name: 'IPv6 Address Presence',
    category: 'Network',
    description: 'Passes when Get-NetIPAddress returns any IPv6 address. The fallback accepts link-local or loopback results, so it does not prove IPv6 on the active room network adapter or external IPv6 connectivity.',
    psCommand: 'Get-NetIPAddress -AddressFamily IPv6 -ErrorAction SilentlyContinue',
    expectedValue: 'At least one IPv6 address returned from any interface',
    troubleshooting: 'Inspect address scope and interface association, then verify the intended active adapter binding and network configuration separately.',
    referenceCommand: 'Get-NetIPAddress -AddressFamily IPv6 | Select-Object InterfaceAlias, IPAddress, AddressState, PrefixOrigin'
  },
  TeamsApp: {
    key: 'TeamsApp',
    name: 'Microsoft Teams Rooms Appx Package',
    category: 'Software/Teams',
    description: 'Checks whether the exact Microsoft.SkypeRoomSystem Appx package is registered for any user. It does not test launch, sign-in, configuration, or package-file health.',
    psCommand: 'Get-AppxPackage -AllUsers -Name "Microsoft.SkypeRoomSystem"',
    expectedValue: 'Exact Microsoft.SkypeRoomSystem Appx package is registered',
    troubleshooting: 'If the package is missing, verify the intended MTR image and use a Microsoft-supported deployment or recovery process to install it. This query does not inspect whether residual package files exist.',
    referenceCommand: 'Get-AppxPackage -AllUsers -Name "Microsoft.SkypeRoomSystem" | Select-Object Name, Version, Status, InstallLocation'
  },
  TeamsVersion: {
    key: 'TeamsVersion',
    name: 'Teams Room App Version',
    category: 'Software/Teams',
    description: 'Reports the installed SkypeRoomSystem version without claiming compliance because no explicit baseline is configured.',
    psCommand: '(Get-AppxPackage -AllUsers -Name "Microsoft.SkypeRoomSystem").Version',
    expectedValue: 'WARN: No minimum version baseline configured; version is informational only',
    troubleshooting: 'Compare the reported version with the current baseline approved for your deployment.',
    referenceCommand: 'Get-AppxPackage -AllUsers -Name "Microsoft.SkypeRoomSystem" | Select-Object Name, Version'
  },
  TeamsSvc: {
    key: 'TeamsSvc',
    name: 'SkypeRoomSystem-Named Service State',
    category: 'Software/Teams',
    description: 'Passes when at least one service whose name starts with SkypeRoomSystem is currently running. It does not prove that a specific required service exists or that the room app is healthy.',
    psCommand: 'Get-Service -Name "SkypeRoomSystem*" | Where-Object Status -eq "Running"',
    expectedValue: 'At least one SkypeRoomSystem*-named service is running; otherwise WARN',
    troubleshooting: 'Review which matching services exist, their current state and startup configuration, and relevant Windows event logs before deciding on corrective action.',
    referenceCommand: 'Get-CimInstance Win32_Service | Where-Object Name -like "SkypeRoomSystem*" | Select-Object Name, DisplayName, State, StartMode'
  },
  Activation: {
    key: 'Activation',
    name: 'Windows Product Activation',
    category: 'System/Security',
    description: 'Passes when a Windows licensing product with the Windows ApplicationID, a partial product key, and LicenseStatus 1 is found. It does not verify a specific Windows edition such as IoT Enterprise.',
    psCommand: 'Get-CimInstance SoftwareLicensingProduct -Filter "ApplicationID=\'55c92734-d682-4d71-983e-d6ec3f16059f\' AND PartialProductKey IS NOT NULL" | Where-Object LicenseStatus -eq 1',
    expectedValue: 'At least one keyed Windows licensing product has LicenseStatus = 1',
    troubleshooting: 'Review the licensed product name, description, status, and channel. If activation is not licensed, follow your organization\'s authorized KMS, MAK, or subscription activation process.',
    referenceCommand: 'Get-CimInstance SoftwareLicensingProduct -Filter "ApplicationID=\'55c92734-d682-4d71-983e-d6ec3f16059f\' AND PartialProductKey IS NOT NULL" | Select-Object Name, Description, LicenseStatus, PartialProductKey'
  },
  NUCModel: {
    key: 'NUCModel',
    name: 'Hardware Compute Model & Manufacturer',
    category: 'Hardware',
    description: 'Passes when Win32_ComputerSystem returns non-empty manufacturer and model values. It does not certify the model or inspect firmware/BIOS version or health.',
    psCommand: 'Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model',
    expectedValue: 'Non-empty manufacturer and model values',
    troubleshooting: 'If values are unavailable, inspect CIM/WMI health. Compare reported values with the approved room hardware inventory and assess firmware separately only when relevant.',
    referenceCommand: 'Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model'
  },
  TPM: {
    key: 'TPM',
    name: 'Trusted Platform Module (TPM 2.0)',
    category: 'System/Security',
    description: 'Requires TPM presence and readiness plus a Win32_Tpm SpecVersion value that includes 2.0.',
    psCommand: 'Get-Tpm; Get-CimInstance -Namespace "Root\\CIMV2\\Security\\MicrosoftTpm" -ClassName Win32_Tpm',
    expectedValue: 'TpmPresent=True, TpmReady=True, and SpecVersion includes 2.0',
    troubleshooting: 'Review TPM presence, readiness, and firmware specification. If it is disabled, follow the hardware vendor and organizational process for BIOS/UEFI changes.',
    referenceCommand: 'Get-Tpm; Get-CimInstance -Namespace "Root\\CIMV2\\Security\\MicrosoftTpm" -ClassName Win32_Tpm | Select-Object SpecVersion'
  },
  AzureAD: {
    key: 'AzureAD',
    name: 'Entra ID or Active Directory Domain Join',
    category: 'System/Security',
    description: 'Passes when dsregcmd succeeds and reports either AzureAdJoined : YES or DomainJoined : YES. A traditional Active Directory domain join therefore satisfies this AzureAD-labelled result.',
    psCommand: 'dsregcmd /status',
    expectedValue: 'AzureAdJoined : YES or DomainJoined : YES',
    troubleshooting: 'Review the full dsregcmd output and compare it with the intended join model. DomainJoined : YES passes this check even when AzureAdJoined is not YES.',
    referenceCommand: 'dsregcmd /status'
  },
  DiskSpace: {
    key: 'DiskSpace',
    name: 'System Drive (C:) Free-Space Threshold',
    category: 'System/Security',
    description: 'Compares C: free space with the diagnostic\'s configured minimum (15 GB by default). It does not inspect which files consume space or prove that an update will fit.',
    psCommand: 'Get-CimInstance Win32_LogicalDisk -Filter "DeviceID=\'C:\'"',
    expectedValue: 'Free space meets the configured threshold (15 GB by default)',
    troubleshooting: 'Review disk usage and your organization\'s retention policy before removing data. Confirm the space required for the specific update or maintenance task separately.',
    referenceCommand: 'Get-CimInstance Win32_LogicalDisk -Filter "DeviceID=\'C:\'" | Select-Object DeviceID, Size, FreeSpace'
  },
  Updates: {
    key: 'Updates',
    name: 'Windows Update Service State',
    category: 'Software/Teams',
    description: 'Checks only whether wuauserv is currently Running and its CIM StartMode is Auto. It does not scan for updates, prove update compliance, install updates, or evaluate Store update policy.',
    psCommand: 'Get-CimInstance Win32_Service -Filter "Name=\'wuauserv\'"',
    expectedValue: 'State = Running and StartMode = Auto; any other result is WARN',
    troubleshooting: 'Review the service state/start mode, Windows Update policy, and Windows Update event logs to determine why the observed values differ before changing configuration.',
    referenceCommand: 'Get-CimInstance Win32_Service -Filter "Name=\'wuauserv\'" | Select-Object Name, State, StartMode, ExitCode'
  }
};
