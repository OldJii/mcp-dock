/**
 * Skills 管理器
 * 负责管理 Cursor, Claude Code, Gemini CLI, Codex CLI 的 Skills
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SkillClientType, SKILL_SUPPORTED_CLIENTS } from './config-manager';

// GitHub 仓库中发现的 Skill 信息
export interface DiscoveredSkill {
  name: string;
  path: string;
  skillMdUrl: string;
  skillMdContent: string;
  files: Array<{ name: string; path: string; rawUrl: string }>;
  repository: {
    url: string;
    branch: string;
    owner: string;
    repo: string;
  };
}

// Import 解析结果
export interface ImportParseResult {
  success: boolean;
  skills: DiscoveredSkill[];
  error?: string;
}

// Skills 来源元数据
export interface SkillSourceMeta {
  id: string;
  installedAt: string;
  updatedAt: string;
  source: {
    repositoryUrl: string;
    branch: string;
    skillPath: string;
    rawBaseUrl: string;
  };
  files: string[];
}

// 已安装的 Skill 信息
export interface InstalledSkill {
  name: string;
  path: string;
  source: SkillSourceMeta | null;
  hasUpdate?: boolean;
}

// Skills 安装结果
export interface SkillInstallResult {
  success: boolean;
  error?: string;
}

// 用户设置
interface SkillsSettings {
  customSkillsPaths?: Partial<Record<SkillClientType, string>>;
}

export class SkillsManager {
  private defaultSkillsPaths: Record<SkillClientType, string>;
  private settingsPath: string;
  private settings: SkillsSettings = {};

  constructor() {
    const home = os.homedir();
    const platform = process.platform;

    this.settingsPath = path.join(home, '.mcp-dock', 'settings.json');

    // Skills 目录路径（跨平台一致）
    this.defaultSkillsPaths = {
      cursor: path.join(home, '.cursor', 'skills'),
      'claude-code': path.join(home, '.claude', 'skills'),
      'gemini-cli': path.join(home, '.gemini', 'skills'),
      'codex-cli': path.join(home, '.codex', 'skills'),
      opencode: path.join(home, '.config', 'opencode', 'skills'),
      'agent-skills': path.join(home, '.agents', 'skills'),
    };

    this.loadSettings();
  }

  /**
   * 加载用户设置
   */
  private async loadSettings(): Promise<void> {
    try {
      const content = await fs.readFile(this.settingsPath, 'utf-8');
      const allSettings = JSON.parse(content);
      this.settings = {
        customSkillsPaths: allSettings.customSkillsPaths,
      };
    } catch {
      this.settings = {};
    }
  }

  /**
   * 获取 Skills 目录路径
   */
  getSkillsPath(client: SkillClientType): string {
    return this.settings.customSkillsPaths?.[client] || this.defaultSkillsPaths[client];
  }

  /**
   * 确保 Skills 目录存在
   */
  private async ensureSkillsDir(client: SkillClientType): Promise<void> {
    const skillsPath = this.getSkillsPath(client);
    await fs.mkdir(skillsPath, { recursive: true });
  }

  /**
   * 获取已安装的 Skills 列表
   */
  async getInstalledSkills(client: SkillClientType): Promise<InstalledSkill[]> {
    await this.loadSettings();
    const skillsPath = this.getSkillsPath(client);
    const skills: InstalledSkill[] = [];

    try {
      const entries = await fs.readdir(skillsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillPath = path.join(skillsPath, entry.name);
          const sourcePath = path.join(skillPath, '.source.json');
          
          let source: SkillSourceMeta | null = null;
          
          try {
            const sourceContent = await fs.readFile(sourcePath, 'utf-8');
            source = JSON.parse(sourceContent);
          } catch {
            // .source.json 不存在，说明是手动安装的
          }

          // 检查是否有 SKILL.md
          const skillMdPath = path.join(skillPath, 'SKILL.md');
          try {
            await fs.access(skillMdPath);
            skills.push({
              name: entry.name,
              path: skillPath,
              source,
            });
          } catch {
            // 没有 SKILL.md，不是有效的 Skill
          }
        }
      }
    } catch {
      // 目录不存在或无法读取
    }

    return skills;
  }

  /**
   * 安装 Skill
   */
  private async fetchWithRetry(
    url: string,
    maxRetries = 3,
    delayMs = 1000
  ): Promise<Response> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await this.fetchWithTimeout(url, {
          headers: { 'User-Agent': 'MCP-Dock' },
        });
        return res;
      } catch (err) {
        lastError = err as Error;
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }

  async installSkill(
    skillId: string,
    sourceInfo: SkillSourceMeta,
    clients: SkillClientType[]
  ): Promise<SkillInstallResult> {
    await this.loadSettings();
    const skillName = skillId.split('/').pop() || skillId;

    for (const client of clients) {
      try {
        await this.ensureSkillsDir(client);
        const skillPath = path.join(this.getSkillsPath(client), skillName);

        await fs.mkdir(skillPath, { recursive: true });

        let downloadedCount = 0;
        const failedFiles: string[] = [];

        for (const file of sourceInfo.files) {
          const fileUrl = `${sourceInfo.source.rawBaseUrl}/${file}`;
          const filePath = path.join(skillPath, file);

          await fs.mkdir(path.dirname(filePath), { recursive: true });

          try {
            const response = await this.fetchWithRetry(fileUrl);
            if (response.ok) {
              const content = await response.text();
              await fs.writeFile(filePath, content, 'utf-8');
              downloadedCount++;
            } else {
              console.error(`[SkillsManager] HTTP ${response.status} for ${file}`);
              failedFiles.push(file);
            }
          } catch (error) {
            console.error(`[SkillsManager] Failed to download ${file} after retries:`, error);
            failedFiles.push(file);
          }
        }

        if (sourceInfo.files.length > 0 && downloadedCount === 0) {
          await fs.rm(skillPath, { recursive: true, force: true });
          return {
            success: false,
            error: `All ${sourceInfo.files.length} files failed to download (network issue). Please check your network and try again.`,
          };
        }

        const sourceMeta: SkillSourceMeta = {
          ...sourceInfo,
          installedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await fs.writeFile(
          path.join(skillPath, '.source.json'),
          JSON.stringify(sourceMeta, null, 2),
          'utf-8'
        );

        console.log(
          `[SkillsManager] Installed skill ${skillName} to ${client}` +
          ` (${downloadedCount}/${sourceInfo.files.length} files` +
          `${failedFiles.length > 0 ? `, failed: ${failedFiles.join(', ')}` : ''})`
        );
      } catch (error) {
        console.error(`[SkillsManager] Failed to install skill to ${client}:`, error);
        return { success: false, error: (error as Error).message };
      }
    }

    return { success: true };
  }

  /**
   * 卸载 Skill
   */
  async uninstallSkill(skillName: string, clients: SkillClientType[]): Promise<void> {
    await this.loadSettings();
    for (const client of clients) {
      try {
        const skillPath = path.join(this.getSkillsPath(client), skillName);
        await fs.rm(skillPath, { recursive: true, force: true });
        console.log(`[SkillsManager] Uninstalled skill ${skillName} from ${client}`);
      } catch (error) {
        console.error(`[SkillsManager] Failed to uninstall skill from ${client}:`, error);
      }
    }
  }

  /**
   * 更新单个 Skill
   */
  async updateSkill(skillName: string, client: SkillClientType): Promise<{ updated: boolean; error?: string }> {
    await this.loadSettings();
    const skillPath = path.join(this.getSkillsPath(client), skillName);
    const sourcePath = path.join(skillPath, '.source.json');

    try {
      // 读取来源信息
      const sourceContent = await fs.readFile(sourcePath, 'utf-8');
      const source: SkillSourceMeta = JSON.parse(sourceContent);

      let downloadedCount = 0;
      for (const file of source.files) {
        const fileUrl = `${source.source.rawBaseUrl}/${file}`;
        const filePath = path.join(skillPath, file);

        try {
          const response = await this.fetchWithRetry(fileUrl);
          if (response.ok) {
            const content = await response.text();
            await fs.writeFile(filePath, content, 'utf-8');
            downloadedCount++;
          }
        } catch (error) {
          console.error(`[SkillsManager] Failed to update file ${file} after retries:`, error);
        }
      }

      if (source.files.length > 0 && downloadedCount === 0) {
        return { updated: false, error: 'All files failed to download. Please check your network.' };
      }

      // 更新时间戳
      source.updatedAt = new Date().toISOString();
      await fs.writeFile(sourcePath, JSON.stringify(source, null, 2), 'utf-8');

      return { updated: true };
    } catch (error) {
      return { updated: false, error: (error as Error).message };
    }
  }

  /**
   * 批量更新所有 Skills
   */
  async updateAllSkills(client: SkillClientType): Promise<{ updated: number; failed: number }> {
    const skills = await this.getInstalledSkills(client);
    let updated = 0;
    let failed = 0;

    for (const skill of skills) {
      if (skill.source) {
        const result = await this.updateSkill(skill.name, client);
        if (result.updated) {
          updated++;
        } else {
          failed++;
        }
      }
    }

    return { updated, failed };
  }

  /**
   * 检查 Skill 是否已安装（在任意支持的客户端）
   */
  async isSkillInstalled(skillId: string): Promise<boolean> {
    const skillName = skillId.split('/').pop() || skillId;

    for (const client of SKILL_SUPPORTED_CLIENTS) {
      const skills = await this.getInstalledSkills(client);
      if (skills.some(s => s.name === skillName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 解析 GitHub URL，提取仓库信息
   */
  private parseGitHubUrl(url: string): { owner: string; repo: string; branch?: string; subPath?: string } | null {
    // 清理空白字符（包括不可见的 Unicode 空格）和尾部斜杠
    const cleaned = url.trim().replace(/[\s\u200B-\u200D\uFEFF]/g, '').replace(/\/+$/, '');

    // owner/repo 简写
    const shortMatch = cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (shortMatch) {
      return { owner: shortMatch[1], repo: shortMatch[2] };
    }

    // GitHub URL: /tree/branch/path
    const treeMatch = cleaned.match(
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/tree\/([^\/]+)(?:\/(.+))?$/
    );
    if (treeMatch) {
      return {
        owner: treeMatch[1],
        repo: treeMatch[2],
        branch: treeMatch[3],
        subPath: treeMatch[4] || undefined,
      };
    }

    // GitHub URL: 基础格式（可能带 /blob/、/issues 等尾部，只提取 owner/repo）
    const baseMatch = cleaned.match(
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/
    );
    if (baseMatch) {
      return {
        owner: baseMatch[1],
        repo: baseMatch[2].replace(/\.git$/, ''),
      };
    }

    // raw.githubusercontent.com URL
    const rawMatch = cleaned.match(
      /^https?:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\/(.+)$/
    );
    if (rawMatch) {
      const filePath = rawMatch[4];
      const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : undefined;
      return {
        owner: rawMatch[1],
        repo: rawMatch[2],
        branch: rawMatch[3],
        subPath: dir,
      };
    }

    return null;
  }

  private static readonly GITHUB_HEADERS = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'MCP-Dock',
  };

  private static readonly REQUEST_TIMEOUT_MS = 15000;

  /**
   * 带超时的 fetch 封装
   */
  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SkillsManager.REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * GitHub API 请求封装（含错误处理）
   */
  private async githubFetch(url: string): Promise<any> {
    const res = await this.fetchWithTimeout(url, { headers: SkillsManager.GITHUB_HEADERS });
    if (res.status === 403) {
      const body: any = await res.json().catch(() => ({}));
      if (body.message?.includes('rate limit')) {
        throw new Error('GitHub API rate limit exceeded. Please try again later or use a more specific URL (e.g. with /tree/main/skills)');
      }
      throw new Error('GitHub API access denied (403). The repository may be private');
    }
    if (res.status === 404) {
      throw new Error('Repository not found. Please check the URL');
    }
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status}`);
    }
    return res.json();
  }

  /**
   * 通过 GitHub API 获取仓库默认分支，API 不可用时 fallback 到 HTML 解析
   */
  private async getDefaultBranch(owner: string, repo: string): Promise<string> {
    try {
      const data = await this.githubFetch(`https://api.github.com/repos/${owner}/${repo}`);
      return data.default_branch || 'main';
    } catch {
      try {
        const res = await this.fetchWithTimeout(`https://github.com/${owner}/${repo}`, {
          headers: { 'User-Agent': 'MCP-Dock' },
          redirect: 'follow',
        });
        if (res.ok) {
          const html = await res.text();
          const match = html.match(/default-branch="([^"]+)"/);
          if (match) return match[1];
        }
      } catch { /* ignore */ }
      return 'main';
    }
  }

  /**
   * 使用 Contents API 列出目录内容
   */
  private async listDirContents(
    owner: string, repo: string, branch: string, dirPath: string
  ): Promise<any[]> {
    const apiPath = dirPath ? `contents/${dirPath}` : 'contents';
    const data = await this.githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/${apiPath}?ref=${branch}`
    );
    return Array.isArray(data) ? data : [];
  }

  /**
   * 通过 GitHub HTML 页面解析目录中的子目录名（不消耗 API 配额）
   */
  private async listSubdirsViaHtml(
    owner: string, repo: string, branch: string, dirPath: string
  ): Promise<string[]> {
    const pageUrl = `https://github.com/${owner}/${repo}/tree/${branch}/${dirPath}`;
    const res = await this.fetchWithTimeout(pageUrl, {
      headers: { 'User-Agent': 'MCP-Dock' },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const prefix = `/${owner}/${repo}/tree/${branch}/${dirPath}/`;
    const regex = new RegExp(`href="${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^"/]+)"`, 'g');
    const dirs = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = regex.exec(html)) !== null) {
      dirs.add(m[1]);
    }
    return [...dirs];
  }

  /**
   * 扫描目录下的子目录，找出包含 SKILL.md 的（HEAD 到 raw.githubusercontent.com 不消耗 API 配额）
   */
  private async probeSkillMdInSubdirs(
    owner: string, repo: string, branch: string, parentPath: string, subdirNames: string[]
  ): Promise<string[]> {
    const BATCH_SIZE = 10;
    const found: string[] = [];

    for (let i = 0; i < subdirNames.length; i += BATCH_SIZE) {
      const batch = subdirNames.slice(i, i + BATCH_SIZE);
      const checks = batch.map(async (name) => {
        const fullPath = parentPath ? `${parentPath}/${name}` : name;
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fullPath}/SKILL.md`;
        try {
          const res = await this.fetchWithTimeout(rawUrl, { method: 'HEAD' });
          return res.ok ? fullPath : null;
        } catch {
          return null;
        }
      });
      const results = await Promise.all(checks);
      for (const r of results) {
        if (r) found.push(r);
      }
    }

    return found;
  }

  /**
   * 通过 Contents API 扫描目录，找出包含 SKILL.md 的子目录
   * 如果 API 不可用，fallback 到 HTML 页面解析
   */
  private async findSkillDirsViaContents(
    owner: string, repo: string, branch: string, dirPath: string
  ): Promise<string[]> {
    let subdirNames: string[] = [];
    let hasDirectSkillMd = false;

    try {
      const items = await this.listDirContents(owner, repo, branch, dirPath);
      hasDirectSkillMd = items.some((f: any) => f.type === 'file' && f.name === 'SKILL.md');
      if (hasDirectSkillMd) return [dirPath];
      subdirNames = items.filter((f: any) => f.type === 'dir').map((f: any) => f.name as string);
    } catch {
      subdirNames = await this.listSubdirsViaHtml(owner, repo, branch, dirPath);
    }

    if (subdirNames.length === 0) {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dirPath}/SKILL.md`;
      try {
        const res = await this.fetchWithTimeout(rawUrl, { method: 'HEAD' });
        if (res.ok) return [dirPath];
      } catch { /* ignore */ }
      return [];
    }

    return this.probeSkillMdInSubdirs(owner, repo, branch, dirPath, subdirNames);
  }

  /**
   * 使用 GitHub Search API 查找 SKILL.md 文件
   */
  private async searchSkillFiles(owner: string, repo: string, dirPath: string): Promise<string[]> {
    const pathQualifier = dirPath ? `+path:${dirPath}` : '';
    const query = encodeURIComponent(`filename:SKILL.md repo:${owner}/${repo}${pathQualifier}`);
    const url = `https://api.github.com/search/code?q=${query}&per_page=100`;

    const data = await this.githubFetch(url);
    const skillDirs = new Set<string>();
    for (const item of (data.items || []) as any[]) {
      const p: string = item.path;
      if (p.endsWith('/SKILL.md') || p === 'SKILL.md') {
        const dir = p.lastIndexOf('/') >= 0 ? p.substring(0, p.lastIndexOf('/')) : '';
        if (!dirPath || dir === dirPath || dir.startsWith(dirPath + '/')) {
          skillDirs.add(dir);
        }
      }
    }
    return [...skillDirs];
  }

  /**
   * 使用 Git Trees API 递归扫描（仅适用于中小仓库）
   */
  private async findSkillDirsViaTree(owner: string, repo: string, branch: string, dirPath: string): Promise<string[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const data = await this.githubFetch(url);

    if (data.truncated) return [];

    const skillDirs = new Set<string>();
    const prefix = dirPath ? `${dirPath}/` : '';

    for (const item of (data.tree || []) as any[]) {
      if (item.type !== 'blob') continue;
      const p: string = item.path;
      if (dirPath && !p.startsWith(prefix)) continue;
      if (p.endsWith('/SKILL.md') || p === 'SKILL.md') {
        const dir = p.lastIndexOf('/') >= 0 ? p.substring(0, p.lastIndexOf('/')) : '';
        skillDirs.add(dir);
      }
    }

    return [...skillDirs];
  }

  /**
   * 查找 SKILL.md 所在目录（多策略自动降级）
   *
   * 场景覆盖：
   *   - 小仓库根目录有 SKILL.md
   *   - 仓库 skills/ 下有多个子目录各含 SKILL.md
   *   - 大仓库（tree API truncated）需要 Contents API 或 Search API
   *   - 用户指定了具体子路径
   */
  private async findSkillDirs(owner: string, repo: string, branch: string, dirPath: string): Promise<string[]> {
    // 策略 1: 如果指定了子路径，用 Contents API（含 HTML fallback）扫描该目录及其子目录
    if (dirPath) {
      try {
        const dirs = await this.findSkillDirsViaContents(owner, repo, branch, dirPath);
        if (dirs.length > 0) return dirs;
      } catch { /* continue */ }
    }

    // 策略 2: 尝试 Git Trees API（中小仓库，一次请求拿到全部文件树）
    try {
      const dirs = await this.findSkillDirsViaTree(owner, repo, branch, dirPath);
      if (dirs.length > 0) return dirs;
    } catch { /* fallback */ }

    // 策略 3: Search API（大仓库 fallback）
    try {
      const dirs = await this.searchSkillFiles(owner, repo, dirPath);
      if (dirs.length > 0) return dirs;
    } catch { /* continue */ }

    // 策略 4: 未指定子路径时，探测常见 skills 目录结构（含 HTML fallback）
    if (!dirPath) {
      const commonParents = ['skills', '.cursor/skills', '.agents/skills', '.claude/skills'];
      for (const parent of commonParents) {
        try {
          const dirs = await this.findSkillDirsViaContents(owner, repo, branch, parent);
          if (dirs.length > 0) return dirs;
        } catch { /* continue */ }
      }

      // 最后检查根目录 SKILL.md
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/SKILL.md`;
        const res = await this.fetchWithTimeout(rawUrl, { method: 'HEAD' });
        if (res.ok) return [''];
      } catch { /* ignore */ }
    }

    return [];
  }

  /**
   * 获取指定目录下的所有文件（Contents API → HTML fallback）
   */
  private async listDirFiles(
    owner: string, repo: string, branch: string, dirPath: string
  ): Promise<Array<{ name: string; path: string; rawUrl: string }>> {
    const makeEntry = (name: string) => {
      const fullPath = dirPath ? `${dirPath}/${name}` : name;
      return {
        name,
        path: fullPath,
        rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${fullPath}`,
      };
    };

    // 策略 1: Contents API
    try {
      const items = await this.listDirContents(owner, repo, branch, dirPath);
      const files = items
        .filter((f: any) => f.type === 'file')
        .map((f: any) => ({
          name: f.name as string,
          path: f.path as string,
          rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`,
        }));
      if (files.length > 0) return files;
    } catch { /* fallback */ }

    // 策略 2: HTML 页面解析文件名
    try {
      const pageUrl = `https://github.com/${owner}/${repo}/tree/${branch}/${dirPath}`;
      const res = await this.fetchWithTimeout(pageUrl, {
        headers: { 'User-Agent': 'MCP-Dock' },
      });
      if (res.ok) {
        const html = await res.text();
        const prefix = `/${owner}/${repo}/blob/${branch}/${dirPath}/`;
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`href="${escapedPrefix}([^"/]+)"`, 'g');
        const fileNames = new Set<string>();
        let m: RegExpExecArray | null;
        while ((m = regex.exec(html)) !== null) {
          fileNames.add(m[1]);
        }
        if (fileNames.size > 0) {
          return [...fileNames].map(makeEntry);
        }
      }
    } catch { /* fallback */ }

    // 策略 3: 至少尝试获取 SKILL.md
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dirPath ? dirPath + '/' : ''}SKILL.md`;
      const res = await this.fetchWithTimeout(rawUrl, { method: 'HEAD' });
      if (res.ok) {
        return [makeEntry('SKILL.md')];
      }
    } catch { /* ignore */ }

    return [];
  }

  /**
   * 从 GitHub URL 解析并发现 Skills
   */
  async parseImportUrl(url: string): Promise<ImportParseResult> {
    const parsed = this.parseGitHubUrl(url);
    if (!parsed) {
      return { success: false, skills: [], error: 'Invalid GitHub URL. Supported formats: https://github.com/owner/repo, owner/repo' };
    }

    const { owner, repo } = parsed;

    try {
      const branch = parsed.branch || await this.getDefaultBranch(owner, repo);
      const searchPath = parsed.subPath || '';

      const skillDirs = await this.findSkillDirs(owner, repo, branch, searchPath);

      if (skillDirs.length === 0) {
        return { success: false, skills: [], error: 'No SKILL.md found in this repository' };
      }

      const skills: DiscoveredSkill[] = [];
      const MD_BATCH = 5;

      for (let i = 0; i < skillDirs.length; i += MD_BATCH) {
        const batch = skillDirs.slice(i, i + MD_BATCH);
        const fetches = batch.map(async (dir) => {
          const skillMdPath = dir ? `${dir}/SKILL.md` : 'SKILL.md';
          const skillMdUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillMdPath}`;

          let skillMdContent = '';
          try {
            const mdRes = await this.fetchWithTimeout(skillMdUrl);
            if (mdRes.ok) skillMdContent = await mdRes.text();
          } catch { /* ignore */ }

          const skillName = dir ? dir.split('/').pop() || repo : repo;

          return {
            name: skillName,
            path: dir,
            skillMdUrl,
            skillMdContent,
            files: [],
            repository: { url: `https://github.com/${owner}/${repo}`, branch, owner, repo },
          } as DiscoveredSkill;
        });
        const results = await Promise.all(fetches);
        skills.push(...results);
      }

      return { success: true, skills };
    } catch (error) {
      const msg = (error as Error).message || 'Unknown error';
      if ((error as Error).name === 'AbortError' || msg.includes('abort')) {
        return { success: false, skills: [], error: 'Request timed out. The repository may be too large. Try using a more specific URL (e.g. https://github.com/owner/repo/tree/main/skills)' };
      }
      return { success: false, skills: [], error: msg };
    }
  }

  /**
   * 从发现的 Skill 安装到指定客户端
   */
  async installFromDiscovered(
    skill: DiscoveredSkill,
    clients: SkillClientType[]
  ): Promise<SkillInstallResult> {
    const { owner, repo, branch } = skill.repository;
    const skillId = `${owner}/${skill.path ? `${repo}/${skill.name}` : repo}`;
    const rawBaseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}${skill.path ? `/${skill.path}` : ''}`;

    let fileNames = skill.files.map(f => f.name);
    if (fileNames.length === 0) {
      const files = await this.listDirFiles(owner, repo, branch, skill.path || '');
      fileNames = files.map(f => f.name);
    }

    const sourceInfo: SkillSourceMeta = {
      id: skillId,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: {
        repositoryUrl: skill.repository.url,
        branch,
        skillPath: skill.path,
        rawBaseUrl,
      },
      files: fileNames,
    };

    return this.installSkill(skillId, sourceInfo, clients);
  }

  /**
   * 获取所有客户端的已安装 Skills
   */
  async getAllInstalledSkills(): Promise<{
    skills: Record<string, { name: string; clients: SkillClientType[] }>;
    byClient: Record<SkillClientType, InstalledSkill[]>;
  }> {
    const skills: Record<string, { name: string; clients: SkillClientType[] }> = {};
    const byClient: Record<SkillClientType, InstalledSkill[]> = {
      cursor: [],
      'claude-code': [],
      'gemini-cli': [],
      'codex-cli': [],
      opencode: [],
      'agent-skills': [],
    };

    for (const client of SKILL_SUPPORTED_CLIENTS) {
      const clientSkills = await this.getInstalledSkills(client);
      byClient[client] = clientSkills;

      for (const skill of clientSkills) {
        if (skills[skill.name]) {
          skills[skill.name].clients.push(client);
        } else {
          skills[skill.name] = { name: skill.name, clients: [client] };
        }
      }
    }

    return { skills, byClient };
  }

  /**
   * 获取本地已安装 Skill 的详情（用于详情页 fallback）
   */
  async getLocalSkillDetail(skillId: string): Promise<{
    found: boolean;
    name: string;
    skillMdContent: string;
    source: SkillSourceMeta | null;
    files: string[];
    clients: SkillClientType[];
  } | null> {
    await this.loadSettings();

    const skillName = skillId.split('/').pop() || skillId;
    const foundClients: SkillClientType[] = [];
    let bestSource: SkillSourceMeta | null = null;
    let skillMdContent = '';
    let fileList: string[] = [];

    for (const client of SKILL_SUPPORTED_CLIENTS) {
      const skillPath = path.join(this.getSkillsPath(client), skillName);
      try {
        await fs.access(skillPath);
      } catch {
        continue;
      }

      foundClients.push(client);

      if (!bestSource) {
        const sourcePath = path.join(skillPath, '.source.json');
        try {
          const content = await fs.readFile(sourcePath, 'utf-8');
          bestSource = JSON.parse(content);
        } catch { /* no source */ }
      }

      if (!skillMdContent) {
        try {
          skillMdContent = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
        } catch { /* no SKILL.md */ }
      }

      if (fileList.length === 0) {
        try {
          const entries = await fs.readdir(skillPath);
          fileList = entries.filter(e => e !== '.source.json');
        } catch { /* ignore */ }
      }
    }

    if (foundClients.length === 0) return null;

    return {
      found: true,
      name: skillName,
      skillMdContent,
      source: bestSource,
      files: fileList,
      clients: foundClients,
    };
  }
}
