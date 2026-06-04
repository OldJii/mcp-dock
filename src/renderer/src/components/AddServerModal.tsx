/**
 * 添加自定义 Server 模态框
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import ClientIcon from './ClientIcon';
import type { ClientInfo, ClientType } from '../../../preload/index';

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (serverId: string, config: ServerConfig, clients: ClientType[]) => Promise<void>;
  clients: ClientInfo[];
  isLoading?: boolean;
}

interface ServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface EnvVar {
  key: string;
  value: string;
}

export default function AddServerModal({
  isOpen,
  onClose,
  onSubmit,
  clients,
  isLoading = false,
}: AddServerModalProps) {
  const { t } = useTranslation();
  
  // 表单状态
  const [displayName, setDisplayName] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientType[]>([]);
  const [jsonInput, setJsonInput] = useState('');
  const [parseError, setParseError] = useState('');
  const [showJsonInput, setShowJsonInput] = useState(false);

  // 可用的客户端
  const availableClients = clients.filter(c => c.installed);

  // 重置表单
  useEffect(() => {
    if (isOpen) {
      setDisplayName('');
      setCommand('');
      setArgs('');
      setEnvVars([]);
      setSelectedClients([]);
      setJsonInput('');
      setParseError('');
      setShowJsonInput(false);
    }
  }, [isOpen]);

  // 添加环境变量
  const addEnvVar = () => {
    setEnvVars(prev => [...prev, { key: '', value: '' }]);
  };

  // 删除环境变量
  const removeEnvVar = (index: number) => {
    setEnvVars(prev => prev.filter((_, i) => i !== index));
  };

  // 更新环境变量
  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    setEnvVars(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // 切换客户端选择
  const toggleClient = (clientId: ClientType) => {
    setSelectedClients(prev => 
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  // 解析 JSON 输入
  const parseJson = () => {
    setParseError('');
    
    if (!jsonInput.trim()) {
      setParseError(t('addServer.emptyJson') || 'Please paste JSON configuration');
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      
      // 验证必要字段
      if (!parsed.command) {
        setParseError(t('addServer.missingCommand') || 'Missing "command" field');
        return;
      }

      // 填充表单
      setCommand(parsed.command);
      
      if (parsed.args) {
        if (Array.isArray(parsed.args)) {
          setArgs(parsed.args.join(' '));
        } else {
          setArgs(String(parsed.args));
        }
      }

      if (parsed.env && typeof parsed.env === 'object') {
        const envArray = Object.entries(parsed.env).map(([key, value]) => ({
          key,
          value: String(value),
        }));
        setEnvVars(envArray);
      }

      // 尝试从 args 中提取名称
      if (!displayName && parsed.args && Array.isArray(parsed.args)) {
        // 尝试找到包名（通常是 -y 后面的参数或第一个非 flag 参数）
        const yIndex = parsed.args.indexOf('-y');
        if (yIndex !== -1 && parsed.args[yIndex + 1]) {
          const packageName = parsed.args[yIndex + 1];
          // 提取包名的最后部分作为显示名称
          const name = packageName.split('/').pop()?.replace(/^@/, '') || packageName;
          setDisplayName(name);
        }
      }

      setShowJsonInput(false);
    } catch (e) {
      setParseError(t('addServer.invalidJson') || 'Invalid JSON format');
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!command.trim()) {
      return;
    }

    if (selectedClients.length === 0) {
      return;
    }

    // 生成 server ID
    const serverId = displayName.trim() 
      ? displayName.trim().toLowerCase().replace(/\s+/g, '-')
      : `custom-${Date.now()}`;

    // 构建配置
    const config: ServerConfig = {
      command: command.trim(),
    };

    if (args.trim()) {
      config.args = args.trim().split(/\s+/);
    }

    if (envVars.length > 0) {
      const env: Record<string, string> = {};
      envVars.forEach(({ key, value }) => {
        if (key.trim()) {
          env[key.trim()] = value;
        }
      });
      if (Object.keys(env).length > 0) {
        config.env = env;
      }
    }

    await onSubmit(serverId, config, selectedClients);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('addServer.title') || 'Add Custom Server'}
      size="lg"
    >
      <div className="space-y-4">
        {/* Display Name */}
        <div>
          <label className="block text-[12px] text-[#98989d] mb-1.5">
            {t('addServer.displayName') || 'Display Name'} 
            <span className="text-[#636366] ml-1">({t('common.optional') || 'optional'})</span>
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('addServer.displayNamePlaceholder') || 'My Custom Server'}
            className="w-full px-3 py-2 bg-[#1c1c1e] border border-[#3a3a3c] rounded-lg text-[13px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff]"
          />
        </div>

        {/* Command */}
        <div>
          <label className="block text-[12px] text-[#98989d] mb-1.5">
            {t('addServer.command') || 'Command'} <span className="text-[#ff3b30]">*</span>
          </label>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="npx, uvx, node, python..."
            className="w-full px-3 py-2 bg-[#1c1c1e] border border-[#3a3a3c] rounded-lg text-[13px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff]"
          />
        </div>

        {/* Arguments */}
        <div>
          <label className="block text-[12px] text-[#98989d] mb-1.5">
            {t('addServer.arguments') || 'Arguments'}
          </label>
          <input
            type="text"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="-y @modelcontextprotocol/server-filesystem /path/to/dir"
            className="w-full px-3 py-2 bg-[#1c1c1e] border border-[#3a3a3c] rounded-lg text-[13px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff]"
          />
          <p className="text-[11px] text-[#636366] mt-1">
            {t('addServer.argumentsHint') || 'Space-separated arguments'}
          </p>
        </div>

        {/* Environment Variables */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[12px] text-[#98989d]">
              {t('addServer.envVars') || 'Environment Variables'}
            </label>
            <button
              onClick={addEnvVar}
              className="text-[12px] text-[#0a84ff] hover:text-[#5ac8fa]"
            >
              + {t('common.add') || 'Add'}
            </button>
          </div>
          {envVars.length === 0 ? (
            <p className="text-[12px] text-[#636366]">
              {t('addServer.noEnvVars') || 'No environment variables'}
            </p>
          ) : (
            <div className="space-y-2">
              {envVars.map((env, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={env.key}
                    onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                    placeholder="KEY"
                    className="flex-1 px-3 py-2 bg-[#1c1c1e] border border-[#3a3a3c] rounded-lg text-[13px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff]"
                  />
                  <input
                    type="text"
                    value={env.value}
                    onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1 px-3 py-2 bg-[#1c1c1e] border border-[#3a3a3c] rounded-lg text-[13px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff]"
                  />
                  <button
                    onClick={() => removeEnvVar(index)}
                    className="px-2 text-[#ff3b30] hover:text-[#ff6961]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Target Clients */}
        <div>
          <label className="block text-[12px] text-[#98989d] mb-1.5">
            {t('addServer.targetClients') || 'Target Clients'} <span className="text-[#ff3b30]">*</span>
          </label>
          {availableClients.length === 0 ? (
            <p className="text-[12px] text-[#636366]">
              {t('addServer.noClients') || 'No MCP clients installed'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {availableClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => toggleClient(client.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
                    ${selectedClients.includes(client.id)
                      ? 'border-[#0a84ff] bg-[#0a84ff]/10'
                      : 'border-[#3a3a3c] hover:border-[#636366]'
                    }
                  `}
                >
                  <ClientIcon clientId={client.id} size={20} />
                  <span className="text-[13px] text-white">{client.name}</span>
                  {selectedClients.includes(client.id) && (
                    <svg className="w-4 h-4 text-[#0a84ff] ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Paste JSON Section */}
        <div className="border-t border-[#3a3a3c] pt-4">
          <button
            onClick={() => setShowJsonInput(!showJsonInput)}
            className="flex items-center gap-2 text-[13px] text-[#0a84ff] hover:text-[#5ac8fa]"
          >
            <svg className={`w-4 h-4 transition-transform ${showJsonInput ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {t('addServer.pasteJson') || 'Paste JSON Configuration'}
          </button>
          
          {showJsonInput && (
            <div className="mt-3 space-y-2">
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={`{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
  "env": {
    "API_KEY": "xxx"
  }
}`}
                className="w-full h-32 px-3 py-2 bg-[#1c1c1e] border border-[#3a3a3c] rounded-lg text-[12px] text-white font-mono placeholder-[#636366] focus:outline-none focus:border-[#0a84ff] resize-none"
              />
              {parseError && (
                <p className="text-[12px] text-[#ff3b30]">{parseError}</p>
              )}
              <button
                onClick={parseJson}
                className="px-3 py-1.5 bg-[#3a3a3c] text-white rounded-lg text-[12px] hover:bg-[#4a4a4c] transition-colors"
              >
                {t('addServer.parseAndFill') || 'Parse & Fill Form'}
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={isLoading || !command.trim() || selectedClients.length === 0}
          >
            {isLoading ? (t('common.loading') || 'Loading...') : (t('addServer.add') || 'Add Server')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
