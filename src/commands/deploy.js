import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { logger } from '../utils/logger.js';

/**
 * Read and parse package.json from cwd
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
 * Run pre-deploy checks: ensure git is clean and tests pass
 * @returns {{ passed: boolean, warnings: string[] }}
 */
function runPreDeployChecks(cwd, pkg) {
  const warnings = [];

  // Check for uncommitted changes
  try {
    const output = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf-8' });
    if (output.trim()) {
      warnings.push('Uncommitted changes detected in working directory');
    }
  } catch {
    warnings.push('Not a git repository or git not available');
  }

  // Check if tests exist and can be run
  if (pkg?.scripts?.test && !pkg.scripts.test.includes('no test')) {
    logger.step('Running tests before deploy...');
    try {
      execFileSync('npm', ['test', '--', '--passWithNoTests'], { cwd, stdio: 'ignore' });
    } catch {
      return { passed: false, warnings: [...warnings, 'Tests failed'] };
    }
  }

  return { passed: true, warnings };
}

/**
 * Detect deploy platform from project configuration
 */
function detectDeployPlatform(cwd, pkg) {
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };

  if (existsSync(join(cwd, 'vercel.json')) || deps?.vercel) return 'vercel';
  if (existsSync(join(cwd, 'netlify.toml')) || deps?.netlify) return 'netlify';
  if (existsSync(join(cwd, 'fly.toml'))) return 'fly';
  if (existsSync(join(cwd, 'Dockerfile'))) return 'docker';
  if (pkg?.scripts?.deploy) return 'custom';
  return 'unknown';
}

/**
 * Execute platform-specific deploy
 */
function executeDeploy(platform, cwd, options) {
  const { env, dryRun } = options;

  switch (platform) {
    case 'vercel': {
      const args = ['deploy'];
      if (env === 'production') args.push('--prod');
      if (dryRun) {
        logger.info('[dry-run] Would run: vercel deploy' + (env === 'production' ? ' --prod' : ''));
        return;
      }
      execFileSync('npx', ['vercel', ...args], { cwd, stdio: 'inherit' });
      break;
    }
    case 'netlify': {
      const args = ['deploy'];
      if (env === 'production') args.push('--prod');
      if (dryRun) {
        logger.info('[dry-run] Would run: netlify deploy' + (env === 'production' ? ' --prod' : ''));
        return;
      }
      execFileSync('npx', ['netlify-cli', ...args], { cwd, stdio: 'inherit' });
      break;
    }
    case 'fly': {
      if (dryRun) {
        logger.info('[dry-run] Would run: fly deploy');
        return;
      }
      execFileSync('fly', ['deploy'], { cwd, stdio: 'inherit' });
      break;
    }
    case 'docker': {
      const tag = `app:${env}`;
      if (dryRun) {
        logger.info(`[dry-run] Would run: docker build -t ${tag} .`);
        return;
      }
      execFileSync('docker', ['build', '-t', tag, '.'], { cwd, stdio: 'inherit' });
      logger.success(`Docker image built: ${tag}`);
      break;
    }
    case 'custom': {
      if (dryRun) {
        logger.info('[dry-run] Would run: npm run deploy');
        return;
      }
      execFileSync('npm', ['run', 'deploy'], { cwd, stdio: 'inherit' });
      break;
    }
    default:
      logger.warn('No deploy platform detected. Add a deploy configuration (vercel.json, netlify.toml, fly.toml, Dockerfile) or a "deploy" script in package.json.');
      process.exit(1);
  }
}

/**
 * Deploy command handler
 */
export async function deployCommand(options) {
  const { env, dryRun, force } = options;
  const cwd = process.cwd();

  logger.info(`Deploying to: ${env}${dryRun ? ' (dry run)' : ''}`);

  const pkg = readPackageJson(cwd);
  if (!pkg) {
    logger.error('No package.json found. Make sure you are in a project directory.');
    process.exit(1);
  }

  // Pre-deploy checks (skip only with --force)
  if (!force) {
    logger.step('Running pre-deploy checks...');
    const { passed, warnings } = runPreDeployChecks(cwd, pkg);

    for (const w of warnings) {
      logger.warn(w);
    }

    if (!passed) {
      logger.error('Pre-deploy checks failed. Use --force to deploy anyway.');
      process.exit(1);
    }

    if (warnings.length > 0 && !dryRun) {
      logger.warn('Proceeding with warnings...');
    }
  }

  const platform = detectDeployPlatform(cwd, pkg);
  logger.step(`Deploy platform: ${platform}`);

  try {
    executeDeploy(platform, cwd, { env, dryRun });

    if (!dryRun) {
      logger.success(`Deployment to ${env} complete!`);
    } else {
      logger.success('Dry run complete — no changes were made.');
    }
  } catch (err) {
    logger.error(`Deploy failed: ${err.message}`);
    process.exit(1);
  }
}
