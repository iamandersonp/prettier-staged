#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

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
 * Copies the pre-commit hook to the target project's git-hooks directory
 * if it doesn't already exist
 */
function copyPreCommitHook() {
  try {
    const targetProjectDir = getTargetProjectDir();
    const targetHooksDir = path.join(targetProjectDir, 'git-hooks');
    const targetPreCommitPath = path.join(targetHooksDir, 'pre-commit');

    // Check if pre-commit already exists
    if (fs.existsSync(targetPreCommitPath)) {
      console.log('✅ git-hooks/pre-commit already exists, skipping copy');
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
      console.log('📁 Created git-hooks directory');
    }

    // Copy the file
    fs.copyFileSync(sourcePreCommitPath, targetPreCommitPath);

    // Make it executable
    fs.chmodSync(targetPreCommitPath, 0o755);

    console.log('✅ Copied pre-commit hook to git-hooks/pre-commit');
    console.log('💡 To use it, run: git config core.hooksPath git-hooks');
  } catch (error) {
    // Don't fail installation if hook copy fails
    console.warn('⚠️ Failed to copy pre-commit hook:', error.message);
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
    execSync('git config core.hooksPath .git-hooks', { stdio: 'ignore' });
    console.log('✅ Configured git to use .git-hooks directory');

    // Make hooks executable
    execSync('chmod +x ./.git-hooks/*', { stdio: 'ignore' });
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
    console.log('📦 Installing as dependency, copying pre-commit hook...');
    copyPreCommitHook();
  } else {
    console.log('🏠 Running in development mode, skipping hook copy');
  }

  console.log('✨ Setup complete!');
}

// Export for testing
module.exports = {
  isExternalInstallation,
  getTargetProjectDir,
  copyPreCommitHook,
  setupLibraryGitHooks,
  installHooks
};

// Run if called directly
if (require.main === module) {
  installHooks();
}
