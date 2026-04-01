const { execSync } = require('node:child_process');

// Mock completo del módulo child_process
jest.mock('node:child_process', () => ({
  execSync: jest.fn()
}));

const { runPrettierStaged } = require('../src/index.js');

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
});
