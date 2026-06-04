/**
 * Electron Preload 脚本类型定义
 */

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

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

declare const api: {
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
  };
  mcp: {
    connect: (sessionId: string, config: { command: string; args?: string[]; env?: Record<string, string> }) => Promise<{ success: boolean; serverInfo?: { name?: string; version?: string }; error?: string }>;
    disconnect: (sessionId: string) => Promise<{ success: boolean }>;
    isConnected: (sessionId: string) => Promise<boolean>;
    listTools: (sessionId: string) => Promise<{ success: boolean; tools?: McpTool[]; error?: string }>;
    callTool: (sessionId: string, name: string, args: Record<string, unknown>) => Promise<{ success: boolean; result?: unknown; error?: string }>;
    listResources: (sessionId: string) => Promise<{ success: boolean; resources?: unknown[]; error?: string }>;
    listPrompts: (sessionId: string) => Promise<{ success: boolean; prompts?: unknown[]; error?: string }>;
    onStderr: (callback: (data: { sessionId: string; message: string }) => void) => () => void;
    onDisconnected: (callback: (data: { sessionId: string; code: number }) => void) => () => void;
    onError: (callback: (data: { sessionId: string; error: string }) => void) => () => void;
  };
};

export type ElectronAPI = typeof api;
