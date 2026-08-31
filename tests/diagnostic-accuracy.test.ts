import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MTR_CHECKS_METADATA } from '../src/data/mtrChecksInfo';
import { generatePowerShellScript, generateUpdateScript } from '../src/data/powershellTemplates';
import { createOperationRunner, type OperationRunnerDependencies } from '../src/electron/operationRunner';
import { parseOperationId } from '../src/shared/operations';

const diagnosticScript = () => generatePowerShellScript({
  minimumDiskSpaceGB: 15,
  minimumDisplayCount: 1,
  targetPingHost: 'teams.microsoft.com',
  targetPingPort: 443,
});

const createDependencies = (captureScript: (script: string) => void): OperationRunnerDependencies => ({
  isPackaged: true,
  platform: 'win32',
  isElevated: async () => true,
  makeTempDirectory: async () => 'C:\\private\\mtr-operation-random',
  secureDirectory: async () => undefined,
  writePrivateFile: async (_file, content) => captureScript(content),
  removeDirectory: async () => undefined,
  runProcess: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false, outputLimitExceeded: false }),
});

test('run-diagnostics contains checks only and no machine configuration changes', () => {
  const script = diagnosticScript();

  assert.doesNotMatch(script, /powercfg\s+-(?:duplicatescheme|setactive|change|setacvalueindex|setdcvalueindex)/i);
  assert.doesNotMatch(script, /\b(?:Set|New|Remove|Add|Enable|Disable|Start|Stop|Restart|Initialize)-[A-Za-z]+\b/i);
  assert.doesNotMatch(script, /\b(?:Out-File|Invoke-Item|Invoke-WebRequest)\b/i);
  assert.doesNotMatch(script, /Applying|Optimized|Optimize/i);
});

test('diagnostic PASS predicates prove the properties they describe', () => {
  const script = diagnosticScript();

  assert.match(script, /Get-PnpDevice -Class AudioEndpoint/);
  assert.match(script, /\$captureEndpoints/);
  assert.match(script, /\$renderEndpoints/);
  assert.doesNotMatch(script, /\$Results\.TeamsVersion = "PASS"/);
  assert.doesNotMatch(script, /MSTeams|\*SkypeRoomSystem\*/);
  assert.match(script, /Get-AppxPackage -AllUsers -Name "Microsoft\.SkypeRoomSystem"/);
  assert.match(script, /ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f'/i);
  assert.match(script, /Win32_Tpm/);
  assert.match(script, /SpecVersion[\s\S]*-contains '2\.0'/);
  assert.match(script, /Get-NetIPAddress[^\n]*IPv4/);
  assert.match(script, /100000000/);
  assert.match(script, /\$wuSvc\.State -eq 'Running' -and \$wuSvc\.StartMode -eq 'Auto'/);
});

test('native diagnostic command failures are checked before their output can pass', () => {
  const script = diagnosticScript();
  const commandIndex = script.indexOf('dsregcmd /status');
  const exitCheckIndex = script.indexOf('$LASTEXITCODE', commandIndex);
  const joinedCheckIndex = script.indexOf('AzureAdJoined', commandIndex);

  assert.ok(commandIndex >= 0);
  assert.ok(exitCheckIndex > commandIndex);
  assert.ok(joinedCheckIndex > exitCheckIndex);
});

test('fixed updater validates transfer and Microsoft Authenticode signature before executing its exact download', async () => {
  let script = '';
  const runner = createOperationRunner(createDependencies((content) => { script = content; }));
  await runner('install-mtr-update');

  assert.match(script, /Invoke-WebRequest[^\n]*-OutFile \$TargetScript[^\n]*-PassThru[^\n]*-TimeoutSec 300[^\n]*-ErrorAction Stop/);
  assert.match(script, /StatusCode/);
  assert.match(script, /Test-Path -LiteralPath \$TargetScript -PathType Leaf/);
  assert.match(script, /Get-AuthenticodeSignature -LiteralPath \$TargetScript/);
  assert.match(script, /\$Signature\.Status -ne 'Valid'/);
  assert.match(script, /O=Microsoft Corporation/);
  assert.match(script, /throw "Official MTR update signature is not valid or is not signed by Microsoft Corporation\."/);
  assert.doesNotMatch(script, /Downloads|Get-ChildItem|fallback/i);

  const signatureIndex = script.indexOf('Get-AuthenticodeSignature');
  const unblockIndex = script.indexOf('Unblock-File');
  const executeIndex = script.indexOf('-File $TargetScript');
  assert.ok(signatureIndex >= 0 && signatureIndex < unblockIndex);
  assert.ok(unblockIndex < executeIndex);
});

test('scan and repair operation is narrowly named and makes no update-install or TPM claims', () => {
  const script = generateUpdateScript();

  assert.equal(parseOperationId('force-system-updates'), null);
  assert.equal(parseOperationId('scan-repair-updates'), 'scan-repair-updates');
  assert.doesNotMatch(script, /Initialize-Tpm|Get-Tpm|TPM/i);
  assert.match(script, /REQUESTED: Windows Update interactive scan/i);
  assert.match(script, /REQUESTED: Re-register existing SkypeRoomSystem package/i);
  assert.match(script, /does not install updates/i);
  assert.doesNotMatch(script, /updated|updates completed|Force Update/i);
  assert.match(script, /\.ExitCode -ne 0/);
});

test('diagnostic and scan-repair UI wording is honest', async () => {
  const diagnostics = await readFile(new URL('../src/components/SystemDiagnostics.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(diagnostics, /Run Diagnostics & Optimize|Force System Updates|TPM, Store, OS/);
  assert.match(diagnostics, /Run Diagnostics/);
  assert.match(diagnostics, /Scan Updates & Repair MTR App/);
  assert.match(diagnostics, /Requests a scan; does not install updates/);
  assert.match(diagnostics, /Run Official MTR App Updater/);
  assert.match(diagnostics, /may take up to 30 minutes and will time out/i);
  assert.doesNotMatch(diagnostics, /Install Newest Teams Room/);
});

test('diagnostic metadata describes the implemented checks and non-compliance version result', () => {
  assert.match(MTR_CHECKS_METADATA.Microphone.psCommand, /Get-PnpDevice -Class AudioEndpoint/);
  assert.match(MTR_CHECKS_METADATA.Network.expectedValue, /Preferred non-APIPA IPv4 address and at least 100 Mbps/i);
  assert.match(MTR_CHECKS_METADATA.Activation.psCommand, /ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f'/i);
  assert.match(MTR_CHECKS_METADATA.TPM.psCommand, /Win32_Tpm/);
  assert.match(MTR_CHECKS_METADATA.TeamsVersion.expectedValue, /No minimum version baseline configured/i);
  assert.match(MTR_CHECKS_METADATA.Updates.expectedValue, /State = Running and StartMode = Auto/i);
});
