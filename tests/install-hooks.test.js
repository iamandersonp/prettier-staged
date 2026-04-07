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
  });

  describe('getTargetProjectDir', () => {
    it('should return INIT_CWD when set', () => {
      const targetDir = '/target/project';
      process.env.INIT_CWD = targetDir;
      expect(getTargetProjectDir()).toBe(targetDir);
    });

    it('should return current working directory when INIT_CWD is not set', () => {
      expect(getTargetProjectDir()).toBe(process.cwd());
    });
  });

  describe('copyPreCommitHook', () => {
    const targetDir = '/target/project';
    const targetHooksDir = path.join(targetDir, HOOKS_DIR);
    const targetPreCommit = path.join(targetHooksDir, 'pre-commit');

    beforeEach(() => {
      process.env.INIT_CWD = targetDir;
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

    beforeEach(() => {
      process.env.INIT_CWD = targetDir;
    });

    it('should skip copy if .env.example already exists', () => {
      fs.existsSync.mockReturnValue(true);

      copyEnvExample();

      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ .env.example already exists, skipping copy');
    });

    it('should warn if source .env.example does not exist', () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetEnvExample) return false;
        if (filePath.includes('.env.example')) return false;
        return true;
      });

      copyEnvExample();

      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('⚠️ Source .env.example not found, skipping copy');
    });

    it('should copy .env.example when conditions are met', () => {
      // Mock file existence checks
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetEnvExample) return false; // Target doesn't exist
        if (filePath.includes('.env.example')) return true; // Source exists
        return false;
      });

      copyEnvExample();

      expect(fs.copyFileSync).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ Copied .env.example to project root');
      expect(consoleSpy).toHaveBeenCalledWith(
        '💡 Configure your environment by copying .env.example to .env'
      );
    });

    it('should handle copy errors gracefully', () => {
      fs.existsSync.mockImplementation((filePath) => {
        if (filePath === targetEnvExample) return false;
        if (filePath.includes('.env.example')) return true;
        return false;
      });
      fs.copyFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      copyEnvExample();

      expect(warnSpy).toHaveBeenCalledWith('⚠️ Failed to copy .env.example:', 'Permission denied');
    });
  });

  describe('setupLibraryGitHooks', () => {
    it('should configure git hooks successfully', () => {
      execSync.mockImplementation(() => {});

      setupLibraryGitHooks();

      expect(execSync).toHaveBeenCalledWith(`git config core.hooksPath ${HOOKS_DIR}`, {
        stdio: 'ignore'
      });
      expect(execSync).toHaveBeenCalledWith(`chmod +x ./${HOOKS_DIR}/*`, { stdio: 'ignore' });
      expect(consoleSpy).toHaveBeenCalledWith(`✅ Configured git to use ${HOOKS_DIR} directory`);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Made git hooks executable');
    });

    it('should handle git configuration errors gracefully', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('git config')) {
          throw new Error('Not a git repository');
        }
      });

      setupLibraryGitHooks();

      expect(warnSpy).toHaveBeenCalledWith(
        '⚠️ Could not setup library git hooks:',
        'Not a git repository'
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
        if (filePath.includes('.git-hooks/pre-commit-sample')) return true; // Source hook exists
        if (filePath.includes('.env.example')) return true; // Source .env.example exists
        return false; // Targets don't exist
      });

      installHooks();

      expect(consoleSpy).toHaveBeenCalledWith('🔧 Setting up prettier-staged hooks...');
      expect(consoleSpy).toHaveBeenCalledWith('📦 Installing as dependency, copying files...');
      expect(consoleSpy).toHaveBeenCalledWith('✨ Setup complete!');
    });
  });
});
