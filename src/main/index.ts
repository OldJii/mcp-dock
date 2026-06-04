/**
 * MCP Dock - Electron 主进程入口
 */

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { ConfigManager, ClientType, SkillClientType } from './config-manager';
import { EnvManager } from './env-manager';
import { HistoryManager } from './history-manager';
import { SkillsManager, SkillSourceMeta, DiscoveredSkill } from './skills-manager';
import { getCacheManager } from './cache-manager';
import { createMcpClient, getMcpClient, removeMcpClient } from './mcp-client';

// 管理器实例
const configManager = new ConfigManager();
const envManager = new EnvManager();
const historyManager = new HistoryManager();
const skillsManager = new SkillsManager();
const cacheManager = getCacheManager();

let mainWindow: BrowserWindow | null = null;

// 开发模式：明确设置了 NODE_ENV=development 或 VITE_DEV_SERVER_URL
const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  
  // 图标路径：根据平台和模式选择正确的图标文件
  // 开发模式: __dirname = mcp-dock-core/dist/main, build 在 ../../build
  // 生产模式: __dirname = app.asar/dist/main, build 在 app.asar/build (即 ../../build)
  const getIconPath = () => {
    const basePath = path.join(__dirname, '../../build');
    if (isMac) {
      return path.join(basePath, 'icon.icns');
    } else if (isWin) {
      return path.join(basePath, 'icon.ico');
    } else {
      return path.join(basePath, 'icon.png');
    }
  };
  
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    icon: getIconPath(),
    // macOS 特有的标题栏样式
    ...(isMac ? {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 18 },
    } : {}),
    // Windows 特有配置
    ...(isWin ? {
      frame: true,
      autoHideMenuBar: true,
    } : {}),
    backgroundColor: '#1c1c1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload', 'index.js'),
    },
  });

  // 开发模式加载 Vite 开发服务器
  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 外部链接在默认浏览器中打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  // ============================================================================
  // DNS 配置：使用安全的 DNS 服务器避免 DNS 污染
  // ============================================================================
  app.configureHostResolver({
    enableBuiltInResolver: true,
    secureDnsMode: 'secure',
    secureDnsServers: [
      'https://1.1.1.1/dns-query',      // Cloudflare DoH
      'https://8.8.8.8/dns-query',      // Google DoH
      'https://dns.alidns.com/dns-query' // 阿里 DoH（国内备用）
    ],
  });
  // macOS: 设置 Dock 图标（使用 PNG 格式，因为 dock.setIcon 不支持 icns）
  if (process.platform === 'darwin') {
    const dockIconPath = path.join(__dirname, '../../build/icon.png');
    try {
      app.dock.setIcon(dockIconPath);
    } catch (e) {
      console.warn('Failed to set dock icon:', e);
    }
  }
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用 (macOS 除外)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============ IPC 处理器 ============

// 客户端管理
ipcMain.handle('clients:get-all', async () => {
  return configManager.getAllClients();
});

// 配置管理
ipcMain.handle('config:read', async (_, client?: ClientType) => {
  return configManager.readConfig(client);
});

ipcMain.handle('config:write', async (_, config: any, client?: ClientType) => {
  await historyManager.backup();
  return configManager.writeConfig(config, client);
});

ipcMain.handle('config:get-servers', async (_, client?: ClientType) => {
  return configManager.getInstalledServers(client);
});

ipcMain.handle('config:get-all-servers', async () => {
  return configManager.getAllInstalledServers();
});

ipcMain.handle('config:install-server', async (_, serverId: string, serverConfig: any, clients: ClientType[]) => {
  await historyManager.backup();
  return configManager.installServer(serverId, serverConfig, clients);
});

ipcMain.handle('config:uninstall-server', async (_, serverId: string, clients: ClientType[]) => {
  await historyManager.backup();
  return configManager.uninstallServer(serverId, clients);
});

ipcMain.handle('config:update-server', async (_, serverId: string, serverConfig: any, client?: ClientType) => {
  await historyManager.backup();
  return configManager.updateServer(serverId, serverConfig, client);
});

ipcMain.handle('config:sync-server', async (_, serverId: string, sourceClient: ClientType, targetClients: ClientType[]) => {
  await historyManager.backup();
  return configManager.syncServerToClients(serverId, sourceClient, targetClients);
});

// 环境检测
ipcMain.handle('env:check-runtime', async (_, runtime: 'node' | 'python') => {
  return envManager.checkRuntime(runtime);
});

ipcMain.handle('env:get-all-runtimes', async () => {
  return envManager.getAllRuntimes();
});

ipcMain.handle('env:get-npx-path', async () => {
  return envManager.getNpxPath();
});

ipcMain.handle('env:get-uvx-path', async () => {
  return envManager.getUvxPath();
});

// 历史记录
ipcMain.handle('history:list', async () => {
  return historyManager.listBackups();
});

ipcMain.handle('history:restore', async (_, timestamp: string) => {
  return historyManager.restore(timestamp);
});

ipcMain.handle('history:get-diff', async (_, timestamp: string) => {
  return historyManager.getDiff(timestamp);
});

ipcMain.handle('history:clear-all', async () => {
  return historyManager.clearAll();
});

// 系统信息
ipcMain.handle('system:get-platform', () => {
  return process.platform;
});

ipcMain.handle('system:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('system:open-external', async (_, url: string) => {
  return shell.openExternal(url);
});

ipcMain.handle('system:get-config-path', (_, client?: ClientType) => {
  return configManager.getConfigPath(client);
});

ipcMain.handle('clients:set-custom-path', async (_, client: ClientType, customPath: string | null) => {
  return configManager.setCustomConfigPath(client, customPath);
});

// 打开配置文件所在目录
ipcMain.handle('system:open-config-directory', async (_, client: ClientType) => {
  const configPath = configManager.getConfigPath(client);
  const dir = require('path').dirname(configPath);
  return shell.openPath(dir);
});

// ============ MCP Inspector IPC 处理器 ============

// 连接到 MCP Server
ipcMain.handle('mcp:connect', async (_, sessionId: string, config: { command: string; args?: string[]; env?: Record<string, string> }) => {
  try {
    const client = createMcpClient(sessionId);
    
    // 设置事件监听
    client.on('stderr', (message: string) => {
      mainWindow?.webContents.send('mcp:stderr', { sessionId, message });
    });
    
    client.on('disconnected', (code: number) => {
      mainWindow?.webContents.send('mcp:disconnected', { sessionId, code });
    });
    
    client.on('error', (error: Error) => {
      mainWindow?.webContents.send('mcp:error', { sessionId, error: error.message });
    });
    
    const serverInfo = await client.connect(config);
    return { success: true, serverInfo };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 断开连接
ipcMain.handle('mcp:disconnect', async (_, sessionId: string) => {
  removeMcpClient(sessionId);
  return { success: true };
});

// 获取连接状态
ipcMain.handle('mcp:is-connected', async (_, sessionId: string) => {
  const client = getMcpClient(sessionId);
  return client?.isConnected() || false;
});

// 获取工具列表
ipcMain.handle('mcp:list-tools', async (_, sessionId: string) => {
  try {
    const client = getMcpClient(sessionId);
    if (!client) {
      return { success: false, error: 'Not connected' };
    }
    const tools = await client.listTools();
    return { success: true, tools };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 调用工具
ipcMain.handle('mcp:call-tool', async (_, sessionId: string, name: string, args: Record<string, unknown>) => {
  try {
    const client = getMcpClient(sessionId);
    if (!client) {
      return { success: false, error: 'Not connected' };
    }
    const result = await client.callTool(name, args);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 获取资源列表
ipcMain.handle('mcp:list-resources', async (_, sessionId: string) => {
  try {
    const client = getMcpClient(sessionId);
    if (!client) {
      return { success: false, error: 'Not connected' };
    }
    const resources = await client.listResources();
    return { success: true, resources };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// 获取 Prompt 列表
ipcMain.handle('mcp:list-prompts', async (_, sessionId: string) => {
  try {
    const client = getMcpClient(sessionId);
    if (!client) {
      return { success: false, error: 'Not connected' };
    }
    const prompts = await client.listPrompts();
    return { success: true, prompts };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// ============ Skills IPC 处理器 ============

// 获取指定客户端的已安装 Skills
ipcMain.handle('skills:get-installed', async (_, client: SkillClientType) => {
  return skillsManager.getInstalledSkills(client);
});

// 获取所有客户端的已安装 Skills
ipcMain.handle('skills:get-all-installed', async () => {
  return skillsManager.getAllInstalledSkills();
});

// 安装 Skill
ipcMain.handle('skills:install', async (_, skillId: string, sourceInfo: SkillSourceMeta, clients: SkillClientType[]) => {
  await historyManager.backup();
  return skillsManager.installSkill(skillId, sourceInfo, clients);
});

// 卸载 Skill
ipcMain.handle('skills:uninstall', async (_, skillName: string, clients: SkillClientType[]) => {
  await historyManager.backup();
  return skillsManager.uninstallSkill(skillName, clients);
});

// 更新单个 Skill
ipcMain.handle('skills:update', async (_, skillName: string, client: SkillClientType) => {
  return skillsManager.updateSkill(skillName, client);
});

// 批量更新所有 Skills
ipcMain.handle('skills:update-all', async (_, client: SkillClientType) => {
  return skillsManager.updateAllSkills(client);
});

// 检查 Skill 是否已安装
ipcMain.handle('skills:is-installed', async (_, skillId: string) => {
  return skillsManager.isSkillInstalled(skillId);
});

// 解析导入 URL，发现 Skills
ipcMain.handle('skills:parse-import-url', async (_, url: string) => {
  return skillsManager.parseImportUrl(url);
});

// 从发现的 Skill 安装
ipcMain.handle('skills:install-from-discovered', async (_, skill: DiscoveredSkill, clients: SkillClientType[]) => {
  await historyManager.backup();
  return skillsManager.installFromDiscovered(skill, clients);
});

// 获取本地 Skill 详情
ipcMain.handle('skills:get-local-detail', async (_, skillId: string) => {
  return skillsManager.getLocalSkillDetail(skillId);
});

// 设置自定义 Skills 路径
ipcMain.handle('clients:set-custom-skills-path', async (_, client: SkillClientType, customPath: string | null) => {
  return configManager.setCustomSkillsPath(client, customPath);
});

// 打开 Skills 目录
ipcMain.handle('system:open-skills-directory', async (_, client: SkillClientType) => {
  const skillsPath = configManager.getSkillsPath(client);
  return shell.openPath(skillsPath);
});

// ============ 缓存 IPC 处理器 ============

// 缓存键类型
type CacheKey = 
  | 'official-index' 
  | 'smithery-index' 
  | 'skills-index'
  | `official-detail-${string}`
  | `smithery-detail-${string}`
  | `skills-detail-${string}`;

// 获取缓存
ipcMain.handle('cache:get', async (_event, key: CacheKey) => {
  return cacheManager.get(key);
});

// 设置缓存
ipcMain.handle('cache:set', async (_event, key: CacheKey, data: unknown, etag?: string) => {
  return cacheManager.set(key, data, etag);
});

// 获取缓存元数据
ipcMain.handle('cache:get-meta', async (_, key: CacheKey) => {
  return cacheManager.getMeta(key);
});

// 检查缓存是否过期
ipcMain.handle('cache:is-expired', async (_, key: CacheKey) => {
  return cacheManager.isExpired(key);
});

// 检查缓存是否存在
ipcMain.handle('cache:has', async (_, key: CacheKey) => {
  return cacheManager.has(key);
});

// 删除指定缓存
ipcMain.handle('cache:delete', async (_, key: CacheKey) => {
  return cacheManager.delete(key);
});

// 清除所有缓存
ipcMain.handle('cache:clear', async () => {
  return cacheManager.clear();
});

// 按前缀清除缓存
ipcMain.handle('cache:clear-by-prefix', async (_, prefix: 'official' | 'smithery' | 'skills') => {
  return cacheManager.clearByPrefix(prefix);
});

// 获取缓存统计信息
ipcMain.handle('cache:get-stats', async () => {
  return cacheManager.getStats();
});

// 获取缓存目录路径
ipcMain.handle('cache:get-directory', async () => {
  return cacheManager.getCacheDirectory();
});
