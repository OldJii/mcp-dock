/**
 * SkillsManager 自动化测试
 * 覆盖: URL 解析、Skill 发现、安装/卸载/更新、文件列表获取、本地详情
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock electron 的 config-manager 依赖
vi.mock('../main/config-manager', () => ({
  SKILL_SUPPORTED_CLIENTS: ['cursor', 'claude-code', 'gemini-cli', 'codex-cli', 'opencode', 'agent-skills'],
}));

import { SkillsManager, SkillSourceMeta, DiscoveredSkill } from '../main/skills-manager';

let manager: SkillsManager;
let testDir: string;

beforeEach(async () => {
  testDir = path.join(os.tmpdir(), `mcp-dock-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(testDir, { recursive: true });
  manager = new SkillsManager();
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

// ===================== parseGitHubUrl 测试 =====================

describe('parseGitHubUrl (通过 parseImportUrl 间接测试)', () => {
  it('应拒绝无效 URL', async () => {
    const result = await manager.parseImportUrl('not-a-valid-url');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid GitHub URL');
  });

  it('应拒绝空字符串', async () => {
    const result = await manager.parseImportUrl('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid GitHub URL');
  });

  it('应拒绝非 GitHub 域名', async () => {
    const result = await manager.parseImportUrl('https://gitlab.com/owner/repo');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid GitHub URL');
  });
});

// ===================== URL 格式解析测试（纯逻辑） =====================

describe('GitHub URL 格式解析', () => {
  // 通过反射访问 private 方法
  function parseUrl(url: string) {
    return (manager as any).parseGitHubUrl(url);
  }

  it('应解析 owner/repo 简写', () => {
    const result = parseUrl('openclaw/openclaw');
    expect(result).toEqual({ owner: 'openclaw', repo: 'openclaw' });
  });

  it('应解析标准 GitHub URL', () => {
    const result = parseUrl('https://github.com/openclaw/openclaw');
    expect(result).toEqual({ owner: 'openclaw', repo: 'openclaw' });
  });

  it('应解析带 .git 后缀的 URL', () => {
    const result = parseUrl('https://github.com/openclaw/openclaw.git');
    expect(result).toEqual({ owner: 'openclaw', repo: 'openclaw' });
  });

  it('应解析带 /tree/branch/path 的 URL', () => {
    const result = parseUrl('https://github.com/openclaw/openclaw/tree/main/skills');
    expect(result).toEqual({
      owner: 'openclaw',
      repo: 'openclaw',
      branch: 'main',
      subPath: 'skills',
    });
  });

  it('应解析带 /tree/branch 但无 path 的 URL', () => {
    const result = parseUrl('https://github.com/openclaw/openclaw/tree/main');
    expect(result).toEqual({
      owner: 'openclaw',
      repo: 'openclaw',
      branch: 'main',
      subPath: undefined,
    });
  });

  it('应解析 raw.githubusercontent.com URL', () => {
    const result = parseUrl('https://raw.githubusercontent.com/owner/repo/main/skills/test/SKILL.md');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      subPath: 'skills/test',
    });
  });

  it('应处理尾部斜杠', () => {
    const result = parseUrl('https://github.com/openclaw/openclaw/');
    expect(result).toEqual({ owner: 'openclaw', repo: 'openclaw' });
  });

  it('应处理 URL 中的空白字符', () => {
    const result = parseUrl('  https://github.com/openclaw/openclaw  ');
    expect(result).toEqual({ owner: 'openclaw', repo: 'openclaw' });
  });

  it('应处理带 Unicode 零宽空格的 URL', () => {
    const result = parseUrl('https://github.com/openclaw/openclaw\u200B');
    expect(result).toEqual({ owner: 'openclaw', repo: 'openclaw' });
  });

  it('应返回 null 对于完全无效的输入', () => {
    expect(parseUrl('random text')).toBeNull();
    expect(parseUrl('http://example.com')).toBeNull();
    expect(parseUrl('')).toBeNull();
  });

  it('应解析带嵌套路径的 tree URL', () => {
    const result = parseUrl('https://github.com/owner/repo/tree/main/a/b/c');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      subPath: 'a/b/c',
    });
  });
});

// ===================== getSkillsPath 测试 =====================

describe('getSkillsPath', () => {
  it('应返回 cursor 的默认路径', () => {
    const p = manager.getSkillsPath('cursor');
    expect(p).toBe(path.join(os.homedir(), '.cursor', 'skills'));
  });

  it('应返回 claude-code 的默认路径', () => {
    const p = manager.getSkillsPath('claude-code');
    expect(p).toBe(path.join(os.homedir(), '.claude', 'skills'));
  });

  it('应返回 agent-skills 的默认路径', () => {
    const p = manager.getSkillsPath('agent-skills');
    expect(p).toBe(path.join(os.homedir(), '.agents', 'skills'));
  });

  it('应返回 opencode 的默认路径', () => {
    const p = manager.getSkillsPath('opencode');
    expect(p).toBe(path.join(os.homedir(), '.config', 'opencode', 'skills'));
  });
});

// ===================== installSkill / uninstallSkill 测试 =====================

describe('installSkill', () => {
  // 用 mock 的 skills 路径来测试
  let originalGetSkillsPath: any;

  beforeEach(() => {
    originalGetSkillsPath = manager.getSkillsPath.bind(manager);
    (manager as any).getSkillsPath = () => testDir;
  });

  afterEach(() => {
    (manager as any).getSkillsPath = originalGetSkillsPath;
  });

  it('应在所有文件下载失败时返回失败并清理目录', async () => {
    // Mock fetchWithRetry 使其总是抛出错误
    (manager as any).fetchWithRetry = vi.fn().mockRejectedValue(new Error('Network error'));

    const sourceInfo: SkillSourceMeta = {
      id: 'test/skill',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: {
        repositoryUrl: 'https://github.com/test/repo',
        branch: 'main',
        skillPath: 'skills/test',
        rawBaseUrl: 'https://raw.githubusercontent.com/test/repo/main/skills/test',
      },
      files: ['SKILL.md', 'README.md'],
    };

    const result = await manager.installSkill('test/skill', sourceInfo, ['cursor']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('All');
    expect(result.error).toContain('failed to download');

    // 验证空目录已被清理
    const dirExists = await fs.access(path.join(testDir, 'skill')).then(() => true).catch(() => false);
    expect(dirExists).toBe(false);
  });

  it('应在部分文件下载成功时返回成功', async () => {
    let callCount = 0;
    (manager as any).fetchWithRetry = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('# Test Skill') });
      }
      return Promise.reject(new Error('Network error'));
    });

    const sourceInfo: SkillSourceMeta = {
      id: 'test/skill',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: {
        repositoryUrl: 'https://github.com/test/repo',
        branch: 'main',
        skillPath: 'skills/test',
        rawBaseUrl: 'https://raw.githubusercontent.com/test/repo/main/skills/test',
      },
      files: ['SKILL.md', 'extra.md'],
    };

    const result = await manager.installSkill('test/skill', sourceInfo, ['cursor']);
    expect(result.success).toBe(true);

    // 验证 SKILL.md 已写入
    const content = await fs.readFile(path.join(testDir, 'skill', 'SKILL.md'), 'utf-8');
    expect(content).toBe('# Test Skill');

    // 验证 .source.json 已写入
    const sourceJson = await fs.readFile(path.join(testDir, 'skill', '.source.json'), 'utf-8');
    const parsed = JSON.parse(sourceJson);
    expect(parsed.id).toBe('test/skill');
    expect(parsed.files).toEqual(['SKILL.md', 'extra.md']);
  });

  it('应在 files 为空时成功（只创建 .source.json）', async () => {
    const sourceInfo: SkillSourceMeta = {
      id: 'test/empty-skill',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: {
        repositoryUrl: 'https://github.com/test/repo',
        branch: 'main',
        skillPath: '',
        rawBaseUrl: 'https://raw.githubusercontent.com/test/repo/main',
      },
      files: [],
    };

    const result = await manager.installSkill('test/empty-skill', sourceInfo, ['cursor']);
    expect(result.success).toBe(true);

    const sourceJson = await fs.readFile(path.join(testDir, 'empty-skill', '.source.json'), 'utf-8');
    expect(JSON.parse(sourceJson).id).toBe('test/empty-skill');
  });
});

describe('uninstallSkill', () => {
  let originalGetSkillsPath: any;

  beforeEach(async () => {
    originalGetSkillsPath = manager.getSkillsPath.bind(manager);
    (manager as any).getSkillsPath = () => testDir;

    // 创建一个 skill 目录
    const skillDir = path.join(testDir, 'test-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test', 'utf-8');
    await fs.writeFile(path.join(skillDir, '.source.json'), '{}', 'utf-8');
  });

  afterEach(() => {
    (manager as any).getSkillsPath = originalGetSkillsPath;
  });

  it('应删除 skill 目录', async () => {
    await manager.uninstallSkill('test-skill', ['cursor']);

    const exists = await fs.access(path.join(testDir, 'test-skill')).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it('应在 skill 不存在时不报错', async () => {
    await expect(manager.uninstallSkill('nonexistent', ['cursor'])).resolves.not.toThrow();
  });
});

// ===================== getInstalledSkills 测试 =====================

describe('getInstalledSkills', () => {
  let originalGetSkillsPath: any;

  beforeEach(async () => {
    originalGetSkillsPath = manager.getSkillsPath.bind(manager);
    (manager as any).getSkillsPath = () => testDir;
  });

  afterEach(() => {
    (manager as any).getSkillsPath = originalGetSkillsPath;
  });

  it('应返回空列表当目录不存在时', async () => {
    (manager as any).getSkillsPath = () => path.join(testDir, 'nonexistent');
    const skills = await manager.getInstalledSkills('cursor');
    expect(skills).toEqual([]);
  });

  it('应只返回包含 SKILL.md 的目录', async () => {
    // 有效 skill
    const validDir = path.join(testDir, 'valid-skill');
    await fs.mkdir(validDir, { recursive: true });
    await fs.writeFile(path.join(validDir, 'SKILL.md'), '# Valid', 'utf-8');

    // 无效 skill（没有 SKILL.md）
    const invalidDir = path.join(testDir, 'invalid-skill');
    await fs.mkdir(invalidDir, { recursive: true });
    await fs.writeFile(path.join(invalidDir, 'README.md'), '# Not a skill', 'utf-8');

    // 文件（不是目录）
    await fs.writeFile(path.join(testDir, 'not-a-dir.txt'), 'text', 'utf-8');

    const skills = await manager.getInstalledSkills('cursor');
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('valid-skill');
  });

  it('应正确读取 .source.json', async () => {
    const skillDir = path.join(testDir, 'sourced-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Sourced', 'utf-8');

    const source: SkillSourceMeta = {
      id: 'owner/repo/sourced-skill',
      installedAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      source: {
        repositoryUrl: 'https://github.com/owner/repo',
        branch: 'main',
        skillPath: 'skills/sourced-skill',
        rawBaseUrl: 'https://raw.githubusercontent.com/owner/repo/main/skills/sourced-skill',
      },
      files: ['SKILL.md'],
    };
    await fs.writeFile(path.join(skillDir, '.source.json'), JSON.stringify(source), 'utf-8');

    const skills = await manager.getInstalledSkills('cursor');
    expect(skills).toHaveLength(1);
    expect(skills[0].source).not.toBeNull();
    expect(skills[0].source!.id).toBe('owner/repo/sourced-skill');
  });

  it('应对手动安装的 skill（无 .source.json）返回 source 为 null', async () => {
    const skillDir = path.join(testDir, 'manual-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Manual', 'utf-8');

    const skills = await manager.getInstalledSkills('cursor');
    expect(skills).toHaveLength(1);
    expect(skills[0].source).toBeNull();
  });
});

// ===================== updateSkill 测试 =====================

describe('updateSkill', () => {
  let originalGetSkillsPath: any;

  beforeEach(async () => {
    originalGetSkillsPath = manager.getSkillsPath.bind(manager);
    (manager as any).getSkillsPath = () => testDir;
  });

  afterEach(() => {
    (manager as any).getSkillsPath = originalGetSkillsPath;
  });

  it('应在 .source.json 不存在时返回失败', async () => {
    const skillDir = path.join(testDir, 'no-source');
    await fs.mkdir(skillDir, { recursive: true });

    const result = await manager.updateSkill('no-source', 'cursor');
    expect(result.updated).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('应在所有文件下载失败时返回失败', async () => {
    const skillDir = path.join(testDir, 'fail-update');
    await fs.mkdir(skillDir, { recursive: true });

    const source: SkillSourceMeta = {
      id: 'test/fail-update',
      installedAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      source: {
        repositoryUrl: 'https://github.com/test/repo',
        branch: 'main',
        skillPath: 'skills/fail-update',
        rawBaseUrl: 'https://raw.githubusercontent.com/test/repo/main/skills/fail-update',
      },
      files: ['SKILL.md'],
    };
    await fs.writeFile(path.join(skillDir, '.source.json'), JSON.stringify(source), 'utf-8');

    (manager as any).fetchWithRetry = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await manager.updateSkill('fail-update', 'cursor');
    expect(result.updated).toBe(false);
    expect(result.error).toContain('All files failed');
  });

  it('应在下载成功时更新时间戳', async () => {
    const skillDir = path.join(testDir, 'good-update');
    await fs.mkdir(skillDir, { recursive: true });

    const source: SkillSourceMeta = {
      id: 'test/good-update',
      installedAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      source: {
        repositoryUrl: 'https://github.com/test/repo',
        branch: 'main',
        skillPath: 'skills/good-update',
        rawBaseUrl: 'https://raw.githubusercontent.com/test/repo/main/skills/good-update',
      },
      files: ['SKILL.md'],
    };
    await fs.writeFile(path.join(skillDir, '.source.json'), JSON.stringify(source), 'utf-8');

    (manager as any).fetchWithRetry = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Updated'),
    });

    const result = await manager.updateSkill('good-update', 'cursor');
    expect(result.updated).toBe(true);

    const updatedSource = JSON.parse(await fs.readFile(path.join(skillDir, '.source.json'), 'utf-8'));
    expect(updatedSource.updatedAt).not.toBe('2025-01-01T00:00:00.000Z');

    const content = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8');
    expect(content).toBe('# Updated');
  });
});

// ===================== getLocalSkillDetail 测试 =====================

describe('getLocalSkillDetail', () => {
  let originalGetSkillsPath: any;

  beforeEach(async () => {
    originalGetSkillsPath = manager.getSkillsPath.bind(manager);
    (manager as any).getSkillsPath = () => testDir;
  });

  afterEach(() => {
    (manager as any).getSkillsPath = originalGetSkillsPath;
  });

  it('应在 skill 不存在时返回 null', async () => {
    const result = await manager.getLocalSkillDetail('nonexistent');
    expect(result).toBeNull();
  });

  it('应返回本地 skill 的完整详情', async () => {
    const skillDir = path.join(testDir, 'detail-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Detail Test\nThis is a test skill.', 'utf-8');

    const source: SkillSourceMeta = {
      id: 'owner/repo/detail-skill',
      installedAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2025-06-01T00:00:00.000Z',
      source: {
        repositoryUrl: 'https://github.com/owner/repo',
        branch: 'main',
        skillPath: 'skills/detail-skill',
        rawBaseUrl: 'https://raw.githubusercontent.com/owner/repo/main/skills/detail-skill',
      },
      files: ['SKILL.md'],
    };
    await fs.writeFile(path.join(skillDir, '.source.json'), JSON.stringify(source), 'utf-8');

    const result = await manager.getLocalSkillDetail('owner/repo/detail-skill');
    expect(result).not.toBeNull();
    expect(result!.found).toBe(true);
    expect(result!.name).toBe('detail-skill');
    expect(result!.skillMdContent).toContain('Detail Test');
    expect(result!.source).not.toBeNull();
    expect(result!.source!.id).toBe('owner/repo/detail-skill');
    expect(result!.files).toContain('SKILL.md');
    expect(result!.files).not.toContain('.source.json');
  });
});

// ===================== isSkillInstalled 测试 =====================

describe('isSkillInstalled', () => {
  let originalGetSkillsPath: any;

  beforeEach(async () => {
    originalGetSkillsPath = manager.getSkillsPath.bind(manager);
    (manager as any).getSkillsPath = () => testDir;
  });

  afterEach(() => {
    (manager as any).getSkillsPath = originalGetSkillsPath;
  });

  it('应在 skill 存在时返回 true', async () => {
    const skillDir = path.join(testDir, 'existing-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Exists', 'utf-8');

    const result = await manager.isSkillInstalled('owner/repo/existing-skill');
    expect(result).toBe(true);
  });

  it('应在 skill 不存在时返回 false', async () => {
    const result = await manager.isSkillInstalled('owner/repo/nonexistent');
    expect(result).toBe(false);
  });
});

// ===================== installFromDiscovered 测试 =====================

describe('installFromDiscovered', () => {
  let originalGetSkillsPath: any;

  beforeEach(async () => {
    originalGetSkillsPath = manager.getSkillsPath.bind(manager);
    (manager as any).getSkillsPath = () => testDir;
  });

  afterEach(() => {
    (manager as any).getSkillsPath = originalGetSkillsPath;
  });

  it('应在 files 为空时调用 listDirFiles 获取文件列表', async () => {
    const listDirFilesSpy = vi.fn().mockResolvedValue([
      { name: 'SKILL.md', path: 'skills/test/SKILL.md', rawUrl: 'https://raw.githubusercontent.com/owner/repo/main/skills/test/SKILL.md' },
    ]);
    (manager as any).listDirFiles = listDirFilesSpy;

    (manager as any).fetchWithRetry = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Discovered Skill'),
    });

    const skill: DiscoveredSkill = {
      name: 'test',
      path: 'skills/test',
      skillMdUrl: 'https://raw.githubusercontent.com/owner/repo/main/skills/test/SKILL.md',
      skillMdContent: '# Test',
      files: [],
      repository: { url: 'https://github.com/owner/repo', branch: 'main', owner: 'owner', repo: 'repo' },
    };

    const result = await manager.installFromDiscovered(skill, ['cursor']);
    expect(result.success).toBe(true);
    expect(listDirFilesSpy).toHaveBeenCalledWith('owner', 'repo', 'main', 'skills/test');
  });

  it('应在 files 非空时直接使用', async () => {
    const listDirFilesSpy = vi.fn();
    (manager as any).listDirFiles = listDirFilesSpy;

    (manager as any).fetchWithRetry = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Skill Content'),
    });

    const skill: DiscoveredSkill = {
      name: 'test',
      path: 'skills/test',
      skillMdUrl: '',
      skillMdContent: '',
      files: [{ name: 'SKILL.md', path: 'skills/test/SKILL.md', rawUrl: '' }],
      repository: { url: 'https://github.com/owner/repo', branch: 'main', owner: 'owner', repo: 'repo' },
    };

    const result = await manager.installFromDiscovered(skill, ['cursor']);
    expect(result.success).toBe(true);
    expect(listDirFilesSpy).not.toHaveBeenCalled();
  });

  it('应正确处理根目录 skill（path 为空）', async () => {
    (manager as any).listDirFiles = vi.fn().mockResolvedValue([
      { name: 'SKILL.md', path: 'SKILL.md', rawUrl: '' },
    ]);

    (manager as any).fetchWithRetry = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Root Skill'),
    });

    const skill: DiscoveredSkill = {
      name: 'repo',
      path: '',
      skillMdUrl: '',
      skillMdContent: '',
      files: [],
      repository: { url: 'https://github.com/owner/repo', branch: 'main', owner: 'owner', repo: 'repo' },
    };

    const result = await manager.installFromDiscovered(skill, ['cursor']);
    expect(result.success).toBe(true);
  });
});

// ===================== fetchWithRetry 测试 =====================

describe('fetchWithRetry', () => {
  it('应在首次成功时直接返回', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    (manager as any).fetchWithTimeout = mockFetch;

    const result = await (manager as any).fetchWithRetry('https://example.com');
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('应在失败后重试', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ ok: true });
    (manager as any).fetchWithTimeout = mockFetch;

    const result = await (manager as any).fetchWithRetry('https://example.com', 3, 10);
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('应在所有重试都失败后抛出最后的错误', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Persistent failure'));
    (manager as any).fetchWithTimeout = mockFetch;

    await expect((manager as any).fetchWithRetry('https://example.com', 3, 10))
      .rejects.toThrow('Persistent failure');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
