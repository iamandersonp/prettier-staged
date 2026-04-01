#!/usr/bin/env node

const { execSync } = require('node:child_process');

const extensions = /\.(html|ts|scss|css|json)$/;

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

module.exports = { runPrettierStaged };
