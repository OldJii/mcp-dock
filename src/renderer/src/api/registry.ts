/**
 * Registry API - Community Edition
 *
 * This is the open-source edition of MCP Dock's registry layer.
 * It provides basic type definitions and stub implementations.
 *
 * The full version includes:
 * - Browsing 8,500+ MCP servers from Official Registry and Smithery
 * - Browsing 4,400+ AI Skills
 * - SWR caching with background revalidation
 *
 * In this edition, users can still:
 * - Manually add and configure MCP servers
 * - Install servers to any supported client
 * - Use the MCP Inspector to test servers
 * - Manage configuration history and rollback
 *
 * To enable full registry browsing, build your own data backend
 * and set the VITE_REGISTRY_API_URL environment variable.
 */

export type DataSource = 'official' | 'smithery';
export type ResourceType = 'mcp' | 'skills';

// Base server list item - minimal fields for UI rendering
export interface ServerListItem {
  id: string;
  displayName: string;
  description: string;
  iconUrl: string | null;
  [key: string]: unknown;
}

// Base server detail - minimal fields for detail page
export interface ServerDetail {
  id: string;
  displayName: string;
  description: string;
  iconUrl: string | null;
  [key: string]: unknown;
}

// Skill list item
export interface SkillListItem {
  id: string;
  name: string;
  description: string;
  author: string;
  authorUrl: string;
  category: string;
  categoryId: string;
  stars: number;
  forks: number;
  updatedAt: string;
  repository: {
    url: string;
    branch: string;
    skillPath: string;
  };
}

// Skill detail
export interface SkillDetail extends SkillListItem {
  skillMd: {
    content: string;
    lines: number;
    size: string;
    rawUrl: string;
  };
  files: Array<{
    name: string;
    path: string;
    size: string;
    rawUrl: string;
  }>;
  metadata: {
    allowedTools?: string;
    [key: string]: unknown;
  };
  stats: {
    totalFiles: number;
    totalSize: string;
    license: string;
  };
}

// Type guards (always return false in community edition)
export function isSmitheryListItem(_item: ServerListItem): boolean {
  return false;
}

export function isOfficialListItem(_item: ServerListItem): boolean {
  return false;
}

export function isSmitheryDetail(_detail: ServerDetail): boolean {
  return false;
}

export function isOfficialDetail(_detail: ServerDetail): boolean {
  return false;
}

/**
 * Register a callback for data updates (no-op in community edition)
 */
export function onDataUpdate(_key: string, _callback: (data: unknown) => void): () => void {
  return () => {};
}

/**
 * Clear cached data
 */
export async function clearCache(_source?: DataSource): Promise<void> {}

/**
 * Fetch server list - returns empty in community edition
 * To populate, connect your own registry backend via VITE_REGISTRY_API_URL
 */
export async function fetchServerList(_source: DataSource): Promise<ServerListItem[]> {
  return [];
}

/**
 * Force refresh server list
 */
export async function forceRefreshServerList(_source: DataSource): Promise<ServerListItem[]> {
  return [];
}

/**
 * Fetch server detail - stub
 */
export async function fetchServerDetail(_source: DataSource, _id: string): Promise<ServerDetail> {
  throw new Error('Registry browsing is not available in the community edition. You can still add servers manually.');
}

/**
 * Check if server detail exists
 */
export async function checkServerDetailExists(_source: DataSource, _id: string): Promise<boolean> {
  return false;
}

/**
 * Fetch README from GitHub repository
 */
export async function fetchReadmeFromGitHub(repository: {
  url: string;
  source: string;
  subfolder?: string;
} | null): Promise<string | null> {
  if (!repository?.url) return null;

  const match = repository.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  const subfolder = repository.subfolder || '';
  const basePath = subfolder ? `${subfolder}/` : '';

  const branches = ['main', 'master'];
  const readmeFiles = ['README.md', 'readme.md', 'Readme.md'];

  for (const branch of branches) {
    for (const filename of readmeFiles) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${basePath}${filename}`;
      try {
        const response = await fetch(url, { headers: { 'Accept': 'text/plain' } });
        if (response.ok) {
          const content = await response.text();
          if (content.length > 100000) {
            return content.substring(0, 100000) + '\n\n... (truncated)';
          }
          return content;
        }
      } catch {
        // try next
      }
    }
  }

  return null;
}

/**
 * Fetch skills list - returns empty in community edition
 */
export async function fetchSkillsList(): Promise<SkillListItem[]> {
  return [];
}

/**
 * Force refresh skills list
 */
export async function forceRefreshSkillsList(): Promise<SkillListItem[]> {
  return [];
}

/**
 * Clear skills cache
 */
export async function clearSkillsCache(): Promise<void> {}

/**
 * Fetch skill detail - stub
 */
export async function fetchSkillDetail(_id: string): Promise<SkillDetail> {
  throw new Error('Skills browsing is not available in the community edition.');
}
