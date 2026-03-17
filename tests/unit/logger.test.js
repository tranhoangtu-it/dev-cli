import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../src/utils/logger.js';

describe('logger', () => {
  let consoleSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('info logs with blue info marker', () => {
    logger.info('test info');
    expect(consoleSpy).toHaveBeenCalledOnce();
    const args = consoleSpy.mock.calls[0];
    expect(args[1]).toBe('test info');
  });

  it('success logs with green check marker', () => {
    logger.success('operation done');
    expect(consoleSpy).toHaveBeenCalledOnce();
    const args = consoleSpy.mock.calls[0];
    expect(args[1]).toBe('operation done');
  });

  it('warn logs with yellow warning marker', () => {
    logger.warn('some warning');
    expect(consoleSpy).toHaveBeenCalledOnce();
    const args = consoleSpy.mock.calls[0];
    expect(args[1]).toBe('some warning');
  });

  it('error logs to stderr with red error marker', () => {
    logger.error('something failed');
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const args = consoleErrorSpy.mock.calls[0];
    expect(args[1]).toBe('something failed');
  });

  it('step logs with cyan arrow marker', () => {
    logger.step('doing step');
    expect(consoleSpy).toHaveBeenCalledOnce();
    const args = consoleSpy.mock.calls[0];
    expect(args[1]).toBe('doing step');
  });

  it('each method accepts string messages', () => {
    logger.info('');
    logger.success('');
    logger.warn('');
    logger.error('');
    logger.step('');
    expect(consoleSpy).toHaveBeenCalledTimes(4);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
