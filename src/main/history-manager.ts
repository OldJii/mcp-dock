/**
 * 历史记录管理器
 * 负责所有客户端配置文件的备份和恢复（包括 MCP Servers 和 Skills）
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ConfigManager, ClientType, SkillClientType, SKILL_SUPPORTED_CLIENTS } from './config-manager';

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
  current: Record<string, any>;
  backup: Record<string, any>;
  // Skills 变更
  skillsAdded: string[];
  skillsRemoved: string[];
}

interface BackupData {
  timestamp: string;
  clients: {
    [key in ClientType]?: {
      config: any;
      serverCount: number;
    };
  };
  skills?: {
    [key in SkillClientType]?: string[];
  };
}

export class HistoryManager {
  private backupDir: string;
  private maxBackups: number = 50;
  private configManager: ConfigManager;

  constructor() {
    this.backupDir = path.join(os.homedir(), '.mcp-dock', 'backups');
    this.configManager = new ConfigManager();
  }

  /**
   * 确保备份目录存在
   */
  private async ensureBackupDir(): Promise<void> {
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  /**
   * 生成备份文件名
   */
  private generateBackupFilename(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    return `backup-${timestamp}.json`;
  }

  /**
   * 获取指定客户端的已安装 Skills 列表
   */
  private async getInstalledSkillNames(client: SkillClientType): Promise<string[]> {
    const home = os.homedir();
    const skillsPaths: Record<SkillClientType, string> = {
      cursor: path.join(home, '.cursor', 'skills'),
      'claude-code': path.join(home, '.claude', 'skills'),
      'gemini-cli': path.join(home, '.gemini', 'skills'),
      'codex-cli': path.join(home, '.codex', 'skills'),
      opencode: path.join(home, '.config', 'opencode', 'skills'),
      'agent-skills': path.join(home, '.agents', 'skills'),
    };
    
    const skillsPath = skillsPaths[client];
    const skillNames: string[] = [];
    
    try {
      const entries = await fs.readdir(skillsPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 检查是否有 SKILL.md 文件
          const skillMdPath = path.join(skillsPath, entry.name, 'SKILL.md');
          try {
            await fs.access(skillMdPath);
            skillNames.push(entry.name);
          } catch {
            // 没有 SKILL.md，不是有效的 Skill
          }
        }
      }
    } catch {
      // 目录不存在或无法读取
    }
    
    return skillNames;
  }

  /**
   * 创建备份（备份所有客户端的配置，包括 Skills）
   */
  async backup(): Promise<string | null> {
    try {
      await this.ensureBackupDir();

      const clients: ClientType[] = ['cursor', 'claude-code', 'gemini-cli', 'codex-cli', 'windsurf', 'zed', 'trae', 'opencode'];
      const backupData: BackupData = {
        timestamp: new Date().toISOString(),
        clients: {},
        skills: {},
      };

      let totalServerCount = 0;
      let totalSkillCount = 0;

      for (const client of clients) {
        try {
          const config = await this.configManager.readConfig(client);
          const serverCount = Object.keys(config.mcpServers || {}).length;
          totalServerCount += serverCount;
          
          backupData.clients[client] = {
            config,
            serverCount,
          };
        } catch {
          // 忽略读取失败的客户端
        }
      }

      // 备份 Skills
      for (const client of SKILL_SUPPORTED_CLIENTS) {
        const skillNames = await this.getInstalledSkillNames(client);
        if (skillNames.length > 0) {
          backupData.skills![client] = skillNames;
          totalSkillCount += skillNames.length;
        }
      }

      // 只有在有配置时才创建备份
      if (totalServerCount === 0 && totalSkillCount === 0 && Object.keys(backupData.clients).length === 0) {
        return null;
      }

      const filename = this.generateBackupFilename();
      const backupPath = path.join(this.backupDir, filename);
      
      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

      // 清理旧备份
      await this.cleanOldBackups();

      return filename;
    } catch (error) {
      console.error('Backup failed:', error);
      return null;
    }
  }

  /**
   * 清理旧备份
   */
  private async cleanOldBackups(): Promise<void> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .sort()
        .reverse();

      const toDelete = backupFiles.slice(this.maxBackups);
      for (const file of toDelete) {
        await fs.unlink(path.join(this.backupDir, file));
      }
    } catch {
      // 忽略清理错误
    }
  }

  /**
   * 清空所有备份
   */
  async clearAll(): Promise<boolean> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.json'));
      
      for (const file of backupFiles) {
        await fs.unlink(path.join(this.backupDir, file));
      }
      
      return true;
    } catch (error) {
      console.error('Clear all backups failed:', error);
      return false;
    }
  }

  /**
   * 列出所有备份
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      await this.ensureBackupDir();
      
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .sort()
        .reverse();

      const backups: BackupInfo[] = [];

      for (const filename of backupFiles) {
        const filePath = path.join(this.backupDir, filename);
        
        try {
          const stat = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          const data: BackupData = JSON.parse(content);
          
          // 计算总服务器数
          let serverCount = 0;
          const clientList: ClientType[] = [];
          
          for (const [clientId, clientData] of Object.entries(data.clients || {})) {
            if (clientData) {
              serverCount += clientData.serverCount || 0;
              clientList.push(clientId as ClientType);
            }
          }

          // 计算总 Skills 数（去重）
          const allSkillNames = new Set<string>();
          for (const skillNames of Object.values(data.skills || {})) {
            if (skillNames) {
              skillNames.forEach(name => allSkillNames.add(name));
            }
          }

          backups.push({
            timestamp: data.timestamp,
            filename,
            size: stat.size,
            serverCount,
            skillCount: allSkillNames.size,
            clients: clientList,
          });
        } catch {
          // 忽略解析错误的文件
        }
      }

      return backups;
    } catch {
      return [];
    }
  }

  /**
   * 恢复备份
   */
  async restore(timestamp: string): Promise<boolean> {
    try {
      const backups = await this.listBackups();
      const backup = backups.find(b => b.timestamp === timestamp);
      
      if (!backup) {
        console.error('Backup not found:', timestamp);
        return false;
      }

      const backupPath = path.join(this.backupDir, backup.filename);
      const content = await fs.readFile(backupPath, 'utf-8');
      const data: BackupData = JSON.parse(content);
      
      // 先创建当前配置的备份
      await this.backup();
      
      // 恢复每个客户端的配置
      for (const [clientId, clientData] of Object.entries(data.clients || {})) {
        if (clientData?.config) {
          try {
            await this.configManager.writeConfig(clientData.config, clientId as ClientType);
          } catch (error) {
            console.error(`Failed to restore ${clientId}:`, error);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Restore failed:', error);
      return false;
    }
  }

  /**
   * 获取备份与当前配置的差异
   */
  async getDiff(timestamp: string): Promise<DiffResult | null> {
    try {
      const backups = await this.listBackups();
      const backupInfo = backups.find(b => b.timestamp === timestamp);
      
      if (!backupInfo) {
        return null;
      }

      const backupPath = path.join(this.backupDir, backupInfo.filename);
      const content = await fs.readFile(backupPath, 'utf-8');
      const data: BackupData = JSON.parse(content);

      // 获取当前所有服务器
      const { servers: currentServers } = await this.configManager.getAllInstalledServers();
      
      // 获取备份中的所有服务器
      const backupServers: Record<string, any> = {};
      for (const clientData of Object.values(data.clients || {})) {
        if (clientData?.config?.mcpServers) {
          for (const [serverId, serverConfig] of Object.entries(clientData.config.mcpServers)) {
            if (!backupServers[serverId]) {
              backupServers[serverId] = serverConfig;
            }
          }
        }
      }

      const currentServerIds = Object.keys(currentServers);
      const backupServerIds = Object.keys(backupServers);

      const added = currentServerIds.filter(s => !backupServerIds.includes(s));
      const removed = backupServerIds.filter(s => !currentServerIds.includes(s));
      const modified = currentServerIds.filter(s => {
        if (!backupServerIds.includes(s)) return false;
        return JSON.stringify(currentServers[s]?.config) !== JSON.stringify(backupServers[s]);
      });

      // 获取当前所有 Skills（去重）
      const currentSkillNames = new Set<string>();
      for (const client of SKILL_SUPPORTED_CLIENTS) {
        const skillNames = await this.getInstalledSkillNames(client);
        skillNames.forEach(name => currentSkillNames.add(name));
      }

      // 获取备份中的所有 Skills（去重）
      const backupSkillNames = new Set<string>();
      for (const skillNames of Object.values(data.skills || {})) {
        if (skillNames) {
          skillNames.forEach(name => backupSkillNames.add(name));
        }
      }

      const skillsAdded = [...currentSkillNames].filter(s => !backupSkillNames.has(s));
      const skillsRemoved = [...backupSkillNames].filter(s => !currentSkillNames.has(s));

      return {
        added,
        removed,
        modified,
        current: currentServers,
        backup: backupServers,
        skillsAdded,
        skillsRemoved,
      };
    } catch (error) {
      console.error('Get diff failed:', error);
      return null;
    }
  }
}
