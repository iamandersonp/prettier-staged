#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

/**
 * Lee el archivo .env para obtener HOOKS_DIR, retorna el valor por defecto si no existe
 */
function getHooksDirFromEnv() {
  const defaultHooksDir = '.git-hooks';

  try {
    const envPath = path.join(process.cwd(), '.env');

    if (!fs.existsSync(envPath)) {
      return defaultHooksDir;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('HOOKS_DIR=')) {
        const value = trimmedLine.substring('HOOKS_DIR='.length).trim();
        // Remover comillas si existen (simples o dobles)
        let cleanValue = value
          .replace(/^['"]/, '') // Remover comilla de inicio
          .replace(/['"]$/, ''); // Remover comilla de final
        return cleanValue || defaultHooksDir;
      }
    }

    return defaultHooksDir;
  } catch (error) {
    // Si hay cualquier error leyendo el archivo, usar valor por defecto
    console.warn('Warning: Could not read .env file, using default HOOKS_DIR:', error.message);
    return defaultHooksDir;
  }
}

// Constante para el directorio de hooks (lee desde .env o usa valor por defecto)
const HOOKS_DIR = getHooksDirFromEnv();

/**
 * Detects if the package is being installed as a dependency in another project
 * vs being installed during local development
 */
function isExternalInstallation() {
  const initCwd = process.env.INIT_CWD;
  const currentCwd = process.cwd();

  // If INIT_CWD is different from current working directory,
  // we're being installed as a dependency
  return !!(initCwd && initCwd !== currentCwd);
}

/**
 * Gets the target project directory (where the package is being installed)
 */
function getTargetProjectDir() {
  // INIT_CWD contains the directory where npm install was run
  return process.env.INIT_CWD || process.cwd();
}

/**
 * Copies the pre-commit hook to the target project's .git-hooks directory
 * if it doesn't already exist
 */
function copyPreCommitHook() {
  try {
    const targetProjectDir = getTargetProjectDir();
    const targetHooksDir = path.join(targetProjectDir, HOOKS_DIR);
    const targetPreCommitPath = path.join(targetHooksDir, 'pre-commit');

    // Check if pre-commit already exists
    if (fs.existsSync(targetPreCommitPath)) {
      console.log(`✅ ${HOOKS_DIR}/pre-commit already exists, skipping copy`);
      return;
    }

    // Get source pre-commit path
    const sourcePreCommitPath = path.join(__dirname, '..', '.git-hooks', 'pre-commit-sample');

    if (!fs.existsSync(sourcePreCommitPath)) {
      console.warn('⚠️ Source pre-commit hook not found, skipping copy');
      return;
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetHooksDir)) {
      fs.mkdirSync(targetHooksDir, { recursive: true });
      console.log(`📁 Created ${HOOKS_DIR} directory`);
    }

    // Copy the file
    fs.copyFileSync(sourcePreCommitPath, targetPreCommitPath);

    // Make it executable
    fs.chmodSync(targetPreCommitPath, 0o755);

    console.log(`✅ Copied pre-commit hook to ${HOOKS_DIR}/pre-commit`);
    console.log(`💡 To use it, run: git config core.hooksPath ${HOOKS_DIR}`);
  } catch (error) {
    // Don't fail installation if hook copy fails
    console.warn('⚠️ Failed to copy pre-commit hook:', error.message);
  }
}

/**
 * Copies the .env.example file to the target project's root directory
 * if it doesn't already exist
 */
function copyEnvExample() {
  try {
    const targetProjectDir = getTargetProjectDir();
    const targetEnvExamplePath = path.join(targetProjectDir, '.env.example');

    // Check if .env.example already exists
    if (fs.existsSync(targetEnvExamplePath)) {
      console.log('✅ .env.example already exists, skipping copy');
      return;
    }

    // Get source .env.example path
    const sourceEnvExamplePath = path.join(__dirname, '..', '.env.example');

    if (!fs.existsSync(sourceEnvExamplePath)) {
      console.warn('⚠️ Source .env.example not found, skipping copy');
      return;
    }

    // Copy the file
    fs.copyFileSync(sourceEnvExamplePath, targetEnvExamplePath);

    console.log('✅ Copied .env.example to project root');
    console.log('💡 Configure your environment by copying .env.example to .env');
  } catch (error) {
    // Don't fail installation if .env.example copy fails
    console.warn('⚠️ Failed to copy .env.example:', error.message);
  }
}

/**
 * Sets up git hooks in the library's own .git-hooks directory
 * (existing functionality)
 */
function setupLibraryGitHooks() {
  const { execSync } = require('node:child_process');

  try {
    // Configure git to use .git-hooks directory
    execSync(`git config core.hooksPath ${HOOKS_DIR}`, { stdio: 'ignore' });
    console.log(`✅ Configured git to use ${HOOKS_DIR} directory`);

    // Make hooks executable
    execSync(`chmod +x ./${HOOKS_DIR}/*`, { stdio: 'ignore' });
    console.log('✅ Made git hooks executable');
  } catch (error) {
    // Silently fail if not in a git repository or permissions issue
    console.warn('⚠️ Could not setup library git hooks:', error.message);
  }
}

/**
 * Main installation function
 */
function installHooks() {
  console.log('🔧 Setting up prettier-staged hooks...');

  // Always setup hooks for the library itself
  setupLibraryGitHooks();

  // Only copy to target project if this is an external installation
  if (isExternalInstallation()) {
    console.log('📦 Installing as dependency, copying files...');
    copyPreCommitHook();
    copyEnvExample();
  } else {
    console.log('🏠 Running in development mode, skipping file copies');
  }

  console.log('✨ Setup complete!');
}

// Export for testing
module.exports = {
  isExternalInstallation,
  getTargetProjectDir,
  copyPreCommitHook,
  copyEnvExample,
  setupLibraryGitHooks,
  installHooks,
  getHooksDirFromEnv,
  HOOKS_DIR
};

// Run if called directly
if (require.main === module) {
  installHooks();
}
