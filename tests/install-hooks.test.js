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
  setupLibraryGitHooks,
  installHooks
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
    const targetHooksDir = path.join(targetDir, 'git-hooks');
    const targetPreCommit = path.join(targetHooksDir, 'pre-commit');

    beforeEach(() => {
      process.env.INIT_CWD = targetDir;
    });

    it('should skip copy if pre-commit already exists', () => {
      fs.existsSync.mockReturnValue(true);

      copyPreCommitHook();

      expect(fs.copyFileSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '✅ git-hooks/pre-commit already exists, skipping copy'
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
      expect(consoleSpy).toHaveBeenCalledWith('📁 Created git-hooks directory');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Copied pre-commit hook to git-hooks/pre-commit');
      expect(consoleSpy).toHaveBeenCalledWith(
        '💡 To use it, run: git config core.hooksPath git-hooks'
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

  describe('setupLibraryGitHooks', () => {
    it('should configure git hooks successfully', () => {
      execSync.mockImplementation(() => {});

      setupLibraryGitHooks();

      expect(execSync).toHaveBeenCalledWith('git config core.hooksPath .git-hooks', {
        stdio: 'ignore'
      });
      expect(execSync).toHaveBeenCalledWith('chmod +x ./.git-hooks/*', { stdio: 'ignore' });
      expect(consoleSpy).toHaveBeenCalledWith('✅ Configured git to use .git-hooks directory');
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
      expect(consoleSpy).toHaveBeenCalledWith('🏠 Running in development mode, skipping hook copy');
      expect(consoleSpy).toHaveBeenCalledWith('✨ Setup complete!');
    });

    it('should setup library hooks and copy to target project in external installation', () => {
      process.env.INIT_CWD = '/different/project';

      // Mock successful operations
      execSync.mockImplementation(() => {});
      fs.existsSync.mockImplementation((filePath) => {
        return !!filePath.includes('.git-hooks/pre-commit-sample'); // Target doesn't exist
      });

      installHooks();

      expect(consoleSpy).toHaveBeenCalledWith('🔧 Setting up prettier-staged hooks...');
      expect(consoleSpy).toHaveBeenCalledWith(
        '📦 Installing as dependency, copying pre-commit hook...'
      );
      expect(consoleSpy).toHaveBeenCalledWith('✨ Setup complete!');
    });
  });
});
