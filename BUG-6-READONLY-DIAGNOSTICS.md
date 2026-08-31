# BUG-6: Read-Only Diagnostics & Explicit Remediation

## Overview

The MTR Diagnostic Suite enforces strict separation between **read-only diagnostics** and **destructive remediation operations**. This ensures that health checks cannot accidentally mutate system configuration.

## Architecture

### Operation Types

1. **`run-diagnostics`** (Read-Only)
   - Performs 19 non-destructive health checks
   - Uses only `Get-*` PowerShell cmdlets
   - Requires elevation only to read protected system state
   - Never changes power settings, registry, services, or files
   - Returns results without side effects
   - UI Label: "Run Diagnostics" with subtext "Read-only 19-point health check"

2. **`scan-repair-updates`** (Remediation - Requires Confirmation)
   - Requests Windows Update scan
   - Repairs MTR app registration if issues detected
   - Focuses on app-level repairs, not system configuration
   - Requires explicit user confirmation via modal dialog
   - UI Label: "Scan Updates & Repair MTR App"

3. **`install-mtr-update`** (Update - Requires Confirmation)
   - Downloads and executes official Microsoft MTR update
   - Validates Microsoft Authenticode signature
   - Requires explicit user confirmation via info modal
   - UI Label: "Run Official MTR App Updater"

## Read-Only Diagnostic Contract

### Guaranteed Behaviors

The diagnostic script (`generatePowerShellScript`) is guaranteed to:

- ✅ Use only `Get-*`, `Where-Object`, filtering, and arithmetic operations
- ✅ Never execute `powercfg` commands
- ✅ Never call mutation cmdlets (`Set-*`, `New-*`, `Remove-*`, `Add-*`, `Enable-*`, `Disable-*`, `Start-*`, `Stop-*`, `Restart-*`, `Initialize-*`)
- ✅ Never write files (`Out-File`, `Invoke-Item`, `Invoke-WebRequest`)
- ✅ Never modify registry, services, or system configuration
- ✅ Never print words like "Applying", "Optimized", "Configuring", "Installing", "Repairing", or "Reboot"
- ✅ Return results through stdout JSON only - no file exports
- ✅ Handle all errors with `-ErrorAction SilentlyContinue` to prevent cascading mutations
- ✅ Report failures honestly without attempting fixes

### Validation

These behaviors are enforced by:

1. **Runtime Tests** (`tests/read-only-diagnostics.test.ts`)
   - Regex validation against the generated script
   - Ensures no mutation cmdlets or keywords exist
   - Confirms operation ID separation

2. **Existing Test** (`tests/diagnostic-accuracy.test.ts:22`)
   - Test: `run-diagnostics contains checks only and no machine configuration changes`
   - Validates absence of powercfg, mutation cmdlets, and file operations

3. **Code Architecture**
   - Only whitelisted operation IDs cross the Electron boundary
   - `parseOperationId()` rejects arbitrary scripts
   - Operation runner restricts execution to defined operations

## Remediation Confirmation Flow

### User Experience

1. User clicks "Scan Updates & Repair MTR App" button
2. Confirmation modal appears with:
   - Clear warning about the operation
   - What it does (scan Windows Updates, repair MTR app registration)
   - What it doesn't do (automatic update installation)
   - Requirements (administrator privileges, may take several minutes)
3. User must explicitly click "Run Scan & Repair" to proceed
4. Operation executes in the background
5. Results are displayed when complete

### Code Implementation

The confirmation dialog is implemented in `src/components/SystemDiagnostics.tsx`:

```tsx
// State for confirmation dialog
const [showScanRepairConfirm, setShowScanRepairConfirm] = useState(false);
const [pendingRemediationOp, setPendingRemediationOp] = useState<'scan-repair-updates' | null>(null);

// Button shows confirmation instead of running directly
<button
  onClick={() => {
    setPendingRemediationOp('scan-repair-updates');
    setShowScanRepairConfirm(true);
  }}
>
  Scan Updates & Repair MTR App
</button>

// Modal requires explicit confirmation
{showScanRepairConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    {/* Confirmation dialog with warning and Cancel/Proceed buttons */}
  </div>
)}
```

## Why This Matters

### Risk Mitigation

1. **Accidental Configuration Changes**: The diagnostic cannot accidentally enable power plans, modify disk timeouts, or disable USB selective suspend
2. **Audit Trail**: Users consciously choose to run remediation via explicit confirmation dialog
3. **Security**: Separation prevents privilege escalation through diagnostic channels
4. **Reliability**: Read-only operations cannot corrupt system state or create unrecoverable situations

### User Trust

- Clear labeling ("Read-only 19-point health check")
- Explicit confirmation dialogs for remediation
- Honest operation names that describe what they do
- No automatic fixes that users didn't consent to

## Testing

Run all tests to verify this contract is maintained:

```bash
npm test
```

Key test file: `tests/read-only-diagnostics.test.ts` (8 tests)
- Validates diagnostic script purity
- Confirms remediation separation
- Verifies operation ID enforcement
- Tests error handling safety

Expected result: All 8 BUG-6 tests pass, plus existing diagnostic test

## Maintenance

When modifying `generatePowerShellScript()`:

1. **After any change**, run: `npm test`
2. **Verify all read-only-diagnostics tests pass**
3. **If you add system configuration checks**: Create a new operation ID instead
4. **If you add commands to the script**: Ensure they're `Get-*` only

### Example: Adding a New Health Check

Instead of:
```ts
// ❌ WRONG - This violates read-only contract
powercfg /duplicatescheme SCHEME_CURRENT
```

Do:
```ts
// ✅ CORRECT - Read-only health check
$powerPlans = Get-CimInstance -Namespace "root\cimv2\power" -ClassName Win32_PowerPlan
```

## Related Documentation

- **Code Signing**: See [SIGNING.md](../SIGNING.md) for installer signing details
- **Security Boundary**: See `src/electron/operationRunner.ts` for operation execution isolation
- **UI Components**: See `src/components/SystemDiagnostics.tsx` for remediation confirmation dialogs
- **Test Coverage**: See `tests/diagnostic-accuracy.test.ts` for diagnostic validation tests

## References

- PowerShell Risk Management: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies
- Windows Update Service: https://learn.microsoft.com/en-us/windows/deployment/update/windows-update-for-business
- MTR Documentation: https://learn.microsoft.com/en-us/microsoftteams/rooms/
