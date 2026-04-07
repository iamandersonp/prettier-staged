# @iamandersonp/prettier-staged

An utitlty to auto format stagged files using prettier

## Installation

To use as a dev dependency

```bash
npm i -D @iamandersonp/prettier-staged
```

To use as a global

```bash
npm i -g @iamandersonp/prettier-staged
```

## Setup

Create a command on your package.json

```json
"prettier-staged": "prettier-staged",
```

## Automatic Hook Installation

When installed as a dependency (not during local development), prettier-staged automatically copies a pre-commit hook to your project's hooks directory. This provides a ready-to-use solution for formatting staged files.

### Configuration

You can configure the hooks directory using an optional `.env` file in your project root:

```bash
# .env (optional)
HOOKS_DIR=.git-hooks    # Default value
# or customize:
HOOKS_DIR=custom-hooks
HOOKS_DIR="my hooks"     # With spaces (quotes optional)
```

If no `.env` file exists, the default directory `.git-hooks` will be used.

#### Setting up your .env file

1. Copy the example configuration:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` to customize your hooks directory (optional):

   ```bash
   HOOKS_DIR=.git-hooks  # Use default
   # or
   HOOKS_DIR=git-hooks   # Custom directory
   ```

### What gets installed

- A `{HOOKS_DIR}/pre-commit` file that:
  - Skips formatting during merge conflicts
  - Formats staged files with Prettier
  - Re-stages formatted files automatically

### How to use the copied hook

After installation, run this command in your project root to use the copied hook:

```bash
# Using default .git-hooks directory
git config core.hooksPath .git-hooks
```

```bash
# Or if you customized HOOKS_DIR in .env:
git config core.hooksPath your-custom-directory
```

**Pro tip**: The installation script automatically configures Git for you, so this step is usually not needed!

### Hook behavior

- ✅ **Safe**: Only copies if `{HOOKS_DIR}/pre-commit` doesn't exist (won't overwrite)
- ✅ **Smart**: Only installs when added as a dependency, not during development
- ✅ **Executable**: Automatically sets proper permissions (`chmod +x`)
- ✅ **Configurable**: Hooks directory can be customized via `.env` file
- ✅ **Auto-configured**: Git hooks path is set automatically during installation

### Supported formats in .env

```bash
# All these formats are valid:
HOOKS_DIR=.git-hooks          # Basic format
HOOKS_DIR=".git-hooks"        # With double quotes
HOOKS_DIR='.git-hooks'        # With single quotes
HOOKS_DIR=custom-hooks-dir    # Custom directory name
HOOKS_DIR="hooks with spaces" # Directories with spaces
```

**Note**: If the `.env` file doesn't exist or has errors, the default `.git-hooks` directory is used automatically.

### Custom implementation

If you prefer a custom implementation, you can create your own pre-commit hook using this example (adjust the hooks directory as needed):

```bash
#!/bin/sh
# Replace .git-hooks with your HOOKS_DIR if customized

if git ls-files -u | grep -q .; then
echo "⚠️  Merge in progress. Skipping Prettier to avoid issues."
  exit 0
fi

npm run prettier-staged

STAGED_FILES=$(git diff --name-only --cached --diff-filter=ACM | grep -E '\.(html|ts|scss|css|json)$')

if [ -n "$STAGED_FILES" ]; then
  echo "$STAGED_FILES" | xargs git add
fi
```

### Quick start example

1. **Install the package**:

   ```bash
   npm install -D @iamandersonp/prettier-staged
   ```

2. **Optional: Configure hooks directory**:

   ```bash
   echo "HOOKS_DIR=.git-hooks" > .env
   ```

3. **The hook is automatically set up!** No additional configuration needed.

4. **Optional: Verify the setup**:

   ```bash
   git config core.hooksPath  # Should show your hooks directory
   ls -la .git-hooks/         # Should show the pre-commit hook
   ```

## Testing

This project includes comprehensive unit tests with Jest. The tests cover all the main functionality and edge cases.

### Available test commands

```bash
# Run all tests
npm test

# Run tests in watch mode (automatically re-run on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test coverage

Current test coverage: **>95%** including:

- ✅ Successful file formatting scenarios
- ✅ No files to format scenarios
- ✅ Error handling (Prettier not found, syntax errors, general errors)
- ✅ Edge cases (files with spaces, whitespace trimming, all supported extensions)

The tests use mocks to simulate Git commands and Prettier execution without running actual commands, making tests fast and reliable.
