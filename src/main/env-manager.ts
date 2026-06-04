/**
 * 环境管理器
 * 负责检测 Node.js 和 Python 运行时环境
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

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

export class EnvManager {
  /**
   * 执行命令并获取输出
   */
  private async execCommand(command: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(command, {
        timeout: 5000,
        env: {
          ...process.env,
          PATH: this.getEnhancedPath(),
        },
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * 获取增强的 PATH 环境变量
   * 包含常见的包管理器安装路径
   */
  getEnhancedPath(): string {
    const home = os.homedir();
    const platform = process.platform;
    const currentPath = process.env.PATH || '';

    const additionalPaths: string[] = [];

    if (platform === 'darwin' || platform === 'linux') {
      additionalPaths.push(
        '/usr/local/bin',
        '/opt/homebrew/bin',
        path.join(home, '.local/bin'),
        path.join(home, '.nvm/versions/node/*/bin'),
        path.join(home, '.pyenv/shims'),
        path.join(home, '.cargo/bin'),
        '/opt/local/bin',
      );
    } else if (platform === 'win32') {
      additionalPaths.push(
        path.join(home, 'AppData', 'Local', 'Programs', 'Python', '*'),
        path.join(home, 'AppData', 'Roaming', 'npm'),
        path.join(home, '.pyenv', 'pyenv-win', 'shims'),
      );
    }

    return [...additionalPaths, currentPath].join(path.delimiter);
  }

  /**
   * 检查 Node.js 运行时
   */
  async checkNode(): Promise<RuntimeInfo> {
    const version = await this.execCommand('node --version');
    if (version) {
      const nodePath = await this.execCommand('which node') || 
                       await this.execCommand('where node');
      return {
        available: true,
        version: version.replace('v', ''),
        path: nodePath,
      };
    }
    return { available: false, version: null, path: null };
  }

  /**
   * 检查 Python 运行时
   */
  async checkPython(): Promise<RuntimeInfo> {
    // 尝试 python3 和 python
    let version = await this.execCommand('python3 --version');
    let pythonPath = await this.execCommand('which python3') ||
                     await this.execCommand('where python3');

    if (!version) {
      version = await this.execCommand('python --version');
      pythonPath = await this.execCommand('which python') ||
                   await this.execCommand('where python');
    }

    if (version) {
      return {
        available: true,
        version: version.replace('Python ', ''),
        path: pythonPath,
      };
    }
    return { available: false, version: null, path: null };
  }

  /**
   * 检查 npx
   */
  async checkNpx(): Promise<RuntimeInfo> {
    const version = await this.execCommand('npx --version');
    if (version) {
      const npxPath = await this.execCommand('which npx') ||
                      await this.execCommand('where npx');
      return {
        available: true,
        version,
        path: npxPath,
      };
    }
    return { available: false, version: null, path: null };
  }

  /**
   * 检查 uvx (Python 包运行器)
   */
  async checkUvx(): Promise<RuntimeInfo> {
    const version = await this.execCommand('uvx --version');
    if (version) {
      const uvxPath = await this.execCommand('which uvx') ||
                      await this.execCommand('where uvx');
      return {
        available: true,
        version,
        path: uvxPath,
      };
    }
    return { available: false, version: null, path: null };
  }

  /**
   * 检查指定运行时
   */
  async checkRuntime(runtime: 'node' | 'python'): Promise<RuntimeInfo> {
    if (runtime === 'node') {
      return this.checkNode();
    }
    return this.checkPython();
  }

  /**
   * 获取所有运行时信息
   */
  async getAllRuntimes(): Promise<AllRuntimes> {
    const [node, python, npx, uvx] = await Promise.all([
      this.checkNode(),
      this.checkPython(),
      this.checkNpx(),
      this.checkUvx(),
    ]);

    return { node, python, npx, uvx };
  }

  /**
   * 获取 npx 路径
   */
  async getNpxPath(): Promise<string> {
    const npx = await this.checkNpx();
    return npx.path || 'npx';
  }

  /**
   * 获取 uvx 路径
   */
  async getUvxPath(): Promise<string> {
    const uvx = await this.checkUvx();
    return uvx.path || 'uvx';
  }
}
