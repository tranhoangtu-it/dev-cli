import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
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

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { logger } from '../../src/utils/logger.js';
import { initCommand } from '../../src/commands/init.js';

describe('initCommand', () => {
  const mockCwd = '/mock/workspace';

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('errors on unknown template', async () => {
    await expect(initCommand('my-app', { template: 'angular', git: true, install: true }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unknown template "angular"'));
  });

  it('errors when project directory already exists', async () => {
    existsSync.mockImplementation((p) => p.endsWith('my-app'));

    await expect(initCommand('my-app', { template: 'node', git: true, install: true }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('"my-app" already exists'));
  });

  it('creates node project with default name when no name given', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation(() => {});

    await initCommand(undefined, { template: 'node', git: true, install: false });

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('my-project'));
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('"my-project" created successfully'));
  });

  it('creates node template files', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation(() => {});

    await initCommand('test-project', { template: 'node', git: false, install: false });

    // Should write package.json, src/index.js, README.md, .gitignore
    expect(writeFileSync).toHaveBeenCalledTimes(4);

    // package.json content check
    const pkgCall = writeFileSync.mock.calls.find(c => c[0].endsWith('package.json'));
    expect(pkgCall).toBeDefined();
    const pkgContent = JSON.parse(pkgCall[1]);
    expect(pkgContent.name).toBe('test-project');
    expect(pkgContent.type).toBe('module');
  });

  it('creates react template files', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation(() => {});

    await initCommand('my-react-app', { template: 'react', git: false, install: false });

    // React has: package.json, index.html, src/main.jsx, src/App.jsx, .gitignore = 5 files
    expect(writeFileSync).toHaveBeenCalledTimes(5);

    const pkgCall = writeFileSync.mock.calls.find(c => c[0].endsWith('package.json'));
    const pkgContent = JSON.parse(pkgCall[1]);
    expect(pkgContent.name).toBe('my-react-app');
    expect(pkgContent.dependencies.react).toBeDefined();
  });

  it('initializes git repository when git option is true', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation(() => {});

    await initCommand('git-project', { template: 'node', git: true, install: false });

    const gitCalls = execFileSync.mock.calls.filter(c => c[0] === 'git');
    expect(gitCalls).toHaveLength(3); // init, add, commit
    expect(gitCalls[0][1]).toEqual(['init']);
    expect(gitCalls[1][1]).toEqual(['add', '.']);
    expect(gitCalls[2][1]).toEqual(['commit', '-m', 'chore: initial commit']);
    expect(logger.success).toHaveBeenCalledWith('Git repository initialized');
  });

  it('skips git when git option is false', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation(() => {});

    await initCommand('no-git-project', { template: 'node', git: false, install: false });

    const gitCalls = execFileSync.mock.calls.filter(c => c[0] === 'git');
    expect(gitCalls).toHaveLength(0);
  });

  it('runs npm install when install option is true and package.json exists', async () => {
    existsSync.mockImplementation((p) => {
      // project dir does not exist initially
      if (p === `${mockCwd}/install-project`) return false;
      // package.json exists after creation
      if (p.endsWith('package.json')) return true;
      return false;
    });
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation(() => {});

    await initCommand('install-project', { template: 'node', git: false, install: true });

    const npmCalls = execFileSync.mock.calls.filter(c => c[0] === 'npm');
    expect(npmCalls).toHaveLength(1);
    expect(npmCalls[0][1]).toEqual(['install']);
    expect(logger.success).toHaveBeenCalledWith('Dependencies installed');
  });

  it('warns when npm install fails', async () => {
    existsSync.mockImplementation((p) => {
      if (p === `${mockCwd}/install-project`) return false;
      if (p.endsWith('package.json')) return true;
      return false;
    });
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation((cmd) => {
      if (cmd === 'npm') throw new Error('npm install failed');
    });

    await initCommand('install-project', { template: 'node', git: false, install: true });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Dependency installation failed'));
  });

  it('skips install when install option is false', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation(() => {});

    await initCommand('no-install-project', { template: 'node', git: false, install: false });

    const npmCalls = execFileSync.mock.calls.filter(c => c[0] === 'npm');
    expect(npmCalls).toHaveLength(0);
  });

  it('handles filesystem error during project creation', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => { throw new Error('permission denied'); });

    await expect(initCommand('fail-project', { template: 'node', git: false, install: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create project'));
  });

  it('node package.json has correct scripts', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation(() => {});

    await initCommand('scripts-test', { template: 'node', git: false, install: false });

    const pkgCall = writeFileSync.mock.calls.find(c => c[0].endsWith('package.json'));
    const pkgContent = JSON.parse(pkgCall[1]);
    expect(pkgContent.scripts.start).toBe('node src/index.js');
    expect(pkgContent.scripts.test).toBe('node --test');
    expect(pkgContent.scripts.dev).toBe('node --watch src/index.js');
  });

  it('react package.json has correct dependencies', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation(() => {});

    await initCommand('react-test', { template: 'react', git: false, install: false });

    const pkgCall = writeFileSync.mock.calls.find(c => c[0].endsWith('package.json'));
    const pkgContent = JSON.parse(pkgCall[1]);
    expect(pkgContent.devDependencies.vitest).toBeDefined();
    expect(pkgContent.devDependencies['@vitejs/plugin-react']).toBeDefined();
  });

  it('gitignore contains node_modules', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});
    execFileSync.mockImplementation(() => {});

    await initCommand('gitignore-test', { template: 'node', git: false, install: false });

    const gitignoreCall = writeFileSync.mock.calls.find(c => c[0].endsWith('.gitignore'));
    expect(gitignoreCall).toBeDefined();
    expect(gitignoreCall[1]).toContain('node_modules/');
  });

  it('logs next steps after project creation', async () => {
    existsSync.mockReturnValue(false);
    mkdirSync.mockImplementation(() => {});
    writeFileSync.mockImplementation(() => {});

    await initCommand('next-steps-test', { template: 'node', git: false, install: false });

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Next steps'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('cd next-steps-test'));
  });
});
