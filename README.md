# @iamandersonp/prettier-staged

Configurable utility to auto-format staged files using Prettier with customizable file extensions and hooks directory

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

**No setup required!** 🎉

When you install prettier-staged as a dependency, it automatically adds the `prettier-staged` script to your `package.json`. You can start using it immediately:

```bash
npm run prettier-staged
```

**Manual setup** (only if automatic setup fails):
If for some reason the automatic script addition doesn't work, you can add it manually:

```json
{
  "scripts": {
    "prettier-staged": "prettier-staged"
  }
}
```

## File Extensions Configuration

By default, prettier-staged formats these file types: `html`, `ts`, `scss`, `css`, `json`, `js`

You can customize which file extensions to format by creating a `.env` file in your project root:

```bash
# .env
EXTENSIONS=js,jsx,ts,tsx,css,scss
```

**Examples of custom configurations:**

```bash
# React project
EXTENSIONS=js,jsx,ts,tsx,css,scss

# Vue project
EXTENSIONS=vue,js,ts,css,scss

# TypeScript-only project
EXTENSIONS=ts,tsx

# Full-stack project
EXTENSIONS=html,js,jsx,ts,tsx,vue,css,scss,less,json

# With quotes and spaces (automatically cleaned)
EXTENSIONS="js, jsx, ts, tsx"
EXTENSIONS='vue, css, scss'
```

If no `.env` file exists or `EXTENSIONS` is not specified, the default extensions will be used.

## Automatic Hook Installation

When installed as a dependency (not during local development), prettier-staged automatically copies a pre-commit hook to your project's hooks directory. This provides a ready-to-use solution for formatting staged files.

### Configuration

You can configure the hooks directory and file extensions using an optional `.env` file in your project root:

```bash
# .env (optional)
HOOKS_DIR=.git-hooks                 # Default hooks directory
EXTENSIONS=html,ts,scss,css,json,js  # Default file extensions

# Customize as needed:
HOOKS_DIR=custom-hooks
HOOKS_DIR="my hooks"                 # With spaces (quotes optional)
EXTENSIONS=js,jsx,ts,tsx             # Custom file extensions
EXTENSIONS="vue,svelte,astro"        # Framework-specific files
```

If no `.env` file exists, the default values will be used:

- **HOOKS_DIR**: `.git-hooks`
- **EXTENSIONS**: `html,ts,scss,css,json,js`

#### Setting up your .env file

**Fully automatic** (recommended):
When you install prettier-staged, a `.env` file is automatically created from the template!

🎯 **No manual steps required** - the installation automatically:

- Copies `.env.example` template to your project
- Renames it to `.env` for immediate use
- Preserves existing `.env` files (creates `.env.example` as backup if `.env` already exists)

**Optional customization:**
Edit `.env` to customize your configuration if needed:

```bash
# Hooks directory
HOOKS_DIR=.git-hooks  # Use default
# or
HOOKS_DIR=git-hooks   # Custom directory

# File extensions to format
EXTENSIONS=html,ts,scss,css,json,js  # Use default
# or
EXTENSIONS=js,jsx,ts,tsx             # JavaScript/TypeScript only
EXTENSIONS=vue,svelte,astro          # Framework-specific
```

**Manual setup** (rarely needed):
In the unlikely case that automatic setup fails, you can create your own `.env` file with the configuration above.

### What gets installed

When installed as a dependency, prettier-staged automatically:

- **Pre-commit hook**: Copies a `{HOOKS_DIR}/pre-commit` file that:
  - Skips formatting during merge conflicts
  - Formats staged files with Prettier
  - Re-stages formatted files automatically

- **Configuration file**: Automatically creates a `.env` file with:
  - Default `HOOKS_DIR` and `EXTENSIONS` settings
  - Ready-to-use configuration for immediate use
  - Smart handling: preserves existing `.env`, creates `.env.example` backup if needed
  - No manual copying required!

- **NPM script**: Adds `"prettier-staged": "prettier-staged"` to your `package.json` scripts:
  - Safe operation - won't overwrite existing scripts
  - Creates `scripts` section if it doesn't exist
  - Enables running `npm run prettier-staged` immediately

#### Automatic .env handling

- ✅ **New project**: Creates `.env` from template → Ready to use immediately
- ✅ **Existing .env**: Preserves your `.env` + creates `.env.example` backup
- ✅ **Safe operation**: Never overwrites existing configuration

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

- ✅ **Safe**: Only copies files if they don't exist (won't overwrite)
- ✅ **Smart**: Only installs when added as a dependency, not during development
- ✅ **Complete**: Copies hook, creates configuration file AND adds NPM script
- ✅ **Non-destructive**: Won't overwrite existing package.json scripts or .env files
- ✅ **Executable**: Automatically sets proper permissions (`chmod +x`)
- ✅ **Configurable**: Hooks directory can be customized via `.env` file
- ✅ **Auto-configured**: Git hooks path is set automatically during installation
- ✅ **Zero-setup**: Creates working `.env` configuration automatically

### Supported formats in .env

```bash
# All these formats are valid:

# Hooks directory:
HOOKS_DIR=.git-hooks          # Basic format
HOOKS_DIR=".git-hooks"        # With double quotes
HOOKS_DIR='.git-hooks'        # With single quotes
HOOKS_DIR=custom-hooks-dir    # Custom directory name
HOOKS_DIR="hooks with spaces" # Directories with spaces

# File extensions:
EXTENSIONS=html,ts,scss,css,json,js  # Basic format
EXTENSIONS="js,jsx,ts,tsx"           # With double quotes
EXTENSIONS='vue,svelte,astro'        # With single quotes
EXTENSIONS=js, ts, css, scss         # With spaces (auto-trimmed)
```

**Note**: If the `.env` file doesn't exist or has errors, the default values are used automatically:

- **HOOKS_DIR**: `.git-hooks`
- **EXTENSIONS**: `html,ts,scss,css,json,js`

### Custom implementation

If you prefer a custom implementation, you can create your own pre-commit hook using this example (adjust the hooks directory as needed):

```bash
#!/bin/sh
# Función para leer extensiones desde .env
get_extensions_from_env() {
  local env_file=".env"
  local default_extensions="html|ts|scss|css|json|js"

  if [ ! -f "$env_file" ]; then
    echo "$default_extensions"
    return
  fi

  # Buscar EXTENSIONS en .env
  local extensions=$(grep "^EXTENSIONS=" "$env_file" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")

  if [ -n "$extensions" ]; then
    # Convertir comas a | para el regex
    echo "$extensions" | sed 's/,/|/g' | sed 's/ //g'
  else
    echo "$default_extensions"
  fi
}

if git ls-files -u | grep -q .; then
  echo "⚠️  Merge in progress. Skipping Prettier to avoid issues."
  exit 0
fi

npm run prettier-staged

# Obtener extensiones desde .env y construir patrón dinámico
EXTENSIONS_PATTERN=$(get_extensions_from_env)
STAGED_FILES=$(git diff --name-only --cached --diff-filter=ACM | grep -E "\.($EXTENSIONS_PATTERN)$")

if [ -n "$STAGED_FILES" ]; then
  echo "$STAGED_FILES" | xargs git add
fi
```

### Quick start example

1. **Install the package**:

   ```bash
   npm install -D @iamandersonp/prettier-staged
   ```

2. **Everything is set up automatically!** ✨

   The installation process automatically:
   - 🔗 Adds `"prettier-staged": "prettier-staged"` to your package.json scripts
   - 📁 Creates `.env` configuration file (ready to use!)
   - 🎯 Copies and configures the pre-commit hook
   - ⚡ Zero manual configuration needed!

3. **Optional: Customize your configuration**:

   ```bash
   # Edit the automatically created .env file (optional)
   # Defaults work great for most projects!
   vim .env  # or code .env, nano .env, etc.
   ```

4. **Start using it immediately**:

   ```bash
   # Run prettier-staged manually
   npm run prettier-staged

   # Or just make commits - the pre-commit hook will run automatically!
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Optional: Verify the setup**:

   ```bash
   git config core.hooksPath  # Should show your hooks directory
   ls -la .git-hooks/         # Should show the pre-commit hook
   cat .env                   # See your active configuration
   npm run prettier-staged    # Test the script works
   ```

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
- ✅ Extensions configuration from `.env` file (custom extensions, fallback to defaults, error handling)
- ✅ Hooks directory configuration from `.env` file

The tests use mocks to simulate Git commands and Prettier execution without running actual commands, making tests fast and reliable.

## Changelog

All history of changes are located on [CHANGELOG.md](./CHANGELOG.md).
