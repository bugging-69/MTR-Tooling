/**
 * Custom signing script for electron-builder
 * Signs Windows executables with Authenticode signature and RFC 3161 timestamp
 * 
 * Environment variables required:
 * - CSC_LINK: Path to the code signing certificate file (.pfx or .p12)
 * - CSC_KEY_PASSWORD: Password for the certificate
 * - SIGNTOOL_TIMESTAMP_URL: (optional) RFC 3161 timestamp server URL
 *   Default: http://timestamp.sectigo.com (free public timestamp server)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TIMESTAMP_URL = process.env.SIGNTOOL_TIMESTAMP_URL || 'http://timestamp.sectigo.com';
const HASH_ALGORITHM = 'sha256';

/**
 * Sign a file using signtool
 * @param {string} filePath - Path to the file to sign
 * @param {string} certificatePath - Path to the signing certificate
 * @param {string} certificatePassword - Password for the certificate
 * @returns {void}
 */
function signFile(filePath, certificatePath, certificatePassword) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!fs.existsSync(certificatePath)) {
    throw new Error(`Certificate not found: ${certificatePath}`);
  }

  // Build signtool command
  // signtool sign /f "cert.pfx" /p "password" /fd sha256 /tr "http://timestamp.sectigo.com" /td sha256 "file.exe"
  const command = [
    'signtool',
    'sign',
    '/f', `"${certificatePath}"`,
    '/p', `"${certificatePassword}"`,
    '/fd', HASH_ALGORITHM,
    '/tr', TIMESTAMP_URL,
    '/td', HASH_ALGORITHM,
    `"${filePath}"`
  ].join(' ');

  console.log(`\n📝 Signing: ${path.basename(filePath)}`);
  console.log(`   Hash Algorithm: ${HASH_ALGORITHM}`);
  console.log(`   Timestamp URL: ${TIMESTAMP_URL}`);

  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`✅ Successfully signed: ${path.basename(filePath)}`);
    if (output) {
      console.log(output);
    }
  } catch (error) {
    console.error(`❌ Failed to sign: ${path.basename(filePath)}`);
    console.error(error.message);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
    throw new Error(`Signing failed for ${filePath}: ${error.message}`);
  }
}

/**
 * Main signing function called by electron-builder
 * @param {object} config - electron-builder configuration
 * @returns {Promise<void>}
 */
async function sign(config) {
  const certificatePath = process.env.CSC_LINK;
  const certificatePassword = process.env.CSC_KEY_PASSWORD;

  if (!certificatePath) {
    console.warn('⚠️  CSC_LINK not set - skipping code signing');
    return;
  }

  if (!certificatePassword) {
    throw new Error('CSC_KEY_PASSWORD environment variable is required for signing');
  }

  console.log('\n🔐 Starting Authenticode signing process...');

  // Sign all files passed in the config
  if (config.path) {
    const filePath = config.path;
    signFile(filePath, certificatePath, certificatePassword);
  } else if (Array.isArray(config)) {
    // Handle multiple files
    for (const filePath of config) {
      signFile(filePath, certificatePath, certificatePassword);
    }
  }

  console.log('\n✨ Signing complete\n');
}

module.exports = sign;
