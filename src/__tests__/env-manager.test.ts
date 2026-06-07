/**
 * EnvManager 自动化测试
 * 覆盖: 运行时检测（Node.js, Python, npx, uvx）、PATH 增强
 */

import { describe, it, expect } from 'vitest';
import os from 'os';
import path from 'path';
import { EnvManager, selectExecutablePath } from '../main/env-manager';

const envManager = new EnvManager();

describe('selectExecutablePath', () => {
  it('prefers the .cmd shim from multiline Windows where output', () => {
    const output = [
      String.raw`C:\Program Files\nodejs\npx`,
      String.raw`C:\Program Files\nodejs\npx.cmd`,
    ].join('\r\n');

    expect(selectExecutablePath(output, 'npx', 'win32')).toBe(String.raw`C:\Program Files\nodejs\npx.cmd`);
  });

  it('falls back to the first Windows candidate when no shim is present', () => {
    const output = [
      String.raw`C:\Tools\uvx`,
      String.raw`C:\OtherTools\uvx`,
    ].join('\n');

    expect(selectExecutablePath(output, 'uvx', 'win32')).toBe(String.raw`C:\Tools\uvx`);
  });

  it('uses the first candidate on non-Windows platforms', () => {
    const output = ['/usr/local/bin/npx', '/opt/homebrew/bin/npx'].join('\n');

    expect(selectExecutablePath(output, 'npx', 'darwin')).toBe('/usr/local/bin/npx');
  });
});

describe('getEnhancedPath', () => {
  it('应包含当前 PATH', () => {
    const enhanced = envManager.getEnhancedPath();
    const currentPath = process.env.PATH || '';
    expect(enhanced).toContain(currentPath);
  });

  it('应包含常见的包管理器路径', () => {
    const enhanced = envManager.getEnhancedPath();
    const platform = process.platform;

    if (platform === 'darwin' || platform === 'linux') {
      expect(enhanced).toContain('/usr/local/bin');
      expect(enhanced).toContain(path.join(os.homedir(), '.local/bin'));
      expect(enhanced).toContain(path.join(os.homedir(), '.cargo/bin'));
    }
  });

  it('应返回非空字符串', () => {
    const enhanced = envManager.getEnhancedPath();
    expect(enhanced.length).toBeGreaterThan(0);
  });
});

describe('checkNode', () => {
  it('应检测到 Node.js（当前环境必定有）', async () => {
    const result = await envManager.checkNode();
    expect(result.available).toBe(true);
    expect(result.version).not.toBeNull();
    expect(result.version!.length).toBeGreaterThan(0);
  });
});

describe('checkNpx', () => {
  it('应检测到 npx（Node.js 环境必定有）', async () => {
    const result = await envManager.checkNpx();
    expect(result.available).toBe(true);
    expect(result.version).not.toBeNull();
  });
});

describe('getAllRuntimes', () => {
  it('应返回所有运行时信息', async () => {
    const runtimes = await envManager.getAllRuntimes();
    expect(runtimes).toHaveProperty('node');
    expect(runtimes).toHaveProperty('python');
    expect(runtimes).toHaveProperty('npx');
    expect(runtimes).toHaveProperty('uvx');

    expect(runtimes.node.available).toBe(true);
  });
});

describe('checkRuntime', () => {
  it('应通过 checkRuntime("node") 检测 Node.js', async () => {
    const result = await envManager.checkRuntime('node');
    expect(result.available).toBe(true);
  });

  it('应通过 checkRuntime("python") 检测 Python', async () => {
    const result = await envManager.checkRuntime('python');
    // Python 可能不存在，但不应该抛错
    expect(typeof result.available).toBe('boolean');
  });
});
