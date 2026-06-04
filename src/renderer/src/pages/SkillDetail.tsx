/**
 * Skill 详情页面
 * 支持两种数据源：远程 Registry 和本地已安装 Skill
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchSkillDetail } from '../api/registry';
import { useElectronAPI, type ClientInfo, type SkillClientType, type LocalSkillDetail } from '../lib/electron';
import ClientIcon from '../components/ClientIcon';
import Modal from '../components/Modal';
import { StarIcon, ForkIcon, ClockIcon } from '../components/Icons';

function formatNumber(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getCategoryColor(categoryId: string): { bg: string; text: string; border: string } {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    coding: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    testing: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
    devops: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
    'data-analytics': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
    security: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
    'content-writing': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    productivity: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    design: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  };
  return colors[categoryId] || { bg: 'bg-[#3a3a3c]', text: 'text-[#98989d]', border: 'border-[#3a3a3c]' };
}

function SkillAvatar({ author, size = 48 }: { author: string; size?: number }) {
  const [avatarError, setAvatarError] = useState(false);
  const avatarUrl = `https://avatars.githubusercontent.com/${author}`;
  const initial = author.charAt(0).toUpperCase();
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];
  const colorIndex = author.charCodeAt(0) % colors.length;

  if (!avatarError) {
    return (
      <img src={avatarUrl} alt={author} className="rounded-xl object-cover"
        style={{ width: size, height: size }} onError={() => setAvatarError(true)} />
    );
  }
  return (
    <div className={`rounded-xl ${colors[colorIndex]} flex items-center justify-center text-white font-bold`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initial}
    </div>
  );
}

// 统一的 Skill 数据视图（兼容 registry 和 local）
interface SkillView {
  type: 'registry' | 'local';
  name: string;
  author: string;
  description: string;
  categoryId?: string;
  category?: string;
  stars?: number;
  forks?: number;
  updatedAt?: string;
  repositoryUrl?: string;
  branch?: string;
  skillPath?: string;
  skillMdContent: string;
  skillMdRawUrl?: string;
  files: Array<{ name: string; size?: string; path?: string }>;
  stats?: { totalFiles?: number; totalSize?: string; license?: string };
  skillMdLines?: number;
  installedClients: SkillClientType[];
}

export default function SkillDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const api = useElectronAPI();

  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [selectedClients, setSelectedClients] = useState<SkillClientType[]>([]);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installedInClients, setInstalledInClients] = useState<SkillClientType[]>([]);
  const [skillView, setSkillView] = useState<SkillView | null>(null);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);

  const decodedId = id ? decodeURIComponent(id) : '';

  // 尝试从 registry 获取
  const { data: registrySkill, isLoading: isLoadingRegistry, error: registryError } = useQuery({
    queryKey: ['skillDetail', decodedId],
    queryFn: () => fetchSkillDetail(decodedId),
    enabled: !!decodedId,
    retry: false,
  });

  // registry 成功 → 构建 SkillView
  useEffect(() => {
    if (registrySkill) {
      setSkillView({
        type: 'registry',
        name: registrySkill.name,
        author: registrySkill.author,
        description: registrySkill.description,
        categoryId: registrySkill.categoryId,
        category: registrySkill.category,
        stars: registrySkill.stars,
        forks: registrySkill.forks,
        updatedAt: registrySkill.updatedAt,
        repositoryUrl: registrySkill.repository?.url,
        branch: registrySkill.repository?.branch,
        skillPath: registrySkill.repository?.skillPath,
        skillMdContent: registrySkill.skillMd?.content || '',
        skillMdRawUrl: registrySkill.skillMd?.rawUrl,
        files: registrySkill.files || [],
        stats: registrySkill.stats,
        skillMdLines: registrySkill.skillMd?.lines,
        installedClients: [],
      });
    }
  }, [registrySkill]);

  // registry 失败 → fallback 到本地
  useEffect(() => {
    if (!registryError || isLoadingRegistry || registrySkill) return;

    let cancelled = false;
    setIsLoadingLocal(true);

    api.skills.getLocalDetail(decodedId).then((local: LocalSkillDetail | null) => {
      if (cancelled) return;
      setIsLoadingLocal(false);

      if (!local) return;

      const owner = local.source?.id?.split('/')[0] || local.name;
      setSkillView({
        type: 'local',
        name: local.name,
        author: owner,
        description: '',
        repositoryUrl: local.source?.source?.repositoryUrl,
        branch: local.source?.source?.branch,
        skillPath: local.source?.source?.skillPath,
        skillMdContent: local.skillMdContent,
        skillMdRawUrl: local.source ? `${local.source.source.rawBaseUrl}/SKILL.md` : undefined,
        files: local.files.map(f => ({ name: f })),
        installedClients: local.clients,
      });
      setInstalledInClients(local.clients);
    }).catch(() => {
      if (!cancelled) setIsLoadingLocal(false);
    });

    return () => { cancelled = true; };
  }, [registryError, isLoadingRegistry, registrySkill, decodedId, api]);

  // 获取客户端列表
  useEffect(() => {
    api.clients.getAll().then(clientList => {
      const skillClients = clientList.filter(c => c.supportsSkills);
      setClients(skillClients);
      const firstInstalled = skillClients.find(c => c.installed);
      if (firstInstalled) {
        setSelectedClients([firstInstalled.id as SkillClientType]);
      }
    });
  }, [api]);

  // 检查已安装状态（registry skill）
  useEffect(() => {
    if (skillView?.type !== 'registry') return;
    const skillName = decodedId.split('/').pop() || skillView.name;
    api.skills.getAllInstalled().then(({ byClient }) => {
      const installedIn: SkillClientType[] = [];
      for (const [client, skills] of Object.entries(byClient)) {
        if (skills.some(s => s.name === skillName)) {
          installedIn.push(client as SkillClientType);
        }
      }
      setInstalledInClients(installedIn);
    });
  }, [api, skillView, decodedId]);

  const handleInstall = async () => {
    if (!skillView || selectedClients.length === 0) return;
    setIsInstalling(true);
    try {
      const repoUrl = skillView.repositoryUrl || '';
      const branch = skillView.branch || 'main';
      const skillPath = skillView.skillPath || '';
      const rawBaseUrl = skillView.skillMdRawUrl
        ? skillView.skillMdRawUrl.replace('/SKILL.md', '')
        : `https://raw.githubusercontent.com/${skillView.author}/${decodedId.split('/')[1] || skillView.name}/${branch}${skillPath ? `/${skillPath}` : ''}`;

      const sourceInfo = {
        id: decodedId,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: { repositoryUrl: repoUrl, branch, skillPath, rawBaseUrl },
        files: skillView.files?.map(f => f.name) || [],
      };
      await api.skills.install(decodedId, sourceInfo, selectedClients);
      setShowInstallModal(false);
      setInstalledInClients(prev => [...new Set([...prev, ...selectedClients])]);
    } catch (error) {
      console.error('Failed to install skill:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const openInstallModal = () => {
    const firstInstalled = clients.find(c => c.installed && !installedInClients.includes(c.id as SkillClientType));
    setSelectedClients(firstInstalled ? [firstInstalled.id as SkillClientType] : []);
    setShowInstallModal(true);
  };

  const handleUninstall = async () => {
    if (!skillView || installedInClients.length === 0) return;
    if (!confirm(t('skill.confirmUninstall') || 'Are you sure you want to uninstall this skill from all clients?')) return;
    try {
      await api.skills.uninstall(skillView.name, installedInClients);
      setInstalledInClients([]);
    } catch (error) {
      console.error('Failed to uninstall skill:', error);
    }
  };

  const toggleClient = (clientId: SkillClientType) => {
    setSelectedClients(prev =>
      prev.includes(clientId) ? prev.filter(c => c !== clientId) : [...prev, clientId]
    );
  };

  const isLoading = isLoadingRegistry || isLoadingLocal;

  if (isLoading && !skillView) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1c1c1e]">
        <div className="w-8 h-8 border-2 border-[#3a3a3c] border-t-[#0a84ff] rounded-full animate-spin" />
      </div>
    );
  }

  if (!skillView) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#1c1c1e]">
        <div className="w-12 h-12 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[#ff3b30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-[13px] text-[#98989d] mb-3">{t('skill.loadFailed') || 'Failed to load skill'}</p>
        <button onClick={() => navigate(-1)} className="btn btn-secondary text-[13px]">
          {t('detail.back')}
        </button>
      </div>
    );
  }

  const isInstalled = installedInClients.length > 0;
  const hasCategory = !!skillView.categoryId;
  const { bg, text, border } = hasCategory ? getCategoryColor(skillView.categoryId!) : { bg: '', text: '', border: '' };
  const skillDirUrl = skillView.repositoryUrl && skillView.branch && skillView.skillPath
    ? `${skillView.repositoryUrl}/tree/${skillView.branch}/${skillView.skillPath}`
    : skillView.repositoryUrl || '';

  return (
    <div className="flex flex-col h-full bg-[#1c1c1e]">
      {/* 头部导航 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#3a3a3c] text-[12px] text-[#636366]">
        <button onClick={() => navigate(-1)} className="hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        {skillView.type === 'registry' ? (
          <>
            <span className="hover:text-white cursor-pointer" onClick={() => navigate('/store')}>{t('nav.store')}</span>
            <span>/</span>
            {hasCategory && (
              <>
                <span className="hover:text-white cursor-pointer">{t(`skillCategory.${skillView.categoryId}`) || skillView.category}</span>
                <span>/</span>
              </>
            )}
          </>
        ) : (
          <>
            <span className="hover:text-white cursor-pointer" onClick={() => navigate('/library')}>{t('nav.library')}</span>
            <span>/</span>
          </>
        )}
        <span className="text-white">{skillView.name}</span>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden flex">
        {/* 左侧主内容 */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-start gap-4 mb-3">
                <SkillAvatar author={skillView.author} size={48} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-white">{skillView.name}</h1>
                    {skillView.type === 'local' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/30">
                        {t('detail.installed')}
                      </span>
                    )}
                  </div>
                  <span className="text-[14px] text-[#636366]">by @{skillView.author}</span>
                </div>
              </div>

              {skillView.description && (
                <p className="text-[14px] text-[#98989d] leading-relaxed mb-4">{skillView.description}</p>
              )}

              {hasCategory && (
                <span className={`inline-block px-2 py-1 rounded-md text-[12px] font-medium border ${bg} ${text} ${border}`}>
                  {t(`skillCategory.${skillView.categoryId}`) || skillView.category}
                </span>
              )}

              {(skillView.stars != null || skillView.forks != null || skillView.updatedAt) && (
                <div className="flex items-center gap-4 mt-4 text-[13px] text-[#98989d]">
                  {skillView.stars != null && (
                    <span className="flex items-center gap-1">
                      <StarIcon className="w-4 h-4 text-yellow-400" />
                      {formatNumber(skillView.stars)} Stars
                    </span>
                  )}
                  {skillView.forks != null && (
                    <span className="flex items-center gap-1">
                      <ForkIcon className="w-4 h-4 text-[#636366]" />
                      {formatNumber(skillView.forks)} Forks
                    </span>
                  )}
                  {skillView.updatedAt && (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-4 h-4 text-[#636366]" />
                      Updated {formatDate(skillView.updatedAt)}
                    </span>
                  )}
                </div>
              )}
            </div>

            <h2 className="text-[15px] font-semibold text-white mb-4">SKILL.md</h2>
            <div className="card p-4 overflow-x-auto">
              {skillView.skillMdContent ? (
                <pre className="text-[12px] text-[#e6edf3] font-mono leading-relaxed whitespace-pre-wrap">
                  <code>{skillView.skillMdContent}</code>
                </pre>
              ) : (
                <p className="text-[13px] text-[#636366] italic">{t('detail.noReadme')}</p>
              )}
            </div>
          </div>
        </div>

        {/* 右侧边栏 */}
        <div className="w-[280px] flex-shrink-0 border-l border-[#3a3a3c] overflow-y-auto p-4">
          {/* 安装/卸载按钮 */}
          <div className="mb-4">
            {isInstalled ? (
              <button onClick={handleUninstall} className="w-full btn btn-danger text-[13px]">
                {t('detail.uninstallAll')}
              </button>
            ) : (
              <button onClick={openInstallModal} className="w-full btn btn-primary text-[13px]">
                {t('detail.install')}
              </button>
            )}
          </div>

          {/* 已安装的客户端 */}
          {isInstalled && (
            <div className="mb-4 p-3 bg-[#3a3a3c]/30 rounded-lg">
              <p className="text-[11px] text-[#636366] mb-2">{t('detail.installedIn')}</p>
              <div className="flex flex-wrap gap-1">
                {installedInClients.map(clientId => {
                  const client = clients.find(c => c.id === clientId);
                  return (
                    <span key={clientId} className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#3a3a3c] text-[10px] text-[#98989d]">
                      <ClientIcon clientId={clientId} size={12} />
                      {client?.name || clientId}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Source 卡片 */}
          {skillView.repositoryUrl && (
            <div className="card p-4 space-y-3 mb-4">
              <h3 className="text-[13px] font-semibold text-white">Source</h3>
              <a href="#" onClick={(e) => { e.preventDefault(); api.system.openExternal(skillView.repositoryUrl!); }}
                className="flex items-center justify-between text-[12px] text-[#98989d] hover:text-[#0a84ff] transition-colors">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  GitHub Repository
                </span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>

              {skillDirUrl && skillDirUrl !== skillView.repositoryUrl && (
                <a href="#" onClick={(e) => { e.preventDefault(); api.system.openExternal(skillDirUrl); }}
                  className="flex items-center justify-between text-[12px] text-[#98989d] hover:text-[#0a84ff] transition-colors">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                    {skillView.branch || 'main'}
                  </span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}

              {skillView.skillMdRawUrl && (
                <a href="#" onClick={(e) => { e.preventDefault(); api.system.openExternal(skillView.skillMdRawUrl!); }}
                  className="flex items-center justify-between text-[12px] text-[#98989d] hover:text-[#0a84ff] transition-colors">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Raw SKILL.md
                  </span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* Source & Community（仅 registry skill） */}
          {skillView.type === 'registry' && (
            <div className="card p-4 mb-4">
              <h3 className="text-[13px] font-semibold text-white mb-3">Source & Community</h3>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[#636366]">Repository</span>
                  <span className="text-white">{skillView.author}</span>
                </div>
                {skillView.branch && (
                  <div className="flex justify-between">
                    <span className="text-[#636366]">Branch</span>
                    <span className="text-white">{skillView.branch}</span>
                  </div>
                )}
                {(skillView.stars != null || skillView.forks != null) && (
                  <div className="flex justify-between">
                    <span className="text-[#636366]">Community</span>
                    <span className="text-white flex items-center gap-1">
                      {skillView.stars != null && <><StarIcon className="w-3 h-3 text-yellow-400" />{formatNumber(skillView.stars)}</>}
                      {skillView.forks != null && <><ForkIcon className="w-3 h-3 text-[#636366] ml-1" />{formatNumber(skillView.forks)}</>}
                    </span>
                  </div>
                )}
                {skillView.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-[#636366]">Updated At</span>
                    <span className="text-white">{formatDate(skillView.updatedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Skill Stats（仅 registry skill） */}
          {skillView.type === 'registry' && skillView.stats && (
            <div className="card p-4 mb-4">
              <h3 className="text-[13px] font-semibold text-white mb-3">Skill Stats</h3>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[#636366]">SKILL.md</span>
                  <span className="text-white">{skillView.skillMdLines || 0} Lines</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#636366]">Total Files</span>
                  <span className="text-white">{skillView.stats.totalFiles || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#636366]">Total Size</span>
                  <span className="text-white">{skillView.stats.totalSize || '0 B'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#636366]">License</span>
                  <span className="text-white">{skillView.stats.license || 'NOASSERTION'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Files 列表 */}
          {skillView.files.length > 0 && (
            <div className="card p-4">
              <h3 className="text-[13px] font-semibold text-white mb-3">
                Files ({skillView.files.length})
              </h3>
              <div className="space-y-1.5">
                {skillView.files.map((file) => (
                  <div key={file.name} className="flex items-center justify-between p-2 rounded-md bg-[#3a3a3c]/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-3.5 h-3.5 text-[#636366] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="text-[11px] text-white truncate">{file.name}</span>
                    </div>
                    {file.size && <span className="text-[10px] text-[#636366] flex-shrink-0 ml-2">{file.size}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 安装模态框 */}
      <Modal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)}
        title={t('skill.installTitle') || 'Install Skill'}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-[#3a3a3c]/30 rounded-lg">
            <SkillAvatar author={skillView.author} size={40} />
            <div>
              <h3 className="text-[14px] font-medium text-white">{skillView.name}</h3>
              <p className="text-[12px] text-[#636366]">by @{skillView.author}</p>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-white mb-2">{t('detail.selectClients')}</label>
            <div className="grid grid-cols-2 gap-2">
              {clients.filter(c => c.installed && c.supportsSkills).map(client => {
                const isSelected = selectedClients.includes(client.id as SkillClientType);
                const isAlreadyInstalled = installedInClients.includes(client.id as SkillClientType);
                return (
                  <button key={client.id}
                    onClick={() => !isAlreadyInstalled && toggleClient(client.id as SkillClientType)}
                    disabled={isAlreadyInstalled}
                    className={`flex items-center gap-2 p-3 rounded-md border text-left transition-colors
                      ${isAlreadyInstalled ? 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]'
                        : isSelected ? 'bg-[#0a84ff]/10 border-[#0a84ff]/30 text-[#0a84ff]'
                          : 'bg-[#3a3a3c] border-[#3a3a3c] text-white hover:border-[#636366]'}`}>
                    <ClientIcon clientId={client.id} size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium">{client.name}</div>
                      <div className="text-[10px] opacity-60">
                        {isAlreadyInstalled ? t('detail.alreadyInstalled') : t('detail.available')}
                      </div>
                    </div>
                    {(isSelected || isAlreadyInstalled) && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {clients.filter(c => c.installed && c.supportsSkills).length === 0 && (
            <p className="text-center text-[#636366] text-[13px] py-4">
              {t('skill.noClientsSupport') || 'No installed clients support Skills'}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowInstallModal(false)} className="btn btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleInstall} disabled={selectedClients.length === 0 || isInstalling}
              className="btn btn-primary disabled:opacity-50">
              {isInstalling ? t('common.loading') : t('detail.install')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
