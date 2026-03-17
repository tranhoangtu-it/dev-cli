#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initCommand } from './commands/init.js';
import { buildCommand } from './commands/build.js';
import { deployCommand } from './commands/deploy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

program
  .name('dev')
  .description('Developer productivity CLI tool')
  .version(pkg.version);

program
  .command('init [name]')
  .description('Initialize a new project')
  .option('-t, --template <template>', 'Project template (node|react)', 'node')
  .option('--no-git', 'Skip git initialization')
  .option('--no-install', 'Skip dependency installation')
  .action(initCommand);

program
  .command('build')
  .description('Build the current project')
  .option('-e, --env <environment>', 'Build environment (development|staging|production)', 'development')
  .option('--minify', 'Minify output')
  .option('--sourcemap', 'Generate source maps')
  .action(buildCommand);

program
  .command('deploy')
  .description('Deploy the current project')
  .option('-e, --env <environment>', 'Deployment target environment', 'production')
  .option('--dry-run', 'Simulate deployment without making changes')
  .option('--force', 'Force deployment even if checks fail')
  .action(deployCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
