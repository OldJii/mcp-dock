/**
 * Official 数据源配置表单组件 - Surge 风格
 * 用于配置 Official Registry 的环境变量、参数和远程服务器
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { OfficialPackage, OfficialRemote } from '../api/registry';

// 安装类型
type InstallType = 'package' | 'remote';

interface OfficialConfigFormProps {
  packages: OfficialPackage[];
  remotes?: OfficialRemote[];
  selectedPackage: OfficialPackage | null;
  onPackageSelect: (pkg: OfficialPackage) => void;
  onSubmit: (envValues: Record<string, string>, argValues: Record<string, string>) => void;
  onRemoteSubmit?: (remote: OfficialRemote, headerValues: Record<string, string>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function OfficialConfigForm({
  packages,
  remotes = [],
  selectedPackage,
  onPackageSelect,
  onSubmit,
  onRemoteSubmit,
  onCancel,
  isLoading = false,
}: OfficialConfigFormProps) {
  const { t } = useTranslation();
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 安装类型和选中的远程服务器
  const [installType, setInstallType] = useState<InstallType>('package');
  const [selectedRemote, setSelectedRemote] = useState<OfficialRemote | null>(null);

  const hasPackages = packages.length > 0;
  const hasRemotes = remotes.length > 0;

  // 初始化：仅在组件首次挂载时自动选择安装类型和默认选项
  // 使用 useRef 跟踪是否已初始化，避免重复设置
  const isInitialized = useState(false);
  
  useEffect(() => {
    // 只在首次挂载时初始化
    if (isInitialized[0]) return;
    
    if (hasPackages) {
      setInstallType('package');
      if (!selectedPackage) {
        onPackageSelect(packages[0]);
      }
      isInitialized[1](true);
    } else if (hasRemotes) {
      setInstallType('remote');
      if (!selectedRemote) {
        setSelectedRemote(remotes[0]);
      }
      isInitialized[1](true);
    }
  }, [packages, remotes, hasPackages, hasRemotes, selectedPackage, selectedRemote, onPackageSelect, isInitialized]);

  // 当选择的包变化时，重置表单值
  useEffect(() => {
    if (selectedPackage && installType === 'package') {
      const initialEnv: Record<string, string> = {};
      const initialArgs: Record<string, string> = {};
      
      selectedPackage.environmentVariables?.forEach(env => {
        initialEnv[env.name] = env.default || '';
      });
      
      selectedPackage.packageArguments?.forEach(arg => {
        initialArgs[arg.name] = arg.default || '';
      });
      
      setEnvValues(initialEnv);
      setArgValues(initialArgs);
      setErrors({});
    }
  }, [selectedPackage, installType]);

  // 当选择的远程服务器变化时，重置表单值
  useEffect(() => {
    if (selectedRemote && installType === 'remote') {
      const initialHeaders: Record<string, string> = {};
      
      selectedRemote.headers?.forEach(header => {
        initialHeaders[header.name] = header.default || '';
      });
      
      setHeaderValues(initialHeaders);
      setErrors({});
    }
  }, [selectedRemote, installType]);

  const handleEnvChange = (key: string, value: string) => {
    setEnvValues(prev => ({ ...prev, [key]: value }));
    if (errors[`env_${key}`]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[`env_${key}`];
        return next;
      });
    }
  };

  const handleArgChange = (key: string, value: string) => {
    setArgValues(prev => ({ ...prev, [key]: value }));
    if (errors[`arg_${key}`]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[`arg_${key}`];
        return next;
      });
    }
  };

  const handleHeaderChange = (key: string, value: string) => {
    setHeaderValues(prev => ({ ...prev, [key]: value }));
    if (errors[`header_${key}`]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[`header_${key}`];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    
    if (installType === 'package' && selectedPackage) {
      // 验证必填的环境变量
      selectedPackage.environmentVariables?.forEach(env => {
        if (env.isRequired && !envValues[env.name]?.trim()) {
          newErrors[`env_${env.name}`] = 'Required';
        }
      });
      
      // 验证必填的参数
      selectedPackage.packageArguments?.forEach(arg => {
        if (arg.isRequired && !argValues[arg.name]?.trim()) {
          newErrors[`arg_${arg.name}`] = 'Required';
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // 过滤空值
      const filteredEnv: Record<string, string> = {};
      Object.entries(envValues).forEach(([key, value]) => {
        if (value?.trim()) {
          filteredEnv[key] = value.trim();
        }
      });

      const filteredArgs: Record<string, string> = {};
      Object.entries(argValues).forEach(([key, value]) => {
        if (value?.trim()) {
          filteredArgs[key] = value.trim();
        }
      });

      onSubmit(filteredEnv, filteredArgs);
    } else if (installType === 'remote' && selectedRemote) {
      // 验证必填的 headers
      selectedRemote.headers?.forEach(header => {
        if (header.isRequired && !headerValues[header.name]?.trim()) {
          newErrors[`header_${header.name}`] = 'Required';
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // 过滤空值
      const filteredHeaders: Record<string, string> = {};
      Object.entries(headerValues).forEach(([key, value]) => {
        if (value?.trim()) {
          filteredHeaders[key] = value.trim();
        }
      });

      if (onRemoteSubmit) {
        onRemoteSubmit(selectedRemote, filteredHeaders);
      }
    }
  };

  // 如果既没有包也没有远程服务器，显示错误
  if (!hasPackages && !hasRemotes) {
    return (
      <div className="text-center py-8">
        <p className="text-[13px] text-[#ff3b30] mb-4">{t('detail.noInstallOptions')}</p>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          {t('detail.cancel')}
        </button>
      </div>
    );
  }

  const envVars = selectedPackage?.environmentVariables || [];
  const pkgArgs = selectedPackage?.packageArguments || [];
  const headers = selectedRemote?.headers || [];
  const hasPackageConfig = envVars.length > 0 || pkgArgs.length > 0;
  const hasRemoteConfig = headers.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 安装类型选择（如果同时有包和远程服务器） */}
      {hasPackages && hasRemotes && (
        <div>
          <label className="block text-[12px] font-medium text-white mb-2">
            {t('detail.installType')}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setInstallType('package');
                if (packages.length > 0 && !selectedPackage) {
                  onPackageSelect(packages[0]);
                }
              }}
              className={`
                flex-1 px-3 py-2 rounded-md border text-[12px] font-medium transition-colors
                ${installType === 'package'
                  ? 'bg-[#0a84ff]/10 border-[#0a84ff]/30 text-[#0a84ff]'
                  : 'bg-[#3a3a3c] border-[#3a3a3c] text-white hover:border-[#636366]'
                }
              `}
            >
              📦 {t('detail.localPackage')}
            </button>
            <button
              type="button"
              onClick={() => {
                setInstallType('remote');
                if (remotes.length > 0 && !selectedRemote) {
                  setSelectedRemote(remotes[0]);
                }
              }}
              className={`
                flex-1 px-3 py-2 rounded-md border text-[12px] font-medium transition-colors
                ${installType === 'remote'
                  ? 'bg-[#30d158]/10 border-[#30d158]/30 text-[#30d158]'
                  : 'bg-[#3a3a3c] border-[#3a3a3c] text-white hover:border-[#636366]'
                }
              `}
            >
              ☁️ {t('detail.remoteServer')}
            </button>
          </div>
        </div>
      )}

      {/* Docker 提示 (如果选择的包是 oci 类型) */}
      {installType === 'package' && selectedPackage?.registryType === 'oci' && (
        <div className="p-3 rounded-md bg-[#ff9f0a]/10 border border-[#ff9f0a]/30">
          <div className="flex items-start gap-2">
            <span className="text-[#ff9f0a]">⚠️</span>
            <div>
              <p className="text-[12px] font-medium text-[#ff9f0a] mb-1">{t('detail.dockerRequired')}</p>
              <p className="text-[11px] text-[#98989d]">{t('detail.dockerRequiredDesc')}</p>
            </div>
          </div>
        </div>
      )}

      {/* MCPB 提示 (如果选择的包是 mcpb 类型) */}
      {installType === 'package' && selectedPackage?.registryType === 'mcpb' && (
        <div className="p-3 rounded-md bg-[#ff3b30]/10 border border-[#ff3b30]/30">
          <div className="flex items-start gap-2">
            <span className="text-[#ff3b30]">⚠️</span>
            <div>
              <p className="text-[12px] font-medium text-[#ff3b30] mb-1">{t('detail.mcpbNotSupported')}</p>
              <p className="text-[11px] text-[#98989d] mb-2">{t('detail.mcpbNotSupportedDesc')}</p>
              <a
                href={selectedPackage.identifier}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#0a84ff] hover:underline break-all"
              >
                {selectedPackage.identifier}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 包选择 (如果有多个包且选择了本地安装) */}
      {installType === 'package' && packages.length > 1 && (
        <div>
          <label className="block text-[12px] font-medium text-white mb-2">
            {t('detail.selectPackage')}
          </label>
          <div className="space-y-2">
            {packages.map((pkg, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onPackageSelect(pkg)}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors
                  ${selectedPackage === pkg
                    ? 'bg-[#0a84ff]/10 border-[#0a84ff]/30'
                    : 'bg-[#3a3a3c] border-[#3a3a3c] hover:border-[#636366]'
                  }
                `}
              >
                <span className={`
                  px-1.5 py-0.5 rounded text-[10px] font-medium
                  ${pkg.registryType === 'npm' ? 'bg-[#cb3837]/15 text-[#cb3837]' :
                    pkg.registryType === 'pypi' ? 'bg-[#3776ab]/15 text-[#3776ab]' :
                    pkg.registryType === 'mcpb' ? 'bg-[#ff9f0a]/15 text-[#ff9f0a]' :
                    'bg-[#2496ed]/15 text-[#2496ed]'}
                `}>
                  {pkg.registryType}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-mono text-white truncate">{pkg.identifier}</div>
                  {pkg.runtimeHint && (
                    <div className="text-[10px] text-[#636366]">via {pkg.runtimeHint}</div>
                  )}
                </div>
                {selectedPackage === pkg && (
                  <svg className="w-4 h-4 text-[#0a84ff]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 远程服务器选择 (如果有多个远程服务器且选择了远程安装) */}
      {installType === 'remote' && remotes.length > 1 && (
        <div>
          <label className="block text-[12px] font-medium text-white mb-2">
            {t('detail.selectRemote')}
          </label>
          <div className="space-y-2">
            {remotes.map((remote, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSelectedRemote(remote)}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-md border text-left transition-colors
                  ${selectedRemote === remote
                    ? 'bg-[#30d158]/10 border-[#30d158]/30'
                    : 'bg-[#3a3a3c] border-[#3a3a3c] hover:border-[#636366]'
                  }
                `}
              >
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#30d158]/15 text-[#30d158]">
                  {remote.type}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-mono text-white truncate">{remote.url}</div>
                </div>
                {selectedRemote === remote && (
                  <svg className="w-4 h-4 text-[#30d158]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 单个远程服务器信息展示 */}
      {installType === 'remote' && remotes.length === 1 && selectedRemote && (
        <div className="p-3 rounded-md bg-[#30d158]/10 border border-[#30d158]/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#30d158]/15 text-[#30d158]">
              {selectedRemote.type}
            </span>
            <span className="text-[10px] text-[#30d158]">{t('detail.remoteServer')}</span>
          </div>
          <div className="text-[12px] font-mono text-white break-all">{selectedRemote.url}</div>
        </div>
      )}

      {/* 本地包配置 */}
      {installType === 'package' && (
        <>
          {/* 无配置项提示 */}
          {!hasPackageConfig && (
            <div className="text-center py-4">
              <p className="text-[13px] text-[#98989d]">{t('detail.noConfigRequired')}</p>
            </div>
          )}

          {/* 环境变量 */}
          {envVars.length > 0 && (
            <div>
              <h3 className="text-[12px] font-medium text-white mb-3">{t('detail.envVars')}</h3>
              <div className="space-y-3">
                {envVars.map((env) => {
                  const hasError = !!errors[`env_${env.name}`];
                  const isSecret = env.isSecret;
                  
                  return (
                    <div key={env.name}>
                      <label className="block mb-1">
                        <span className="text-[12px] font-medium text-white">
                          {env.name}
                        </span>
                        {env.isRequired ? (
                          <span className="ml-1 text-[10px] text-[#ff3b30]">*</span>
                        ) : (
                          <span className="ml-1 text-[10px] text-[#636366]">({t('detail.optional')})</span>
                        )}
                        {isSecret && (
                          <span className="ml-1 text-[10px] text-[#ff9f0a]">🔒</span>
                        )}
                      </label>
                      
                      {env.description && (
                        <p className="text-[11px] text-[#636366] mb-1.5">{env.description}</p>
                      )}

                      {env.choices && env.choices.length > 0 ? (
                        <select
                          value={envValues[env.name] || ''}
                          onChange={(e) => handleEnvChange(env.name, e.target.value)}
                          className={`
                            w-full px-3 py-2 rounded-md bg-[#1c1c1e] border text-[13px] text-white
                            transition-colors
                            ${hasError 
                              ? 'border-[#ff3b30]' 
                              : 'border-[#3a3a3c] focus:border-[#0a84ff]'
                            }
                          `}
                        >
                          <option value="">Select...</option>
                          {env.choices.map((choice) => (
                            <option key={choice} value={choice}>{choice}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={isSecret ? 'password' : 'text'}
                          value={envValues[env.name] || ''}
                          onChange={(e) => handleEnvChange(env.name, e.target.value)}
                          placeholder={env.default || `Enter ${env.name}...`}
                          className={`
                            w-full px-3 py-2 rounded-md bg-[#1c1c1e] border text-[13px] text-white
                            placeholder:text-[#636366] transition-colors
                            ${hasError 
                              ? 'border-[#ff3b30]' 
                              : 'border-[#3a3a3c] focus:border-[#0a84ff]'
                            }
                          `}
                        />
                      )}

                      {hasError && (
                        <p className="mt-1 text-[11px] text-[#ff3b30]">{errors[`env_${env.name}`]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 参数 */}
          {pkgArgs.length > 0 && (
            <div>
              <h3 className="text-[12px] font-medium text-white mb-3">{t('detail.args')}</h3>
              <div className="space-y-3">
                {pkgArgs.map((arg) => {
                  const hasError = !!errors[`arg_${arg.name}`];
                  
                  return (
                    <div key={arg.name}>
                      <label className="block mb-1">
                        <span className="text-[12px] font-medium text-white font-mono">
                          {arg.name}
                        </span>
                        {arg.isRequired ? (
                          <span className="ml-1 text-[10px] text-[#ff3b30]">*</span>
                        ) : (
                          <span className="ml-1 text-[10px] text-[#636366]">({t('detail.optional')})</span>
                        )}
                        <span className="ml-2 text-[10px] text-[#636366]">
                          ({arg.type})
                        </span>
                      </label>
                      
                      {arg.description && (
                        <p className="text-[11px] text-[#636366] mb-1.5">{arg.description}</p>
                      )}

                      <input
                        type="text"
                        value={argValues[arg.name] || ''}
                        onChange={(e) => handleArgChange(arg.name, e.target.value)}
                        placeholder={arg.default || `Enter value...`}
                        className={`
                          w-full px-3 py-2 rounded-md bg-[#1c1c1e] border text-[13px] text-white font-mono
                          placeholder:text-[#636366] transition-colors
                          ${hasError 
                            ? 'border-[#ff3b30]' 
                            : 'border-[#3a3a3c] focus:border-[#0a84ff]'
                          }
                        `}
                      />

                      {hasError && (
                        <p className="mt-1 text-[11px] text-[#ff3b30]">{errors[`arg_${arg.name}`]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 远程服务器配置 */}
      {installType === 'remote' && (
        <>
          {/* 无配置项提示 */}
          {!hasRemoteConfig && (
            <div className="text-center py-4">
              <p className="text-[13px] text-[#98989d]">{t('detail.noConfigRequired')}</p>
            </div>
          )}

          {/* Headers */}
          {headers.length > 0 && (
            <div>
              <h3 className="text-[12px] font-medium text-white mb-3">{t('detail.headers')}</h3>
              <div className="space-y-3">
                {headers.map((header) => {
                  const hasError = !!errors[`header_${header.name}`];
                  const isSecret = header.isSecret;
                  
                  return (
                    <div key={header.name}>
                      <label className="block mb-1">
                        <span className="text-[12px] font-medium text-white">
                          {header.name}
                        </span>
                        {header.isRequired ? (
                          <span className="ml-1 text-[10px] text-[#ff3b30]">*</span>
                        ) : (
                          <span className="ml-1 text-[10px] text-[#636366]">({t('detail.optional')})</span>
                        )}
                        {isSecret && (
                          <span className="ml-1 text-[10px] text-[#ff9f0a]">🔒</span>
                        )}
                      </label>
                      
                      {header.description && (
                        <p className="text-[11px] text-[#636366] mb-1.5">{header.description}</p>
                      )}

                      <input
                        type={isSecret ? 'password' : 'text'}
                        value={headerValues[header.name] || ''}
                        onChange={(e) => handleHeaderChange(header.name, e.target.value)}
                        placeholder={header.default || `Enter ${header.name}...`}
                        className={`
                          w-full px-3 py-2 rounded-md bg-[#1c1c1e] border text-[13px] text-white
                          placeholder:text-[#636366] transition-colors
                          ${hasError 
                            ? 'border-[#ff3b30]' 
                            : 'border-[#3a3a3c] focus:border-[#0a84ff]'
                          }
                        `}
                      />

                      {hasError && (
                        <p className="mt-1 text-[11px] text-[#ff3b30]">{errors[`header_${header.name}`]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 按钮 */}
      <div className="flex justify-end gap-2 pt-3 border-t border-[#3a3a3c]">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          {t('detail.cancel')}
        </button>
        <button
          type="submit"
          disabled={
            isLoading || 
            (installType === 'package' && !selectedPackage) || 
            (installType === 'package' && selectedPackage?.registryType === 'mcpb') ||
            (installType === 'remote' && !selectedRemote)
          }
          className="btn btn-primary disabled:opacity-50"
        >
          {isLoading ? t('common.loading') : t('detail.installNow')}
        </button>
      </div>
    </form>
  );
}
