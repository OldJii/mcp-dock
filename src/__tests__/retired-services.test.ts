/**
 * 已停止服务识别测试
 * 只按实际连接方式判断，不按名称；绝不改写传入的配置。
 */

import { describe, it, expect } from 'vitest';
import { isRetiredServerConfig } from '../renderer/src/lib/retired-services';

describe('isRetiredServerConfig', () => {
  it('flags remote URLs on retired hosts and their subdomains', () => {
    expect(isRetiredServerConfig({ url: 'https://server.smithery.ai/@acme/weather/mcp' })).toBe(true);
    expect(isRetiredServerConfig({ serverUrl: 'https://run.tools/acme/weather' })).toBe(true);
    expect(isRetiredServerConfig({ httpUrl: 'https://SMITHERY.AI./x' })).toBe(true);
  });

  it('flags launches through the retired CLI, with or without a version', () => {
    expect(isRetiredServerConfig({ command: 'npx', args: ['-y', '@smithery/cli', 'run', '@acme/weather'] })).toBe(true);
    expect(isRetiredServerConfig({ command: 'npx', args: ['-y', '@smithery/cli@latest', 'run', 'x'] })).toBe(true);
    expect(isRetiredServerConfig({ command: 'npx @smithery/cli@1.2.3 run x' })).toBe(true);
  });

  it('flags bridges that point at a retired address', () => {
    expect(isRetiredServerConfig({ command: 'npx', args: ['-y', 'mcp-remote', 'https://server.smithery.ai/x/mcp'] })).toBe(true);
    expect(isRetiredServerConfig({ command: 'npx', args: ['-y', 'mcp-remote', '--url=https://run.tools/x'] })).toBe(true);
  });

  it('leaves vendor remotes and other launchers alone, whatever their name says', () => {
    expect(isRetiredServerConfig({ url: 'https://mcp.vendor.example/mcp' })).toBe(false);
    expect(isRetiredServerConfig({ url: 'https://notsmithery.ai/mcp' })).toBe(false);
    expect(isRetiredServerConfig({ url: 'https://smithery.ai.example.com/mcp' })).toBe(false);
    expect(isRetiredServerConfig({ command: 'npx', args: ['-y', '@acme/smithery-notes-mcp'] })).toBe(false);
    expect(isRetiredServerConfig({ command: 'npx', args: ['-y', '@smithery/cli-extras'] })).toBe(false);
    expect(isRetiredServerConfig({ command: 'uvx', args: ['smithery-tools'] })).toBe(false);
  });

  it('copes with missing or malformed fields and does not mutate the config', () => {
    expect(isRetiredServerConfig(null)).toBe(false);
    expect(isRetiredServerConfig(undefined)).toBe(false);
    expect(isRetiredServerConfig({})).toBe(false);
    expect(isRetiredServerConfig({ url: 'not a url', args: 'oops' })).toBe(false);
    expect(isRetiredServerConfig({ args: [1, null, {}] })).toBe(false);

    const config = { command: 'npx', args: ['-y', '@smithery/cli', 'run', 'x'], url: 'https://run.tools/x' };
    const snapshot = JSON.stringify(config);
    isRetiredServerConfig(config);
    expect(JSON.stringify(config)).toBe(snapshot);
  });
});
