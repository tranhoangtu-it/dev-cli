import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before importing the command
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
  },
}));

import { existsSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { logger } from '../../src/utils/logger.js';
import { buildCommand } from '../../src/commands/build.js';

describe('buildCommand', () => {
  let processExitSpy;
  const mockCwd = '/mock/project';

  beforeEach(() => {
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits with error when no package.json found', async () => {
    existsSync.mockReturnValue(false);
    readFileSync.mockImplementation(() => { throw new Error('not found'); });

    await expect(buildCommand({ env: 'development', minify: false, sourcemap: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No package.json found'));
  });

  it('runs npm build script when package.json has build script', async () => {
    const pkg = { scripts: { build: 'vite build' }, dependencies: { vite: '^5.0.0' } };
    existsSync.mockImplementation((p) => p.endsWith('package.json'));
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation(() => {});

    await buildCommand({ env: 'production', minify: false, sourcemap: false });

    expect(execFileSync).toHaveBeenCalledWith('npm', ['run', 'build'], expect.any(Object));
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Build complete'));
  });

  it('passes minify and sourcemap flags to build script', async () => {
    const pkg = { scripts: { build: 'vite build' }, dependencies: {} };
    existsSync.mockImplementation((p) => p.endsWith('package.json'));
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation(() => {});

    await buildCommand({ env: 'development', minify: true, sourcemap: true });

    expect(execFileSync).toHaveBeenCalledWith(
      'npm',
      ['run', 'build', '--', '--minify', '--sourcemap'],
      expect.any(Object)
    );
  });

  it('validates node project syntax when no build script', async () => {
    const pkg = { main: 'src/index.js', dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('src/index.js')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation(() => {});

    await buildCommand({ env: 'development', minify: false, sourcemap: false });

    expect(execFileSync).toHaveBeenCalledWith('node', ['--check', 'src/index.js'], expect.any(Object));
    expect(logger.success).toHaveBeenCalledWith('Syntax validation passed');
  });

  it('warns and exits when webpack project has no build script', async () => {
    // webpack is detected as a known project type (not 'node'), but no build script → exit
    const pkg = { dependencies: { webpack: '^5.0.0' }, devDependencies: {} };
    existsSync.mockImplementation((p) => p.endsWith('package.json'));
    readFileSync.mockReturnValue(JSON.stringify(pkg));

    await expect(buildCommand({ env: 'development', minify: false, sourcemap: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No build script found'));
  });

  it('handles build script failure', async () => {
    const pkg = { scripts: { build: 'vite build' }, dependencies: { vite: '^5' } };
    existsSync.mockImplementation((p) => p.endsWith('package.json'));
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation(() => { throw new Error('build failed'); });

    await expect(buildCommand({ env: 'production', minify: false, sourcemap: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Build failed'));
  });

  it('detects webpack project type', async () => {
    const pkg = { dependencies: { webpack: '^5.0.0' }, devDependencies: {} };
    existsSync.mockImplementation((p) => p.endsWith('package.json'));
    readFileSync.mockReturnValue(JSON.stringify(pkg));

    // No build script + unknown type exits with 1
    await expect(buildCommand({ env: 'development', minify: false, sourcemap: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.step).toHaveBeenCalledWith('Detected project type: webpack');
  });

  it('detects next project type', async () => {
    const pkg = { dependencies: { next: '^14.0.0' }, devDependencies: {} };
    existsSync.mockImplementation((p) => p.endsWith('package.json'));
    readFileSync.mockReturnValue(JSON.stringify(pkg));

    await expect(buildCommand({ env: 'development', minify: false, sourcemap: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.step).toHaveBeenCalledWith('Detected project type: next');
  });

  it('sets NODE_ENV to production for production builds', async () => {
    const pkg = { scripts: { build: 'vite build' }, dependencies: { vite: '^5' } };
    existsSync.mockImplementation((p) => p.endsWith('package.json'));
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation(() => {});

    await buildCommand({ env: 'production', minify: false, sourcemap: false });

    const callArgs = execFileSync.mock.calls[0];
    expect(callArgs[2].env.NODE_ENV).toBe('production');
  });

  it('sets NODE_ENV to development for non-production builds', async () => {
    const pkg = { scripts: { build: 'vite build' }, dependencies: { vite: '^5' } };
    existsSync.mockImplementation((p) => p.endsWith('package.json'));
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation(() => {});

    await buildCommand({ env: 'staging', minify: false, sourcemap: false });

    const callArgs = execFileSync.mock.calls[0];
    expect(callArgs[2].env.NODE_ENV).toBe('development');
  });

  it('skips syntax check when main file does not exist', async () => {
    const pkg = { main: 'src/index.js', dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      return false; // main file does not exist
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));

    await buildCommand({ env: 'development', minify: false, sourcemap: false });

    expect(execFileSync).not.toHaveBeenCalled();
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Build complete'));
  });

  it('handles invalid JSON in package.json', async () => {
    existsSync.mockImplementation((p) => p.endsWith('package.json'));
    readFileSync.mockReturnValue('not valid json{{{');

    await expect(buildCommand({ env: 'development', minify: false, sourcemap: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No package.json found'));
  });
});
