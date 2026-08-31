# Code Signing Guide

This document explains how to configure and use Authenticode code signing for the MTR Diagnostic Suite Windows distribution.

## Overview

The Windows installer and portable executable are signed with Authenticode signatures and RFC 3161 timestamps to:
- Allow Windows to verify publisher identity and artifact integrity
- Reduce SmartScreen warnings and security concerns
- Meet security requirements for a diagnostic/remediation tool that executes PowerShell

## Architecture

### Components

1. **electron-builder configuration** (package.json)
   - Specifies signing certificate environment variables
   - References custom signing script for advanced control

2. **Custom signing script** (customSign.js)
   - Uses `signtool` to apply Authenticode signatures
   - Adds RFC 3161 timestamp from public timestamp server
   - Handles errors and logs signing progress

3. **CI/CD workflow** (.github/workflows/build.yml)
   - Prepares signing certificate from GitHub secret
   - Runs electron-builder with signing enabled
   - Verifies signatures using `Get-AuthenticodeSignature`
   - Fails the build if signatures are invalid
   - Cleans up sensitive certificate file

## Setup Instructions

### Prerequisites

- Windows-based CI environment (GitHub Actions `windows-latest` runner)
- Code signing certificate in PFX format (.pfx or .p12)
- Certificate password
- Access to GitHub repository secrets

### Obtaining a Code Signing Certificate

You can obtain a code signing certificate from:

1. **Commercial CAs** (recommended for production):
   - DigiCert, GlobalSign, Sectigo, Comodo, etc.
   - Typically $200-500/year
   - Includes organization verification
   - Faster SmartScreen reputation building

2. **Self-signed certificates** (for testing/staging):
   ```powershell
   # Create a self-signed certificate valid for 10 years
   $cert = New-SelfSignedCertificate `
     -Type CodeSigningCert `
     -Subject "CN=MTR Diagnostic Suite" `
     -KeyUsage DigitalSignature `
     -KeySpec Signature `
     -KeyLength 2048 `
     -NotAfter (Get-Date).AddYears(10) `
     -CertStoreLocation "Cert:\CurrentUser\My"
   
   # Export to PFX file
   $pwd = ConvertTo-SecureString -String "YourPassword" -Force -AsPlainText
   Export-PfxCertificate -Cert $cert -FilePath "codesign.pfx" -Password $pwd
   ```

### GitHub Secrets Configuration

1. **Obtain Base64-encoded certificate**:
   ```powershell
   $certBytes = [System.IO.File]::ReadAllBytes("codesign.pfx")
   $certBase64 = [System.Convert]::ToBase64String($certBytes)
   Set-Clipboard -Value $certBase64  # Copy to clipboard
   ```

2. **Add GitHub secrets** (Settings → Secrets and variables → Actions):
   - `CSC_LINK_BASE64`: Base64-encoded PFX certificate (paste from clipboard)
   - `CSC_KEY_PASSWORD`: Certificate password (NOT the base64 string)

### Local Testing (Optional)

To test signing locally:

```powershell
# Set environment variables
$env:CSC_LINK = "C:\path\to\codesign.pfx"
$env:CSC_KEY_PASSWORD = "your-certificate-password"

# Build with signing
npm run electron:build

# Verify signature
Get-AuthenticodeSignature -FilePath "release\MTR Diagnostic Suite Setup.exe"
```

## Expected Publisher Information

After successful signing, the certificate details should be:

```
SignerCertificate.Subject: CN=<Your Organization Name>
SignerCertificate.Thumbprint: <40-character hex string>
TimeStamperCertificate: <Timestamp CA info>
Status: Valid
```

**Document the actual signer certificate subject for your organization** in your release notes, so users can verify the signature matches your official publisher identity.

## Signature Verification

### For End Users

**Windows 11/10 - View Signature Properties**:
1. Right-click on the installer (.exe file)
2. Select "Properties"
3. Click the "Digital Signatures" tab
4. Select the signature and click "Details"
5. Verify:
   - Status: "Signature verified"
   - Signer name matches your organization
   - Timestamp is from a trusted authority

**PowerShell - Verify Signature**:
```powershell
$signature = Get-AuthenticodeSignature -FilePath "MTR Diagnostic Suite Setup.exe"
$signature | Format-List -Property *
```

### In CI/CD

The workflow automatically verifies signatures using `Get-AuthenticodeSignature`:
- Checks signature validity
- Displays signer certificate info
- Logs timestamp server info
- **Fails the release if signature is invalid**

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CSC_LINK` | Yes (for signing) | Path to code signing certificate (.pfx/.p12) |
| `CSC_KEY_PASSWORD` | Yes (for signing) | Password for the certificate |
| `SIGNTOOL_TIMESTAMP_URL` | No | RFC 3161 timestamp server URL (defaults to `http://timestamp.sectigo.com`) |
| `CSC_LINK_BASE64` | Yes (in CI) | Base64-encoded certificate (GitHub secret) |

## Troubleshooting

### Common Issues

**"signtool is not recognized"**
- `signtool` comes with Windows SDK
- Install Windows SDK or ensure it's in PATH
- On CI runners, it should be pre-installed

**"Certificate not found"**
- Verify CSC_LINK path is correct
- Check certificate file permissions
- Ensure .pfx file is valid

**"The specified timestamp URL was not reached"**
- Verify internet connection
- Check if timestamp server is accessible
- Try alternative timestamp server URL

**"The certificate password is incorrect"**
- Verify CSC_KEY_PASSWORD matches certificate
- Check for special characters (may need escaping)
- Ensure password doesn't have trailing whitespace

**"Signature verification fails"**
- Certificate may have expired
- Timestamp may have failed (no internet during signing)
- SHA256 support may be missing

### Getting Help

1. Check GitHub Actions workflow logs for detailed error messages
2. Review the custom signing script output for signing details
3. Run local verification: `Get-AuthenticodeSignature -FilePath <exe_path>`
4. Contact certificate provider for timestamp server issues

## Security Best Practices

1. **Never commit certificate to repository**
   - Use GitHub secrets
   - Cleanup certificate file after build (workflow does this)

2. **Use strong certificate passwords**
   - Minimum 20 characters
   - Mix uppercase, lowercase, numbers, symbols
   - Store securely in GitHub secrets

3. **Keep certificate secure**
   - Restrict who has access to CSC_LINK_BASE64 and CSC_KEY_PASSWORD secrets
   - Only accessible in production workflows (master/main branch)
   - Audit access logs regularly

4. **Monitor signature validity**
   - Set calendar reminder for certificate expiration
   - Keep list of certificate subjects/thumbprints for documentation
   - Verify signatures in releases after publishing

5. **Use RFC 3161 timestamps**
   - Signatures remain valid even after certificate expires
   - Always include timestamp in signing configuration
   - Public timestamp servers are reliable (Sectigo, DigiCert, etc.)

## References

- [Authenticode Code Signing](https://learn.microsoft.com/en-us/windows-hardware/drivers/dashboard/code-signing-reqs)
- [RFC 3161 Timestamp Protocol](https://www.ietf.org/rfc/rfc3161.txt)
- [signtool Documentation](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool)
- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)

## Related Issues

- BUG-9: Sign the Windows installer and packaged application
- Windows SmartScreen warnings
- User trust and artifact integrity verification
