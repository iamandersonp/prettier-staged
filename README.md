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

By default preetier-stagged will check stagged files, so it's recommended to set up the pre-commit git hook

This is an example of a posible implementation. In this example we skip the execution of command if there is a merge in progress

```bash
#!/bin/sh
#

if git ls-files -u | grep -q .; then
echo "⚠️  Merge in progress with conflicts. Skipping Prettier to avoid issues."
  exit 0
fi

prettier-staged

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
