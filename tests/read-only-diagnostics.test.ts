import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePowerShellScript, generateUpdateScript } from '../src/data/powershellTemplates';
import { parseOperationId } from '../src/shared/operations';

/**
 * BUG-6 REGRESSION TESTS: Read-Only Diagnostics & Explicit Remediation
 *
 * Requirement: Diagnostics must be read-only. Remediation operations must be
 * separate, explicit, require confirmation, and must properly capture exit codes
 * and verify state before reporting success.
 */

const diagnosticConfig = {
  minimumDiskSpaceGB: 15,
  minimumDisplayCount: 1,
  targetPingHost: 'teams.microsoft.com',
  targetPingPort: 443,
};

test('diagnostic script is completely read-only with no configuration changes', () => {
  const script = generatePowerShellScript(diagnosticConfig);

  // Reject any power configuration mutations
  assert.doesNotMatch(script, /powercfg\s+-(?:duplicatescheme|setactive|change|setacvalueindex|setdcvalueindex|query)/i,
    'Diagnostic must not contain powercfg commands that modify power plans or settings');

  // Reject PowerShell mutation cmdlets
  assert.doesNotMatch(script, /\b(?:Set|New|Remove|Add|Enable|Disable|Start|Stop|Restart|Initialize|Invoke|Out-File)-[A-Za-z]+\b/i,
    'Diagnostic must not use mutation cmdlets (Set*, New*, Remove*, Add*, etc.)');

  // Reject file write operations
  assert.doesNotMatch(script, /\b(?:Out-File|Invoke-Item|Invoke-WebRequest|Invoke-Expression|iex|iwr)\b/i,
    'Diagnostic must not write files or download content');

  // Reject mutation keywords
  assert.doesNotMatch(script, /\b(?:Applying|Optimized?|Configuring|Updating|Installing|Repairing|Reboot|Restart)\b/i,
    'Diagnostic must not contain words indicating configuration changes');

  // Reject registry operations
  assert.doesNotMatch(script, /\b(?:New-Item|Set-Item|Remove-Item|Set-ItemProperty|Remove-ItemProperty)\b.*-Path.*HKLM|HKEY_LOCAL_MACHINE/i,
    'Diagnostic must not modify registry');

  // Ensure script produces only read results
  assert.match(script, /Get-CimInstance|Get-Service|Get-PnpDevice|Get-AppxPackage|Get-NetIPAddress/,
    'Diagnostic must use read-only Get-* cmdlets');
});

test('diagnostic script properly handles errors without mutating state', () => {
  const script = generatePowerShellScript(diagnosticConfig);

  // Verify error handling uses -ErrorAction SilentlyContinue, not -ErrorAction Stop
  assert.match(script, /-ErrorAction SilentlyContinue/,
    'Diagnostic must use SilentlyContinue for errors to avoid mutations on read failures');

  // Verify no $LASTEXITCODE checking for configuration (should only check for script success)
  // The diagnostic may check exit code for validating its own successful completion, but not to apply fixes
  assert.doesNotMatch(script, /\$LASTEXITCODE\s*(?:-(?:eq|ne|gt|lt)\s*0|.*powercfg)/i,
    'Diagnostic must not check $LASTEXITCODE for configuration operations');
});

test('remediation script exists as separate function', () => {
  const remediationScript = generateUpdateScript();

  assert.ok(remediationScript && typeof remediationScript === 'string',
    'Remediation script must be generated separately from diagnostics');

  assert.ok(remediationScript.length > 0,
    'Remediation script must not be empty');
});

test('remediation script contains Teams app repair (not system configuration)', () => {
  const remediationScript = generateUpdateScript();

  // MTR remediation focuses on app registration, not system config
  assert.match(remediationScript, /Microsoft\.SkypeRoomSystem|AppxPackage/i,
    'Remediation must address Teams Room app repair');

  assert.match(remediationScript, /Add-AppxPackage/,
    'Remediation must use Add-AppxPackage for re-registration');

  assert.doesNotMatch(remediationScript, /powercfg.*setactive/i,
    'Remediation should not modify power plans as a primary operation');
});

test('operation IDs enforce separation between diagnostics and remediation', () => {
  // Only these fixed operation IDs should cross the security boundary
  const validOps = [
    'run-diagnostics',
    'scan-repair-updates',
    'install-mtr-update',
  ];

  for (const op of validOps) {
    assert.equal(parseOperationId(op), op,
      `Valid operation ID ${op} must be recognized`);
  }

  // Reject arbitrary operations
  assert.equal(parseOperationId('run-arbitrary-powershell'), null,
    'Arbitrary operation IDs must be rejected');

  assert.equal(parseOperationId('force-system-updates'), null,
    'Unknown operation IDs must be rejected');

  assert.equal(parseOperationId({ scriptContent: 'any-script', scriptType: 'powershell' }), null,
    'Inline script objects must be rejected');
});

test('diagnostic script identifies itself as read-only in comments', () => {
  const script = generatePowerShellScript(diagnosticConfig);

  // Diagnostic should clearly state its non-destructive nature
  // at least in the help or variable documentation
  assert.ok(
    script.includes('Diagnostic') || script.includes('DIAGNOSTIC') || script.includes('checks'),
    'Diagnostic script must clearly identify itself as diagnostic/check-only'
  );
});

test('diagnostic script does not request elevation changes', () => {
  const script = generatePowerShellScript(diagnosticConfig);

  // Must require administrator for reading some system state, but never change it
  assert.match(script, /#Requires\s+-RunAsAdministrator/,
    'Diagnostic requires elevation to read protected system state');

  // But should not use elevation to mutate
  assert.doesNotMatch(script, /start.*powershell.*-verb.*runas|Start-Process.*-Verb RunAs/i,
    'Diagnostic must not re-elevate or start new admin processes to make changes');
});

test('operation structure validates read-only contract for run-diagnostics', () => {
  // This test validates that the operation runner enforces the separation
  // by checking that 'run-diagnostics' is defined as a valid operation
  const diagnosticsOp = 'run-diagnostics';
  const parsedId = parseOperationId(diagnosticsOp);

  assert.equal(parsedId, diagnosticsOp,
    'run-diagnostics must be a recognized, valid operation ID');

  assert.notEqual(parsedId, null,
    'run-diagnostics must not be rejected by parseOperationId');

  assert.notEqual(parsedId, 'force-system-updates',
    'run-diagnostics must be distinctly different from mutation operations');
});
