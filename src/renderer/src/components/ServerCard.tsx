/**
 * 服务器卡片组件 - 网格布局卡片
 * 支持多数据源 (Official / Smithery)
 * 紧凑高度设计
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ServerListItem, DataSource, OfficialListItem } from '../api/registry';
import { isSmitheryListItem, isOfficialListItem } from '../api/registry';
import { DownloadIcon, VerifiedIcon, ClockIcon } from './Icons';

interface ServerCardProps {
  server: ServerListItem;
  dataSource: DataSource;
  isInstalled?: boolean;
}

// 格式化数字
function formatNumber(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// 格式化相对时间
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return '';
  }
}

// 从仓库 URL 提取 GitHub 用户名
function extractGitHubUsername(repoUrl: string | null | undefined): string | null {
  if (!repoUrl) return null;
  const match = repoUrl.match(/github\.com\/([^\/]+)/);
  return match ? match[1] : null;
}

// 获取 GitHub 用户头像 URL
function getGitHubAvatarUrl(username: string): string {
  return `https://avatars.githubusercontent.com/${username}`;
}

// 服务器图标组件
function ServerIcon({ server }: { server: ServerListItem }) {
  const [imgError, setImgError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  
  // 获取仓库 URL (仅 Official 数据源)
  const repoUrl = isOfficialListItem(server) ? (server as OfficialListItem).repository?.url : null;
  const githubUsername = extractGitHubUsername(repoUrl);
  
  // 首字母图标
  const initial = server.displayName.charAt(0).toUpperCase();
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
  ];
  const colorIndex = server.displayName.charCodeAt(0) % colors.length;
  
  // 优先使用服务器图标
  if (server.iconUrl && !imgError) {
    return (
      <img
        src={server.iconUrl}
        alt={server.displayName}
        className="w-9 h-9 rounded-xl object-cover"
        onError={() => setImgError(true)}
      />
    );
  }
  
  // 其次使用 GitHub 头像
  if (githubUsername && !avatarError) {
    return (
      <img
        src={getGitHubAvatarUrl(githubUsername)}
        alt={server.displayName}
        className="w-9 h-9 rounded-xl object-cover"
        onError={() => setAvatarError(true)}
      />
    );
  }
  
  // 最后使用首字母图标
  return (
    <div className={`w-9 h-9 rounded-xl ${colors[colorIndex]} flex items-center justify-center text-white font-semibold text-sm`}>
      {initial}
    </div>
  );
}

export default function ServerCard({ server, dataSource, isInstalled }: ServerCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/detail/${dataSource}/${encodeURIComponent(server.id)}`);
  };

  // 获取更新时间（Official 数据源）
  const lastCommitAt = isOfficialListItem(server) ? (server as any).lastCommitAt : null;
  const updatedAt = isOfficialListItem(server) ? (server as any).updatedAt : null;
  const updateTime = lastCommitAt || updatedAt;

  return (
    <div
      onClick={handleClick}
      className="card p-3 cursor-pointer hover:bg-[#3a3a3c]/30 transition-colors flex flex-col h-[115px]"
    >
      {/* 顶部内容区域 */}
      <div className="flex items-start gap-2.5 flex-1 min-h-0">
        {/* 图标 */}
        <div className="flex-shrink-0">
          <ServerIcon server={server} />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[13px] font-medium text-white truncate">
              {server.displayName}
            </h3>
            {isInstalled && (
              <span className="tag tag-success text-[9px] px-1 py-0 flex-shrink-0">
                {t('detail.installed')}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#98989d] line-clamp-2 mt-0.5 leading-relaxed">
            {server.description || 'No description'}
          </p>
        </div>
      </div>

      {/* 底部信息 - 紧凑设计 */}
      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[#3a3a3c]/50">
        {isOfficialListItem(server) ? (
          // Official 数据源
          <>
            <div className="flex items-center gap-2 text-[10px] text-[#636366]">
              <span className="font-mono">v{server.version}</span>
              {(server as any).author && (
                <span>@{(server as any).author}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#636366]">
              {/* Star 数 */}
              {(server as any).stars > 0 && (
                <span className="flex items-center gap-0.5">
                  <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {formatNumber((server as any).stars)}
                </span>
              )}
              {/* 更新时间 */}
              {updateTime && (
                <span className="flex items-center gap-0.5">
                  <ClockIcon className="w-3 h-3" />
                  {formatRelativeTime(updateTime)}
                </span>
              )}
            </div>
          </>
        ) : isSmitheryListItem(server) ? (
          // Smithery 数据源
          <>
            <span className="text-[10px] text-[#636366] flex items-center gap-1">
              <DownloadIcon className="w-3 h-3" />
              {formatNumber(server.downloads)}
            </span>
            {server.verified && (
              <VerifiedIcon className="w-3.5 h-3.5 text-[#0a84ff]" />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
