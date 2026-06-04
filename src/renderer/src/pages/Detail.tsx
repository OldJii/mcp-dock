/**
 * MCP Server 详情页面 - 参考 Skill 详情页风格
 * 支持多数据源 (Official / Smithery)
 * 布局：左侧信息 + README + 右侧操作区
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { 
  fetchServerDetail, 
  fetchReadmeFromGitHub,
  isSmitheryDetail, 
  isOfficialDetail,
  type DataSource,
  type SmitheryDetail,
  type OfficialPackage,
  type OfficialRemote,
} from '../api/registry';
import { useElectronAPI, type RuntimeInfo, type ClientInfo, type ClientType } from '../lib/electron';
import { useStore } from '../store/useStore';
import Modal from '../components/Modal';
import ConfigForm from '../components/ConfigForm';
import OfficialConfigForm from '../components/OfficialConfigForm';
import ClientIcon from '../components/ClientIcon';
import { BackIcon, ClockIcon, DownloadIcon, VerifiedIcon, GitHubIcon, ExternalLinkIcon, CheckIcon } from '../components/Icons';

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

// 默认图标
function DefaultIcon({ name, repoUrl }: { name: string; repoUrl?: string | null }) {
  const [imgError, setImgError] = useState(false);
  const githubUsername = extractGitHubUsername(repoUrl);
  
  // 尝试使用 GitHub 头像
  if (githubUsername && !imgError) {
    return (
      <img
        src={getGitHubAvatarUrl(githubUsername)}
        alt={name}
        className="w-12 h-12 rounded-xl object-cover"
        onError={() => setImgError(true)}
      />
    );
  }
  
  // 回退到首字母图标
  const initial = name.charAt(0).toUpperCase();
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
  const colorIndex = name.charCodeAt(0) % colors.length;
  
  return (
    <div className={`w-12 h-12 rounded-xl ${colors[colorIndex]} flex items-center justify-center text-white font-bold text-lg`}>
      {initial}
    </div>
  );
}

export default function Detail() {
  const { source, id } = useParams<{ source: DataSource; id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const api = useElectronAPI();
  
  const { addInstalledServerId, removeInstalledServerId } = useStore();
  
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientType[]>([]);
  const [installedClients, setInstalledClients] = useState<ClientType[]>([]);
  const [installError, setInstallError] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<OfficialPackage | null>(null);
  const [readme, setReadme] = useState<string | null>(null);
  const [isLoadingReadme, setIsLoadingReadme] = useState(false);
  const [iconError, setIconError] = useState(false);

  const dataSource = (source || 'official') as DataSource;
  const decodedId = id ? decodeURIComponent(id) : '';

  // 获取服务器详情
  const { data: server, isLoading, error } = useQuery({
    queryKey: ['serverDetail', dataSource, decodedId],
    queryFn: () => fetchServerDetail(dataSource, decodedId),
    enabled: !!decodedId,
    retry: 1,
  });

  // 加载客户端列表
  useEffect(() => {
    api.clients.getAll().then(setClients);
  }, [api]);

  // 检查运行时
  useEffect(() => {
    if (server) {
      if (isSmitheryDetail(server) && server.connection?.runtime) {
        api.env.checkRuntime(server.connection.runtime).then(setRuntimeInfo);
      } else if (isOfficialDetail(server) && server.packages.length > 0) {
        const pkg = server.packages[0];
        const runtime = pkg.runtimeHint === 'uvx' ? 'python' : 'node';
        api.env.checkRuntime(runtime).then(setRuntimeInfo);
        setSelectedPackage(pkg);
      } else {
        api.env.checkRuntime('node').then(setRuntimeInfo);
      }
    }
  }, [server, api]);

  // 使用存储的 README（不再实时获取）
  useEffect(() => {
    if (server && isOfficialDetail(server)) {
      // 优先使用存储的 README
      if (server.readme) {
        setReadme(server.readme);
        setIsLoadingReadme(false);
      } else if (server.repository) {
        // 回退：如果没有存储的 README，尝试实时获取
        setIsLoadingReadme(true);
        fetchReadmeFromGitHub(server.repository)
          .then(content => setReadme(content))
          .catch(() => setReadme(null))
          .finally(() => setIsLoadingReadme(false));
      }
    }
  }, [server]);

  // 检查此服务器安装在哪些客户端
  const refreshInstalledClients = async () => {
    try {
      const { servers } = await api.config.getAllServers();
      const serverInfo = servers[decodedId];
      if (serverInfo) {
        setInstalledClients(serverInfo.clients);
      } else {
        setInstalledClients([]);
      }
    } catch (error) {
      console.error('Failed to get installed clients:', error);
    }
  };

  useEffect(() => {
    refreshInstalledClients();
  }, [api, decodedId]);

  // 默认选择已安装的客户端
  useEffect(() => {
    const installedClientIds = clients.filter(c => c.installed).map(c => c.id);
    if (installedClientIds.length > 0 && selectedClients.length === 0) {
      if (installedClientIds.includes('cursor')) {
        setSelectedClients(['cursor']);
      } else if (installedClientIds.includes('claude-code')) {
        setSelectedClients(['claude-code']);
      } else {
        setSelectedClients([installedClientIds[0]]);
      }
    }
  }, [clients]);

  // 切换客户端选择
  const toggleClient = (clientId: ClientType) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(c => c !== clientId)
        : [...prev, clientId]
    );
  };

  // Smithery 安装
  const handleSmitheryInstall = async (configValues: Record<string, any>) => {
    const clientsToInstall = selectedClients.filter(c => !installedClients.includes(c));
    
    if (clientsToInstall.length === 0) {
      setInstallError('Please select at least one client.');
      return;
    }

    setIsInstalling(true);
    setInstallError(null);
    
    try {
      const npxPath = await api.env.getNpxPath();
      const uvxPath = await api.env.getUvxPath();
      
      const smitheryServer = server as SmitheryDetail;
      const runtime = smitheryServer.connection?.runtime || 'node';
      const config = {
        command: runtime === 'node' ? npxPath : uvxPath,
        args: runtime === 'node'
          ? ['-y', '@smithery/cli@latest', 'run', decodedId, '--config', JSON.stringify(configValues)]
          : ['smithery-cli', 'run', decodedId, '--config', JSON.stringify(configValues)],
      };

      const result = await api.config.installServer(decodedId, config, clientsToInstall);
      
      if (result.success.length > 0) {
        addInstalledServerId(decodedId);
        await refreshInstalledClients();
        setShowConfigModal(false);
      }
      
      if (result.failed.length > 0) {
        setInstallError(`Failed to install to: ${result.failed.join(', ')}`);
      }
    } catch (error) {
      console.error('Install failed:', error);
      setInstallError(String(error));
    } finally {
      setIsInstalling(false);
    }
  };

  // Official 安装
  const handleOfficialInstall = async (envValues: Record<string, string>, argValues: Record<string, string>) => {
    const clientsToInstall = selectedClients.filter(c => !installedClients.includes(c));
    
    if (clientsToInstall.length === 0) {
      setInstallError('Please select at least one client.');
      return;
    }

    if (!selectedPackage) {
      setInstallError('Please select a package to install.');
      return;
    }

    setIsInstalling(true);
    setInstallError(null);
    
    try {
      const npxPath = await api.env.getNpxPath();
      const uvxPath = await api.env.getUvxPath();
      
      let config: { command: string; args: string[]; env?: Record<string, string> };
      
      if (selectedPackage.registryType === 'npm') {
        const args = ['-y', selectedPackage.identifier];
        Object.entries(argValues).forEach(([key, value]) => {
          if (value) {
            args.push(key, value);
          }
        });
        config = {
          command: npxPath,
          args,
          env: Object.keys(envValues).length > 0 ? envValues : undefined,
        };
      } else if (selectedPackage.registryType === 'pypi') {
        const args = [selectedPackage.identifier];
        Object.entries(argValues).forEach(([key, value]) => {
          if (value) {
            args.push(key, value);
          }
        });
        config = {
          command: uvxPath,
          args,
          env: Object.keys(envValues).length > 0 ? envValues : undefined,
        };
      } else if (selectedPackage.registryType === 'oci') {
        const args = ['run', '-i', '--rm'];
        Object.entries(envValues).forEach(([key, value]) => {
          if (value) {
            args.push('-e', `${key}=${value}`);
          }
        });
        args.push(selectedPackage.identifier);
        config = {
          command: 'docker',
          args,
        };
      } else if (selectedPackage.registryType === 'mcpb') {
        throw new Error(
          'MCP Bundle (.mcpb) 格式暂不支持自动安装。\n' +
          '请手动下载并配置：\n' +
          `下载地址: ${selectedPackage.identifier}\n\n` +
          '或者在 mcp.json 中手动添加配置。'
        );
      } else {
        throw new Error(`Unsupported registry type: ${selectedPackage.registryType}`);
      }

      const result = await api.config.installServer(decodedId, config, clientsToInstall);
      
      if (result.success.length > 0) {
        addInstalledServerId(decodedId);
        await refreshInstalledClients();
        setShowConfigModal(false);
      }
      
      if (result.failed.length > 0) {
        setInstallError(`Failed to install to: ${result.failed.join(', ')}`);
      }
    } catch (error) {
      console.error('Install failed:', error);
      setInstallError(String(error));
    } finally {
      setIsInstalling(false);
    }
  };

  // Official 远程服务器安装
  const handleRemoteInstall = async (remote: OfficialRemote, headerValues: Record<string, string>) => {
    const clientsToInstall = selectedClients.filter(c => !installedClients.includes(c));
    
    if (clientsToInstall.length === 0) {
      setInstallError('Please select at least one client.');
      return;
    }

    setIsInstalling(true);
    setInstallError(null);
    
    try {
      const config = {
        url: remote.url,
        transport: remote.type,
        headers: Object.keys(headerValues).length > 0 ? headerValues : undefined,
      } as any;

      const result = await api.config.installServer(decodedId, config, clientsToInstall);
      
      if (result.success.length > 0) {
        addInstalledServerId(decodedId);
        await refreshInstalledClients();
        setShowConfigModal(false);
      }
      
      if (result.failed.length > 0) {
        setInstallError(`Failed to install to: ${result.failed.join(', ')}`);
      }
    } catch (error) {
      console.error('Install failed:', error);
      setInstallError(String(error));
    } finally {
      setIsInstalling(false);
    }
  };

  // 卸载服务器
  const handleUninstall = async (clientsToRemove?: ClientType[]) => {
    const targets = clientsToRemove || installedClients;
    if (targets.length === 0) return;
    
    if (!confirm(t('installed.confirmRemove'))) return;

    setIsUninstalling(true);
    try {
      await api.config.uninstallServer(decodedId, targets);
      await refreshInstalledClients();
      
      const { servers } = await api.config.getAllServers();
      if (!servers[decodedId]) {
        removeInstalledServerId(decodedId);
      }
    } catch (error) {
      console.error('Uninstall failed:', error);
    } finally {
      setIsUninstalling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // 获取运行时信息
  const getRuntime = () => {
    if (isSmitheryDetail(server!)) {
      return server!.connection?.runtime || 'node';
    } else if (isOfficialDetail(server!)) {
      if (selectedPackage?.runtimeHint === 'uvx') return 'python';
      if (selectedPackage?.runtimeHint === 'docker') return 'docker';
      return 'node';
    }
    return 'node';
  };

  // 获取仓库 URL
  const getRepoUrl = () => {
    if (isOfficialDetail(server!)) {
      return server!.repository?.url || null;
    }
    return null;
  };

  const runtimeAvailable = runtimeInfo?.available ?? false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1c1c1e]">
        <div className="w-8 h-8 border-2 border-[#3a3a3c] border-t-[#0a84ff] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#1c1c1e]">
        <div className="w-12 h-12 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[#ff3b30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-[13px] text-white mb-1">{t('detail.loadFailed')}</p>
        <p className="text-[12px] text-[#636366] mb-4 max-w-sm text-center">{t('detail.loadFailedHint')}</p>
        <button onClick={() => navigate('/store')} className="btn btn-secondary">
          {t('detail.back')}
        </button>
      </div>
    );
  }

  const runtime = getRuntime();
  const repoUrl = getRepoUrl();

  return (
    <div className="flex flex-col h-full bg-[#1c1c1e]">
      {/* 头部导航 - 参考 SkillDetail 风格 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#3a3a3c] text-[12px] text-[#636366]">
        <button onClick={() => navigate(-1)} className="hover:text-white transition-colors">
          <BackIcon className="w-4 h-4" />
        </button>
        <span className="hover:text-white cursor-pointer" onClick={() => navigate('/store')}>Store</span>
        <span>/</span>
        <span className="hover:text-white cursor-pointer">{dataSource === 'official' ? 'Official' : 'Smithery'}</span>
        <span>/</span>
        <span className="text-white">{server.displayName}</span>
      </div>

      {/* 内容区域 - 左右布局 */}
      <div className="flex-1 overflow-hidden flex">
        {/* 左侧主内容 */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* 标题区域 */}
            <div className="mb-6">
              <div className="flex items-start gap-4 mb-3">
                {/* 图标 */}
                <div className="flex-shrink-0">
                  {server.iconUrl && !iconError ? (
                    <img
                      src={server.iconUrl}
                      alt={server.displayName}
                      className="w-12 h-12 rounded-xl object-cover"
                      onError={() => setIconError(true)}
                    />
                  ) : (
                    <DefaultIcon name={server.displayName} repoUrl={repoUrl} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-white">{server.displayName}</h1>
                    {isSmitheryDetail(server) && server.verified && (
                      <VerifiedIcon className="w-5 h-5 text-[#0a84ff]" />
                    )}
                  </div>
                  <p className="text-[12px] text-[#636366] font-mono">{server.id}</p>
                </div>
              </div>
              
              <p className="text-[14px] text-[#98989d] leading-relaxed mb-4">
                {server.description || t('detail.noDescription')}
              </p>

              {/* 统计信息 - 与 Skill 详情页风格一致 */}
              <div className="flex items-center gap-4 text-[13px] text-[#98989d]">
                {isSmitheryDetail(server) && (
                  <>
                    <span className="flex items-center gap-1">
                      <DownloadIcon className="w-4 h-4" />
                      {formatNumber(server.downloads || 0)} Downloads
                    </span>
                    {server.createdAt && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4 text-[#636366]" />
                        Created {formatDate(server.createdAt)}
                      </span>
                    )}
                  </>
                )}
                {isOfficialDetail(server) && (
                  <>
                    {/* Stars */}
                    {(server.stars || 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {formatNumber(server.stars || 0)} Stars
                      </span>
                    )}
                    {/* Forks */}
                    {(server.forks || 0) > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-[#636366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                        </svg>
                        {formatNumber(server.forks || 0)} Forks
                      </span>
                    )}
                    {/* Last Commit */}
                    {server.lastCommitAt && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4 text-[#636366]" />
                        Updated {formatDate(server.lastCommitAt)}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Topics 标签 (Official) */}
              {isOfficialDetail(server) && server.topics && server.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {server.topics.map((topic) => (
                    <span
                      key={topic}
                      className="px-2 py-0.5 rounded-full text-[10px] bg-[#0a84ff]/10 text-[#0a84ff] border border-[#0a84ff]/20"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 运行时警告 */}
            {!runtimeAvailable && (
              <div className="card p-4 border-[#ff9f0a]/30 bg-[#ff9f0a]/5 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{runtime === 'node' ? '⬢' : runtime === 'python' ? '🐍' : '🐳'}</span>
                  <div className="flex-1">
                    <h3 className="text-[13px] font-semibold text-[#ff9f0a] mb-1">
                      {t('detail.runtimeRequired')}
                    </h3>
                    <p className="text-[12px] text-[#98989d] mb-3">
                      {t('detail.runtimeRequiredDesc', { 
                        runtime: runtime === 'node' ? 'Node.js' : runtime === 'python' ? 'Python' : 'Docker' 
                      })}
                    </p>
                    <div className="space-y-2">
                      {runtime === 'node' && (
                        <>
                          <div className="bg-[#1c1c1e] rounded-lg p-2">
                            <p className="text-[10px] text-[#636366] mb-1">macOS (Homebrew)</p>
                            <code className="text-[11px] text-[#0a84ff] font-mono">brew install node</code>
                          </div>
                          <div className="bg-[#1c1c1e] rounded-lg p-2">
                            <p className="text-[10px] text-[#636366] mb-1">Windows</p>
                            <code className="text-[11px] text-[#0a84ff] font-mono">winget install OpenJS.NodeJS</code>
                          </div>
                        </>
                      )}
                      {runtime === 'python' && (
                        <>
                          <div className="bg-[#1c1c1e] rounded-lg p-2">
                            <p className="text-[10px] text-[#636366] mb-1">macOS (Homebrew)</p>
                            <code className="text-[11px] text-[#0a84ff] font-mono">brew install python</code>
                          </div>
                          <div className="bg-[#1c1c1e] rounded-lg p-2">
                            <p className="text-[10px] text-[#636366] mb-1">uv (recommended)</p>
                            <code className="text-[11px] text-[#0a84ff] font-mono">curl -LsSf https://astral.sh/uv/install.sh | sh</code>
                          </div>
                        </>
                      )}
                      {runtime === 'docker' && (
                        <div className="bg-[#1c1c1e] rounded-lg p-2">
                          <p className="text-[10px] text-[#636366] mb-1">Docker Desktop</p>
                          <a 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              api.system.openExternal('https://www.docker.com/products/docker-desktop/');
                            }}
                            className="text-[11px] text-[#0a84ff] font-mono hover:underline"
                          >
                            https://docker.com/products/docker-desktop/
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* README 内容 (Official) - 与 Skill 详情页一致的展示风格，展示源码不渲染 */}
            {isOfficialDetail(server) && server.repository && (
              <>
                {/* README.md 标题 - 直接在页面背景上 */}
                <h2 className="text-[15px] font-semibold text-white mb-4">README.md</h2>

                {/* README 内容 - 纯净展示源码，与 SKILL.md 展示风格一致 */}
                <div className="card p-4 mb-6 overflow-x-auto">
                  {isLoadingReadme ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-[#3a3a3c] border-t-[#0a84ff] rounded-full animate-spin" />
                    </div>
                  ) : readme ? (
                    <pre className="text-[12px] text-[#e6edf3] font-mono leading-relaxed whitespace-pre-wrap">
                      <code>{readme}</code>
                    </pre>
                  ) : (
                    <p className="text-[14px] text-[#8b949e] text-center py-4">{t('detail.noReadme')}</p>
                  )}
                </div>
              </>
            )}

            {/* 功能列表 (Smithery 数据源) */}
            {isSmitheryDetail(server) && server.capabilities && server.capabilities.length > 0 && (
              <div className="card overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-[#3a3a3c]">
                  <h2 className="text-[13px] font-semibold text-white">
                    {t('detail.capabilities')} ({server.capabilities.length})
                  </h2>
                </div>
                {server.capabilities.map((cap, index) => (
                  <div
                    key={index}
                    className={`px-4 py-3 ${index !== server.capabilities.length - 1 ? 'border-b border-[#3a3a3c]' : ''}`}
                  >
                    <h4 className="text-[12px] font-mono text-[#0a84ff] mb-0.5">{cap.name}</h4>
                    <p className="text-[12px] text-[#636366]">{cap.description || t('detail.noToolDescription')}</p>
                  </div>
                ))}
              </div>
            )}


            {/* 远程服务器列表 */}
            {isOfficialDetail(server) && server.remotes && server.remotes.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-[#3a3a3c]">
                  <h2 className="text-[13px] font-semibold text-white">
                    {t('detail.remotes')} ({server.remotes.length})
                  </h2>
                </div>
                {server.remotes.map((remote, index) => (
                  <div
                    key={index}
                    className={`px-4 py-3 ${index !== server.remotes!.length - 1 ? 'border-b border-[#3a3a3c]' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#30d158]/15 text-[#30d158]">
                        {remote.type}
                      </span>
                      <span className="text-[10px] text-[#636366]">
                        {t('detail.remoteServer')}
                      </span>
                    </div>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        api.system.openExternal(remote.url);
                      }}
                      className="text-[12px] font-mono text-[#0a84ff] hover:underline break-all"
                    >
                      {remote.url}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧边栏 */}
        <div className="w-[280px] flex-shrink-0 border-l border-[#3a3a3c] overflow-y-auto p-4">
          {/* 安装按钮 */}
          <div className="mb-4 space-y-2">
            {runtimeAvailable && (
              <button
                onClick={() => setShowConfigModal(true)}
                className="w-full btn btn-primary text-[13px]"
              >
                {installedClients.length > 0 ? t('detail.installMore') : t('detail.install')}
              </button>
            )}
            {installedClients.length > 0 && (
              <button
                onClick={() => handleUninstall()}
                disabled={isUninstalling}
                className="w-full btn btn-danger text-[13px]"
              >
                {isUninstalling ? t('common.loading') : t('detail.uninstallAll')}
              </button>
            )}
            {/* Inspect 按钮 */}
            {runtimeAvailable && selectedPackage && (
              <button
                onClick={() => {
                  const pkg = selectedPackage;
                  let config: { command: string; args?: string[]; env?: Record<string, string> } | null = null;
                  
                  if (pkg.registryType === 'npm') {
                    config = { command: 'npx', args: ['-y', pkg.identifier] };
                  } else if (pkg.registryType === 'pypi') {
                    config = { command: 'uvx', args: [pkg.identifier] };
                  } else if (pkg.registryType === 'oci') {
                    config = { command: 'docker', args: ['run', '-i', '--rm', pkg.identifier] };
                  }
                  
                  if (config) {
                    const configStr = encodeURIComponent(JSON.stringify(config));
                    navigate(`/inspector?config=${configStr}`);
                  }
                }}
                className="w-full btn btn-secondary text-[13px] flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
                {t('detail.inspect') || 'Inspect'}
              </button>
            )}
          </div>

          {/* 已安装的客户端 */}
          {installedClients.length > 0 && (
            <div className="mb-4 p-3 bg-[#3a3a3c]/30 rounded-lg">
              <p className="text-[11px] text-[#636366] mb-2">{t('detail.installedIn')}</p>
              <div className="flex flex-wrap gap-1">
                {installedClients.map(clientId => {
                  const client = clients.find(c => c.id === clientId);
                  return (
                    <span
                      key={clientId}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#3a3a3c] text-[10px] text-[#98989d]"
                    >
                      <ClientIcon clientId={clientId} size={12} />
                      {client?.name || clientId}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Source 卡片 */}
          <div className="card p-4 space-y-3 mb-4">
            <h3 className="text-[13px] font-semibold text-white">Source</h3>
            
            {isOfficialDetail(server) && server.repository?.url && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  api.system.openExternal(server.repository!.url);
                }}
                className="flex items-center justify-between text-[12px] text-[#98989d] hover:text-[#0a84ff] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <GitHubIcon className="w-4 h-4" />
                  GitHub Repository
                </span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            )}
            
            {isSmitheryDetail(server) && server.links?.registry && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  api.system.openExternal(server.links.registry);
                }}
                className="flex items-center justify-between text-[12px] text-[#98989d] hover:text-[#0a84ff] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <GitHubIcon className="w-4 h-4" />
                  Smithery Registry
                </span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            )}
            
            {isSmitheryDetail(server) && server.links?.homepage && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  api.system.openExternal(server.links.homepage);
                }}
                className="flex items-center justify-between text-[12px] text-[#98989d] hover:text-[#0a84ff] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ExternalLinkIcon className="w-4 h-4" />
                  Homepage
                </span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            )}

            {isOfficialDetail(server) && server.websiteUrl && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  api.system.openExternal(server.websiteUrl!);
                }}
                className="flex items-center justify-between text-[12px] text-[#98989d] hover:text-[#0a84ff] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ExternalLinkIcon className="w-4 h-4" />
                  Website
                </span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Details 卡片 */}
          <div className="card p-4 mb-4">
            <h3 className="text-[13px] font-semibold text-white mb-3">Details</h3>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#636366]">Runtime</span>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${runtimeAvailable ? 'bg-[#34c759]' : 'bg-[#ff9f0a]'}`} />
                  <span className="text-white capitalize">{runtime}</span>
                </div>
              </div>
              
              {isOfficialDetail(server) && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#636366]">Version</span>
                    <span className="text-white font-mono">v{server.version}</span>
                  </div>
                  {server.defaultBranch && (
                    <div className="flex justify-between">
                      <span className="text-[#636366]">Branch</span>
                      <span className="text-white">{server.defaultBranch}</span>
                    </div>
                  )}
                  {server.license && (
                    <div className="flex justify-between">
                      <span className="text-[#636366]">License</span>
                      <span className="text-white">{server.license}</span>
                    </div>
                  )}
                  {server.author && (
                    <div className="flex justify-between">
                      <span className="text-[#636366]">Author</span>
                      <span className="text-white">@{server.author}</span>
                    </div>
                  )}
                </>
              )}
              
              {isSmitheryDetail(server) && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[#636366]">Downloads</span>
                    <span className="text-white">{formatNumber(server.downloads || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#636366]">Verified</span>
                    <span className="text-white">{server.verified ? 'Yes' : 'No'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 安装包列表 (Official 数据源) - 移到右侧边栏 */}
          {isOfficialDetail(server) && server.packages && server.packages.length > 0 && (
            <div className="card p-4">
              <h3 className="text-[13px] font-semibold text-white mb-3">
                Packages ({server.packages.length})
              </h3>
              <div className="space-y-2">
                {server.packages.map((pkg, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-md bg-[#3a3a3c]/30 ${index !== server.packages.length - 1 ? '' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`
                        px-1.5 py-0.5 rounded text-[10px] font-medium
                        ${pkg.registryType === 'npm' ? 'bg-[#cb3837]/15 text-[#cb3837]' :
                          pkg.registryType === 'pypi' ? 'bg-[#3776ab]/15 text-[#3776ab]' :
                          'bg-[#2496ed]/15 text-[#2496ed]'}
                      `}>
                        {pkg.registryType}
                      </span>
                      {pkg.runtimeHint && (
                        <span className="text-[10px] text-[#636366]">
                          via {pkg.runtimeHint}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-[#0a84ff] break-all">{pkg.identifier}</p>
                    {pkg.version && (
                      <p className="text-[10px] text-[#636366]">v{pkg.version}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 配置模态框 */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setInstallError(null);
        }}
        title={t('detail.configTitle')}
        size="lg"
      >
        <div className="space-y-4">
          {installError && (
            <div className="p-3 rounded-md bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#ff3b30] text-[12px]">
              {installError}
            </div>
          )}

          {/* Server 信息头部 - 与 Skills 安装弹窗一致 */}
          <div className="flex items-center gap-3 p-3 bg-[#3a3a3c]/30 rounded-lg">
            {server.iconUrl && !iconError ? (
              <img
                src={server.iconUrl}
                alt={server.displayName}
                className="w-10 h-10 rounded-lg object-cover"
                onError={() => setIconError(true)}
              />
            ) : (
              <DefaultIcon name={server.displayName} repoUrl={repoUrl} />
            )}
            <div>
              <h3 className="text-[14px] font-medium text-white">{server.displayName}</h3>
              <p className="text-[12px] text-[#636366]">{server.id}</p>
            </div>
          </div>

          {/* 客户端选择 - 只展示已安装的 Client */}
          <div>
            <label className="block text-[12px] font-medium text-white mb-2">
              {t('detail.selectClients')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {clients.filter(client => client.installed).map(client => {
                const isSelected = selectedClients.includes(client.id);
                const isAlreadyInstalled = installedClients.includes(client.id);
                
                return (
                  <button
                    key={client.id}
                    onClick={() => !isAlreadyInstalled && toggleClient(client.id)}
                    disabled={isAlreadyInstalled}
                    className={`
                      flex items-center gap-2 p-3 rounded-md border text-left transition-colors
                      ${isAlreadyInstalled
                        ? 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]'
                        : isSelected
                          ? 'bg-[#0a84ff]/10 border-[#0a84ff]/30 text-[#0a84ff]'
                          : 'bg-[#3a3a3c] border-[#3a3a3c] text-white hover:border-[#636366]'
                      }
                    `}
                  >
                    <ClientIcon clientId={client.id} size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium">{client.name}</div>
                      <div className="text-[10px] opacity-60">
                        {isAlreadyInstalled 
                          ? t('detail.alreadyInstalled')
                          : t('detail.available')}
                      </div>
                    </div>
                    {(isSelected || isAlreadyInstalled) && (
                      <CheckIcon className="w-4 h-4" />
                    )}
                  </button>
                );
              })}
            </div>

            {clients.filter(c => c.installed).length === 0 && (
              <p className="text-center text-[#636366] text-[13px] py-4">
                {t('detail.noClientsInstalled') || 'No installed clients support MCP'}
              </p>
            )}
          </div>

          {/* 配置表单 */}
          {selectedClients.filter(c => !installedClients.includes(c)).length > 0 && (
            <>
              <div className="border-t border-[#3a3a3c] pt-4">
                <p className="text-[12px] text-[#98989d] mb-4">
                  {t('detail.configDescription')}
                </p>
              </div>
              
              {/* Smithery 配置表单 */}
              {isSmitheryDetail(server) && (
                <ConfigForm
                  schema={server.connection?.configSchema || { type: 'object', properties: {}, required: [] }}
                  onSubmit={handleSmitheryInstall}
                  onCancel={() => {
                    setShowConfigModal(false);
                    setInstallError(null);
                  }}
                  isLoading={isInstalling}
                />
              )}
              
              {/* Official 配置表单 */}
              {isOfficialDetail(server) && (
                <OfficialConfigForm
                  packages={server.packages || []}
                  remotes={server.remotes || []}
                  selectedPackage={selectedPackage}
                  onPackageSelect={setSelectedPackage}
                  onSubmit={handleOfficialInstall}
                  onRemoteSubmit={handleRemoteInstall}
                  onCancel={() => {
                    setShowConfigModal(false);
                    setInstallError(null);
                  }}
                  isLoading={isInstalling}
                />
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
