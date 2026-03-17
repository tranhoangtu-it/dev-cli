import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { logger } from '../utils/logger.js';

/**
 * Read and parse package.json from cwd
 * @returns {Object|null} Parsed package.json or null
 */
function readPackageJson(cwd) {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Detect project type from package.json
 */
function detectProjectType(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.vite || deps['@vitejs/plugin-react']) return 'vite';
  if (deps.webpack) return 'webpack';
  if (deps.next) return 'next';
  if (deps.scripts?.build) return 'custom';
  return 'node';
}

/**
 * Build command handler
 */
export async function buildCommand(options) {
  const { env, minify, sourcemap } = options;
  const cwd = process.cwd();

  logger.info(`Building for environment: ${env}`);

  const pkg = readPackageJson(cwd);
  if (!pkg) {
    logger.error('No package.json found. Make sure you are in a project directory.');
    process.exit(1);
  }

  const projectType = detectProjectType(pkg);
  logger.step(`Detected project type: ${projectType}`);

  // Set NODE_ENV based on target environment
  const nodeEnv = env === 'production' ? 'production' : 'development';
  const envVars = { ...process.env, NODE_ENV: nodeEnv };

  try {
    if (pkg.scripts?.build) {
      logger.step('Running npm build script...');
      const args = ['run', 'build'];
      // Pass extra args to the underlying build tool if available
      if (minify || sourcemap) {
        args.push('--');
        if (minify) args.push('--minify');
        if (sourcemap) args.push('--sourcemap');
      }
      execFileSync('npm', args, { cwd, stdio: 'inherit', env: envVars });
    } else if (projectType === 'node') {
      logger.step('Node.js project — no compile step required.');
      logger.step('Validating syntax...');
      // Validate main entry point syntax using node --check
      const main = pkg.main || 'src/index.js';
      if (existsSync(join(cwd, main))) {
        execFileSync('node', ['--check', main], { cwd, stdio: 'inherit' });
        logger.success('Syntax validation passed');
      }
    } else {
      logger.warn('No build script found in package.json. Add a "build" script and try again.');
      process.exit(1);
    }

    logger.success(`Build complete (${env})`);
  } catch (err) {
    logger.error(`Build failed: ${err.message}`);
    process.exit(1);
  }
}
