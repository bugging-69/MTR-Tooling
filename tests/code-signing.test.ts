import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Regression test for BUG-9: Sign the Windows installer and packaged application
 * 
 * These tests verify that:
 * 1. Signing configuration is present in electron-builder config
 * 2. Certificate environment variables are properly configured
 * 3. Custom signing script exists and is properly formatted
 * 4. CI workflow includes signature verification
 */

test('electron-builder win config includes code signing configuration', async () => {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

  const winConfig = packageJson.build.win;
  assert.ok(winConfig, 'win configuration should exist');
  assert.ok(winConfig.certificateFile, 'certificateFile should be configured');
  assert.ok(winConfig.certificatePassword, 'certificatePassword should be configured');
  assert.strictEqual(winConfig.certificateFile, '${CSC_LINK}', 'certificateFile should reference CSC_LINK env var');
  assert.strictEqual(winConfig.certificatePassword, '${CSC_KEY_PASSWORD}', 'certificatePassword should reference CSC_KEY_PASSWORD env var');
  assert.deepStrictEqual(winConfig.signingHashAlgorithms, ['sha256'], 'should use sha256 hashing');
  assert.strictEqual(winConfig.sign, './customSign.js', 'should reference custom signing script');
});

test('NSIS configuration includes signing support', async () => {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

  const nsisConfig = packageJson.build.nsis;
  assert.ok(nsisConfig, 'nsis configuration should exist');
  assert.ok(nsisConfig.signingCertificateFile, 'signingCertificateFile should be configured');
  assert.ok(nsisConfig.signingCertificatePassword, 'signingCertificatePassword should be configured');
});

test('custom signing script exists with proper error handling', async () => {
  const signScriptPath = path.join(process.cwd(), 'customSign.js');
  const scriptContent = await readFile(signScriptPath, 'utf-8');

  assert.match(scriptContent, /signtool/, 'script should use signtool');
  assert.match(scriptContent, /sha256/, 'script should use sha256 hash algorithm');
  assert.match(scriptContent, /timestamp/, 'script should include timestamping');
  assert.match(scriptContent, /CSC_LINK/, 'script should reference CSC_LINK env var');
  assert.match(scriptContent, /CSC_KEY_PASSWORD/, 'script should reference CSC_KEY_PASSWORD env var');
  assert.match(scriptContent, /exports|module\.exports/, 'script should be a CommonJS module');
});

test('CI workflow includes certificate preparation step', async () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'build.yml');
  const workflowContent = await readFile(workflowPath, 'utf-8');

  assert.match(workflowContent, /Prepare signing certificate/, 'workflow should have certificate preparation step');
  assert.match(workflowContent, /CSC_LINK_BASE64/, 'workflow should reference CSC_LINK_BASE64 secret');
  assert.match(workflowContent, /FromBase64String/, 'workflow should decode base64 certificate');
});

test('CI workflow includes signature verification step', async () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'build.yml');
  const workflowContent = await readFile(workflowPath, 'utf-8');

  assert.match(workflowContent, /Verify installer signature/, 'workflow should have verification step');
  assert.match(workflowContent, /Get-AuthenticodeSignature/, 'workflow should verify authenticode signature');
  assert.match(workflowContent, /\.Status/, 'workflow should check signature status');
  assert.match(workflowContent, /Valid/, 'workflow should validate signature status');
  assert.match(workflowContent, /exit 1/, 'workflow should fail if signature is invalid');
});

test('CI workflow cleans up certificate after build', async () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'build.yml');
  const workflowContent = await readFile(workflowPath, 'utf-8');

  assert.match(workflowContent, /Clean up certificate/, 'workflow should have cleanup step');
  assert.match(workflowContent, /Remove-Item/, 'workflow should remove certificate file');
  assert.match(workflowContent, /if: always\(\)/, 'cleanup should always run');
});

test('signing script handles missing certificate gracefully', async () => {
  const signScriptPath = path.join(process.cwd(), 'customSign.js');
  const scriptContent = await readFile(signScriptPath, 'utf-8');

  assert.match(scriptContent, /CSC_LINK not set/, 'script should handle missing certificate');
  assert.match(scriptContent, /skipping code signing/, 'script should skip signing gracefully');
  assert.match(scriptContent, /CSC_KEY_PASSWORD.*required/, 'script should require password if certificate is present');
});

test('signing script uses RFC 3161 timestamp server', async () => {
  const signScriptPath = path.join(process.cwd(), 'customSign.js');
  const scriptContent = await readFile(signScriptPath, 'utf-8');

  assert.match(scriptContent, /timestamp/, 'script should include timestamping');
  assert.match(scriptContent, /SIGNTOOL_TIMESTAMP_URL|\/tr/, 'script should reference timestamp URL or /tr flag');
  assert.match(scriptContent, /sectigo|http/, 'script should reference a valid timestamp server');
});

test('signing configuration documents signer certificate subject in CI', async () => {
  const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'build.yml');
  const workflowContent = await readFile(workflowPath, 'utf-8');

  // The workflow should output the signer certificate subject for documentation
  assert.match(workflowContent, /SignerCertificate\.Subject|Signer:/, 'workflow should output signer certificate info');
});
