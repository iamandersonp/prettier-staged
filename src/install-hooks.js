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

  // 1. Both paths exist and are different: likely an external installation
  if (initCwd && initCwd !== currentCwd) {
    return true;
  }

  // 2. Rebuild/Link case: paths are the same,
  // but we check if we are inside node_modules
  if (currentCwd.includes('node_modules')) {
    return true;
  }

  // 3. If none of the above, it's real local development
  return false;
}

/**
 * Gets the target project directory (where the package is being installed)
 */
function getTargetProjectDir() {
  let targetDir;
  const currentCwd = process.cwd();

  if (currentCwd.includes('node_modules')) {
    // If we are in node_modules/@iamandersonp/prettier-staged
    // Go up 3 levels to reach the user's root
    targetDir = path.resolve(currentCwd, '..', '..', '..');
  } else {
    // If for some reason INIT_CWD was different and valid
    targetDir = process.env.INIT_CWD;
  }
  return targetDir || process.cwd();
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
 * Checks if required environment variables exist in .env file and adds them if missing
 */
function ensureEnvVariables(envPath) {
  try {
    if (!fs.existsSync(envPath)) {
      return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    // Check which variables exist
    const hasHooksDir = lines.some((line) => {
      const trimmed = line.trim();
      return (
        trimmed.startsWith('HOOKS_DIR=') ||
        trimmed.startsWith('HOOKS_DIR ') ||
        trimmed.includes('HOOKS_DIR=')
      );
    });
    const hasExtensions = lines.some((line) => {
      const trimmed = line.trim();
      return (
        trimmed.startsWith('EXTENSIONS=') ||
        trimmed.startsWith('EXTENSIONS ') ||
        trimmed.includes('EXTENSIONS=')
      );
    });

    // Variables to add with default values
    const variablesToAdd = [];

    if (!hasHooksDir) {
      variablesToAdd.push(
        '',
        '# Configuración del directorio de hooks de Git',
        'HOOKS_DIR=.git-hooks'
      );
    }

    if (!hasExtensions) {
      variablesToAdd.push(
        '',
        '# Configuración de extensiones de archivos para formateo con Prettier',
        'EXTENSIONS=html,js,ts,scss,css,json'
      );
    }

    // If we need to add variables, append them to the file
    if (variablesToAdd.length > 0) {
      const updatedContent = envContent.trimEnd() + '\n' + variablesToAdd.join('\n') + '\n';
      fs.writeFileSync(envPath, updatedContent, 'utf8');

      const addedVars = [];
      if (!hasHooksDir) addedVars.push('HOOKS_DIR');
      if (!hasExtensions) addedVars.push('EXTENSIONS');

      console.log(`✅ Added missing environment variables to .env: ${addedVars.join(', ')}`);
    }
  } catch (error) {
    console.warn('⚠️ Failed to ensure .env variables:', error.message);
  }
}

/**
 * Copies the .env.example file to the target project's root directory
 * if it doesn't already exist, and renames it to .env if .env doesn't exist
 */
function copyEnvExample() {
  try {
    const targetProjectDir = getTargetProjectDir();
    const targetEnvExamplePath = path.join(targetProjectDir, '.env.example');
    const targetEnvPath = path.join(targetProjectDir, '.env');

    // Check if .env.example already exists
    if (fs.existsSync(targetEnvExamplePath)) {
      console.log('✅ .env.example already exists, skipping copy');

      // Even if .env.example exists, check if we should rename it to .env
      if (fs.existsSync(targetEnvPath)) {
        console.log('💡 .env already exists, keeping both files');
        // Check and add missing variables to existing .env
        ensureEnvVariables(targetEnvPath);
      } else {
        fs.renameSync(targetEnvExamplePath, targetEnvPath);
        console.log('✅ Renamed .env.example to .env');
        console.log('💡 Environment configuration is ready to use');
      }
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

    // Check if .env already exists before renaming
    if (fs.existsSync(targetEnvPath)) {
      console.log('💡 .env already exists, keeping .env.example as backup');
      console.log('💡 You can configure your environment by editing the existing .env file');
      // Check and add missing variables to existing .env
      ensureEnvVariables(targetEnvPath);
    } else {
      // Rename .env.example to .env
      fs.renameSync(targetEnvExamplePath, targetEnvPath);
      console.log('✅ Renamed .env.example to .env');
      console.log('💡 Environment configuration is ready to use');
    }
  } catch (error) {
    // Don't fail installation if .env.example copy fails
    console.warn('⚠️ Failed to copy .env.example:', error.message);
  }
}

/**
 * Adds the prettier-staged script to the target project's package.json
 * if it doesn't already exist
 */
function addScriptToPackageJson() {
  try {
    const targetProjectDir = getTargetProjectDir();
    const packageJsonPath = path.join(targetProjectDir, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      console.warn('⚠️ package.json not found, skipping script addition');
      return;
    }

    // Read existing package.json
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    // Initialize scripts object if it doesn't exist
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    // Check if prettier-staged script already exists
    if (packageJson.scripts['prettier-staged']) {
      console.log('✅ prettier-staged script already exists in package.json');
      return;
    }

    // Add the prettier-staged script
    packageJson.scripts['prettier-staged'] = 'prettier-staged';

    // Write updated package.json with proper formatting
    const updatedContent = JSON.stringify(packageJson, null, 2) + '\n';
    fs.writeFileSync(packageJsonPath, updatedContent, 'utf8');

    console.log('✅ Added "prettier-staged" script to package.json');
    console.log('💡 You can now run: npm run prettier-staged');
  } catch (error) {
    // Don't fail installation if script addition fails
    console.warn('⚠️ Failed to add script to package.json:', error.message);
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

  // Only copy to target project if this is an external installation
  if (isExternalInstallation()) {
    const targetProjectDir = getTargetProjectDir();
    if (fs.existsSync(path.join(targetProjectDir, 'package.json'))) {
      console.log(`🚀 Configuring prettier-staged in: ${targetProjectDir}`);
      console.log('📦 Installing as dependency, copying files...');
      copyPreCommitHook();
      copyEnvExample();
      addScriptToPackageJson();
    } else {
      console.warn(`⚠️ No package.json found in ${targetProjectDir}. Aborting to prevent damage.`);
    }
  } else {
    console.log('🏠 Running in development mode, skipping file copies');
  }
  // Always setup hooks
  setupLibraryGitHooks();

  console.log('✨ Setup complete!');
}

// Export for testing
module.exports = {
  isExternalInstallation,
  getTargetProjectDir,
  copyPreCommitHook,
  copyEnvExample,
  ensureEnvVariables,
  addScriptToPackageJson,
  setupLibraryGitHooks,
  installHooks,
  getHooksDirFromEnv,
  HOOKS_DIR
};

// Run if called directly
if (require.main === module) {
  installHooks();
}
