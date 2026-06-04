/**
 * Skill 卡片组件 - 网格布局卡片
 * 显示：名称、作者、分类、star数、更新时间
 * 紧凑高度设计，与 ServerCard 一致
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SkillListItem } from '../api/registry';
import { StarIcon, ClockIcon } from './Icons';

interface SkillCardProps {
  skill: SkillListItem;
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

// 格式化时间
function formatDate(dateStr: string): string {
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
}

// 获取分类颜色
function getCategoryColor(categoryId: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    coding: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
    testing: { bg: 'bg-green-500/15', text: 'text-green-400' },
    devops: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
    'data-analytics': { bg: 'bg-purple-500/15', text: 'text-purple-400' },
    security: { bg: 'bg-red-500/15', text: 'text-red-400' },
    'content-writing': { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
    productivity: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
    design: { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  };
  return colors[categoryId] || { bg: 'bg-[#3a3a3c]', text: 'text-[#98989d]' };
}

// Skill 图标组件
function SkillIcon({ skill }: { skill: SkillListItem }) {
  const [avatarError, setAvatarError] = useState(false);
  
  // 使用作者 GitHub 头像
  const avatarUrl = `https://avatars.githubusercontent.com/${skill.author}`;
  
  // 首字母图标
  const initial = skill.name.charAt(0).toUpperCase();
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
  ];
  const colorIndex = skill.name.charCodeAt(0) % colors.length;
  
  if (!avatarError) {
    return (
      <img
        src={avatarUrl}
        alt={skill.author}
        className="w-9 h-9 rounded-xl object-cover"
        onError={() => setAvatarError(true)}
      />
    );
  }
  
  return (
    <div className={`w-9 h-9 rounded-xl ${colors[colorIndex]} flex items-center justify-center text-white font-semibold text-sm`}>
      {initial}
    </div>
  );
}

export default function SkillCard({ skill, isInstalled }: SkillCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/skill/${encodeURIComponent(skill.id)}`);
  };

  const { bg, text } = getCategoryColor(skill.categoryId);

  return (
    <div
      onClick={handleClick}
      className="card p-3 cursor-pointer hover:bg-[#3a3a3c]/30 transition-colors flex flex-col h-[115px]"
    >
      {/* 顶部内容区域 */}
      <div className="flex items-start gap-2.5 flex-1 min-h-0">
        {/* 图标 */}
        <div className="flex-shrink-0">
          <SkillIcon skill={skill} />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[13px] font-medium text-white truncate">
              {skill.name}
            </h3>
            {isInstalled && (
              <span className="tag tag-success text-[9px] px-1 py-0 flex-shrink-0">
                {t('detail.installed')}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#98989d] line-clamp-2 mt-0.5 leading-relaxed">
            {skill.description || 'No description'}
          </p>
        </div>
      </div>

      {/* 底部信息 - 紧凑设计 */}
      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[#3a3a3c]/50">
        <div className="flex items-center gap-2 text-[10px] text-[#636366]">
          {/* 分类 - 使用翻译 */}
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${bg} ${text}`}>
            {t(`skillCategory.${skill.categoryId}`) || skill.category}
          </span>
          {/* 作者 */}
          <span>@{skill.author}</span>
        </div>
        
        <div className="flex items-center gap-2 text-[10px] text-[#636366]">
          {/* Star 数 */}
          <span className="flex items-center gap-0.5">
            <StarIcon className="w-3 h-3 text-yellow-400" />
            {formatNumber(skill.stars)}
          </span>
          {/* 更新时间 */}
          <span className="flex items-center gap-0.5">
            <ClockIcon className="w-3 h-3" />
            {formatDate(skill.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
