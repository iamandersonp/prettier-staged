const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// Mock del módulo fs y child_process
jest.mock('node:fs');
jest.mock('node:child_process');

const {
  isExternalInstallation,
  getTargetProjectDir,
  copyPreCommitHook,
  copyEnvExample,
  ensureEnvVariables,
  addScriptToPackageJson,
  isGitRepository,
  setupLibraryGitHooks,
  installHooks,
  getHooksDirFromEnv,
  HOOKS_DIR
} = require('../src/install-hooks.js');

describe('install-hooks', () => {
  let consoleSpy, warnSpy;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup fs mocks explicitly
    fs.existsSync = jest.fn();
    fs.mkdirSync = jest.fn();
    fs.copyFileSync = jest.fn();
    fs.chmodSync = jest.fn();
    fs.readFileSync = jest.fn();
    fs.writeFileSync = jest.fn();
    fs.renameSync = jest.fn();

    // Setup child_process mocks explicitly
    execSync.mockReset();

    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.INIT_CWD;

    // Setup console spies
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    // Restore environment and spies
    process.env = originalEnv;
    consoleSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('getHooksDirFromEnv', () => {
    beforeEach(() => {
      // Reset process.cwd for these tests
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
    });

    afterEach(() => {
      process.cwd.mockRestore();
    });

    it('should return default value when .env file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = getHooksDirFromEnv();

      expect(result).toBe('.git-hooks');
      expect(fs.existsSync).toHaveBeenCalledWith('/test/project/.env');
    });

    it('should return value from .env file when HOOKS_DIR is set', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('NODE_ENV=test\nHOOKS_DIR=custom-hooks\nOTHER=value');

      const result = getHooksDirFromEnv();

      expect(result).toBe('custom-hooks');
      expect(fs.readFileSync).toHaveBeenCalledWith('/test/project/.env', 'utf8');
    });

    it('should return default value when .env exists but HOOKS_DIR is not set', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('NODE_ENV=test\nOTHER=value');

      const result = getHooksDirFromEnv();

      expect(result).toBe('.git-hooks');
    });

    it('should remove quotes from HOOKS_DIR value', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('HOOKS_DIR="quoted-hooks"');

      const result = getHooksDirFromEnv();

      expect(result).toBe('quoted-hooks');
    });

    it('should remove single quotes from HOOKS_DIR value', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue("HOOKS_DIR='single-quoted'");

      const result = getHooksDirFromEnv();

      expect(result).toBe('single-quoted');
    });

    it('should handle file read errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = getHooksDirFromEnv();

      expect(result).toBe('.git-hooks');
    });

    it('should return default value when HOOKS_DIR is empty', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('HOOKS_DIR=\nOTHER=value');

      const result = getHooksDirFromEnv();

      expect(result).toBe('.git-hooks');
    });
  });

  describe('isExternalInstallation', () => {
    let originalCwd;

    beforeEach(() => {
      originalCwd = process.cwd;
    });

    afterEach(() => {
      if (process.cwd !== originalCwd) {
        process.cwd = originalCwd;
      }
    });

    it('should return false when INIT_CWD is not set', () => {
      expect(isExternalInstallation()).toBe(false);
    });

    it('should return false when INIT_CWD equals current working directory', () => {
      process.env.INIT_CWD = process.cwd();
      expect(isExternalInstallation()).toBe(false);
    });

    it('should return true when INIT_CWD differs from current working directory', () => {
      process.env.INIT_CWD = '/different/path';
      expect(isExternalInstallation()).toBe(true);
    });

    it('should return true when current working directory includes node_modules', () => {
      // Mock process.cwd to simulate being inside node_modules
      process.cwd = jest
        .fn()
        .mockReturnValue('/some/project/node_modules/@iamandersonp/prettier-staged');

      // Set INIT_CWD to same path to simulate npm rebuild/link scenario
      process.env.INIT_CWD = '/some/project/node_modules/@iamandersonp/prettier-staged';

      const result = isExternalInstallation();

      expect(result).toBe(true);
    });
  });

  describe('getTargetProjectDir', () => {
    let originalCwd;

    beforeEach(() => {
      originalCwd = process.cwd;
    });

    afterEach(() => {
      if (process.cwd !== originalCwd) {
        process.cwd = originalCwd;
      }
    });

    it('should return INIT_CWD when set and not in node_modules', () => {
      const targetDir = '/target/project';
      process.env.INIT_CWD = targetDir;
      expect(getTargetProjectDir()).toBe(targetDir);
    });

    it('should return current working directory when INIT_CWD is not set and not in node_modules', () => {
      const currentDir = process.cwd();
      delete process.env.INIT_CWD;
      expect(getTargetProjectDir()).toBe(currentDir);
    });

    it('should return resolved path when current working directory includes node_modules', () => {
      // Mock process.cwd to simulate being inside node_modules
      const mockNodeModulesPath = '/some/project/node_modules/@iamandersonp/prettier-staged';
      const expectedProjectRoot = '/some/project';

      process.cwd = jest.fn().mockReturnValue(mockNodeModulesPath);

      // Clear INIT_CWD to test the node_modules path resolution
      delete process.env.INIT_CWD;

      const result = getTargetProjectDir();

      expect(result).toBe(expectedProjectRoot);
    });

    it('should fallback to current working directory when in node_modules but INIT_CWD is empty string', () => {
      // Mock process.cwd to simulate being inside node_modules
      const mockNodeModulesPath = '/some/project/node_modules/@iamandersonp/prettier-staged';

      process.cwd = jest.fn().mockReturnValue(mockNodeModulesPath);

      // Set INIT_CWD to empty string
      process.env.INIT_CWD = '';

      const result = getTargetProjectDir();

      // Should return the resolved path from node_modules (going up 3 levels)
      expect(result).toBe('/some/project');
    });
  });

  describe('copyPreCommitHook', () => {
    const targetDir = '/target/project';
    const targetHooksDir = path.join(targetDir, HOOKS_DIR);
    const targetPreCommit = path.join(targetHooksDir, 'pre-commit');
    let originalCwd;

    beforeEach(() => {
      originalCwd = process.cwd;
      if (process.cwd !== originalCwd) {
        process.cwd = originalCwd;
      }
      process.env.INIT_CWD = targetDir;
    });

    afterEach(() => {
      if (process.cwd !== originalCwd) {
        process.cwd = originalCwd;
      }
    });

    it('should skip copy if pre-commit already exists', () => {
      fs.existsSync.mockReturnValue(true);

      copyPreCommitHook();

      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        `✅ ${HOOKS_DIR}/pre-commit already exists, skipping copy`
      );
    });

    it('should warn if source pre-commit does not exist', () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetPreCommit) return false;
        if (filePath.includes('.git-hooks/pre-commit-sample')) return false;
        return true;
      });

      copyPreCommitHook();

      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('⚠️ Source pre-commit hook not found, skipping copy');
    });

    it('should create directory and copy file when conditions are met', () => {
      // Mock file existence checks
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetPreCommit) return false; // Target doesn't exist
        if (filePath === targetHooksDir) return false; // Directory doesn't exist
        if (filePath.includes('.git-hooks/pre-commit-sample')) return true; // Source exists
        return false;
      });

      copyPreCommitHook();

      expect(fs.mkdirSync).toHaveBeenCalledWith(targetHooksDir, { recursive: true });
      expect(fs.copyFileSync).toHaveBeenCalled();
      expect(fs.chmodSync).toHaveBeenCalledWith(targetPreCommit, 0o755);
      expect(consoleSpy).toHaveBeenCalledWith(`📁 Created ${HOOKS_DIR} directory`);
      expect(consoleSpy).toHaveBeenCalledWith(
        `✅ Copied pre-commit hook to ${HOOKS_DIR}/pre-commit`
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `💡 To use it, run: git config core.hooksPath ${HOOKS_DIR}`
      );
    });

    it('should handle copy errors gracefully', () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetPreCommit) return false;
        if (filePath.includes('.git-hooks/pre-commit-sample')) return true;
        return false;
      });
      fs.copyFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      copyPreCommitHook();

      expect(warnSpy).toHaveBeenCalledWith(
        '⚠️ Failed to copy pre-commit hook:',
        'Permission denied'
      );
    });
  });

  describe('copyEnvExample', () => {
    const targetDir = '/target/project';
    const targetEnvExample = path.join(targetDir, '.env.example');
    const targetEnv = path.join(targetDir, '.env');
    let originalCwd;

    beforeEach(() => {
      originalCwd = process.cwd;
      if (process.cwd !== originalCwd) {
        process.cwd = originalCwd;
      }
      process.env.INIT_CWD = targetDir;
    });

    afterEach(() => {
      if (process.cwd !== originalCwd) {
        process.cwd = originalCwd;
      }
    });

    it('should skip copy if .env.example already exists and .env exists (keep both)', () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetEnvExample) return true; // .env.example exists
        if (filePath === targetEnv) return true; // .env also exists
        return false;
      });

      // Mock .env file content with existing variables
      fs.readFileSync.mockReturnValue('HOOKS_DIR=.git-hooks\nEXTENSIONS=html,js,ts\n');

      copyEnvExample();

      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(fs.renameSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ .env.example already exists, skipping copy');
      expect(consoleSpy).toHaveBeenCalledWith('💡 .env already exists, keeping both files');
    });

    it('should rename .env.example to .env when .env.example exists but .env does not', () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetEnvExample) return true; // .env.example exists
        if (filePath === targetEnv) return false; // .env does not exist
        return false;
      });

      copyEnvExample();

      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(fs.renameSync).toHaveBeenCalledWith(targetEnvExample, targetEnv);
      expect(consoleSpy).toHaveBeenCalledWith('✅ .env.example already exists, skipping copy');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Renamed .env.example to .env');
      expect(consoleSpy).toHaveBeenCalledWith('💡 Environment configuration is ready to use');
    });

    it('should warn if source .env.example does not exist', () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetEnvExample) return false;
        if (filePath === targetEnv) return false;
        if (filePath.includes('.env.example')) return false; // Source doesn't exist
        return true; // Default case for other paths
      });

      copyEnvExample();

      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(fs.renameSync).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('⚠️ Source .env.example not found, skipping copy');
    });

    it('should copy .env.example and rename to .env when .env does not exist', () => {
      // Mock file existence checks
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetEnvExample) return false; // Target doesn't exist initially
        if (filePath === targetEnv) return false; // .env doesn't exist
        if (filePath.includes('.env.example')) return true; // Source exists
        return false;
      });

      copyEnvExample();

      expect(fs.copyFileSync).toHaveBeenCalled();
      expect(fs.renameSync).toHaveBeenCalledWith(targetEnvExample, targetEnv);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Copied .env.example to project root');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Renamed .env.example to .env');
      expect(consoleSpy).toHaveBeenCalledWith('💡 Environment configuration is ready to use');
    });

    it('should copy .env.example but keep it as backup when .env already exists', () => {
      // Mock file existence checks
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetEnvExample) return false; // Target doesn't exist initially
        if (filePath === targetEnv) return true; // .env already exists
        if (filePath.includes('.env.example')) return true; // Source exists
        return false;
      });

      // Mock .env file content with missing variables
      fs.readFileSync.mockReturnValue('NODE_ENV=development\n');

      copyEnvExample();

      expect(fs.copyFileSync).toHaveBeenCalled();
      expect(fs.renameSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ Copied .env.example to project root');
      expect(consoleSpy).toHaveBeenCalledWith(
        '💡 .env already exists, keeping .env.example as backup'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '💡 You can configure your environment by editing the existing .env file'
      );
    });

    it('should handle copy errors gracefully', () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetEnvExample) return false;
        if (filePath === targetEnv) return false;
        if (filePath.includes('.env.example')) return true; // Source exists
        return false;
      });
      fs.copyFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      copyEnvExample();

      expect(fs.renameSync).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('⚠️ Failed to copy .env.example:', 'Permission denied');
    });

    it('should handle rename errors gracefully', () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetEnvExample) return false;
        if (filePath === targetEnv) return false;
        if (filePath.includes('.env.example')) return true; // Source exists
        return false;
      });
      fs.renameSync.mockImplementation(() => {
        throw new Error('Permission denied for rename');
      });

      copyEnvExample();

      expect(fs.copyFileSync).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        '⚠️ Failed to copy .env.example:',
        'Permission denied for rename'
      );
    });
  });

  describe('ensureEnvVariables', () => {
    const envPath = '/test/project/.env';

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
    });

    it('should skip if .env file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      ensureEnvVariables(envPath);

      expect(fs.readFileSync).not.toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should not modify .env if all required variables exist', () => {
      const envContent = 'NODE_ENV=development\nHOOKS_DIR=.git-hooks\nEXTENSIONS=html,js,ts\n';
      fs.readFileSync.mockReturnValue(envContent);

      ensureEnvVariables(envPath);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should add missing HOOKS_DIR variable', () => {
      const envContent = 'NODE_ENV=development\nEXTENSIONS=html,js,ts\n';
      fs.readFileSync.mockReturnValue(envContent);

      ensureEnvVariables(envPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        envPath,
        'NODE_ENV=development\nEXTENSIONS=html,js,ts\n\n# Configuración del directorio de hooks de Git\nHOOKS_DIR=.git-hooks\n',
        'utf8'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ Added missing environment variables to .env: HOOKS_DIR'
      );
    });

    it('should add missing EXTENSIONS variable', () => {
      const envContent = 'NODE_ENV=development\nHOOKS_DIR=.git-hooks\n';
      fs.readFileSync.mockReturnValue(envContent);

      ensureEnvVariables(envPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        envPath,
        'NODE_ENV=development\nHOOKS_DIR=.git-hooks\n\n# Configuración de extensiones de archivos para formateo con Prettier\nEXTENSIONS=html,js,ts,scss,css,json\n',
        'utf8'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ Added missing environment variables to .env: EXTENSIONS'
      );
    });

    it('should add both missing variables', () => {
      const envContent = 'NODE_ENV=development\nOTHER_VAR=value\n';
      fs.readFileSync.mockReturnValue(envContent);

      ensureEnvVariables(envPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        envPath,
        'NODE_ENV=development\nOTHER_VAR=value\n\n# Configuración del directorio de hooks de Git\nHOOKS_DIR=.git-hooks\n\n# Configuración de extensiones de archivos para formateo con Prettier\nEXTENSIONS=html,js,ts,scss,css,json\n',
        'utf8'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ Added missing environment variables to .env: HOOKS_DIR, EXTENSIONS'
      );
    });

    it('should handle empty .env file', () => {
      const envContent = '';
      fs.readFileSync.mockReturnValue(envContent);

      ensureEnvVariables(envPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        envPath,
        '\n\n# Configuración del directorio de hooks de Git\nHOOKS_DIR=.git-hooks\n\n# Configuración de extensiones de archivos para formateo con Prettier\nEXTENSIONS=html,js,ts,scss,css,json\n',
        'utf8'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ Added missing environment variables to .env: HOOKS_DIR, EXTENSIONS'
      );
    });

    it('should handle .env file with only whitespace', () => {
      const envContent = '   \n\n   \n';
      fs.readFileSync.mockReturnValue(envContent);

      ensureEnvVariables(envPath);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        envPath,
        '\n\n# Configuración del directorio de hooks de Git\nHOOKS_DIR=.git-hooks\n\n# Configuración de extensiones de archivos para formateo con Prettier\nEXTENSIONS=html,js,ts,scss,css,json\n',
        'utf8'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ Added missing environment variables to .env: HOOKS_DIR, EXTENSIONS'
      );
    });

    it('should recognize variables with different spacing', () => {
      const envContent = '  HOOKS_DIR  =  .git-hooks  \n   EXTENSIONS=html,js  \n';
      fs.readFileSync.mockReturnValue(envContent);

      ensureEnvVariables(envPath);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should recognize variables with comments and whitespace', () => {
      const envContent = '# Comment\nHOOKS_DIR=.git-hooks\n# Another comment\nEXTENSIONS=js,ts\n';
      fs.readFileSync.mockReturnValue(envContent);

      ensureEnvVariables(envPath);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should handle file read errors gracefully', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      ensureEnvVariables(envPath);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        '⚠️ Failed to ensure .env variables:',
        'Permission denied'
      );
    });

    it('should handle file write errors gracefully', () => {
      const envContent = 'NODE_ENV=development\n';
      fs.readFileSync.mockReturnValue(envContent);
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      ensureEnvVariables(envPath);

      expect(warnSpy).toHaveBeenCalledWith('⚠️ Failed to ensure .env variables:', 'Disk full');
    });
  });

  describe('addScriptToPackageJson', () => {
    const targetDir = '/target/project';
    const packageJsonPath = path.join(targetDir, 'package.json');
    let originalCwd;

    beforeEach(() => {
      originalCwd = process.cwd;
      if (process.cwd !== originalCwd) {
        process.cwd = originalCwd;
      }
      process.env.INIT_CWD = targetDir;
    });

    afterEach(() => {
      if (process.cwd !== originalCwd) {
        process.cwd = originalCwd;
      }
    });

    it('should skip if package.json does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      addScriptToPackageJson();

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('⚠️ package.json not found, skipping script addition');
    });

    it('should skip if prettier-staged script already exists', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          name: 'test-project',
          scripts: {
            'prettier-staged': 'prettier-staged'
          }
        })
      );

      addScriptToPackageJson();

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ prettier-staged script already exists in package.json'
      );
    });

    it('should add prettier-staged script to existing scripts', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          name: 'test-project',
          scripts: {
            test: 'jest',
            build: 'webpack'
          }
        })
      );

      addScriptToPackageJson();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        packageJsonPath,
        JSON.stringify(
          {
            name: 'test-project',
            scripts: {
              test: 'jest',
              build: 'webpack',
              'prettier-staged': 'prettier-staged'
            }
          },
          null,
          2
        ) + '\n',
        'utf8'
      );
      expect(consoleSpy).toHaveBeenCalledWith('✅ Added "prettier-staged" script to package.json');
      expect(consoleSpy).toHaveBeenCalledWith('💡 You can now run: npm run prettier-staged');
    });

    it('should create scripts object if it does not exist', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0'
        })
      );

      addScriptToPackageJson();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        packageJsonPath,
        JSON.stringify(
          {
            name: 'test-project',
            version: '1.0.0',
            scripts: {
              'prettier-staged': 'prettier-staged'
            }
          },
          null,
          2
        ) + '\n',
        'utf8'
      );
      expect(consoleSpy).toHaveBeenCalledWith('✅ Added "prettier-staged" script to package.json');
    });

    it('should handle JSON parse errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');

      addScriptToPackageJson();

      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        '⚠️ Failed to add script to package.json:',
        expect.any(String)
      );
    });

    it('should handle file write errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        JSON.stringify({
          name: 'test-project',
          scripts: {}
        })
      );
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      addScriptToPackageJson();

      expect(warnSpy).toHaveBeenCalledWith(
        '⚠️ Failed to add script to package.json:',
        'Permission denied'
      );
    });
  });

  describe('isGitRepository', () => {
    it('should return true when in a git repository', () => {
      execSync.mockImplementation(() => {
        // Simula comando exitoso
      });

      const result = isGitRepository();

      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('git rev-parse --git-dir', { stdio: 'ignore' });
    });

    it('should return false when not in a git repository', () => {
      execSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const result = isGitRepository();

      expect(result).toBe(false);
    });

    it('should return false when git command fails for any reason', () => {
      execSync.mockImplementation(() => {
        throw new Error('Git not found');
      });

      const result = isGitRepository();

      expect(result).toBe(false);
    });
  });

  describe('setupLibraryGitHooks', () => {
    it('should skip setup when not in a git repository', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') {
          throw new Error('Not a git repository');
        }
      });

      setupLibraryGitHooks();

      expect(consoleSpy).toHaveBeenCalledWith(
        'ℹ️ Not in a git repository, skipping git hooks configuration'
      );
      // Should not call any git config commands
      expect(execSync).toHaveBeenCalledTimes(1); // Only the git rev-parse check
    });

    it('should configure git hooks successfully when in git repository', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') {
          // Simula que estamos en un repo git
          return;
        }
        // Simula otros comandos git exitosos
      });

      setupLibraryGitHooks();

      expect(execSync).toHaveBeenCalledWith('git rev-parse --git-dir', { stdio: 'ignore' });
      expect(execSync).toHaveBeenCalledWith(`git config core.hooksPath ${HOOKS_DIR}`, {
        stdio: 'ignore'
      });
      expect(execSync).toHaveBeenCalledWith(`chmod +x ./${HOOKS_DIR}/*`, { stdio: 'ignore' });
      expect(consoleSpy).toHaveBeenCalledWith(`✅ Configured git to use ${HOOKS_DIR} directory`);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Made git hooks executable');
    });

    it('should handle git configuration errors gracefully when in git repository', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd === 'git rev-parse --git-dir') {
          // Simula que estamos en un repo git
          return;
        }
        if (cmd.includes('git config')) {
          throw new Error('Permission denied');
        }
      });

      setupLibraryGitHooks();

      expect(warnSpy).toHaveBeenCalledWith(
        '⚠️ Could not setup library git hooks:',
        'Permission denied'
      );
    });
  });

  describe('installHooks', () => {
    it('should setup library hooks and skip copy in development mode', () => {
      process.env.INIT_CWD = process.cwd(); // Same as current directory

      // Mock successful library setup
      execSync.mockImplementation(() => {});

      installHooks();

      expect(consoleSpy).toHaveBeenCalledWith('🔧 Setting up prettier-staged hooks...');
      expect(consoleSpy).toHaveBeenCalledWith(
        '🏠 Running in development mode, skipping file copies'
      );
      expect(consoleSpy).toHaveBeenCalledWith('✨ Setup complete!');
    });

    it('should setup library hooks and copy to target project in external installation', () => {
      process.env.INIT_CWD = '/different/project';

      // Mock successful operations
      execSync.mockImplementation(() => {});
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === '/different/project/package.json') return true; // Exact match for target package.json
        if (filePath.includes('.git-hooks/pre-commit-sample')) return true; // Source hook exists
        if (filePath.includes('.env.example')) return true; // Source .env.example exists
        if (filePath === '/different/project/.env') return false; // .env doesn't exist (will be renamed)
        return false; // Other targets don't exist
      });
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath === '/different/project/package.json') {
          return JSON.stringify({
            name: 'target-project',
            scripts: { test: 'jest' }
          });
        }
        return '';
      });

      installHooks();

      expect(consoleSpy).toHaveBeenCalledWith('🔧 Setting up prettier-staged hooks...');
      expect(consoleSpy).toHaveBeenCalledWith(
        '🚀 Configuring prettier-staged in: /different/project'
      );
      expect(consoleSpy).toHaveBeenCalledWith('📦 Installing as dependency, copying files...');
      expect(consoleSpy).toHaveBeenCalledWith('✨ Setup complete!');
    });
    it('should warn when external installation target has no package.json', () => {
      process.env.INIT_CWD = '/different/project';

      // Mock successful operations but no package.json in target
      execSync.mockImplementation(() => {});
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === '/different/project/package.json') return false; // No package.json in target
        if (filePath.includes('.git-hooks/pre-commit-sample')) return true; // Source hook exists
        if (filePath.includes('.env.example')) return true; // Source .env.example exists
        if (filePath === '/different/project/.env') return false; // .env doesn't exist
        return false;
      });

      installHooks();

      expect(consoleSpy).toHaveBeenCalledWith('🔧 Setting up prettier-staged hooks...');
      expect(warnSpy).toHaveBeenCalledWith(
        '⚠️ No package.json found in /different/project. Aborting to prevent damage.'
      );
      expect(consoleSpy).toHaveBeenCalledWith('✨ Setup complete!');

      // Should not copy files
      expect(consoleSpy).not.toHaveBeenCalledWith('📦 Installing as dependency, copying files...');
    });
  });

  describe('Direct execution scenarios', () => {
    let originalRequireMain;

    beforeEach(() => {
      // Save original require.main
      originalRequireMain = require.main;
    });

    afterEach(() => {
      // Restore original require.main
      require.main = originalRequireMain;
    });

    it('should execute installHooks when install-hooks.js is run directly', () => {
      // Mock successful operations
      execSync.mockImplementation(() => {});

      // Mock require.main to simulate direct execution
      require.main = { filename: require.resolve('../src/install-hooks.js') };

      // Clear the require cache and require the module again to trigger direct execution
      const installHooksPath = require.resolve('../src/install-hooks.js');
      delete require.cache[installHooksPath];

      // This should trigger the direct execution path
      const moduleExports = require('../src/install-hooks.js');

      // Verify the module exports are still available
      expect(typeof moduleExports.installHooks).toBe('function');
      expect(typeof moduleExports.isExternalInstallation).toBe('function');
    });
  });
});
