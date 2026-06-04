/**
 * 配置管理器
 * 负责读写多个 MCP 客户端的配置文件
 * 支持: Cursor, VS Code, Claude Code, Gemini CLI, Codex CLI, Windsurf, Zed, TRAE, Opencode
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import * as jsonc from 'jsonc-parser';
import * as TOML from 'smol-toml';

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  type?: 'stdio' | 'http' | 'streamable-http' | 'sse';
  headers?: Record<string, string>;
}

export interface ClientConfig {
  mcpServers?: Record<string, McpServerConfig>;
  [key: string]: any;
}

// 所有 MCP 客户端类型
export type ClientType = 'cursor' | 'vscode' | 'claude-code' | 'gemini-cli' | 'codex-cli' | 'windsurf' | 'zed' | 'trae' | 'trae-cn' | 'kiro' | 'opencode' | 'jetbrains' | 'antigravity' | 'openclaw';

// 支持 Skills 的客户端类型（含 .agents 统一标准）
export type SkillClientType = 'cursor' | 'claude-code' | 'gemini-cli' | 'codex-cli' | 'opencode' | 'agent-skills';

// 客户端是否支持 Skills
export const SKILL_SUPPORTED_CLIENTS: SkillClientType[] = ['cursor', 'claude-code', 'gemini-cli', 'codex-cli', 'opencode', 'agent-skills'];

// VS Code 使用 "servers" 键而非 "mcpServers"
const SERVERS_KEY_CLIENTS: ClientType[] = ['vscode'];

export interface ClientInfo {
  id: ClientType;
  name: string;
  installed: boolean;
  configPath: string;
  configExists: boolean;
  supportsSkills: boolean;
  skillsPath?: string;
}

// 用户自定义配置路径存储
interface UserSettings {
  customConfigPaths?: Partial<Record<ClientType, string>>;
  customSkillsPaths?: Partial<Record<SkillClientType, string>>;
}

export class ConfigManager {
  private defaultClientPaths: Record<ClientType, string>;
  private defaultSkillsPaths: Record<SkillClientType, string>;
  private userSettingsPath: string;
  private userSettings: UserSettings = {};

  constructor() {
    const home = os.homedir();
    const platform = process.platform;

    // 用户设置文件路径
    this.userSettingsPath = path.join(home, '.mcp-dock', 'settings.json');

    // 根据平台设置各客户端默认配置路径
    // 参考: https://modelcontextprotocol.io/docs/configuration
    if (platform === 'darwin') {
      // macOS 路径配置
      this.defaultClientPaths = {
        cursor: path.join(home, '.cursor', 'mcp.json'),
        vscode: path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'),
        'claude-code': path.join(home, '.claude.json'),
        'gemini-cli': path.join(home, '.gemini', 'settings.json'),
        'codex-cli': path.join(home, '.codex', 'config.toml'),
        windsurf: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
        zed: path.join(home, '.config', 'zed', 'settings.json'),
        trae: path.join(home, 'Library', 'Application Support', 'Trae', 'User', 'mcp.json'),
        'trae-cn': path.join(home, 'Library', 'Application Support', 'Trae CN', 'User', 'mcp.json'),
        kiro: path.join(home, '.kiro', 'settings', 'mcp.json'),
        opencode: path.join(home, '.config', 'opencode', 'opencode.json'),
        jetbrains: '', // resolved dynamically via findJetBrainsConfigPath
        antigravity: path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
        openclaw: path.join(home, '.openclaw', 'openclaw.json'),
      };
      // Skills 目录路径
      this.defaultSkillsPaths = {
        cursor: path.join(home, '.cursor', 'skills'),
        'claude-code': path.join(home, '.claude', 'skills'),
        'gemini-cli': path.join(home, '.gemini', 'skills'),
        'codex-cli': path.join(home, '.codex', 'skills'),
        opencode: path.join(home, '.config', 'opencode', 'skills'),
        'agent-skills': path.join(home, '.agents', 'skills'),
      };
    } else if (platform === 'win32') {
      // Windows 路径配置
      this.defaultClientPaths = {
        cursor: path.join(home, 'AppData', 'Roaming', 'Cursor', 'mcp.json'),
        vscode: path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'mcp.json'),
        'claude-code': path.join(home, '.claude.json'),
        'gemini-cli': path.join(home, '.gemini', 'settings.json'),
        'codex-cli': path.join(home, '.codex', 'config.toml'),
        windsurf: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
        zed: path.join(home, 'AppData', 'Roaming', 'Zed', 'settings.json'),
        trae: path.join(home, 'AppData', 'Roaming', 'Trae', 'User', 'mcp.json'),
        'trae-cn': path.join(home, 'AppData', 'Roaming', 'Trae CN', 'User', 'mcp.json'),
        kiro: path.join(home, '.kiro', 'settings', 'mcp.json'),
        opencode: path.join(home, '.config', 'opencode', 'opencode.json'),
        jetbrains: '', // resolved dynamically
        antigravity: path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
        openclaw: path.join(home, '.openclaw', 'openclaw.json'),
      };
      this.defaultSkillsPaths = {
        cursor: path.join(home, '.cursor', 'skills'),
        'claude-code': path.join(home, '.claude', 'skills'),
        'gemini-cli': path.join(home, '.gemini', 'skills'),
        'codex-cli': path.join(home, '.codex', 'skills'),
        opencode: path.join(home, '.config', 'opencode', 'skills'),
        'agent-skills': path.join(home, '.agents', 'skills'),
      };
    } else {
      // Linux 路径配置
      this.defaultClientPaths = {
        cursor: path.join(home, '.cursor', 'mcp.json'),
        vscode: path.join(home, '.config', 'Code', 'User', 'mcp.json'),
        'claude-code': path.join(home, '.claude.json'),
        'gemini-cli': path.join(home, '.gemini', 'settings.json'),
        'codex-cli': path.join(home, '.codex', 'config.toml'),
        windsurf: path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
        zed: path.join(home, '.config', 'zed', 'settings.json'),
        trae: path.join(home, '.config', 'Trae', 'User', 'mcp.json'),
        'trae-cn': path.join(home, '.config', 'Trae CN', 'User', 'mcp.json'),
        kiro: path.join(home, '.kiro', 'settings', 'mcp.json'),
        opencode: path.join(home, '.config', 'opencode', 'opencode.json'),
        jetbrains: '', // resolved dynamically
        antigravity: path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
        openclaw: path.join(home, '.openclaw', 'openclaw.json'),
      };
      this.defaultSkillsPaths = {
        cursor: path.join(home, '.cursor', 'skills'),
        'claude-code': path.join(home, '.claude', 'skills'),
        'gemini-cli': path.join(home, '.gemini', 'skills'),
        'codex-cli': path.join(home, '.codex', 'skills'),
        opencode: path.join(home, '.config', 'opencode', 'skills'),
        'agent-skills': path.join(home, '.agents', 'skills'),
      };
    }

    // 异步加载用户设置
    this.loadUserSettings();
  }

  /**
   * 加载用户设置
   */
  private async loadUserSettings(): Promise<void> {
    try {
      const content = await fs.readFile(this.userSettingsPath, 'utf-8');
      this.userSettings = JSON.parse(content);
    } catch {
      this.userSettings = {};
    }
    this.resolvedJetBrainsPath = await this.findJetBrainsConfigPath();
  }

  /**
   * 保存用户设置
   */
  private async saveUserSettings(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.userSettingsPath), { recursive: true });
      await fs.writeFile(this.userSettingsPath, JSON.stringify(this.userSettings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save user settings:', error);
    }
  }

  /**
   * 获取客户端配置路径（优先使用用户自定义路径）
   */
  private getClientConfigPath(client: ClientType): string {
    if (client === 'jetbrains') {
      const custom = this.userSettings.customConfigPaths?.['jetbrains'];
      if (custom) return custom;
      return this.resolvedJetBrainsPath || '';
    }
    return this.userSettings.customConfigPaths?.[client] || this.defaultClientPaths[client];
  }

  private resolvedJetBrainsPath: string = '';

  /**
   * 扫描 JetBrains 配置目录，找到最新版本的 mcp.json
   */
  private async findJetBrainsConfigPath(): Promise<string> {
    const home = os.homedir();
    const platform = process.platform;
    let baseDir: string;
    if (platform === 'darwin') {
      baseDir = path.join(home, 'Library', 'Application Support', 'JetBrains');
    } else if (platform === 'win32') {
      baseDir = path.join(home, 'AppData', 'Roaming', 'JetBrains');
    } else {
      baseDir = path.join(home, '.config', 'JetBrains');
    }

    try {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const idePatterns = /^(IntelliJIdea|IdeaIC|WebStorm|PyCharm|GoLand|Rider|CLion|PhpStorm|RubyMine|DataGrip)/;
      const ideDirs = entries
        .filter(e => e.isDirectory() && idePatterns.test(e.name))
        .map(e => e.name)
        .sort()
        .reverse();

      for (const dir of ideDirs) {
        const mcpPath = path.join(baseDir, dir, 'mcp.json');
        try {
          await fs.access(mcpPath);
          return mcpPath;
        } catch {
          // mcp.json doesn't exist in this dir
        }
      }
      if (ideDirs.length > 0) {
        return path.join(baseDir, ideDirs[0], 'mcp.json');
      }
    } catch {
      // JetBrains dir doesn't exist
    }
    return '';
  }

  /**
   * 设置自定义配置路径
   */
  async setCustomConfigPath(client: ClientType, customPath: string | null): Promise<void> {
    if (!this.userSettings.customConfigPaths) {
      this.userSettings.customConfigPaths = {};
    }
    
    if (customPath) {
      this.userSettings.customConfigPaths[client] = customPath;
    } else {
      delete this.userSettings.customConfigPaths[client];
    }
    
    await this.saveUserSettings();
  }

  /**
   * 获取客户端 Skills 目录路径（优先使用用户自定义路径）
   */
  getSkillsPath(client: SkillClientType): string {
    return this.userSettings.customSkillsPaths?.[client] || this.defaultSkillsPaths[client];
  }

  /**
   * 设置自定义 Skills 路径
   */
  async setCustomSkillsPath(client: SkillClientType, customPath: string | null): Promise<void> {
    if (!this.userSettings.customSkillsPaths) {
      this.userSettings.customSkillsPaths = {};
    }
    
    if (customPath) {
      this.userSettings.customSkillsPaths[client] = customPath;
    } else {
      delete this.userSettings.customSkillsPaths[client];
    }
    
    await this.saveUserSettings();
  }

  /**
   * 获取客户端显示名称
   */
  private getClientName(client: ClientType): string {
    const names: Record<ClientType, string> = {
      cursor: 'Cursor',
      vscode: 'VS Code',
      'claude-code': 'Claude Code',
      'gemini-cli': 'Gemini CLI',
      'codex-cli': 'Codex CLI',
      windsurf: 'Windsurf',
      zed: 'Zed',
      trae: 'TRAE',
      'trae-cn': 'TRAE CN',
      kiro: 'Kiro',
      opencode: 'Opencode',
      jetbrains: 'JetBrains',
      antigravity: 'Antigravity',
      openclaw: 'OpenClaw',
    };
    return names[client];
  }

  /**
   * 获取各平台的应用路径
   */
  private getAppPaths(client: ClientType): string[] {
    const home = os.homedir();
    const platform = process.platform;

    const darwinPaths: Record<ClientType, string[]> = {
      cursor: ['/Applications/Cursor.app', path.join(home, 'Applications', 'Cursor.app')],
      vscode: ['/Applications/Visual Studio Code.app', path.join(home, 'Applications', 'Visual Studio Code.app')],
      'claude-code': ['/usr/local/bin/claude', path.join(home, '.local', 'bin', 'claude')],
      'gemini-cli': ['/usr/local/bin/gemini', path.join(home, '.local', 'bin', 'gemini')],
      'codex-cli': [
        '/usr/local/bin/codex',
        path.join(home, '.local', 'bin', 'codex'),
        '/opt/homebrew/bin/codex',
        path.join(home, '.npm', 'bin', 'codex'),
        path.join(home, '.codex'),
      ],
      windsurf: ['/Applications/Windsurf.app', path.join(home, 'Applications', 'Windsurf.app')],
      zed: ['/Applications/Zed.app', path.join(home, 'Applications', 'Zed.app')],
      trae: ['/Applications/Trae.app', path.join(home, 'Applications', 'Trae.app'), '/Applications/TRAE.app', path.join(home, 'Applications', 'TRAE.app')],
      'trae-cn': ['/Applications/Trae CN.app', path.join(home, 'Applications', 'Trae CN.app')],
      kiro: ['/Applications/Kiro.app', path.join(home, 'Applications', 'Kiro.app')],
      opencode: ['/usr/local/bin/opencode', path.join(home, '.local', 'bin', 'opencode'), '/opt/homebrew/bin/opencode'],
      antigravity: ['/Applications/Antigravity.app', path.join(home, 'Applications', 'Antigravity.app')],
      openclaw: ['/usr/local/bin/openclaw', '/usr/local/bin/oclaw', path.join(home, '.local', 'bin', 'openclaw'), '/opt/homebrew/bin/openclaw'],
      jetbrains: [
        '/Applications/IntelliJ IDEA.app',
        '/Applications/IntelliJ IDEA CE.app',
        '/Applications/WebStorm.app',
        '/Applications/PyCharm.app',
        '/Applications/GoLand.app',
        '/Applications/CLion.app',
        '/Applications/PhpStorm.app',
        '/Applications/Rider.app',
        path.join(home, 'Applications', 'IntelliJ IDEA.app'),
        path.join(home, 'Library', 'Application Support', 'JetBrains', 'Toolbox'),
      ],
    };

    const win32Paths: Record<ClientType, string[]> = {
      cursor: [
        path.join(home, 'AppData', 'Local', 'Programs', 'cursor', 'Cursor.exe'),
        path.join(home, 'AppData', 'Local', 'cursor', 'Cursor.exe'),
      ],
      vscode: [
        path.join(home, 'AppData', 'Local', 'Programs', 'Microsoft VS Code', 'Code.exe'),
        path.join('C:', 'Program Files', 'Microsoft VS Code', 'Code.exe'),
      ],
      'claude-code': [
        path.join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
        path.join(home, '.claude', 'claude.exe'),
        path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      ],
      'gemini-cli': [
        path.join(home, 'AppData', 'Local', 'Programs', 'gemini', 'gemini.exe'),
        path.join(home, '.gemini', 'gemini.exe'),
      ],
      'codex-cli': [
        path.join(home, 'AppData', 'Local', 'Programs', 'codex', 'codex.exe'),
        path.join(home, '.codex', 'codex.exe'),
        path.join(home, 'AppData', 'Roaming', 'npm', 'codex.cmd'),
        path.join(home, '.codex'),
      ],
      windsurf: [
        path.join(home, 'AppData', 'Local', 'Programs', 'windsurf', 'Windsurf.exe'),
        path.join(home, 'AppData', 'Local', 'Windsurf', 'Windsurf.exe'),
      ],
      zed: [
        path.join(home, 'AppData', 'Local', 'Programs', 'Zed', 'Zed.exe'),
        path.join(home, 'AppData', 'Local', 'Zed', 'Zed.exe'),
      ],
      trae: [
        path.join(home, 'AppData', 'Local', 'Programs', 'trae', 'TRAE.exe'),
        path.join(home, 'AppData', 'Local', 'TRAE', 'TRAE.exe'),
      ],
      'trae-cn': [
        path.join(home, 'AppData', 'Local', 'Programs', 'trae-cn', 'TRAE CN.exe'),
        path.join(home, 'AppData', 'Local', 'Trae CN', 'Trae CN.exe'),
      ],
      kiro: [
        path.join(home, 'AppData', 'Local', 'Programs', 'Kiro', 'Kiro.exe'),
        path.join(home, 'AppData', 'Local', 'Kiro', 'Kiro.exe'),
      ],
      opencode: [
        path.join(home, 'AppData', 'Local', 'Programs', 'opencode', 'opencode.exe'),
        path.join(home, '.config', 'opencode'),
      ],
      antigravity: [
        path.join(home, 'AppData', 'Local', 'Programs', 'Antigravity', 'Antigravity.exe'),
      ],
      openclaw: [
        path.join(home, 'AppData', 'Roaming', 'npm', 'openclaw.cmd'),
        path.join(home, 'AppData', 'Local', 'Programs', 'openclaw', 'openclaw.exe'),
        path.join(home, '.openclaw'),
      ],
      jetbrains: [
        path.join(home, 'AppData', 'Local', 'JetBrains', 'Toolbox'),
        path.join('C:', 'Program Files', 'JetBrains'),
      ],
    };

    const linuxPaths: Record<ClientType, string[]> = {
      cursor: [
        '/usr/bin/cursor',
        '/usr/local/bin/cursor',
        path.join(home, '.local', 'bin', 'cursor'),
        '/opt/Cursor/cursor',
      ],
      vscode: [
        '/usr/bin/code',
        '/usr/local/bin/code',
        '/snap/bin/code',
        '/usr/share/code/code',
      ],
      'claude-code': [
        '/usr/bin/claude',
        '/usr/local/bin/claude',
        path.join(home, '.local', 'bin', 'claude'),
      ],
      'gemini-cli': [
        '/usr/bin/gemini',
        '/usr/local/bin/gemini',
        path.join(home, '.local', 'bin', 'gemini'),
      ],
      'codex-cli': [
        '/usr/bin/codex',
        '/usr/local/bin/codex',
        path.join(home, '.local', 'bin', 'codex'),
        path.join(home, '.npm', 'bin', 'codex'),
        path.join(home, '.codex'),
      ],
      windsurf: [
        '/usr/bin/windsurf',
        '/usr/local/bin/windsurf',
        '/opt/Windsurf/windsurf',
      ],
      zed: [
        '/usr/bin/zed',
        '/usr/local/bin/zed',
        path.join(home, '.local', 'bin', 'zed'),
        '/opt/Zed/zed',
      ],
      trae: [
        '/usr/bin/trae',
        '/usr/local/bin/trae',
        '/opt/TRAE/trae',
      ],
      'trae-cn': [
        '/usr/bin/trae-cn',
        '/usr/local/bin/trae-cn',
        '/opt/Trae CN/trae-cn',
      ],
      kiro: [
        '/usr/bin/kiro',
        '/usr/local/bin/kiro',
        path.join(home, '.local', 'bin', 'kiro'),
      ],
      opencode: [
        '/usr/bin/opencode',
        '/usr/local/bin/opencode',
        path.join(home, '.local', 'bin', 'opencode'),
      ],
      antigravity: [
        '/usr/bin/antigravity',
        path.join(home, '.local', 'bin', 'antigravity'),
      ],
      openclaw: [
        '/usr/local/bin/openclaw',
        '/usr/local/bin/oclaw',
        path.join(home, '.local', 'bin', 'openclaw'),
      ],
      jetbrains: [
        path.join(home, '.local', 'share', 'JetBrains', 'Toolbox'),
        '/opt/idea',
        '/opt/webstorm',
        '/opt/pycharm',
      ],
    };

    if (platform === 'darwin') {
      return darwinPaths[client] || [];
    } else if (platform === 'win32') {
      return win32Paths[client] || [];
    } else {
      return linuxPaths[client] || [];
    }
  }

  /**
   * 检查客户端应用是否已安装（只检查应用程序，不检查配置文件）
   * 对于 CLI 工具（codex-cli, opencode 等），额外通过 which/where 命令检测
   */
  private async isClientInstalled(client: ClientType): Promise<boolean> {
    const paths = this.getAppPaths(client);
    
    for (const appPath of paths) {
      try {
        await fs.access(appPath);
        return true;
      } catch {
        // 继续检查下一个路径
      }
    }

    // CLI 工具通过 which/where 命令作为后备检测
    const cliClients: Partial<Record<ClientType, string>> = {
      'codex-cli': 'codex',
      'opencode': 'opencode',
      'claude-code': 'claude',
      'gemini-cli': 'gemini',
      'openclaw': 'openclaw',
    };

    const cliName = cliClients[client];
    if (cliName) {
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const whichCmd = process.platform === 'win32' ? 'where' : 'which';
        const { stdout } = await execAsync(`${whichCmd} ${cliName}`, {
          timeout: 3000,
          env: { ...process.env, PATH: this.getEnhancedPath() },
        });
        if (stdout && stdout.trim()) return true;
      } catch {
        // which/where 失败，CLI 未安装
      }
    }

    return false;
  }

  /**
   * 获取增强的 PATH（包含常见安装路径）
   */
  private getEnhancedPath(): string {
    const home = os.homedir();
    const currentPath = process.env.PATH || '';
    const additionalPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      path.join(home, '.local', 'bin'),
      path.join(home, '.npm', 'bin'),
      path.join(home, '.cargo', 'bin'),
    ];
    return [...additionalPaths, currentPath].join(path.delimiter);
  }

  /**
   * 检查配置文件是否存在
   */
  private async configExists(client: ClientType): Promise<boolean> {
    try {
      await fs.access(this.getClientConfigPath(client));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取所有客户端信息
   */
  async getAllClients(): Promise<ClientInfo[]> {
    // 确保用户设置已加载
    await this.loadUserSettings();
    
    const clients: ClientType[] = ['cursor', 'vscode', 'claude-code', 'gemini-cli', 'codex-cli', 'windsurf', 'zed', 'trae', 'trae-cn', 'kiro', 'opencode', 'jetbrains', 'antigravity', 'openclaw'];
    const results: ClientInfo[] = [];

    for (const client of clients) {
      const [installed, configExists] = await Promise.all([
        this.isClientInstalled(client),
        this.configExists(client),
      ]);

      const supportsSkills = SKILL_SUPPORTED_CLIENTS.includes(client as SkillClientType);

      results.push({
        id: client,
        name: this.getClientName(client),
        installed,
        configPath: this.getClientConfigPath(client),
        configExists,
        supportsSkills,
        skillsPath: supportsSkills ? this.getSkillsPath(client as SkillClientType) : undefined,
      });
    }

    return results;
  }

  /**
   * 获取指定客户端的配置文件路径
   */
  getConfigPath(client: ClientType = 'cursor'): string {
    return this.getClientConfigPath(client);
  }

  /**
   * 确保配置目录存在
   */
  private async ensureConfigDir(client: ClientType): Promise<void> {
    const configPath = this.getClientConfigPath(client);
    const dir = path.dirname(configPath);
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * 获取客户端使用的 MCP 服务器键名
   */
  private getServersKey(client: ClientType): string {
    if (SERVERS_KEY_CLIENTS.includes(client)) return 'servers';
    if (client === 'zed') return 'context_servers';
    if (client === 'opencode') return 'mcp';
    return 'mcpServers';
  }

  /**
   * 读取配置文件
   * VS Code: JSON 格式，key 为 servers
   * Zed: JSONC 格式，key 为 context_servers
   * Opencode: JSON/JSONC 格式，key 为 mcp
   */
  async readConfig(client: ClientType = 'cursor'): Promise<ClientConfig> {
    const configPath = this.getClientConfigPath(client);
    
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      
      if (client === 'jetbrains') {
        const config = JSON.parse(content);
        return { mcpServers: config.mcpServers || {} };
      }
      
      if (client === 'codex-cli') {
        const tomlConfig = TOML.parse(content) as Record<string, any>;
        const mcpServers: Record<string, McpServerConfig> = {};
        const rawServers = tomlConfig.mcp_servers || {};
        for (const [name, serverDef] of Object.entries(rawServers)) {
          const def = serverDef as Record<string, any>;
          if (def.command) {
            mcpServers[name] = {
              command: def.command,
              args: def.args || [],
              env: def.env || {},
            };
          }
        }
        return { mcpServers };
      }
      
      if (client === 'openclaw') {
        const config = jsonc.parse(content);
        const rawServers = config.mcp?.servers || {};
        const mcpServers: Record<string, McpServerConfig> = {};
        for (const [name, def] of Object.entries(rawServers)) {
          const d = def as Record<string, any>;
          if (d.url) {
            mcpServers[name] = {
              url: d.url,
              type: d.type || 'http',
              headers: d.headers || {},
            };
          } else if (d.command) {
            mcpServers[name] = {
              command: d.command,
              args: d.args || [],
              env: {},
            };
          }
        }
        return { mcpServers, ...config };
      }
      
      if (client === 'opencode') {
        const config = jsonc.parse(content);
        const rawMcp = config.mcp || {};
        const mcpServers: Record<string, McpServerConfig> = {};
        for (const [name, def] of Object.entries(rawMcp)) {
          const d = def as Record<string, any>;
          if (d.type === 'local' && Array.isArray(d.command) && d.command.length > 0) {
            mcpServers[name] = {
              command: d.command[0],
              args: d.command.slice(1),
              env: d.environment || d.env || {},
            };
          } else if (d.type === 'remote' && d.url) {
            mcpServers[name] = {
              url: d.url,
              type: 'http',
              headers: d.headers || {},
            };
          }
        }
        return { mcpServers, ...config };
      }
      
      if (client === 'claude-code' || client === 'zed') {
        const config = jsonc.parse(content);
        const serversKey = this.getServersKey(client);
        return {
          mcpServers: config[serversKey] || {},
          ...config,
        };
      }
      
      if (SERVERS_KEY_CLIENTS.includes(client)) {
        const config = JSON.parse(content);
        return {
          mcpServers: config.servers || {},
          ...config,
        };
      }
      
      const config = JSON.parse(content);
      return config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        if (client === 'zed') {
          return { mcpServers: {}, context_servers: {} };
        }
        if (client === 'opencode' || client === 'openclaw') {
          return { mcpServers: {} };
        }
        if (SERVERS_KEY_CLIENTS.includes(client)) {
          return { mcpServers: {}, servers: {} };
        }
        return { mcpServers: {} };
      }
      throw error;
    }
  }

  /**
   * 写入配置文件
   * VS Code: JSON 格式，key 为 servers
   * Zed: JSONC 格式，key 为 context_servers，保留用户注释
   * Opencode: JSONC 格式，key 为 mcp，保留用户注释
   */
  async writeConfig(config: ClientConfig, client: ClientType = 'cursor'): Promise<void> {
    await this.ensureConfigDir(client);
    const configPath = this.getClientConfigPath(client);
    
    if (client === 'jetbrains') {
      let existingConfig: Record<string, any> = {};
      try {
        const existing = await fs.readFile(configPath, 'utf-8');
        existingConfig = JSON.parse(existing);
      } catch {
        // file doesn't exist
      }
      existingConfig.mcpServers = config.mcpServers || {};
      const content = JSON.stringify(existingConfig, null, 2);
      await fs.writeFile(configPath, content, 'utf-8');
      return;
    }
    
    if (client === 'codex-cli') {
      let existingToml: Record<string, any> = {};
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        existingToml = TOML.parse(content) as Record<string, any>;
      } catch {
        // 文件不存在或解析失败
      }
      const mcpServers = config.mcpServers || {};
      const tomlServers: Record<string, any> = {};
      for (const [name, serverDef] of Object.entries(mcpServers)) {
        tomlServers[name] = {
          command: serverDef.command,
          ...(serverDef.args && serverDef.args.length > 0 ? { args: serverDef.args } : {}),
          ...(serverDef.env && Object.keys(serverDef.env).length > 0 ? { env: serverDef.env } : {}),
        };
      }
      existingToml.mcp_servers = tomlServers;
      const tomlContent = TOML.stringify(existingToml);
      await fs.writeFile(configPath, tomlContent, 'utf-8');
      return;
    }

    if (client === 'openclaw') {
      let existingContent = '{}';
      try {
        existingContent = await fs.readFile(configPath, 'utf-8');
      } catch {
        // file doesn't exist
      }
      
      const mcpServers = config.mcpServers || {};
      const openclawServers: Record<string, any> = {};
      for (const [name, def] of Object.entries(mcpServers)) {
        if (def.url) {
          openclawServers[name] = {
            url: def.url,
            type: 'http',
            ...(def.headers && Object.keys(def.headers).length > 0 ? { headers: def.headers } : {}),
          };
        } else {
          openclawServers[name] = {
            command: def.command,
            ...(def.args && def.args.length > 0 ? { args: def.args } : {}),
          };
        }
      }
      
      const edits = jsonc.modify(existingContent, ['mcp', 'servers'], openclawServers, {
        formattingOptions: { tabSize: 2, insertSpaces: true }
      });
      const newContent = jsonc.applyEdits(existingContent, edits);
      await fs.writeFile(configPath, newContent, 'utf-8');
      return;
    }
    
    if (client === 'opencode') {
      let existingContent = '{}';
      try {
        existingContent = await fs.readFile(configPath, 'utf-8');
      } catch {
        // 文件不存在
      }
      
      const mcpServers = config.mcpServers || {};
      const opencodeMcp: Record<string, any> = {};
      for (const [name, def] of Object.entries(mcpServers)) {
        if (def.url) {
          opencodeMcp[name] = {
            type: 'remote',
            url: def.url,
            ...(def.headers && Object.keys(def.headers).length > 0 ? { headers: def.headers } : {}),
            enabled: true,
          };
        } else {
          opencodeMcp[name] = {
            type: 'local',
            command: [def.command, ...(def.args || [])],
            ...(def.env && Object.keys(def.env).length > 0 ? { environment: def.env } : {}),
            enabled: true,
          };
        }
      }
      
      const edits = jsonc.modify(existingContent, ['mcp'], opencodeMcp, {
        formattingOptions: { tabSize: 2, insertSpaces: true }
      });
      const newContent = jsonc.applyEdits(existingContent, edits);
      await fs.writeFile(configPath, newContent, 'utf-8');
      return;
    }
    
    // Claude Code / Zed: 包含非 MCP 设置，需 merge 写入
    if (client === 'claude-code' || client === 'zed') {
      let existingContent = '{}';
      try {
        existingContent = await fs.readFile(configPath, 'utf-8');
      } catch {
        // 文件不存在，使用空对象
      }
      
      const serversKey = this.getServersKey(client);
      const mcpServers = config.mcpServers || config[serversKey] || {};
      
      const edits = jsonc.modify(existingContent, [serversKey], mcpServers, {
        formattingOptions: { tabSize: 2, insertSpaces: true }
      });
      
      const newContent = jsonc.applyEdits(existingContent, edits);
      await fs.writeFile(configPath, newContent, 'utf-8');
      return;
    }
    
    // VS Code: 写入时将 mcpServers -> servers
    if (SERVERS_KEY_CLIENTS.includes(client)) {
      const { mcpServers, servers, ...rest } = config;
      const writeConfig = {
        ...rest,
        servers: mcpServers || servers || {},
      };
      const content = JSON.stringify(writeConfig, null, 2);
      await fs.writeFile(configPath, content, 'utf-8');
      return;
    }
    
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(configPath, content, 'utf-8');
  }

  /**
   * 获取已安装的服务器列表（从指定客户端）
   */
  async getInstalledServers(client: ClientType = 'cursor'): Promise<Record<string, McpServerConfig>> {
    const config = await this.readConfig(client);
    return config.mcpServers || {};
  }

  /**
   * 获取所有客户端中已安装的服务器（合并去重）
   */
  async getAllInstalledServers(): Promise<{
    servers: Record<string, { config: McpServerConfig; clients: ClientType[] }>;
    byClient: Record<ClientType, Record<string, McpServerConfig>>;
  }> {
    const clients: ClientType[] = ['cursor', 'vscode', 'claude-code', 'gemini-cli', 'codex-cli', 'windsurf', 'zed', 'trae', 'trae-cn', 'kiro', 'opencode', 'jetbrains', 'antigravity', 'openclaw'];
    const servers: Record<string, { config: McpServerConfig; clients: ClientType[] }> = {};
    const byClient: Record<ClientType, Record<string, McpServerConfig>> = {
      cursor: {},
      vscode: {},
      'claude-code': {},
      'gemini-cli': {},
      'codex-cli': {},
      windsurf: {},
      zed: {},
      trae: {},
      'trae-cn': {},
      kiro: {},
      opencode: {},
      jetbrains: {},
      antigravity: {},
      openclaw: {},
    };

    for (const client of clients) {
      try {
        const clientServers = await this.getInstalledServers(client);
        byClient[client] = clientServers;
        
        for (const [serverId, config] of Object.entries(clientServers)) {
          if (servers[serverId]) {
            servers[serverId].clients.push(client);
          } else {
            servers[serverId] = { config, clients: [client] };
          }
        }
      } catch {
        // 忽略读取失败的客户端
      }
    }

    return { servers, byClient };
  }

  /**
   * 安装服务器到指定客户端
   */
  async installServer(
    serverId: string, 
    serverConfig: McpServerConfig, 
    clients: ClientType[] = ['cursor']
  ): Promise<{ success: ClientType[]; failed: ClientType[] }> {
    const success: ClientType[] = [];
    const failed: ClientType[] = [];

    console.log(`[ConfigManager] Installing server ${serverId} to clients:`, clients);
    console.log(`[ConfigManager] Server config:`, JSON.stringify(serverConfig, null, 2));

    for (const client of clients) {
      try {
        console.log(`[ConfigManager] Installing to ${client}...`);
        const config = await this.readConfig(client);
        console.log(`[ConfigManager] Current config for ${client}:`, JSON.stringify(config, null, 2));
        
        if (!config.mcpServers) {
          config.mcpServers = {};
        }
        config.mcpServers[serverId] = serverConfig;
        
        console.log(`[ConfigManager] New config for ${client}:`, JSON.stringify(config, null, 2));
        await this.writeConfig(config, client);
        console.log(`[ConfigManager] Successfully installed to ${client}`);
        success.push(client);
      } catch (error) {
        console.error(`[ConfigManager] Failed to install to ${client}:`, error);
        failed.push(client);
      }
    }

    console.log(`[ConfigManager] Install result - success:`, success, 'failed:', failed);
    return { success, failed };
  }

  /**
   * 从指定客户端卸载服务器
   */
  async uninstallServer(
    serverId: string, 
    clients: ClientType[] = ['cursor']
  ): Promise<{ success: ClientType[]; failed: ClientType[] }> {
    const success: ClientType[] = [];
    const failed: ClientType[] = [];

    for (const client of clients) {
      try {
        const config = await this.readConfig(client);
        if (config.mcpServers && config.mcpServers[serverId]) {
          delete config.mcpServers[serverId];
          await this.writeConfig(config, client);
        }
        success.push(client);
      } catch (error) {
        console.error(`Failed to uninstall from ${client}:`, error);
        failed.push(client);
      }
    }

    return { success, failed };
  }

  /**
   * 更新服务器配置
   */
  async updateServer(
    serverId: string, 
    serverConfig: McpServerConfig, 
    client: ClientType = 'cursor'
  ): Promise<void> {
    const config = await this.readConfig(client);
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    config.mcpServers[serverId] = serverConfig;
    await this.writeConfig(config, client);
  }

  /**
   * 同步服务器到其他客户端
   */
  async syncServerToClients(
    serverId: string,
    sourceClient: ClientType,
    targetClients: ClientType[]
  ): Promise<{ success: ClientType[]; failed: ClientType[] }> {
    const servers = await this.getInstalledServers(sourceClient);
    const serverConfig = servers[serverId];
    
    if (!serverConfig) {
      return { success: [], failed: targetClients };
    }

    return this.installServer(serverId, serverConfig, targetClients);
  }

  /**
   * 检查服务器是否已安装（在任意客户端）
   */
  async isServerInstalled(serverId: string): Promise<boolean> {
    const { servers } = await this.getAllInstalledServers();
    return serverId in servers;
  }

  /**
   * 生成 Smithery CLI 配置
   */
  generateServerConfig(
    runtime: 'node' | 'python',
    qualifiedName: string,
    configValues: Record<string, any>,
    npxPath: string = 'npx',
    uvxPath: string = 'uvx'
  ): McpServerConfig {
    if (runtime === 'node') {
      return {
        command: npxPath,
        args: [
          '-y',
          '@smithery/cli@latest',
          'run',
          qualifiedName,
          '--config',
          JSON.stringify(configValues),
        ],
      };
    } else {
      return {
        command: uvxPath,
        args: [
          'smithery-cli',
          'run',
          qualifiedName,
          '--config',
          JSON.stringify(configValues),
        ],
      };
    }
  }
}
