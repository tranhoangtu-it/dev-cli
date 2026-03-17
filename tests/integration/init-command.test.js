/**
 * Integration tests for the init command
 * These tests use real filesystem via temporary directories
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

// Mock child_process to avoid git/npm execution in tests
vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

// Mock logger to suppress output during tests
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
import { initCommand } from '../../src/commands/init.js';

describe('init command integration', () => {
  let testDir;

  beforeEach(() => {
    const suffix = randomBytes(4).toString('hex');
    testDir = join(tmpdir(), `dev-cli-test-${suffix}`);
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

  it('creates a node project with correct file structure', async () => {
    execFileSync.mockImplementation(() => {});

    await initCommand('my-node-app', { template: 'node', git: false, install: false });

    const projectDir = join(testDir, 'my-node-app');
    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
    expect(existsSync(join(projectDir, 'src/index.js'))).toBe(true);
    expect(existsSync(join(projectDir, 'README.md'))).toBe(true);
    expect(existsSync(join(projectDir, '.gitignore'))).toBe(true);
  });

  it('package.json has correct content for node project', async () => {
    execFileSync.mockImplementation(() => {});

    await initCommand('my-node-app', { template: 'node', git: false, install: false });

    const projectDir = join(testDir, 'my-node-app');
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));

    expect(pkg.name).toBe('my-node-app');
    expect(pkg.version).toBe('1.0.0');
    expect(pkg.type).toBe('module');
    expect(pkg.main).toBe('src/index.js');
    expect(pkg.license).toBe('MIT');
  });

  it('src/index.js contains hello world entry point', async () => {
    execFileSync.mockImplementation(() => {});

    await initCommand('hello-project', { template: 'node', git: false, install: false });

    const content = readFileSync(join(testDir, 'hello-project/src/index.js'), 'utf-8');
    expect(content).toContain('Hello, World!');
  });

  it('README.md contains project name', async () => {
    execFileSync.mockImplementation(() => {});

    await initCommand('awesome-app', { template: 'node', git: false, install: false });

    const readme = readFileSync(join(testDir, 'awesome-app/README.md'), 'utf-8');
    expect(readme).toContain('awesome-app');
    expect(readme).toContain('Node.js project');
  });

  it('creates react project with correct file structure', async () => {
    execFileSync.mockImplementation(() => {});

    await initCommand('my-react-app', { template: 'react', git: false, install: false });

    const projectDir = join(testDir, 'my-react-app');
    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
    expect(existsSync(join(projectDir, 'index.html'))).toBe(true);
    expect(existsSync(join(projectDir, 'src/main.jsx'))).toBe(true);
    expect(existsSync(join(projectDir, 'src/App.jsx'))).toBe(true);
    expect(existsSync(join(projectDir, '.gitignore'))).toBe(true);
  });

  it('react App.jsx contains project name', async () => {
    execFileSync.mockImplementation(() => {});

    await initCommand('my-react-app', { template: 'react', git: false, install: false });

    const app = readFileSync(join(testDir, 'my-react-app/src/App.jsx'), 'utf-8');
    expect(app).toContain('my-react-app');
  });

  it('react index.html references main.jsx', async () => {
    execFileSync.mockImplementation(() => {});

    await initCommand('react-html-test', { template: 'react', git: false, install: false });

    const html = readFileSync(join(testDir, 'react-html-test/index.html'), 'utf-8');
    expect(html).toContain('src/main.jsx');
    expect(html).toContain('react-html-test');
  });

  it('calls git init/add/commit when git=true', async () => {
    execFileSync.mockImplementation(() => {});

    await initCommand('git-project', { template: 'node', git: true, install: false });

    const gitCalls = execFileSync.mock.calls.filter(c => c[0] === 'git');
    expect(gitCalls).toHaveLength(3);
    expect(gitCalls[0][1]).toEqual(['init']);
    expect(gitCalls[1][1]).toEqual(['add', '.']);
    expect(gitCalls[2][1][0]).toBe('commit');
  });

  it('fails when project directory already exists', async () => {
    // Pre-create the directory
    mkdirSync(join(testDir, 'existing-project'), { recursive: true });

    await expect(initCommand('existing-project', { template: 'node', git: false, install: false }))
      .rejects.toThrow('process.exit(1)');
  });

  it('uses "my-project" as default name when name not provided', async () => {
    execFileSync.mockImplementation(() => {});

    await initCommand(undefined, { template: 'node', git: false, install: false });

    const projectDir = join(testDir, 'my-project');
    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
  });
});
