/**
 * Electron API 类型定义和访问
 */

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  type?: 'stdio' | 'http' | 'streamable-http' | 'sse';
  headers?: Record<string, string>;
}

export interface RuntimeInfo {
  available: boolean;
  version: string | null;
  path: string | null;
}

export interface AllRuntimes {
  node: RuntimeInfo;
  python: RuntimeInfo;
  npx: RuntimeInfo;
  uvx: RuntimeInfo;
}

export interface BackupInfo {
  timestamp: string;
  filename: string;
  size: number;
  serverCount: number;
  skillCount: number;
  clients: ClientType[];
}

export interface DiffResult {
  added: string[];
  removed: string[];
  modified: string[];
  current: any;
  backup: any;
  skillsAdded: string[];
  skillsRemoved: string[];
}

export type ClientType = 'cursor' | 'vscode' | 'claude-code' | 'gemini-cli' | 'codex-cli' | 'windsurf' | 'zed' | 'trae' | 'trae-cn' | 'kiro' | 'opencode' | 'jetbrains' | 'antigravity' | 'openclaw';
export type SkillClientType = 'cursor' | 'claude-code' | 'gemini-cli' | 'codex-cli' | 'opencode' | 'agent-skills';

export interface ClientInfo {
  id: ClientType;
  name: string;
  installed: boolean;
  configPath: string;
  configExists: boolean;
  supportsSkills: boolean;
  skillsPath?: string;
}

// Skills 相关类型
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

export interface InstalledSkill {
  name: string;
  path: string;
  source: SkillSourceMeta | null;
  hasUpdate?: boolean;
}

export interface SkillInstallResult {
  success: boolean;
  error?: string;
}

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

export interface LocalSkillDetail {
  found: boolean;
  name: string;
  skillMdContent: string;
  source: SkillSourceMeta | null;
  files: string[];
  clients: SkillClientType[];
}

export interface ImportParseResult {
  success: boolean;
  skills: DiscoveredSkill[];
  error?: string;
}

export interface AllSkillsResult {
  skills: Record<string, { name: string; clients: SkillClientType[] }>;
  byClient: Record<SkillClientType, InstalledSkill[]>;
}

export interface InstallResult {
  success: ClientType[];
  failed: ClientType[];
}

export interface AllServersResult {
  servers: Record<string, { config: McpServerConfig; clients: ClientType[] }>;
  byClient: Record<ClientType, Record<string, McpServerConfig>>;
}

interface ElectronAPI {
  clients: {
    getAll: () => Promise<ClientInfo[]>;
    setCustomPath: (client: ClientType, customPath: string | null) => Promise<void>;
    setCustomSkillsPath: (client: SkillClientType, customPath: string | null) => Promise<void>;
  };
  config: {
    read: (client?: ClientType) => Promise<any>;
    write: (config: any, client?: ClientType) => Promise<void>;
    getServers: (client?: ClientType) => Promise<Record<string, McpServerConfig>>;
    getAllServers: () => Promise<AllServersResult>;
    installServer: (serverId: string, serverConfig: McpServerConfig, clients: ClientType[]) => Promise<InstallResult>;
    uninstallServer: (serverId: string, clients: ClientType[]) => Promise<InstallResult>;
    updateServer: (serverId: string, serverConfig: McpServerConfig, client?: ClientType) => Promise<void>;
    syncServer: (serverId: string, sourceClient: ClientType, targetClients: ClientType[]) => Promise<InstallResult>;
  };
  env: {
    checkRuntime: (runtime: 'node' | 'python') => Promise<RuntimeInfo>;
    getAllRuntimes: () => Promise<AllRuntimes>;
    getNpxPath: () => Promise<string>;
    getUvxPath: () => Promise<string>;
  };
  history: {
    list: () => Promise<BackupInfo[]>;
    restore: (timestamp: string) => Promise<boolean>;
    getDiff: (timestamp: string) => Promise<DiffResult | null>;
    clearAll: () => Promise<boolean>;
  };
  system: {
    getPlatform: () => Promise<string>;
    getVersion: () => Promise<string>;
    openExternal: (url: string) => Promise<void>;
    getConfigPath: (client?: ClientType) => Promise<string>;
    openConfigDirectory: (client: ClientType) => Promise<string>;
    openSkillsDirectory: (client: SkillClientType) => Promise<string>;
  };
  skills: {
    getInstalled: (client: SkillClientType) => Promise<InstalledSkill[]>;
    getAllInstalled: () => Promise<AllSkillsResult>;
    install: (skillId: string, sourceInfo: SkillSourceMeta, clients: SkillClientType[]) => Promise<SkillInstallResult>;
    uninstall: (skillName: string, clients: SkillClientType[]) => Promise<void>;
    update: (skillName: string, client: SkillClientType) => Promise<{ updated: boolean; error?: string }>;
    updateAll: (client: SkillClientType) => Promise<{ updated: number; failed: number }>;
    isInstalled: (skillId: string) => Promise<boolean>;
    parseImportUrl: (url: string) => Promise<ImportParseResult>;
    installFromDiscovered: (skill: DiscoveredSkill, clients: SkillClientType[]) => Promise<SkillInstallResult>;
    getLocalDetail: (skillId: string) => Promise<LocalSkillDetail | null>;
  };
}

// 获取 Electron API
export function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && 'electronAPI' in window) {
    return (window as any).electronAPI as ElectronAPI;
  }
  return null;
}

// 检查是否在 Electron 环境中
export function isElectron(): boolean {
  return getElectronAPI() !== null;
}

// Mock API for development in browser
const mockAPI: ElectronAPI = {
  clients: {
    getAll: async () => [
      { id: 'cursor', name: 'Cursor', installed: true, configPath: '~/.cursor/mcp.json', configExists: true, supportsSkills: true, skillsPath: '~/.cursor/skills' },
      { id: 'claude-code', name: 'Claude Code', installed: true, configPath: '~/.claude/mcp.json', configExists: true, supportsSkills: true, skillsPath: '~/.claude/skills' },
      { id: 'gemini-cli', name: 'Gemini CLI', installed: false, configPath: '~/.gemini/settings.json', configExists: false, supportsSkills: true, skillsPath: '~/.gemini/skills' },
      { id: 'codex-cli', name: 'Codex CLI', installed: false, configPath: '~/.codex/config.json', configExists: false, supportsSkills: true, skillsPath: '~/.codex/skills' },
      { id: 'windsurf', name: 'Windsurf', installed: false, configPath: '~/.windsurf/mcp.json', configExists: false, supportsSkills: false },
      { id: 'zed', name: 'Zed', installed: true, configPath: '~/.config/zed/settings.json', configExists: false, supportsSkills: false },
      { id: 'trae', name: 'TRAE', installed: false, configPath: '~/.trae/mcp.json', configExists: false, supportsSkills: false },
      { id: 'opencode', name: 'Opencode', installed: false, configPath: '~/.config/opencode/opencode.json', configExists: false, supportsSkills: true, skillsPath: '~/.config/opencode/skills' },
    ],
    setCustomPath: async () => {},
    setCustomSkillsPath: async () => {},
  },
  config: {
    read: async () => ({ mcpServers: {} }),
    write: async () => {},
    getServers: async () => ({}),
    getAllServers: async () => ({ 
      servers: {}, 
      byClient: { 
        cursor: {}, vscode: {}, 'claude-code': {}, 'gemini-cli': {}, 'codex-cli': {}, windsurf: {}, zed: {}, trae: {}, 'trae-cn': {}, kiro: {}, opencode: {}, jetbrains: {}, antigravity: {} 
      } 
    }),
    installServer: async (_, __, clients) => ({ success: clients, failed: [] }),
    uninstallServer: async (_, clients) => ({ success: clients, failed: [] }),
    updateServer: async () => {},
    syncServer: async (_, __, targets) => ({ success: targets, failed: [] }),
  },
  env: {
    checkRuntime: async () => ({ available: true, version: '20.0.0', path: '/usr/local/bin/node' }),
    getAllRuntimes: async () => ({
      node: { available: true, version: '20.0.0', path: '/usr/local/bin/node' },
      python: { available: true, version: '3.11.0', path: '/usr/bin/python3' },
      npx: { available: true, version: '10.0.0', path: '/usr/local/bin/npx' },
      uvx: { available: false, version: null, path: null },
    }),
    getNpxPath: async () => 'npx',
    getUvxPath: async () => 'uvx',
  },
  history: {
    list: async () => [],
    restore: async () => true,
    getDiff: async () => null,
    clearAll: async () => true,
  },
  system: {
    getPlatform: async () => 'darwin',
    getVersion: async () => '1.0.0-dev',
    openExternal: async (url) => { window.open(url, '_blank'); },
    getConfigPath: async () => '~/Library/Application Support/Claude/claude_desktop_config.json',
    openConfigDirectory: async () => '',
    openSkillsDirectory: async () => '',
  },
  skills: {
    getInstalled: async () => [],
    getAllInstalled: async () => ({ 
      skills: {}, 
      byClient: { 
        cursor: [], 'claude-code': [], 'gemini-cli': [], 'codex-cli': [], opencode: [], 'agent-skills': [] 
      } 
    }),
    install: async () => ({ success: true }),
    uninstall: async () => {},
    update: async () => ({ updated: true }),
    updateAll: async () => ({ updated: 0, failed: 0 }),
    isInstalled: async () => false,
    parseImportUrl: async () => ({ success: false, skills: [], error: 'Not available in browser' }),
    installFromDiscovered: async () => ({ success: true }),
    getLocalDetail: async () => null,
  },
};

// 获取 API (自动回退到 Mock)
export function useElectronAPI(): ElectronAPI {
  return getElectronAPI() || mockAPI;
}
