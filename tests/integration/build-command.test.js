/**
 * Integration tests for the build command
 * Tests real filesystem interactions with temp directories
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

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

import { execFileSync } from 'child_process';
import { logger } from '../../src/utils/logger.js';
import { buildCommand } from '../../src/commands/build.js';

describe('build command integration', () => {
  let testDir;

  beforeEach(() => {
    const suffix = randomBytes(4).toString('hex');
    testDir = join(tmpdir(), `dev-cli-build-test-${suffix}`);
    mkdirSync(testDir, { recursive: true });

    vi.spyOn(process, 'cwd').mockReturnValue(testDir);
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('runs npm build when package.json has build script', async () => {
    const pkg = { name: 'test', scripts: { build: 'vite build' }, dependencies: { vite: '^5' }, devDependencies: {} };
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));
    execFileSync.mockImplementation(() => {});

    await buildCommand({ env: 'production', minify: false, sourcemap: false });

    const buildCalls = execFileSync.mock.calls.filter(c => c[0] === 'npm');
    expect(buildCalls).toHaveLength(1);
    expect(buildCalls[0][1]).toEqual(['run', 'build']);
    expect(logger.success).toHaveBeenCalledWith('Build complete (production)');
  });

  it('validates node project syntax when main file exists', async () => {
    const pkg = { name: 'test', main: 'src/index.js', dependencies: {}, devDependencies: {} };
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src/index.js'), '// valid js\nconsole.log("hi");\n');
    execFileSync.mockImplementation(() => {});

    await buildCommand({ env: 'development', minify: false, sourcemap: false });

    const nodeCalls = execFileSync.mock.calls.filter(c => c[0] === 'node');
    expect(nodeCalls).toHaveLength(1);
    expect(nodeCalls[0][1]).toEqual(['--check', 'src/index.js']);
  });

  it('skips syntax check when main file is missing', async () => {
    const pkg = { name: 'test', main: 'src/missing.js', dependencies: {}, devDependencies: {} };
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));
    execFileSync.mockImplementation(() => {});

    await buildCommand({ env: 'development', minify: false, sourcemap: false });

    const nodeCalls = execFileSync.mock.calls.filter(c => c[0] === 'node');
    expect(nodeCalls).toHaveLength(0);
    expect(logger.success).toHaveBeenCalledWith('Build complete (development)');
  });

  it('fails when no package.json in directory', async () => {
    await expect(buildCommand({ env: 'development', minify: false, sourcemap: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No package.json found'));
  });

  it('detects vite project and logs project type', async () => {
    const pkg = { name: 'test', scripts: { build: 'vite build' }, dependencies: { vite: '^5' }, devDependencies: {} };
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));
    execFileSync.mockImplementation(() => {});

    await buildCommand({ env: 'development', minify: false, sourcemap: false });

    expect(logger.step).toHaveBeenCalledWith('Detected project type: vite');
  });

  it('uses default src/index.js when no main field in package.json', async () => {
    const pkg = { name: 'test', dependencies: {}, devDependencies: {} };
    writeFileSync(join(testDir, 'package.json'), JSON.stringify(pkg));
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src/index.js'), 'console.log("hi");\n');
    execFileSync.mockImplementation(() => {});

    await buildCommand({ env: 'development', minify: false, sourcemap: false });

    const nodeCalls = execFileSync.mock.calls.filter(c => c[0] === 'node');
    expect(nodeCalls[0][1]).toEqual(['--check', 'src/index.js']);
  });
});
