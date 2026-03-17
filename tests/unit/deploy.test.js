import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
import { deployCommand } from '../../src/commands/deploy.js';

describe('deployCommand', () => {
  const mockCwd = '/mock/project';

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

  const mockValidPkg = () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('vercel.json')) return false;
      if (p.endsWith('netlify.toml')) return false;
      if (p.endsWith('fly.toml')) return false;
      if (p.endsWith('Dockerfile')) return false;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    return pkg;
  };

  it('exits with error when no package.json found', async () => {
    existsSync.mockReturnValue(false);
    readFileSync.mockImplementation(() => { throw new Error('not found'); });

    await expect(deployCommand({ env: 'production', dryRun: false, force: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('No package.json found'));
  });

  it('exits when no deploy platform detected', async () => {
    mockValidPkg();
    // git status returns clean
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await expect(deployCommand({ env: 'production', dryRun: false, force: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No deploy platform detected'));
  });

  it('detects vercel platform from vercel.json', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('vercel.json')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'production', dryRun: false, force: false });

    const deployCalls = execFileSync.mock.calls.filter(c => c[0] === 'npx');
    expect(deployCalls[0][1]).toEqual(['vercel', 'deploy', '--prod']);
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Deployment to production complete'));
  });

  it('deploys vercel to preview for non-production', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('vercel.json')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'staging', dryRun: false, force: false });

    const deployCalls = execFileSync.mock.calls.filter(c => c[0] === 'npx');
    expect(deployCalls[0][1]).toEqual(['vercel', 'deploy']);
  });

  it('detects netlify platform from netlify.toml', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('netlify.toml')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'production', dryRun: false, force: false });

    const deployCalls = execFileSync.mock.calls.filter(c => c[0] === 'npx');
    expect(deployCalls[0][1]).toEqual(['netlify-cli', 'deploy', '--prod']);
  });

  it('detects fly platform from fly.toml', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('fly.toml')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'production', dryRun: false, force: false });

    const deployCalls = execFileSync.mock.calls.filter(c => c[0] === 'fly');
    expect(deployCalls[0][1]).toEqual(['deploy']);
  });

  it('detects docker platform from Dockerfile', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('Dockerfile')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'production', dryRun: false, force: false });

    const dockerCalls = execFileSync.mock.calls.filter(c => c[0] === 'docker');
    expect(dockerCalls[0][1]).toEqual(['build', '-t', 'app:production', '.']);
  });

  it('uses custom deploy script when deploy script in package.json', async () => {
    const pkg = { name: 'test', scripts: { deploy: 'my-deploy.sh' }, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'production', dryRun: false, force: false });

    const npmCalls = execFileSync.mock.calls.filter(c => c[0] === 'npm');
    expect(npmCalls[0][1]).toEqual(['run', 'deploy']);
  });

  it('dry-run skips actual vercel deploy', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('vercel.json')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'production', dryRun: true, force: false });

    const npxCalls = execFileSync.mock.calls.filter(c => c[0] === 'npx');
    expect(npxCalls).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[dry-run]'));
    expect(logger.success).toHaveBeenCalledWith(expect.stringContaining('Dry run complete'));
  });

  it('dry-run skips actual netlify deploy', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('netlify.toml')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'production', dryRun: true, force: false });

    const npxCalls = execFileSync.mock.calls.filter(c => c[0] === 'npx');
    expect(npxCalls).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[dry-run]'));
  });

  it('dry-run skips fly deploy', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('fly.toml')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'production', dryRun: true, force: false });

    const flyCalls = execFileSync.mock.calls.filter(c => c[0] === 'fly');
    expect(flyCalls).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith('[dry-run] Would run: fly deploy');
  });

  it('dry-run skips docker build', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('Dockerfile')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'staging', dryRun: true, force: false });

    const dockerCalls = execFileSync.mock.calls.filter(c => c[0] === 'docker');
    expect(dockerCalls).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith('[dry-run] Would run: docker build -t app:staging .');
  });

  it('dry-run skips custom deploy script', async () => {
    const pkg = { name: 'test', scripts: { deploy: 'my-deploy.sh' }, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'production', dryRun: true, force: false });

    const npmDeployCalls = execFileSync.mock.calls.filter(c => c[0] === 'npm' && c[1].includes('deploy'));
    expect(npmDeployCalls).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith('[dry-run] Would run: npm run deploy');
  });

  it('force skips pre-deploy checks', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('vercel.json')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation(() => {});

    await deployCommand({ env: 'production', dryRun: false, force: true });

    // git status should NOT be called when --force
    const gitCalls = execFileSync.mock.calls.filter(c => c[0] === 'git');
    expect(gitCalls).toHaveLength(0);
  });

  it('warns about uncommitted changes in pre-deploy checks', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('vercel.json')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return ' M src/index.js';
      return '';
    });

    await deployCommand({ env: 'production', dryRun: false, force: false });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Uncommitted changes'));
    expect(logger.warn).toHaveBeenCalledWith('Proceeding with warnings...');
  });

  it('warns when not in git repo', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('vercel.json')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git') throw new Error('not a git repo');
      return '';
    });

    await deployCommand({ env: 'production', dryRun: false, force: false });

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Not a git repository'));
  });

  it('exits when pre-deploy tests fail', async () => {
    const pkg = { name: 'test', scripts: { test: 'vitest' }, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => p.endsWith('package.json'));
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      if (cmd === 'npm' && args[0] === 'test') throw new Error('tests failed');
      return '';
    });

    await expect(deployCommand({ env: 'production', dryRun: false, force: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Pre-deploy checks failed'));
  });

  it('handles deploy execution failure', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: {}, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      if (p.endsWith('vercel.json')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      throw new Error('deploy exec failed');
    });

    await expect(deployCommand({ env: 'production', dryRun: false, force: false }))
      .rejects.toThrow('process.exit(1)');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Deploy failed'));
  });

  it('detects vercel dependency in package.json', async () => {
    const pkg = { name: 'test', scripts: {}, dependencies: { vercel: '^34.0.0' }, devDependencies: {} };
    existsSync.mockImplementation((p) => {
      if (p.endsWith('package.json')) return true;
      return false;
    });
    readFileSync.mockReturnValue(JSON.stringify(pkg));
    execFileSync.mockImplementation((cmd, args) => {
      if (cmd === 'git' && args[0] === 'status') return '';
      return '';
    });

    await deployCommand({ env: 'staging', dryRun: false, force: false });

    const deployCalls = execFileSync.mock.calls.filter(c => c[0] === 'npx');
    expect(deployCalls[0][1][0]).toBe('vercel');
  });
});
