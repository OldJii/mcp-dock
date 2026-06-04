/**
 * Cache Manager - 本地持久化缓存管理（带 AES-256-GCM 加密）
 * 
 * 安全特性：
 * - 使用 AES-256-GCM 对称加密算法
 * - 加密密钥基于机器特征派生（不使用系统钥匙串，避免弹窗）
 * - 每个缓存文件使用随机 IV，防止重放攻击
 * - GCM 模式提供认证加密，防止数据篡改
 * 
 * 缓存策略：Stale-While-Revalidate (SWR)
 * 1. 启动时立即返回本地缓存数据（即使已过期）
 * 2. 后台静默检查更新
 * 3. 网络失败时优雅降级到缓存数据
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';

// ==================== 加密常量 ====================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;           // GCM 推荐 IV 长度
const AUTH_TAG_LENGTH = 16;     // GCM 认证标签长度
const KEY_LENGTH = 32;          // AES-256 密钥长度

// ==================== 类型定义 ====================

/**
 * 缓存条目结构
 */
interface CacheEntry<T = unknown> {
  data: T;
  cachedAt: number;      // 缓存时间戳 (ms)
  expiresAt: number;     // 建议过期时间戳 (ms)，过期后仍可使用但应刷新
  version: string;       // 缓存版本号
  etag?: string;         // 用于增量更新
}

/**
 * 缓存元数据（不含数据本身，用于快速检查）
 */
interface CacheMeta {
  cachedAt: number;
  expiresAt: number;
  version: string;
  exists: boolean;
}

/**
 * 缓存键类型
 */
type CacheKey = 
  | 'official-index' 
  | 'smithery-index' 
  | 'skills-index'
  | `official-detail-${string}`
  | `smithery-detail-${string}`
  | `skills-detail-${string}`;

/**
 * 缓存配置
 */
interface CacheConfig {
  /** 列表数据 TTL (ms) - 默认 1 小时 */
  indexTTL: number;
  /** 详情数据 TTL (ms) - 默认 24 小时 */
  detailTTL: number;
  /** 缓存版本号，用于强制失效 */
  version: string;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: CacheConfig = {
  indexTTL: 60 * 60 * 1000,        // 1 小时
  detailTTL: 24 * 60 * 60 * 1000,  // 24 小时
  version: '1.0.0',
};

// ==================== CacheManager 类 ====================

export class CacheManager {
  private cacheDir: string;
  private config: CacheConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private encryptionKey: Buffer | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 缓存目录：~/.mcp-dock/cache/
    const userDataPath = app.getPath('home');
    this.cacheDir = path.join(userDataPath, '.mcp-dock', 'cache');
    
    // 确保缓存目录存在
    this.ensureCacheDir();
    
    // 初始化加密密钥
    this.initEncryptionKey();
  }

  // ==================== 加密相关方法 ====================

  /**
   * 初始化加密密钥
   * 基于机器特征派生密钥（不使用系统钥匙串，避免弹窗）
   * 
   * 注意：缓存的数据是公开的 API 数据（MCP Server 列表等），
   * 不包含用户敏感信息，因此不需要系统级别的密钥保护。
   * 使用机器特征派生密钥提供基本的数据保护。
   */
  private initEncryptionKey(): void {
    this.encryptionKey = this.deriveKey();
    
    // 清理旧的 safeStorage 密钥文件（如果存在）
    const oldKeyFile = path.join(this.cacheDir, '.keyref');
    if (fs.existsSync(oldKeyFile)) {
      try {
        fs.unlinkSync(oldKeyFile);
      } catch {
        // 忽略删除失败
      }
    }
  }

  /**
   * 基于机器特征派生密钥
   * 使用 scrypt 算法确保密钥强度
   */
  private deriveKey(): Buffer {
    // 组合多个机器特征作为密钥材料
    const machineId = [
      process.platform,
      process.arch,
      app.getPath('home'),
      app.getName(),
    ].join('-');
    
    return crypto.scryptSync(machineId, 'mcp-dock-cache-v2', KEY_LENGTH);
  }

  /**
   * 加密数据
   */
  private encrypt(plaintext: string): Buffer {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // 格式：[IV (12 bytes)][AuthTag (16 bytes)][Encrypted Data]
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * 解密数据
   */
  private decrypt(ciphertext: Buffer): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    if (ciphertext.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid ciphertext: too short');
    }

    const iv = ciphertext.subarray(0, IV_LENGTH);
    const authTag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = ciphertext.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  // ==================== 文件操作方法 ====================

  /**
   * 确保缓存目录存在
   */
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    
    // 创建详情子目录
    const detailsDir = path.join(this.cacheDir, 'details');
    if (!fs.existsSync(detailsDir)) {
      fs.mkdirSync(detailsDir, { recursive: true });
    }
  }

  /**
   * 获取缓存文件路径（.enc 扩展名表示加密文件）
   */
  private getCachePath(key: CacheKey): string {
    if (key.includes('-detail-')) {
      return path.join(this.cacheDir, 'details', `${key}.enc`);
    }
    return path.join(this.cacheDir, `${key}.enc`);
  }

  /**
   * 获取 TTL
   */
  private getTTL(key: CacheKey): number {
    return key.includes('-detail-') ? this.config.detailTTL : this.config.indexTTL;
  }

  // ==================== 缓存操作方法 ====================

  /**
   * 读取缓存（优先内存，其次加密文件）
   */
  async get<T>(key: CacheKey): Promise<CacheEntry<T> | null> {
    // 1. 检查内存缓存
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key) as CacheEntry<T>;
      if (entry.version === this.config.version) {
        return entry;
      }
    }

    // 2. 从加密文件读取
    const filePath = this.getCachePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const encryptedData = fs.readFileSync(filePath);
      const decrypted = this.decrypt(encryptedData);
      const entry = JSON.parse(decrypted) as CacheEntry<T>;
      
      // 检查版本是否匹配
      if (entry.version !== this.config.version) {
        fs.unlinkSync(filePath);
        return null;
      }

      // 写入内存缓存
      this.memoryCache.set(key, entry);
      return entry;
    } catch (error) {
      console.error(`Failed to read/decrypt cache for ${key}:`, error);
      // 删除损坏的缓存文件
      try { fs.unlinkSync(filePath); } catch {}
      return null;
    }
  }

  /**
   * 写入缓存（加密后存储）
   */
  async set<T>(key: CacheKey, data: T, etag?: string): Promise<void> {
    const now = Date.now();
    const ttl = this.getTTL(key);
    
    const entry: CacheEntry<T> = {
      data,
      cachedAt: now,
      expiresAt: now + ttl,
      version: this.config.version,
      etag,
    };

    // 写入内存缓存
    this.memoryCache.set(key, entry as CacheEntry);

    // 加密并写入文件
    const filePath = this.getCachePath(key);
    try {
      const plaintext = JSON.stringify(entry);
      const encrypted = this.encrypt(plaintext);
      fs.writeFileSync(filePath, encrypted);
    } catch (error) {
      console.error(`Failed to encrypt/write cache for ${key}:`, error);
    }
  }

  /**
   * 获取缓存元数据（不解密数据本身，从内存或解密获取）
   */
  async getMeta(key: CacheKey): Promise<CacheMeta> {
    // 检查内存缓存
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      return {
        cachedAt: entry.cachedAt,
        expiresAt: entry.expiresAt,
        version: entry.version,
        exists: true,
      };
    }

    // 需要解密才能获取元数据
    const entry = await this.get(key);
    if (entry) {
      return {
        cachedAt: entry.cachedAt,
        expiresAt: entry.expiresAt,
        version: entry.version,
        exists: true,
      };
    }

    return { cachedAt: 0, expiresAt: 0, version: '', exists: false };
  }

  /**
   * 检查缓存是否过期
   */
  async isExpired(key: CacheKey): Promise<boolean> {
    const meta = await this.getMeta(key);
    if (!meta.exists) return true;
    return Date.now() > meta.expiresAt;
  }

  /**
   * 检查缓存是否存在且有效
   */
  async has(key: CacheKey): Promise<boolean> {
    const meta = await this.getMeta(key);
    return meta.exists;
  }

  /**
   * 删除指定缓存
   */
  async delete(key: CacheKey): Promise<void> {
    this.memoryCache.delete(key);
    
    const filePath = this.getCachePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    const files = fs.readdirSync(this.cacheDir);
    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile() && file.endsWith('.enc')) {
        fs.unlinkSync(filePath);
      } else if (stat.isDirectory() && file === 'details') {
        const detailFiles = fs.readdirSync(filePath);
        for (const detailFile of detailFiles) {
          if (detailFile.endsWith('.enc')) {
            fs.unlinkSync(path.join(filePath, detailFile));
          }
        }
      }
    }
  }

  /**
   * 清除指定类型的缓存
   */
  async clearByPrefix(prefix: 'official' | 'smithery' | 'skills'): Promise<void> {
    // 清除内存缓存
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    // 清除文件缓存
    const indexFile = path.join(this.cacheDir, `${prefix}-index.enc`);
    if (fs.existsSync(indexFile)) {
      fs.unlinkSync(indexFile);
    }

    // 清除详情缓存
    const detailsDir = path.join(this.cacheDir, 'details');
    if (fs.existsSync(detailsDir)) {
      const files = fs.readdirSync(detailsDir);
      for (const file of files) {
        if (file.startsWith(`${prefix}-detail-`) && file.endsWith('.enc')) {
          fs.unlinkSync(path.join(detailsDir, file));
        }
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    indexCaches: string[];
    detailCaches: number;
    encrypted: boolean;
  }> {
    let totalFiles = 0;
    let totalSize = 0;
    const indexCaches: string[] = [];
    let detailCaches = 0;

    const mainFiles = fs.readdirSync(this.cacheDir);
    for (const file of mainFiles) {
      const filePath = path.join(this.cacheDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile() && file.endsWith('.enc')) {
        totalFiles++;
        totalSize += stat.size;
        indexCaches.push(file.replace('.enc', ''));
      } else if (stat.isDirectory() && file === 'details') {
        const detailFiles = fs.readdirSync(filePath);
        for (const detailFile of detailFiles) {
          if (detailFile.endsWith('.enc')) {
            const detailPath = path.join(filePath, detailFile);
            const detailStat = fs.statSync(detailPath);
            totalFiles++;
            totalSize += detailStat.size;
            detailCaches++;
          }
        }
      }
    }

    return { 
      totalFiles, 
      totalSize, 
      indexCaches, 
      detailCaches,
      encrypted: true  // 标记为加密存储
    };
  }

  /**
   * 获取缓存目录路径
   */
  getCacheDirectory(): string {
    return this.cacheDir;
  }
}

// ==================== 单例导出 ====================

let cacheManagerInstance: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager();
  }
  return cacheManagerInstance;
}
