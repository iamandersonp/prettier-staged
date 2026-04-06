# preetier-staged

An utitlty to auto format stagged files using prettier

## Installation

To use as a dev dependency

```bash
npm i -D preetier-staged
```

To use as a global

```bash
npm i -g preetier-staged
```

## Setup

Create a command on your package.json

```json
"prettier-staged": "prettier-staged",
```

## Automatic Hook Installation

When installed as a dependency (not during local development), preetier-staged automatically copies a pre-commit hook to your project's `git-hooks/` directory. This provides a ready-to-use solution for formatting staged files.

### What gets installed

- A `git-hooks/pre-commit` file that:
  - Skips formatting during merge conflicts
  - Runs tests (if configured)
  - Formats staged files with Prettier
  - Re-stages formatted files automatically

### How to use the copied hook

After installation, run this command in your project root to use the copied hook:

```bash
git config core.hooksPath git-hooks
```

### Hook behavior

- ✅ **Safe**: Only copies if `git-hooks/pre-commit` doesn't exist (won't overwrite)
- ✅ **Smart**: Only installs when added as a dependency, not during development
- ✅ **Executable**: Automatically sets proper permissions (`chmod +x`)

If you prefer a custom implementation, you can create your own pre-commit hook using this example:

```bash
#!/bin/sh
#

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
