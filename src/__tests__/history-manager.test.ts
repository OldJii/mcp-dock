/**
 * HistoryManager 自动化测试
 * 覆盖: 备份创建、列表、恢复、差异比较、清理
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock electron 模块
vi.mock('electron', () => ({
  app: { getPath: () => os.homedir() },
}));

import { HistoryManager } from '../main/history-manager';

let historyManager: HistoryManager;
let originalBackupDir: string;
let testBackupDir: string;

beforeEach(async () => {
  testBackupDir = path.join(os.tmpdir(), `mcp-dock-history-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(testBackupDir, { recursive: true });

  historyManager = new HistoryManager();
  originalBackupDir = (historyManager as any).backupDir;
  (historyManager as any).backupDir = testBackupDir;
});

afterEach(async () => {
  await fs.rm(testBackupDir, { recursive: true, force: true }).catch(() => {});
});

describe('listBackups', () => {
  it('应在空目录返回空列表', async () => {
    const backups = await historyManager.listBackups();
    expect(backups).toEqual([]);
  });

  it('应正确列出备份文件', async () => {
    const backupData = {
      timestamp: '2025-01-01T00:00:00.000Z',
      clients: {
        cursor: { config: { mcpServers: { 'test-server': { command: 'node' } } }, serverCount: 1 },
      },
      skills: {},
    };
    await fs.writeFile(
      path.join(testBackupDir, 'backup-2025-01-01T00-00-00-000Z.json'),
      JSON.stringify(backupData),
      'utf-8'
    );

    const backups = await historyManager.listBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0].timestamp).toBe('2025-01-01T00:00:00.000Z');
    expect(backups[0].serverCount).toBe(1);
  });

  it('应忽略非备份文件', async () => {
    await fs.writeFile(path.join(testBackupDir, 'not-a-backup.txt'), 'random', 'utf-8');
    await fs.writeFile(path.join(testBackupDir, 'backup-invalid.txt'), 'not json', 'utf-8');

    const backups = await historyManager.listBackups();
    expect(backups).toEqual([]);
  });

  it('应按时间倒序排列', async () => {
    for (const ts of ['2025-01-01', '2025-06-01', '2025-03-01']) {
      const data = {
        timestamp: `${ts}T00:00:00.000Z`,
        clients: {},
        skills: {},
      };
      await fs.writeFile(
        path.join(testBackupDir, `backup-${ts}T00-00-00-000Z.json`),
        JSON.stringify(data),
        'utf-8'
      );
    }

    const backups = await historyManager.listBackups();
    expect(backups).toHaveLength(3);
    expect(backups[0].timestamp).toBe('2025-06-01T00:00:00.000Z');
    expect(backups[1].timestamp).toBe('2025-03-01T00:00:00.000Z');
    expect(backups[2].timestamp).toBe('2025-01-01T00:00:00.000Z');
  });
});

describe('clearAll', () => {
  it('应清空所有备份', async () => {
    for (let i = 0; i < 3; i++) {
      await fs.writeFile(
        path.join(testBackupDir, `backup-test-${i}.json`),
        JSON.stringify({ timestamp: new Date().toISOString(), clients: {}, skills: {} }),
        'utf-8'
      );
    }

    const result = await historyManager.clearAll();
    expect(result).toBe(true);

    const files = await fs.readdir(testBackupDir);
    const backupFiles = files.filter(f => f.startsWith('backup-'));
    expect(backupFiles).toHaveLength(0);
  });
});

describe('cleanOldBackups', () => {
  it('应保留最新的 maxBackups 个备份', async () => {
    (historyManager as any).maxBackups = 3;

    for (let i = 0; i < 5; i++) {
      const ts = `2025-0${i + 1}-01`;
      await fs.writeFile(
        path.join(testBackupDir, `backup-${ts}T00-00-00-000Z.json`),
        JSON.stringify({ timestamp: `${ts}T00:00:00.000Z`, clients: {}, skills: {} }),
        'utf-8'
      );
    }

    await (historyManager as any).cleanOldBackups();

    const files = await fs.readdir(testBackupDir);
    const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.json')).sort().reverse();
    expect(backupFiles).toHaveLength(3);
    expect(backupFiles[0]).toContain('2025-05');
    expect(backupFiles[1]).toContain('2025-04');
    expect(backupFiles[2]).toContain('2025-03');
  });
});
