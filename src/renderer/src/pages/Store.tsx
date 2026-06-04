/**
 * 商店页面 - Surge 风格
 * 支持 MCP Servers 和 Skills 双资源类型
 * 网格布局：每行2个卡片，每页20个
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchServerList, fetchSkillsList, forceRefreshServerList, forceRefreshSkillsList, type SkillListItem } from '../api/registry';
import { useStore } from '../store/useStore';
import { searchServers, paginateServers } from '../lib/search';
import { useElectronAPI } from '../lib/electron';
import ServerCard from '../components/ServerCard';
import SkillCard from '../components/SkillCard';
import Pagination from '../components/Pagination';
import { toast } from '../components/Toast';

// Skills 分类 ID 列表
const SKILL_CATEGORY_IDS = [
  'all',
  'coding',
  'testing',
  'devops',
  'data-analytics',
  'security',
  'content-writing',
  'productivity',
  'design',
];

export default function Store() {
  const { t } = useTranslation();
  const api = useElectronAPI();
  
  const {
    resourceType,
    setResourceType,
    dataSource,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    pageSize,
    serverLists,
    setServerList,
    skillsList,
    setSkillsList,
    installedServerIds,
    setInstalledServerIds,
    installedSkillIds,
    setInstalledSkillIds,
  } = useStore();

  // Skills 分类筛选
  const [selectedCategory, setSelectedCategory] = useState('all');

  // 强制刷新状态
  const [isForceRefreshing, setIsForceRefreshing] = useState(false);

  // 获取 MCP 服务器列表
  const { data: serverData, isLoading: isLoadingServers, error: serverError, refetch: refetchServers } = useQuery({
    queryKey: ['serverList', dataSource],
    queryFn: () => fetchServerList(dataSource),
    staleTime: 10 * 60 * 1000,
    enabled: resourceType === 'mcp',
  });

  // 获取 Skills 列表
  const { data: skillsData, isLoading: isLoadingSkills, error: skillsError, refetch: refetchSkills } = useQuery({
    queryKey: ['skillsList'],
    queryFn: () => fetchSkillsList(),
    staleTime: 10 * 60 * 1000,
    enabled: resourceType === 'skills',
  });

  // 更新 MCP 缓存
  useEffect(() => {
    if (serverData) {
      setServerList(dataSource, serverData);
    }
  }, [serverData, dataSource, setServerList]);

  // 更新 Skills 缓存
  useEffect(() => {
    if (skillsData) {
      setSkillsList(skillsData);
    }
  }, [skillsData, setSkillsList]);

  // 获取已安装服务器
  useEffect(() => {
    api.config.getAllServers().then(({ servers }) => {
      setInstalledServerIds(Object.keys(servers));
    });
  }, [api, setInstalledServerIds]);

  // 获取已安装 Skills
  useEffect(() => {
    api.skills.getAllInstalled().then(({ skills }) => {
      setInstalledSkillIds(Object.keys(skills));
    });
  }, [api, setInstalledSkillIds]);

  // 切换资源类型时重置分类和分页
  useEffect(() => {
    setSelectedCategory('all');
    setCurrentPage(1);
  }, [resourceType, setCurrentPage]);

  // 搜索和分页 - MCP
  const mcpResult = useMemo(() => {
    if (resourceType !== 'mcp') return { items: [], totalPages: 0, totalItems: 0, startIndex: 0, endIndex: 0 };
    const list = serverData || serverLists[dataSource] || [];
    const filtered = searchServers(list, searchQuery);
    return paginateServers(filtered, currentPage, pageSize);
  }, [resourceType, serverData, serverLists, dataSource, searchQuery, currentPage, pageSize]);

  // 搜索和分页 - Skills
  const skillsResult = useMemo(() => {
    if (resourceType !== 'skills') return { items: [], totalPages: 0, totalItems: 0, startIndex: 0, endIndex: 0 };
    const list = skillsData || skillsList || [];
    
    // 分类过滤
    let filtered = selectedCategory === 'all' 
      ? list 
      : list.filter(skill => skill.categoryId === selectedCategory);
    
    // 搜索过滤
    if (searchQuery) {
      filtered = filtered.filter(skill => 
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.author.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // 分页
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const items = filtered.slice(startIndex, endIndex);
    return { items, totalPages, totalItems, startIndex: startIndex + 1, endIndex };
  }, [resourceType, skillsData, skillsList, searchQuery, selectedCategory, currentPage, pageSize]);

  // 获取分类统计
  const categoryStats = useMemo(() => {
    const list = skillsData || skillsList || [];
    const stats: Record<string, number> = { all: list.length };
    list.forEach(skill => {
      stats[skill.categoryId] = (stats[skill.categoryId] || 0) + 1;
    });
    return stats;
  }, [skillsData, skillsList]);

  const isLoading = resourceType === 'mcp' ? isLoadingServers : isLoadingSkills;
  const error = resourceType === 'mcp' ? serverError : skillsError;
  const result = resourceType === 'mcp' ? mcpResult : skillsResult;
  const baseRefetch = resourceType === 'mcp' ? refetchServers : refetchSkills;
  
  // 重试并显示 toast
  const handleRetry = useCallback(async () => {
    try {
      await baseRefetch();
      toast.success(t('store.retrySuccess') || 'Data loaded successfully');
    } catch {
      toast.error(t('store.retryFailed') || 'Failed to load data');
    }
  }, [baseRefetch, t]);

  // 强制刷新数据（跳过缓存）
  const handleForceRefresh = useCallback(async () => {
    setIsForceRefreshing(true);
    const startTime = Date.now();
    try {
      if (resourceType === 'mcp') {
        const data = await forceRefreshServerList(dataSource);
        setServerList(dataSource, data);
      } else {
        const data = await forceRefreshSkillsList();
        setSkillsList(data);
      }
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500) await new Promise(r => setTimeout(r, 1500 - elapsed));
      toast.success(t('store.refreshSuccess') || 'Data refreshed');
    } catch {
      toast.error(t('store.refreshFailed') || 'Failed to refresh data');
    } finally {
      setIsForceRefreshing(false);
    }
  }, [resourceType, dataSource, setServerList, setSkillsList, t]);

  // 获取 attribution 文本
  const attributionText = resourceType === 'mcp'
    ? (dataSource === 'official' 
        ? t('store.attributionOfficial')
        : t('store.attributionSmithery'))
    : t('store.attributionSkills') || 'Data from GitHub repositories';

  return (
    <div className="flex flex-col h-full bg-[#1c1c1e]">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a3a3c]">
        <div className="flex items-center gap-4">
          <h1 className="text-[15px] font-semibold text-white">
            {t('store.title')}
          </h1>
          
          {/* 资源类型切换 */}
          <div className="flex items-center bg-[#3a3a3c] rounded-md p-0.5">
            <button
              onClick={() => setResourceType('mcp')}
              className={`px-3 py-1 rounded text-[12px] font-medium transition-colors ${
                resourceType === 'mcp' 
                  ? 'bg-[#636366] text-white' 
                  : 'text-[#98989d] hover:text-white'
              }`}
            >
              MCP Servers
            </button>
            <button
              onClick={() => setResourceType('skills')}
              className={`px-3 py-1 rounded text-[12px] font-medium transition-colors ${
                resourceType === 'skills' 
                  ? 'bg-[#636366] text-white' 
                  : 'text-[#98989d] hover:text-white'
              }`}
            >
              Skills
            </button>
          </div>
          
          <span className="text-[12px] text-[#98989d]">
            {result.totalItems} {resourceType === 'mcp' ? (t('store.servers') || 'servers') : (t('store.skills') || 'skills')}
          </span>
          
          {/* 数据源标签 - 仅 MCP 显示 */}
          {resourceType === 'mcp' && (
            <span className={`
              px-2 py-0.5 rounded text-[10px] font-medium
              ${dataSource === 'official' 
                ? 'bg-[#0a84ff]/15 text-[#0a84ff]' 
                : 'bg-[#ff9f0a]/15 text-[#ff9f0a]'
              }
            `}>
              {dataSource === 'official' ? 'Official' : 'Smithery'}
            </span>
          )}

          {/* 强制刷新按钮 */}
          <button
            onClick={handleForceRefresh}
            disabled={isForceRefreshing || isLoading}
            className="p-1.5 rounded text-[#98989d] hover:text-white hover:bg-[#3a3a3c] transition-colors disabled:opacity-50"
            title={t('store.forceRefresh') || 'Force refresh data'}
          >
            <svg 
              className={`w-3.5 h-3.5 ${isForceRefreshing ? 'animate-spin' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        {/* 搜索框 */}
        <div className="relative w-[240px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={resourceType === 'mcp' ? t('store.search') : (t('store.searchSkills') || 'Search skills...')}
            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-[#3a3a3c] text-[13px] text-white placeholder:text-[#636366] border-none focus:ring-1 focus:ring-[#0a84ff]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#636366] hover:text-white"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Skills 分类筛选栏 - 与标题区域间距一致 */}
      {resourceType === 'skills' && (
        <div className="flex items-center gap-2 px-4 py-1.5 overflow-x-auto scrollbar-none border-b border-[#3a3a3c]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {SKILL_CATEGORY_IDS.map(categoryId => (
            <button
              key={categoryId}
              onClick={() => {
                setSelectedCategory(categoryId);
                setCurrentPage(1);
              }}
              className={`
                flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors
                ${selectedCategory === categoryId
                  ? 'bg-[#0a84ff] text-white'
                  : 'bg-[#3a3a3c] text-[#98989d] hover:text-white'
                }
              `}
            >
              {t(`skillCategory.${categoryId}`)}
              {categoryStats[categoryId] > 0 && (
                <span className={`text-[10px] ${selectedCategory === categoryId ? 'text-white/70' : 'text-[#636366]'}`}>
                  {categoryStats[categoryId]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-[#3a3a3c] border-t-[#0a84ff] rounded-full animate-spin mb-3" />
            <p className="text-[13px] text-[#98989d]">{t('store.loading')}</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#ff3b30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-[13px] text-[#98989d] mb-3">{t('store.error')}</p>
            <button
              onClick={handleRetry}
              className="btn btn-secondary text-[13px]"
            >
              {t('store.retry')}
            </button>
          </div>
        ) : result.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8">
            <div className="w-14 h-14 rounded-full bg-[#0a84ff]/10 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#0a84ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
              </svg>
            </div>
            <p className="text-[15px] text-white font-medium mb-2">Community Edition</p>
            <p className="text-[13px] text-[#98989d] text-center leading-relaxed mb-4">
              {t('store.communityEditionDesc', 'Registry browsing is not available in the Community Edition. You can still add MCP servers manually from the Library page.')}
            </p>
            <button
              onClick={() => window.location.hash = '#/library'}
              className="px-4 py-2 bg-[#0a84ff] hover:bg-[#0a84ff]/80 text-white text-[13px] font-medium rounded-lg transition-colors"
            >
              {t('store.goToLibrary', 'Go to Library')}
            </button>
          </div>
        ) : (
          <div className="p-4">
            {/* 网格布局：每行2个卡片 */}
            {/* 使用包含 currentPage 的 key 确保翻页时完全重新渲染列表 */}
            <div key={`grid-${resourceType}-${currentPage}-${selectedCategory}`} className="grid grid-cols-2 gap-3">
              {resourceType === 'mcp' ? (
                // MCP Servers 网格
                (result.items as any[]).map((server, index) => (
                  <ServerCard
                    key={`${currentPage}-${index}-${server.id}`}
                    server={server}
                    dataSource={dataSource}
                    isInstalled={installedServerIds.has(server.id)}
                  />
                ))
              ) : (
                // Skills 网格
                (result.items as SkillListItem[]).map((skill, index) => (
                  <SkillCard
                    key={`${currentPage}-${index}-${skill.id}`}
                    skill={skill}
                    isInstalled={installedSkillIds.has(skill.name)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 底部分页和信息 */}
      {!isLoading && !error && result.items.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#3a3a3c] bg-[#2c2c2e]">
          <span className="text-[11px] text-[#636366]">
            {attributionText}
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={result.totalPages}
            totalItems={result.totalItems}
            startIndex={result.startIndex}
            endIndex={result.endIndex}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
