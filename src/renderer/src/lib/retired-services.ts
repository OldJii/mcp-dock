/**
 * 已停止服务的识别
 *
 * Smithery 官方公告（https://smithery.ai/future）：2026-10-31 起停止 API、托管代理连接
 * （run.tools 与 server.smithery.ai 上的 Server 地址）、CLI/SDK、账号与密钥服务。
 *
 * 只用于在已安装列表里标注本机已有配置：只读判断，不改写、不删除、不猜测替换地址。
 * 判断依据是实际连接方式（连接地址的主机名、启动命令里的包），不看名称：
 * 直接连接厂商自己的地址、或使用其他启动器的配置都不受影响。
 */

const RETIRED_HOSTS = ['run.tools', 'smithery.ai'];
const RETIRED_LAUNCHER_PACKAGES = ['@smithery/cli'];

function isRetiredHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return RETIRED_HOSTS.some(retired => host === retired || host.endsWith(`.${retired}`));
}

function isRetiredUrl(value: unknown): boolean {
  try {
    return isRetiredHost(new URL(String(value)).hostname);
  } catch {
    return false;
  }
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// 包名前后必须是边界，避免把名字相近的其他包误判进来
const LAUNCHER_PATTERN = new RegExp(
  `(^|[\\s"'/])(${RETIRED_LAUNCHER_PACKAGES.map(escapeRegExp).join('|')})(@[^\\s"']*)?($|[\\s"'])`,
  'i',
);

function mentionsRetiredLauncher(value: unknown): boolean {
  return LAUNCHER_PATTERN.test(String(value ?? ''));
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>]+/gi;

// 参数里的地址：整个参数就是地址，或形如 `--url=https://…` 的片段
function argPointsToRetiredHost(arg: unknown): boolean {
  if (typeof arg !== 'string') return false;
  return isRetiredUrl(arg) || (arg.match(URL_IN_TEXT) || []).some(isRetiredUrl);
}

export interface RetiredCheckableConfig {
  command?: unknown;
  args?: unknown;
  url?: unknown;
  serverUrl?: unknown;
  httpUrl?: unknown;
}

/**
 * 一条已有的 MCP 配置是否依赖已停止的服务：
 * 远程地址指向 run.tools / smithery.ai，或启动命令通过 @smithery/cli 运行（含 mcp-remote 等桥接到这些地址的参数）。
 */
export function isRetiredServerConfig(config: RetiredCheckableConfig | null | undefined): boolean {
  if (!config || typeof config !== 'object') return false;
  if ([config.url, config.serverUrl, config.httpUrl].some(isRetiredUrl)) return true;
  const args = Array.isArray(config.args) ? config.args : [];
  if (args.some(arg => mentionsRetiredLauncher(arg) || argPointsToRetiredHost(arg))) return true;
  return mentionsRetiredLauncher(config.command);
}
