/**
 * 设置页面 - Surge 风格
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useElectronAPI, type AllRuntimes, type ClientInfo, type SkillClientType } from '../lib/electron';
import { useStore } from '../store/useStore';
import { clearCache, type DataSource } from '../api/registry';
import ClientIcon from '../components/ClientIcon';
import RuntimeIcon from '../components/RuntimeIcon';
import Modal from '../components/Modal';
import { toast } from '../components/Toast';
import mcpDockIcon from '../../assets/icons/mcp-dock.png';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const api = useElectronAPI();
  
  const { dataSource, setDataSource } = useStore();
  
  const [runtimes, setRuntimes] = useState<AllRuntimes | null>(null);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [version, setVersion] = useState('');
  
  // 配置弹窗状态
  const [editingClient, setEditingClient] = useState<ClientInfo | null>(null);
  const [editMcpPath, setEditMcpPath] = useState('');
  const [editSkillsPath, setEditSkillsPath] = useState('');

  // 未安装客户端折叠状态
  const [showUninstalled, setShowUninstalled] = useState(false);

  useEffect(() => {
    loadData(true);
  }, [api]);

  const loadData = async (isInitial = false) => {
    try {
      const [runtimeInfo, clientList, appVersion] = await Promise.all([
        api.env.getAllRuntimes(),
        api.clients.getAll(),
        api.system.getVersion(),
      ]);
      setRuntimes(runtimeInfo);
      setClients(clientList);
      setVersion(appVersion);
    } catch (error) {
      console.error('Failed to load settings data:', error);
    } finally {
      if (isInitial) {
        setIsInitialLoading(false);
      }
    }
  };

  // 刷新数据（带动效）
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const startTime = Date.now();
    
    try {
      const [runtimeInfo, clientList, appVersion] = await Promise.all([
        api.env.getAllRuntimes(),
        api.clients.getAll(),
        api.system.getVersion(),
      ]);
      
      // 确保动画至少持续2秒
      const elapsed = Date.now() - startTime;
      if (elapsed < 2000) {
        await new Promise(resolve => setTimeout(resolve, 2000 - elapsed));
      }
      
      setRuntimes(runtimeInfo);
      setClients(clientList);
      setVersion(appVersion);
      toast.success(t('settings.refreshed') || 'Settings refreshed');
    } catch (error) {
      console.error('Failed to refresh settings data:', error);
      toast.error(t('settings.refreshFailed') || 'Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDataSourceChange = (source: DataSource) => {
    setDataSource(source);
    // 清除缓存以便重新加载数据
    clearCache();
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  // 打开配置弹窗
  const openEditModal = (client: ClientInfo) => {
    setEditingClient(client);
    setEditMcpPath(client.configPath || '');
    setEditSkillsPath(client.skillsPath || '');
  };

  // 保存配置
  const saveClientConfig = async () => {
    if (!editingClient) return;
    
    try {
      // 保存 MCP Config 路径
      if (editMcpPath !== editingClient.configPath) {
        await api.clients.setCustomPath(editingClient.id, editMcpPath || null);
      }
      
      // 保存 Skills 目录（如果支持）
      if (editingClient.supportsSkills && editSkillsPath !== editingClient.skillsPath) {
        await api.clients.setCustomSkillsPath(editingClient.id as SkillClientType, editSkillsPath || null);
      }
      
      await loadData();
      setEditingClient(null);
    } catch (error) {
      console.error('Failed to save client config:', error);
    }
  };

  const currentLang = i18n.language;

  return (
    <div className="flex flex-col h-full bg-[#1c1c1e]">
      {/* 头部 */}
      <div className="flex items-center px-4 py-3 border-b border-[#3a3a3c]">
        <h1 className="text-[15px] font-semibold text-white">
          {t('settings.title')}
        </h1>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* 数据源设置 */}
          <div className="card p-4">
            <h2 className="text-[13px] font-semibold text-white mb-1">
              {t('settings.dataSource')}
            </h2>
            <p className="text-[12px] text-[#98989d] mb-3">
              {t('settings.dataSourceDesc')}
            </p>
            
            <div className="space-y-2">
              <button
                onClick={() => handleDataSourceChange('official')}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-md text-left transition-colors
                  ${dataSource === 'official'
                    ? 'bg-[#0a84ff]/10 border border-[#0a84ff]/30'
                    : 'bg-[#3a3a3c] border border-transparent hover:border-[#636366]'
                  }
                `}
              >
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${dataSource === 'official' ? 'bg-[#0a84ff]' : 'bg-[#636366]'}
                `}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-medium ${dataSource === 'official' ? 'text-[#0a84ff]' : 'text-white'}`}>
                      {t('settings.official')}
                    </span>
                    {dataSource === 'official' && (
                      <svg className="w-4 h-4 text-[#0a84ff]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-[11px] text-[#636366] mt-0.5">
                    {t('settings.officialDesc')}
                  </p>
                </div>
              </button>
              
              <button
                onClick={() => handleDataSourceChange('smithery')}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-md text-left transition-colors
                  ${dataSource === 'smithery'
                    ? 'bg-[#0a84ff]/10 border border-[#0a84ff]/30'
                    : 'bg-[#3a3a3c] border border-transparent hover:border-[#636366]'
                  }
                `}
              >
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${dataSource === 'smithery' ? 'bg-[#0a84ff]' : 'bg-[#636366]'}
                `}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-medium ${dataSource === 'smithery' ? 'text-[#0a84ff]' : 'text-white'}`}>
                      {t('settings.smithery')}
                    </span>
                    {dataSource === 'smithery' && (
                      <svg className="w-4 h-4 text-[#0a84ff]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-[11px] text-[#636366] mt-0.5">
                    {t('settings.smitheryDesc')}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 语言设置 */}
          <div className="card p-4">
            <h2 className="text-[13px] font-semibold text-white mb-1">
              {t('settings.language')}
            </h2>
            <p className="text-[12px] text-[#98989d] mb-3">
              {t('settings.languageDesc')}
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={() => handleLanguageChange('en')}
                className={`
                  flex-1 px-3 py-2 rounded-md text-[13px] font-medium transition-colors
                  ${currentLang === 'en'
                    ? 'bg-[#0a84ff] text-white'
                    : 'bg-[#3a3a3c] text-[#98989d] hover:text-white'
                  }
                `}
              >
                🇺🇸 {t('settings.english')}
              </button>
              <button
                onClick={() => handleLanguageChange('zh')}
                className={`
                  flex-1 px-3 py-2 rounded-md text-[13px] font-medium transition-colors
                  ${currentLang === 'zh'
                    ? 'bg-[#0a84ff] text-white'
                    : 'bg-[#3a3a3c] text-[#98989d] hover:text-white'
                  }
                `}
              >
                🇨🇳 {t('settings.chinese')}
              </button>
            </div>
          </div>

          {/* 客户端配置 */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a3a3c]">
              <div>
                <h2 className="text-[13px] font-semibold text-white">
                  {t('settings.clients') || 'Supported Clients'}
                </h2>
                <p className="text-[11px] text-[#636366] mt-0.5">
                  {t('settings.clientsDesc')}
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5 rounded text-[#98989d] hover:text-white hover:bg-[#3a3a3c] transition-colors disabled:opacity-50"
              >
                <svg 
                  className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>

            {isInitialLoading && clients.length === 0 ? (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#3a3a3c]/30 animate-pulse">
                      <div className="w-7 h-7 rounded-md bg-[#3a3a3c] flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-16 bg-[#3a3a3c] rounded" />
                        <div className="h-2.5 w-24 bg-[#3a3a3c] rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* 已安装客户端 - 网格布局 */}
                {clients.filter(c => c.installed).length > 0 && (
                  <div className="p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {clients.filter(c => c.installed).map(client => (
                        <div
                          key={client.id}
                          className="group flex items-center gap-2.5 p-2.5 rounded-lg bg-[#3a3a3c]/40 hover:bg-[#3a3a3c]/60 transition-colors"
                        >
                          <div className="relative flex-shrink-0">
                            <ClientIcon clientId={client.id} size={28} />
                            {client.configExists && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#34c759] border-2 border-[#2c2c2e]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[12px] font-medium text-white truncate">{client.name}</span>
                            </div>
                            <code className="text-[9px] text-[#636366] font-mono truncate block">
                              {client.configPath?.replace(/^.*[/\\]/, '') || ''}
                            </code>
                          </div>
                          <button
                            onClick={() => openEditModal(client)}
                            className="p-1 rounded text-[#636366] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-[#3a3a3c] transition-all"
                            title={t('settings.editPath') || 'Edit config path'}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 未安装客户端 - 可折叠区域 */}
                {clients.filter(c => !c.installed).length > 0 && (
                  <>
                    <button
                      onClick={() => setShowUninstalled(!showUninstalled)}
                      className="w-full flex items-center justify-between px-4 py-2.5 border-t border-[#3a3a3c] hover:bg-[#3a3a3c]/30 transition-colors"
                    >
                      <span className="text-[11px] text-[#636366]">
                        {t('settings.uninstalledClients') || `${clients.filter(c => !c.installed).length} more clients not installed`}
                      </span>
                      <svg 
                        className={`w-3.5 h-3.5 text-[#636366] transition-transform ${showUninstalled ? 'rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor" 
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    
                    {showUninstalled && (
                      <div className="px-3 pb-3">
                        <div className="grid grid-cols-3 gap-1.5">
                          {clients.filter(c => !c.installed).map(client => (
                            <div
                              key={client.id}
                              className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-[#3a3a3c]/20"
                            >
                              <ClientIcon clientId={client.id} size={20} className="opacity-40 flex-shrink-0" />
                              <span className="text-[11px] text-[#636366] truncate">{client.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* 运行时环境 */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#3a3a3c]">
              <h2 className="text-[13px] font-semibold text-white">
                {t('settings.runtimes')}
              </h2>
              <p className="text-[11px] text-[#636366] mt-0.5">
                {t('settings.runtimesDesc')}
              </p>
            </div>

            {isInitialLoading && !runtimes ? (
              // 初始加载时显示骨架屏
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a3a3c] animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-[#3a3a3c]" />
                    <div className="h-4 w-20 bg-[#3a3a3c] rounded" />
                  </div>
                  <div className="h-4 w-12 bg-[#3a3a3c] rounded" />
                </div>
                <div className="flex items-center justify-between px-4 py-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-[#3a3a3c]" />
                    <div className="h-4 w-20 bg-[#3a3a3c] rounded" />
                  </div>
                  <div className="h-4 w-12 bg-[#3a3a3c] rounded" />
                </div>
              </>
            ) : runtimes && (
              <>
                <RuntimeRow name="Node.js" runtime="node" info={runtimes.node} />
                <RuntimeRow name="Python" runtime="python" info={runtimes.python} isLast />
              </>
            )}
          </div>

          {/* 关于 */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <img src={mcpDockIcon} alt="MCP Dock" className="w-10 h-10 rounded-lg" />
              <div>
                <h3 className="text-[13px] font-semibold text-white">MCP Dock</h3>
                <p className="text-[11px] text-[#636366]">{version ? `Version ${version}` : 'Loading...'}</p>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-[#3a3a3c] flex flex-wrap gap-x-4 gap-y-2">
              <a
                href="#"
                className="inline-flex items-center gap-1.5 text-[12px] text-[#0a84ff] hover:text-[#5ac8fa] transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  api.system.openExternal('https://github.com/OldJii/mcp-dock');
                }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                {t('settings.openSource')}
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-1.5 text-[12px] text-[#98989d] hover:text-[#0a84ff] transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  api.system.openExternal('https://github.com/OldJii/mcp-dock/tree/main/community-registry');
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                {t('settings.contribute') || 'Contribute MCP/Skill'}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 客户端配置弹窗 */}
      <Modal
        isOpen={!!editingClient}
        onClose={() => setEditingClient(null)}
        title={`${t('settings.editPath') || 'Edit'}: ${editingClient?.name || ''}`}
      >
        <div className="space-y-4">
          <p className="text-[12px] text-[#98989d]">
            {t('settings.editPathHint') || 'Customize the configuration paths for this client.'}
          </p>
          
          {/* MCP Config 路径 */}
          <div>
            <label className="block text-[12px] text-[#98989d] mb-1.5">
              MCP Config Path
            </label>
            <input
              type="text"
              value={editMcpPath}
              onChange={(e) => setEditMcpPath(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-[#1c1c1e] border border-[#3a3a3c] text-white font-mono text-[12px] focus:border-[#0a84ff] transition-colors"
              placeholder={t('settings.enterCustomPath') || 'Enter custom config path...'}
            />
          </div>
          
          {/* Skills 目录（仅支持 Skills 的客户端显示） */}
          {editingClient?.supportsSkills && (
            <div>
              <label className="block text-[12px] text-[#98989d] mb-1.5">
                Skills Directory
              </label>
              <input
                type="text"
                value={editSkillsPath}
                onChange={(e) => setEditSkillsPath(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-[#1c1c1e] border border-[#3a3a3c] text-white font-mono text-[12px] focus:border-[#0a84ff] transition-colors"
                placeholder={t('settings.enterSkillsPath') || 'Enter custom skills directory...'}
              />
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditingClient(null)} className="btn btn-secondary">
              {t('common.cancel')}
            </button>
            <button onClick={saveClientConfig} className="btn btn-primary">
              {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// 运行时行组件
function RuntimeRow({ 
  name, 
  runtime, 
  info, 
  isLast = false,
}: { 
  name: string; 
  runtime: 'node' | 'python'; 
  info: { available: boolean; version: string | null; path: string | null };
  isLast?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${!isLast ? 'border-b border-[#3a3a3c]' : ''}`}>
      <div className="flex items-center gap-3">
        <RuntimeIcon runtime={runtime} size={24} />
        <div>
          <span className="text-[13px] font-medium text-white">{name}</span>
          {info.path && (
            <p className="text-[10px] text-[#636366] font-mono truncate max-w-[200px]">
              {info.path}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {info.available ? (
          <>
            <span className="text-[12px] text-[#98989d]">
              v{info.version}
            </span>
            <span className="status-dot active" />
          </>
        ) : (
          <span className="status-dot inactive" />
        )}
      </div>
    </div>
  );
}
