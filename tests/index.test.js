const { execSync } = require('node:child_process');
const fs = require('node:fs');

// Mock de child_process
jest.mock('node:child_process', () => ({
  execSync: jest.fn()
}));

// Mock de node:fs
jest.mock('node:fs');

const {
  runPrettierStaged,
  getExtensionsFromEnv,
  createExtensionsRegex,
  DEFAULT_EXTENSIONS
} = require('../src/index.js');

describe('prettier-staged CLI', () => {
  let consoleSpy, errorSpy, exitSpy;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup console spies
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation();
  });

  afterEach(() => {
    // Restore all spies
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('Successful formatting', () => {
    test('should format staged files with valid extensions', () => {
      // Mock git diff to return files with valid extensions
      execSync
        .mockReturnValueOnce('src/app.ts\nstyles/main.scss\nconfig.json\n')
        .mockReturnValueOnce(undefined) // prettier command
        .mockReturnValueOnce(undefined); // git add command

      // Execute the function
      runPrettierStaged();

      // Verify git diff was called
      expect(execSync).toHaveBeenNthCalledWith(
        1,
        'git diff --name-only --cached --diff-filter=ACM',
        { encoding: 'utf-8' }
      );

      // Verify prettier was called with correct files
      expect(execSync).toHaveBeenNthCalledWith(
        2,
        'npx prettier --write src/app.ts styles/main.scss config.json',
        { stdio: 'inherit' }
      );

      // Verify git add was called with formatted files
      expect(execSync).toHaveBeenNthCalledWith(
        3,
        'git add src/app.ts styles/main.scss config.json'
      );

      // Verify success message
      expect(consoleSpy).toHaveBeenCalledWith('🧼 Formatting staged files with Prettier:');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    test('should handle single file with valid extension', () => {
      execSync
        .mockReturnValueOnce('index.html\n')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      runPrettierStaged();

      expect(execSync).toHaveBeenNthCalledWith(2, 'npx prettier --write index.html', {
        stdio: 'inherit'
      });
      expect(consoleSpy).toHaveBeenCalledWith('🧼 Formatting staged files with Prettier:');
    });
  });

  describe('No files to format', () => {
    test('should show message when no staged files', () => {
      execSync.mockReturnValueOnce('\n'); // Empty git diff output

      runPrettierStaged();

      expect(execSync).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('✅ No staged files matching for formatting.');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    test('should show message when staged files have invalid extensions', () => {
      execSync.mockReturnValueOnce('README.md\nscript.py\nimage.png\n');

      runPrettierStaged();

      expect(execSync).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('✅ No staged files matching for formatting.');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    test('should filter mixed files and format only valid ones', () => {
      execSync
        .mockReturnValueOnce('README.md\nsrc/app.ts\nimage.png\nstyle.css\n')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      runPrettierStaged();

      expect(execSync).toHaveBeenNthCalledWith(2, 'npx prettier --write src/app.ts style.css', {
        stdio: 'inherit'
      });
      expect(consoleSpy).toHaveBeenCalledWith('🧼 Formatting staged files with Prettier:');
    });
  });

  describe('Error handling', () => {
    test('should handle Prettier not found error (status 127)', () => {
      execSync.mockReturnValueOnce('src/app.ts\n');

      const error = new Error('prettier: command not found');
      error.status = 127;
      execSync.mockImplementationOnce(() => {
        throw error;
      });

      runPrettierStaged();

      expect(errorSpy).toHaveBeenCalledWith(
        "❌ Error: Prettier not found. Make sure it's installed:",
        error.message
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('should handle Prettier syntax errors (status 2)', () => {
      execSync.mockReturnValueOnce('src/broken.ts\n');

      const error = new Error('Syntax error in file');
      error.status = 2;
      execSync.mockImplementationOnce(() => {
        throw error;
      });

      runPrettierStaged();

      expect(errorSpy).toHaveBeenCalledWith(
        '❌ Error: Prettier found syntax errors:',
        error.message
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('should handle general Prettier errors', () => {
      execSync.mockReturnValueOnce('src/app.ts\n');

      const error = new Error('General prettier error');
      error.status = 1;
      execSync.mockImplementationOnce(() => {
        throw error;
      });

      runPrettierStaged();

      expect(errorSpy).toHaveBeenCalledWith('❌ Error running Prettier:', error.message);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    test('should handle git command errors', () => {
      const error = new Error('Git command failed');
      error.status = 128;
      execSync.mockImplementationOnce(() => {
        throw error;
      });

      runPrettierStaged();

      expect(errorSpy).toHaveBeenCalledWith('❌ Error running Prettier:', error.message);
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Edge cases', () => {
    test('should handle files with spaces in names', () => {
      execSync
        .mockReturnValueOnce('src/my file.ts\nother file.css\n')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      runPrettierStaged();

      expect(execSync).toHaveBeenNthCalledWith(
        2,
        'npx prettier --write src/my file.ts other file.css',
        { stdio: 'inherit' }
      );
    });

    test('should trim whitespace from file names', () => {
      execSync
        .mockReturnValueOnce('  src/app.ts  \n  style.css  \n\n')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      runPrettierStaged();

      expect(execSync).toHaveBeenNthCalledWith(2, 'npx prettier --write src/app.ts style.css', {
        stdio: 'inherit'
      });
    });

    test('should handle all supported file extensions', () => {
      const validFiles = [
        'template.html',
        'component.ts',
        'styles.scss',
        'reset.css',
        'package.json'
      ];

      execSync
        .mockReturnValueOnce(validFiles.join('\n') + '\n')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      runPrettierStaged();

      expect(execSync).toHaveBeenNthCalledWith(2, `npx prettier --write ${validFiles.join(' ')}`, {
        stdio: 'inherit'
      });
    });
  });

  describe('getExtensionsFromEnv', () => {
    beforeEach(() => {
      // Reset fs mocks
      fs.existsSync = jest.fn();
      fs.readFileSync = jest.fn();
      // Reset process.cwd
      jest.spyOn(process, 'cwd').mockReturnValue('/test/project');
    });

    afterEach(() => {
      process.cwd.mockRestore();
    });

    it('should return default extensions when .env file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = getExtensionsFromEnv();

      expect(result).toEqual(DEFAULT_EXTENSIONS);
      expect(fs.existsSync).toHaveBeenCalledWith('/test/project/.env');
    });

    it('should return extensions from .env file when EXTENSIONS is set', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('NODE_ENV=test\nEXTENSIONS=js,jsx,ts,tsx\nOTHER=value');

      const result = getExtensionsFromEnv();

      expect(result).toEqual(['js', 'jsx', 'ts', 'tsx']);
      expect(fs.readFileSync).toHaveBeenCalledWith('/test/project/.env', 'utf8');
    });

    it('should return default extensions when .env exists but EXTENSIONS is not set', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('NODE_ENV=test\nOTHER=value');

      const result = getExtensionsFromEnv();

      expect(result).toEqual(DEFAULT_EXTENSIONS);
    });

    it('should remove quotes and trim spaces from EXTENSIONS value', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('EXTENSIONS="html, ts , css, json"');

      const result = getExtensionsFromEnv();

      expect(result).toEqual(['html', 'ts', 'css', 'json']);
    });

    it('should remove single quotes from EXTENSIONS value', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue("EXTENSIONS='vue,svelte,astro'");

      const result = getExtensionsFromEnv();

      expect(result).toEqual(['vue', 'svelte', 'astro']);
    });

    it('should handle file read errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = getExtensionsFromEnv();

      expect(result).toEqual(DEFAULT_EXTENSIONS);
    });

    it('should return default extensions when EXTENSIONS is empty', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('EXTENSIONS=\nOTHER=value');

      const result = getExtensionsFromEnv();

      expect(result).toEqual(DEFAULT_EXTENSIONS);
    });

    it('should filter out empty extensions after split', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('EXTENSIONS=js,,ts, ,jsx,');

      const result = getExtensionsFromEnv();

      expect(result).toEqual(['js', 'ts', 'jsx']);
    });
  });

  describe('createExtensionsRegex', () => {
    it('should create regex for single extension', () => {
      const result = createExtensionsRegex(['js']);

      expect(result).toEqual(/\.(js)$/);
      expect(result.test('app.js')).toBe(true);
      expect(result.test('app.ts')).toBe(false);
    });

    it('should create regex for multiple extensions', () => {
      const result = createExtensionsRegex(['js', 'ts', 'jsx']);

      expect(result).toEqual(/\.(js|ts|jsx)$/);
      expect(result.test('app.js')).toBe(true);
      expect(result.test('component.ts')).toBe(true);
      expect(result.test('Component.jsx')).toBe(true);
      expect(result.test('style.css')).toBe(false);
    });

    it('should create regex for default extensions', () => {
      const result = createExtensionsRegex(DEFAULT_EXTENSIONS);

      expect(result).toEqual(/\.(html|ts|scss|css|json|js)$/);
      expect(result.test('index.html')).toBe(true);
      expect(result.test('app.ts')).toBe(true);
      expect(result.test('style.scss')).toBe(true);
      expect(result.test('reset.css')).toBe(true);
      expect(result.test('package.json')).toBe(true);
      expect(result.test('script.js')).toBe(true);
      expect(result.test('readme.md')).toBe(false);
    });
  });
});
