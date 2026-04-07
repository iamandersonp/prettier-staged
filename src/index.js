#!/usr/bin/env node

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Constante para las extensiones por defecto
const DEFAULT_EXTENSIONS = ['html', 'ts', 'scss', 'css', 'json', 'js'];

/**
 * Lee el archivo .env para obtener EXTENSIONS, retorna el valor por defecto si no existe
 */
function getExtensionsFromEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env');

    if (!fs.existsSync(envPath)) {
      return DEFAULT_EXTENSIONS;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('EXTENSIONS=')) {
        const value = trimmedLine.substring('EXTENSIONS='.length).trim();
        // Remover comillas si existen (simples o dobles)
        let cleanValue = value
          .replace(/^['"]/, '') // Remover comilla de inicio
          .replace(/['"]/, ''); // Remover comilla de final

        if (cleanValue) {
          // Convertir string separado por comas a array
          return cleanValue
            .split(',')
            .map((ext) => ext.trim())
            .filter(Boolean);
        }
      }
    }

    return DEFAULT_EXTENSIONS;
  } catch (error) {
    // Si hay cualquier error leyendo el archivo, usar valor por defecto
    console.warn('Warning: Could not read .env file, using default EXTENSIONS:', error.message);
    return DEFAULT_EXTENSIONS;
  }
}

/**
 * Crear regex para extensiones basado en la configuración
 */
function createExtensionsRegex(extensionsArray) {
  const pattern = String.raw`\.(${extensionsArray.join('|')})$`;
  return new RegExp(pattern);
}

// Constante para las extensiones (lee desde .env o usa valor por defecto)
const extensions = createExtensionsRegex(getExtensionsFromEnv());

function runPrettierStaged() {
  try {
    const output = execSync('git diff --name-only --cached --diff-filter=ACM', {
      encoding: 'utf-8'
    });

    const files = output
      .split('\n')
      .map((file) => file.trim())
      .filter((file) => extensions.test(file));

    if (files.length > 0) {
      console.log('🧼 Formatting staged files with Prettier:');
      execSync('npx prettier --write ' + files.join(' '), { stdio: 'inherit' });

      // Re-staging
      execSync(`git add ${files.join(' ')}`);
    } else {
      console.log('✅ No staged files matching for formatting.');
    }
  } catch (error) {
    if (error.status === 127) {
      console.error("❌ Error: Prettier not found. Make sure it's installed:", error.message);
    } else if (error.status === 2) {
      console.error('❌ Error: Prettier found syntax errors:', error.message);
    } else {
      console.error('❌ Error running Prettier:', error.message);
    }
    process.exit(1);
  }
}

// Only run if this file is executed directly (not required as a module)
if (require.main === module) {
  runPrettierStaged();
}

module.exports = {
  runPrettierStaged,
  getExtensionsFromEnv,
  createExtensionsRegex,
  DEFAULT_EXTENSIONS
};
