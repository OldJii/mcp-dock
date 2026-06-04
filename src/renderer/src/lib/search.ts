/**
 * 搜索工具
 * 使用 Fuse.js 进行本地模糊搜索
 * 
 * 搜索范围：
 * - displayName: MCP 名称
 * - id: MCP ID（通常包含作者信息，如 "io.github.author/mcp-name"）
 * - author: 作者名（仅 Smithery 数据源有）
 */

import Fuse from 'fuse.js';
import type { ServerListItem } from '../api/registry';

// Fuse.js 配置 - 只搜索名称和作者
const fuseOptions: Fuse.IFuseOptions<ServerListItem> = {
  keys: [
    { name: 'displayName', weight: 0.5 },  // MCP 名称
    { name: 'id', weight: 0.3 },           // ID（包含作者信息）
    { name: 'author', weight: 0.2 },       // 作者名（仅 Smithery）
  ],
  threshold: 0.3, // 降低阈值，提高精确度
  includeScore: true,
  minMatchCharLength: 1, // 最小匹配字符数
  ignoreLocation: true, // 忽略位置，提高匹配率
};

/**
 * 搜索服务器
 */
export function searchServers(
  servers: ServerListItem[],
  query: string
): ServerListItem[] {
  // 如果没有搜索词，直接返回原始列表
  if (!query || !query.trim()) {
    return servers;
  }

  const trimmedQuery = query.trim();
  
  // 每次搜索都创建新的 Fuse 实例，确保数据一致性
  const fuse = new Fuse(servers, fuseOptions);
  
  // 执行搜索
  const results = fuse.search(trimmedQuery);
  return results.map((result) => result.item);
}

/**
 * 分页
 */
export function paginateServers(
  servers: ServerListItem[],
  page: number,
  pageSize: number
): {
  items: ServerListItem[];
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
} {
  const totalItems = servers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  
  // 确保页码在有效范围内
  const validPage = Math.max(1, Math.min(page, totalPages));
  
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const items = servers.slice(startIndex, endIndex);

  return {
    items,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
  };
}
