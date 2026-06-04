/**
 * MCP JSON-RPC 客户端
 * 用于 Inspector 功能，通过 stdio 与 MCP Server 通信
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import os from 'os';
import fs from 'fs';

// 缓存 shell 环境变量，避免重复执行
let cachedShellEnv: Record<string, string> | null = null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id: number;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: number;
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class McpClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = '';
  private connected = false;
  private serverInfo: { name?: string; version?: string } | null = null;

  constructor() {
    super();
  }

  /**
   * 获取用户的完整 shell 环境变量
   * 通过启动一个交互式 shell 来获取完整的环境配置
   */
  private getShellEnv(): Record<string, string> {
    if (cachedShellEnv) {
      return cachedShellEnv;
    }

    const platform = process.platform;
    
    if (platform === 'darwin' || platform === 'linux') {
      try {
        // 尝试通过交互式 shell 获取完整的环境变量
        const shell = process.env.SHELL || '/bin/zsh';
        const result = execSync(`${shell} -ilc 'env'`, {
          encoding: 'utf-8',
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        
        const env: Record<string, string> = {};
        for (const line of result.split('\n')) {
          const idx = line.indexOf('=');
          if (idx > 0) {
            const key = line.substring(0, idx);
            const value = line.substring(idx + 1);
            env[key] = value;
          }
        }
        
        cachedShellEnv = env;
        return env;
      } catch (error) {
        console.warn('[MCP] Failed to get shell env, using fallback PATH:', error);
      }
    }

    // 回退方案：使用增强的 PATH
    cachedShellEnv = {
      ...process.env as Record<string, string>,
      PATH: this.getEnhancedPath(),
    };
    return cachedShellEnv;
  }

  /**
   * 获取增强的 PATH 环境变量（回退方案）
   * 包含常见的包管理器安装路径
   */
  private getEnhancedPath(): string {
    const home = os.homedir();
    const platform = process.platform;
    const currentPath = process.env.PATH || '';

    const additionalPaths: string[] = [];

    if (platform === 'darwin' || platform === 'linux') {
      // 添加常见的可执行文件路径
      const commonPaths = [
        '/usr/local/bin',
        '/opt/homebrew/bin',           // Homebrew on Apple Silicon
        '/opt/homebrew/sbin',
        path.join(home, '.local/bin'), // pipx, uv 等
        path.join(home, '.volta/bin'), // volta
        path.join(home, '.pyenv/shims'), // pyenv
        path.join(home, '.cargo/bin'), // rust/cargo
        '/opt/local/bin',              // MacPorts
        '/usr/bin',
        '/bin',
      ];

      // 只添加实际存在的路径
      for (const p of commonPaths) {
        if (fs.existsSync(p)) {
          additionalPaths.push(p);
        }
      }

      // 尝试查找 nvm 的当前 node 路径
      const nvmDir = path.join(home, '.nvm/versions/node');
      if (fs.existsSync(nvmDir)) {
        try {
          const versions = fs.readdirSync(nvmDir);
          if (versions.length > 0) {
            // 使用最新版本
            versions.sort().reverse();
            const latestBin = path.join(nvmDir, versions[0], 'bin');
            if (fs.existsSync(latestBin)) {
              additionalPaths.push(latestBin);
            }
          }
        } catch {
          // 忽略错误
        }
      }

      // 尝试查找 fnm 的当前 node 路径
      const fnmDir = path.join(home, '.fnm/node-versions');
      if (fs.existsSync(fnmDir)) {
        try {
          const versions = fs.readdirSync(fnmDir);
          if (versions.length > 0) {
            versions.sort().reverse();
            const latestBin = path.join(fnmDir, versions[0], 'installation/bin');
            if (fs.existsSync(latestBin)) {
              additionalPaths.push(latestBin);
            }
          }
        } catch {
          // 忽略错误
        }
      }
    } else if (platform === 'win32') {
      const commonPaths = [
        path.join(home, 'AppData', 'Roaming', 'npm'),
        path.join(home, '.pyenv', 'pyenv-win', 'shims'),
      ];

      for (const p of commonPaths) {
        if (fs.existsSync(p)) {
          additionalPaths.push(p);
        }
      }
    }

    return [...additionalPaths, currentPath].join(path.delimiter);
  }

  /**
   * 连接到 MCP Server
   */
  async connect(config: McpServerConfig): Promise<{ name?: string; version?: string }> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    return new Promise((resolve, reject) => {
      try {
        // 获取完整的 shell 环境变量，解决 GUI 启动时环境变量不完整的问题
        const shellEnv = this.getShellEnv();
        const env = {
          ...shellEnv,
          ...config.env,
        };

        // 启动进程
        this.process = spawn(config.command, config.args || [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env,
          shell: true,
        });

        // 处理 stdout
        this.process.stdout?.on('data', (data: Buffer) => {
          this.handleData(data.toString());
        });

        // 处理 stderr
        this.process.stderr?.on('data', (data: Buffer) => {
          const message = data.toString();
          console.error('[MCP stderr]', message);
          this.emit('stderr', message);
        });

        // 处理进程退出
        this.process.on('exit', (code) => {
          this.connected = false;
          this.emit('disconnected', code);
          this.rejectAllPending(new Error(`Process exited with code ${code}`));
        });

        // 处理错误
        this.process.on('error', (error) => {
          this.connected = false;
          this.emit('error', error);
          reject(error);
        });

        // 发送初始化请求
        this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'MCP Dock Inspector',
            version: '1.0.0',
          },
        }).then((result: unknown) => {
          const initResult = result as { serverInfo?: { name?: string; version?: string } };
          this.serverInfo = initResult.serverInfo || null;
          this.connected = true;
          
          // 发送 initialized 通知
          this.sendNotification('notifications/initialized', {});
          
          this.emit('connected', this.serverInfo);
          resolve(this.serverInfo || {});
        }).catch((error) => {
          this.disconnect();
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.buffer = '';
    this.rejectAllPending(new Error('Disconnected'));
  }

  /**
   * 获取工具列表
   */
  async listTools(): Promise<McpTool[]> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const result = await this.sendRequest('tools/list', {}) as { tools: McpTool[] };
    return result.tools || [];
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
    return result;
  }

  /**
   * 获取资源列表
   */
  async listResources(): Promise<unknown[]> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    try {
      const result = await this.sendRequest('resources/list', {}) as { resources: unknown[] };
      return result.resources || [];
    } catch {
      // 如果服务器不支持资源，返回空数组
      return [];
    }
  }

  /**
   * 获取 Prompt 列表
   */
  async listPrompts(): Promise<unknown[]> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    try {
      const result = await this.sendRequest('prompts/list', {}) as { prompts: unknown[] };
      return result.prompts || [];
    } catch {
      // 如果服务器不支持 prompts，返回空数组
      return [];
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取服务器信息
   */
  getServerInfo(): { name?: string; version?: string } | null {
    return this.serverInfo;
  }

  /**
   * 发送 JSON-RPC 请求
   */
  private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('No stdin available'));
        return;
      }

      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id,
      };

      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify(request) + '\n';
      this.process.stdin.write(message);

      // 设置超时
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * 发送通知（无需响应）
   */
  private sendNotification(method: string, params?: Record<string, unknown>): void {
    if (!this.process?.stdin) {
      return;
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const message = JSON.stringify(notification) + '\n';
    this.process.stdin.write(message);
  }

  /**
   * 处理接收到的数据
   */
  private handleData(data: string): void {
    this.buffer += data;

    // 按行分割处理
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line) as JsonRpcResponse;
          this.handleResponse(response);
        } catch (error) {
          console.error('[MCP] Failed to parse response:', line, error);
        }
      }
    }
  }

  /**
   * 处理 JSON-RPC 响应
   */
  private handleResponse(response: JsonRpcResponse): void {
    // 处理通知（没有 id）
    if (!('id' in response)) {
      this.emit('notification', response);
      return;
    }

    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn('[MCP] Received response for unknown request:', response.id);
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * 拒绝所有待处理的请求
   */
  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}

// 全局 MCP 客户端实例管理
const clients = new Map<string, McpClient>();

export function getMcpClient(id: string): McpClient | undefined {
  return clients.get(id);
}

export function createMcpClient(id: string): McpClient {
  // 如果已存在，先断开
  const existing = clients.get(id);
  if (existing) {
    existing.disconnect();
  }

  const client = new McpClient();
  clients.set(id, client);
  return client;
}

export function removeMcpClient(id: string): void {
  const client = clients.get(id);
  if (client) {
    client.disconnect();
    clients.delete(id);
  }
}
