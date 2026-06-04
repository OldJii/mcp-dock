/**
 * Electron Preload 脚本
 * 安全地暴露主进程 API 给渲染进程
 */

import { contextBridge, ipcRenderer } from 'electron';

// 类型定义
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
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
}

export interface DiffResult {
  added: string[];
  removed: string[];
  modified: string[];
  current: any;
  backup: any;
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

// 缓存相关类型
export type CacheKey = 
  | 'official-index' 
  | 'smithery-index' 
  | 'skills-index'
  | `official-detail-${string}`
  | `smithery-detail-${string}`
  | `skills-detail-${string}`;

export interface CacheEntry<T = unknown> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  version: string;
  etag?: string;
}

export interface CacheMeta {
  cachedAt: number;
  expiresAt: number;
  version: string;
  exists: boolean;
}

export interface CacheStats {
  totalFiles: number;
  totalSize: number;
  indexCaches: string[];
  detailCaches: number;
  encrypted: boolean;  // 是否加密存储
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

// API 定义
const api = {
  // 客户端管理
  clients: {
    getAll: (): Promise<ClientInfo[]> => ipcRenderer.invoke('clients:get-all'),
    setCustomPath: (client: ClientType, customPath: string | null): Promise<void> =>
      ipcRenderer.invoke('clients:set-custom-path', client, customPath),
    setCustomSkillsPath: (client: SkillClientType, customPath: string | null): Promise<void> =>
      ipcRenderer.invoke('clients:set-custom-skills-path', client, customPath),
  },

  // 配置管理
  config: {
    read: (client?: ClientType): Promise<any> => ipcRenderer.invoke('config:read', client),
    write: (config: any, client?: ClientType): Promise<void> => 
      ipcRenderer.invoke('config:write', config, client),
    getServers: (client?: ClientType): Promise<Record<string, McpServerConfig>> => 
      ipcRenderer.invoke('config:get-servers', client),
    getAllServers: (): Promise<AllServersResult> =>
      ipcRenderer.invoke('config:get-all-servers'),
    installServer: (serverId: string, serverConfig: McpServerConfig, clients: ClientType[]): Promise<InstallResult> =>
      ipcRenderer.invoke('config:install-server', serverId, serverConfig, clients),
    uninstallServer: (serverId: string, clients: ClientType[]): Promise<InstallResult> =>
      ipcRenderer.invoke('config:uninstall-server', serverId, clients),
    updateServer: (serverId: string, serverConfig: McpServerConfig, client?: ClientType): Promise<void> =>
      ipcRenderer.invoke('config:update-server', serverId, serverConfig, client),
    syncServer: (serverId: string, sourceClient: ClientType, targetClients: ClientType[]): Promise<InstallResult> =>
      ipcRenderer.invoke('config:sync-server', serverId, sourceClient, targetClients),
  },

  // 环境检测
  env: {
    checkRuntime: (runtime: 'node' | 'python'): Promise<RuntimeInfo> =>
      ipcRenderer.invoke('env:check-runtime', runtime),
    getAllRuntimes: (): Promise<AllRuntimes> =>
      ipcRenderer.invoke('env:get-all-runtimes'),
    getNpxPath: (): Promise<string> =>
      ipcRenderer.invoke('env:get-npx-path'),
    getUvxPath: (): Promise<string> =>
      ipcRenderer.invoke('env:get-uvx-path'),
  },

  // 历史记录
  history: {
    list: (): Promise<BackupInfo[]> =>
      ipcRenderer.invoke('history:list'),
    restore: (timestamp: string): Promise<boolean> =>
      ipcRenderer.invoke('history:restore', timestamp),
    getDiff: (timestamp: string): Promise<DiffResult | null> =>
      ipcRenderer.invoke('history:get-diff', timestamp),
    clearAll: (): Promise<boolean> =>
      ipcRenderer.invoke('history:clear-all'),
  },

  // 系统
  system: {
    getPlatform: (): Promise<string> =>
      ipcRenderer.invoke('system:get-platform'),
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke('system:get-version'),
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('system:open-external', url),
    getConfigPath: (client?: ClientType): Promise<string> =>
      ipcRenderer.invoke('system:get-config-path', client),
    openConfigDirectory: (client: ClientType): Promise<string> =>
      ipcRenderer.invoke('system:open-config-directory', client),
    openSkillsDirectory: (client: SkillClientType): Promise<string> =>
      ipcRenderer.invoke('system:open-skills-directory', client),
  },

  // Skills 管理
  skills: {
    getInstalled: (client: SkillClientType): Promise<InstalledSkill[]> =>
      ipcRenderer.invoke('skills:get-installed', client),
    getAllInstalled: (): Promise<AllSkillsResult> =>
      ipcRenderer.invoke('skills:get-all-installed'),
    install: (skillId: string, sourceInfo: SkillSourceMeta, clients: SkillClientType[]): Promise<SkillInstallResult> =>
      ipcRenderer.invoke('skills:install', skillId, sourceInfo, clients),
    uninstall: (skillName: string, clients: SkillClientType[]): Promise<void> =>
      ipcRenderer.invoke('skills:uninstall', skillName, clients),
    update: (skillName: string, client: SkillClientType): Promise<{ updated: boolean; error?: string }> =>
      ipcRenderer.invoke('skills:update', skillName, client),
    updateAll: (client: SkillClientType): Promise<{ updated: number; failed: number }> =>
      ipcRenderer.invoke('skills:update-all', client),
    isInstalled: (skillId: string): Promise<boolean> =>
      ipcRenderer.invoke('skills:is-installed', skillId),
    parseImportUrl: (url: string): Promise<ImportParseResult> =>
      ipcRenderer.invoke('skills:parse-import-url', url),
    installFromDiscovered: (skill: DiscoveredSkill, clients: SkillClientType[]): Promise<SkillInstallResult> =>
      ipcRenderer.invoke('skills:install-from-discovered', skill, clients),
    getLocalDetail: (skillId: string): Promise<LocalSkillDetail | null> =>
      ipcRenderer.invoke('skills:get-local-detail', skillId),
  },

  // MCP Inspector
  mcp: {
    connect: (sessionId: string, config: { command: string; args?: string[]; env?: Record<string, string> }): Promise<{ success: boolean; serverInfo?: { name?: string; version?: string }; error?: string }> =>
      ipcRenderer.invoke('mcp:connect', sessionId, config),
    disconnect: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('mcp:disconnect', sessionId),
    isConnected: (sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke('mcp:is-connected', sessionId),
    listTools: (sessionId: string): Promise<{ success: boolean; tools?: McpTool[]; error?: string }> =>
      ipcRenderer.invoke('mcp:list-tools', sessionId),
    callTool: (sessionId: string, name: string, args: Record<string, unknown>): Promise<{ success: boolean; result?: unknown; error?: string }> =>
      ipcRenderer.invoke('mcp:call-tool', sessionId, name, args),
    listResources: (sessionId: string): Promise<{ success: boolean; resources?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('mcp:list-resources', sessionId),
    listPrompts: (sessionId: string): Promise<{ success: boolean; prompts?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('mcp:list-prompts', sessionId),
    // 事件监听
    onStderr: (callback: (data: { sessionId: string; message: string }) => void) => {
      ipcRenderer.on('mcp:stderr', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('mcp:stderr');
    },
    onDisconnected: (callback: (data: { sessionId: string; code: number }) => void) => {
      ipcRenderer.on('mcp:disconnected', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('mcp:disconnected');
    },
    onError: (callback: (data: { sessionId: string; error: string }) => void) => {
      ipcRenderer.on('mcp:error', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('mcp:error');
    },
  },

  // 缓存管理 (SWR 本地持久化缓存)
  cache: {
    get: <T>(key: CacheKey): Promise<CacheEntry<T> | null> =>
      ipcRenderer.invoke('cache:get', key),
    set: <T>(key: CacheKey, data: T, etag?: string): Promise<void> =>
      ipcRenderer.invoke('cache:set', key, data, etag),
    getMeta: (key: CacheKey): Promise<CacheMeta> =>
      ipcRenderer.invoke('cache:get-meta', key),
    isExpired: (key: CacheKey): Promise<boolean> =>
      ipcRenderer.invoke('cache:is-expired', key),
    has: (key: CacheKey): Promise<boolean> =>
      ipcRenderer.invoke('cache:has', key),
    delete: (key: CacheKey): Promise<void> =>
      ipcRenderer.invoke('cache:delete', key),
    clear: (): Promise<void> =>
      ipcRenderer.invoke('cache:clear'),
    clearByPrefix: (prefix: 'official' | 'smithery' | 'skills'): Promise<void> =>
      ipcRenderer.invoke('cache:clear-by-prefix', prefix),
    getStats: (): Promise<CacheStats> =>
      ipcRenderer.invoke('cache:get-stats'),
    getDirectory: (): Promise<string> =>
      ipcRenderer.invoke('cache:get-directory'),
  },
};

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', api);

// 类型声明
export type ElectronAPI = typeof api;
