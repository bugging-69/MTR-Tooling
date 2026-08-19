import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MTR_CHECKS_METADATA } from '../src/data/mtrChecksInfo';

const metadata = Object.values(MTR_CHECKS_METADATA);

const guidanceFor = (key: keyof typeof MTR_CHECKS_METADATA) => {
  const item = MTR_CHECKS_METADATA[key];
  return `${item.description} ${item.expectedValue} ${item.troubleshooting}`;
};

test('troubleshooting guide UI consistently presents read-only reference commands', async () => {
  const [guide, tabs] = await Promise.all([
    readFile(new URL('../src/components/RemediationGuide.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/TabsNavigation.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(guide, /MTR 19-Point Troubleshooting & Reference Guide/);
  assert.match(guide, /read-only PowerShell reference commands/);
  assert.match(guide, /Search checks, descriptions, troubleshooting, or reference commands/);
  assert.match(guide, /Copy Reference Command/);
  assert.match(guide, /item\.referenceCommand/);
  assert.match(tabs, /label: 'Reference Guide'/);

  assert.doesNotMatch(guide, /PowerShell repair snippets|Copy Fix Snippet|Copy PowerShell repair command|remediation commands|Troubleshooting & Remediation/);
  assert.doesNotMatch(tabs, /label: 'Fix Guide'/);
});

test('all 19 metadata entries expose only read-only reference commands', () => {
  assert.equal(metadata.length, 19);

  const mutatingPowerShellVerb = /\b(?:Set|New|Remove|Add|Enable|Disable|Start|Stop|Restart|Reset|Install|Uninstall|Register|Unregister|Update|Clear|Repair|Invoke)-[A-Za-z]+\b/i;
  const mutatingNativeCommand = /(?:^|[;&|]\s*)(?:sc(?:\.exe)?\s+(?:start|stop|config)|netsh\b[^;&|]*\bset\b|reg(?:\.exe)?\s+(?:add|delete)|slmgr(?:\.vbs)?\s+\/(?:ato|ipk|upk|rearm)|dsregcmd\s+\/(?:join|leave)|shutdown\b)/i;

  for (const item of metadata) {
    assert.equal(Object.hasOwn(item, 'fixCommand'), false, `${item.key} still exposes fixCommand`);
    assert.ok(item.referenceCommand.trim(), `${item.key} has no reference command`);
    assert.doesNotMatch(item.referenceCommand, mutatingPowerShellVerb, `${item.key} uses a mutating PowerShell command`);
    assert.doesNotMatch(item.referenceCommand, mutatingNativeCommand, `${item.key} uses a mutating native command`);
  }
});

test('high-risk troubleshooting metadata states only what current checks prove', () => {
  assert.match(guidanceFor('Display'), /does not prove that a display is active or showing video/i);
  assert.match(guidanceFor('DisplayCount'), /does not verify active topology, resolution, or video output/i);
  const networkCommand = MTR_CHECKS_METADATA.Network.psCommand;
  assert.match(networkCommand, /\$candidate = \$_/);
  assert.match(networkCommand, /-InterfaceIndex \$candidate\.InterfaceIndex/);
  assert.match(networkCommand, /AddressState -eq "Preferred"/);
  assert.match(networkCommand, /if \(\$ipv4 -and \$candidate\.ReceiveLinkSpeed -ge 100000000\)/);
  assert.ok(networkCommand.indexOf('$candidate = $_') < networkCommand.indexOf('$candidate.InterfaceIndex'));
  assert.match(guidanceFor('VendorDevices'), /does not prove.*MTR-certified peripheral/i);
  assert.match(guidanceFor('HDMIIngest'), /does not prove HDMI ingest capability or a working content stream/i);

  assert.match(guidanceFor('Internet'), /only a TCP connection/i);
  assert.match(guidanceFor('Internet'), /does not prove.*UDP\/media reachability/i);
  assert.match(guidanceFor('Internet'), /UDP media ports separately/i);
  assert.doesNotMatch(MTR_CHECKS_METADATA.Internet.referenceCommand, /3478|3479|3480|3481|UDP/i);

  assert.match(guidanceFor('IPv6'), /fallback accepts link-local or loopback/i);
  assert.match(guidanceFor('IPv6'), /does not prove IPv6 on the active room network adapter/i);
  assert.match(MTR_CHECKS_METADATA.IPv6.referenceCommand, /^Get-NetIPAddress\b/i);

  assert.match(guidanceFor('TeamsApp'), /exact Microsoft\.SkypeRoomSystem Appx package/i);
  assert.match(guidanceFor('TeamsApp'), /supported deployment or recovery process to install it/i);
  assert.doesNotMatch(guidanceFor('TeamsApp'), /re-register/i);
  assert.match(guidanceFor('TeamsSvc'), /at least one service whose name starts with SkypeRoomSystem/i);
  assert.match(guidanceFor('TeamsSvc'), /does not prove.*room app is healthy/i);
  assert.match(MTR_CHECKS_METADATA.TeamsSvc.referenceCommand, /^Get-CimInstance\b/i);

  assert.match(guidanceFor('Activation'), /does not verify a specific Windows edition/i);
  assert.match(MTR_CHECKS_METADATA.Activation.referenceCommand, /^Get-CimInstance\b/i);
  assert.match(guidanceFor('NUCModel'), /does not certify the model or inspect firmware\/BIOS/i);
  assert.doesNotMatch(MTR_CHECKS_METADATA.NUCModel.troubleshooting, /update.*BIOS|BIOS.*update/i);

  assert.match(guidanceFor('AzureAD'), /DomainJoined : YES.*satisfies/i);
  assert.match(guidanceFor('AzureAD'), /DomainJoined : YES passes.*AzureAdJoined is not YES/i);
  assert.match(guidanceFor('DiskSpace'), /configured minimum \(15 GB by default\)/i);
  assert.match(guidanceFor('Updates'), /does not scan for updates, prove update compliance, install updates/i);
  assert.match(MTR_CHECKS_METADATA.Updates.referenceCommand, /^Get-CimInstance\b/i);
});
