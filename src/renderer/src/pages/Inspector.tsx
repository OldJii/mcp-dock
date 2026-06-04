/**
 * MCP Inspector 页面
 * 交互式调试 MCP Server
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useElectronAPI } from '../lib/electron';
import { useStore } from '../store/useStore';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// 注册 JSON 语言
SyntaxHighlighter.registerLanguage('json', json);

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

interface ServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type ActiveTab = 'tools' | 'resources' | 'prompts';

export default function Inspector() {
  const { t } = useTranslation();
  const api = useElectronAPI();
  const [searchParams] = useSearchParams();
  const { inspectorState, setInspectorState } = useStore();
  
  // 跟踪是否是通过 URL 参数进入
  const hasPresetConfig = useRef(false);
  
  // 从 URL 参数获取预设的服务器配置
  const presetConfig = useMemo(() => {
    const configStr = searchParams.get('config');
    if (configStr) {
      try {
        const config = JSON.parse(decodeURIComponent(configStr)) as ServerConfig;
        hasPresetConfig.current = true;
        return config;
      } catch {
        return null;
      }
    }
    return null;
  }, [searchParams]);

  // 连接状态
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [serverInfo, setServerInfo] = useState<{ name?: string; version?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  
  // 配置 - 优先使用 URL 参数，否则使用 store 中保存的状态
  const [command, setCommandState] = useState(
    presetConfig?.command || inspectorState.command || 'npx'
  );
  const [args, setArgsState] = useState(
    presetConfig?.args?.join(' ') || inspectorState.args || ''
  );
  const [envVars, setEnvVarsState] = useState<{ key: string; value: string }[]>(
    presetConfig?.env 
      ? Object.entries(presetConfig.env).map(([key, value]) => ({ key, value }))
      : inspectorState.envVars || []
  );
  
  // 包装 setter 以同时更新 store
  const setCommand = useCallback((value: string) => {
    setCommandState(value);
    setInspectorState({ command: value });
  }, [setInspectorState]);
  
  const setArgs = useCallback((value: string) => {
    setArgsState(value);
    setInspectorState({ args: value });
  }, [setInspectorState]);
  
  const setEnvVars = useCallback((updater: { key: string; value: string }[] | ((prev: { key: string; value: string }[]) => { key: string; value: string }[])) => {
    setEnvVarsState(prev => {
      const newValue = typeof updater === 'function' ? updater(prev) : updater;
      setInspectorState({ envVars: newValue });
      return newValue;
    });
  }, [setInspectorState]);
  
  // 工具列表
  const [tools, setTools] = useState<McpTool[]>([]);
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  
  // Resources 和 Prompts
  const [resources, setResources] = useState<McpResource[]>([]);
  const [prompts, setPrompts] = useState<McpPrompt[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('tools');
  
  // 工具调用
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [resultError, setResultError] = useState<string>('');

  // Session ID
  const sessionId = useMemo(() => `inspector-${Date.now()}`, []);

  // 添加日志
  const addLog = useCallback((message: string) => {
    setLogs(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  // 设置事件监听
  useEffect(() => {
    const unsubStderr = api.mcp.onStderr(({ sessionId: sid, message }) => {
      if (sid === sessionId) {
        addLog(`[stderr] ${message}`);
      }
    });

    const unsubDisconnected = api.mcp.onDisconnected(({ sessionId: sid, code }) => {
      if (sid === sessionId) {
        setStatus('disconnected');
        addLog(`Disconnected with code ${code}`);
      }
    });

    const unsubError = api.mcp.onError(({ sessionId: sid, error }) => {
      if (sid === sessionId) {
        setStatus('error');
        setErrorMessage(error);
        addLog(`Error: ${error}`);
      }
    });

    return () => {
      unsubStderr();
      unsubDisconnected();
      unsubError();
    };
  }, [api, sessionId, addLog]);

  // 组件卸载时断开连接，避免资源泄漏
  useEffect(() => {
    return () => {
      api.mcp.disconnect(sessionId);
    };
  }, [api, sessionId]);

  // 连接到服务器
  const handleConnect = async () => {
    if (status === 'connected') {
      // 断开连接
      await api.mcp.disconnect(sessionId);
      setStatus('disconnected');
      setServerInfo(null);
      setTools([]);
      setResources([]);
      setPrompts([]);
      setSelectedTool(null);
      setResult(null);
      addLog('Disconnected');
      return;
    }

    setStatus('connecting');
    setErrorMessage('');
    setTools([]);
    setResources([]);
    setPrompts([]);
    setSelectedTool(null);
    setResult(null);

    // 构建配置
    const config: ServerConfig = {
      command,
      args: args.trim() ? args.trim().split(/\s+/) : [],
      env: envVars.reduce((acc, { key, value }) => {
        if (key.trim()) {
          acc[key.trim()] = value;
        }
        return acc;
      }, {} as Record<string, string>),
    };

    addLog(`Connecting to: ${command} ${args}`);

    const result = await api.mcp.connect(sessionId, config);
    
    if (result.success) {
      setStatus('connected');
      setServerInfo(result.serverInfo || null);
      addLog(`Connected to ${result.serverInfo?.name || 'MCP Server'} v${result.serverInfo?.version || 'unknown'}`);
      
      // 并行获取 tools、resources 和 prompts
      const [toolsResult, resourcesResult, promptsResult] = await Promise.all([
        api.mcp.listTools(sessionId),
        api.mcp.listResources(sessionId),
        api.mcp.listPrompts(sessionId),
      ]);
      
      if (toolsResult.success && toolsResult.tools) {
        setTools(toolsResult.tools);
        addLog(`Found ${toolsResult.tools.length} tools`);
      }
      
      if (resourcesResult.success && resourcesResult.resources) {
        setResources(resourcesResult.resources as McpResource[]);
        addLog(`Found ${resourcesResult.resources.length} resources`);
      }
      
      if (promptsResult.success && promptsResult.prompts) {
        setPrompts(promptsResult.prompts as McpPrompt[]);
        addLog(`Found ${promptsResult.prompts.length} prompts`);
      }
    } else {
      setStatus('error');
      setErrorMessage(result.error || 'Connection failed');
      addLog(`Connection failed: ${result.error}`);
    }
  };

  // 选择工具
  const handleSelectTool = (tool: McpTool) => {
    setSelectedTool(tool);
    setToolArgs({});
    setResult(null);
    setResultError('');
  };

  // 运行工具
  const handleRunTool = async () => {
    if (!selectedTool) return;

    setIsRunning(true);
    setResult(null);
    setResultError('');
    addLog(`Calling tool: ${selectedTool.name}`);

    // 解析参数
    const parsedArgs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(toolArgs)) {
      if (value.trim()) {
        // 尝试解析 JSON
        try {
          parsedArgs[key] = JSON.parse(value);
        } catch {
          parsedArgs[key] = value;
        }
      }
    }

    const response = await api.mcp.callTool(sessionId, selectedTool.name, parsedArgs);
    
    if (response.success) {
      setResult(response.result);
      addLog(`Tool call successful`);
    } else {
      setResultError(response.error || 'Tool call failed');
      addLog(`Tool call failed: ${response.error}`);
    }

    setIsRunning(false);
  };

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

  // 渲染工具参数表单
  const renderToolForm = () => {
    if (!selectedTool?.inputSchema?.properties) {
      return (
        <p className="text-[13px] text-[#636366]">
          {t('inspector.noParameters') || 'This tool has no parameters'}
        </p>
      );
    }

    const properties = selectedTool.inputSchema.properties as Record<string, {
      type?: string;
      description?: string;
      default?: unknown;
      enum?: string[];
    }>;
    const required = selectedTool.inputSchema.required || [];

    return (
      <div className="space-y-3">
        {Object.entries(properties).map(([key, schema]) => (
          <div key={key}>
            <label className="block text-[12px] text-[#98989d] mb-1">
              {key}
              {required.includes(key) && <span className="text-[#ff3b30] ml-1">*</span>}
              {schema.description && (
                <span className="text-[#636366] ml-2">- {schema.description}</span>
              )}
            </label>
            {schema.enum ? (
              <select
                value={toolArgs[key] || ''}
                onChange={(e) => setToolArgs(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-3 py-2 bg-[#1c1c1e] border border-[#3a3a3c] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#0a84ff]"
              >
                <option value="">Select...</option>
                {schema.enum.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : schema.type === 'boolean' ? (
              <select
                value={toolArgs[key] || ''}
                onChange={(e) => setToolArgs(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-3 py-2 bg-[#1c1c1e] border border-[#3a3a3c] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#0a84ff]"
              >
                <option value="">Select...</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type="text"
                value={toolArgs[key] || ''}
                onChange={(e) => setToolArgs(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={schema.default !== undefined ? String(schema.default) : `Enter ${key}...`}
                className="w-full px-3 py-2 bg-[#1c1c1e] border border-[#3a3a3c] rounded-lg text-[13px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff]"
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#1c1c1e]">
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a3a3c]">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-white">
            {t('inspector.title') || 'MCP Inspector'}
          </h1>
          
          {/* 连接状态 */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              status === 'connected' ? 'bg-[#34c759]' :
              status === 'connecting' ? 'bg-[#ff9f0a] animate-pulse' :
              status === 'error' ? 'bg-[#ff3b30]' :
              'bg-[#636366]'
            }`} />
            <span className="text-[12px] text-[#98989d]">
              {status === 'connected' && serverInfo?.name 
                ? `${serverInfo.name} v${serverInfo.version || '?'}`
                : status === 'connecting' ? (t('inspector.connecting') || 'Connecting...')
                : status === 'error' ? (t('inspector.error') || 'Error')
                : (t('inspector.disconnected') || 'Disconnected')
              }
            </span>
          </div>
        </div>

        <button
          onClick={handleConnect}
          disabled={status === 'connecting'}
          className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
            status === 'connected'
              ? 'bg-[#ff3b30] text-white hover:bg-[#ff3b30]/80'
              : 'bg-[#0a84ff] text-white hover:bg-[#0a84ff]/80'
          } disabled:opacity-50`}
        >
          {status === 'connected' 
            ? (t('inspector.disconnect') || 'Disconnect')
            : status === 'connecting'
            ? (t('inspector.connecting') || 'Connecting...')
            : (t('inspector.connect') || 'Connect')
          }
        </button>
      </div>

      {/* 主内容区 - 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：配置 + 工具列表 */}
        <div className="w-72 border-r border-[#3a3a3c] flex flex-col overflow-hidden">
          {/* 配置区域 */}
          <div className="p-3 border-b border-[#3a3a3c] space-y-3">
            <div>
              <label className="block text-[11px] text-[#636366] uppercase mb-1">
                {t('inspector.command') || 'Command'}
              </label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                disabled={status === 'connected'}
                placeholder="npx, uvx, node..."
                className="w-full px-2 py-1.5 bg-[#2c2c2e] border border-[#3a3a3c] rounded text-[12px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff] disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#636366] uppercase mb-1">
                {t('inspector.arguments') || 'Arguments'}
              </label>
              <input
                type="text"
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                disabled={status === 'connected'}
                placeholder="-y @modelcontextprotocol/server-..."
                className="w-full px-2 py-1.5 bg-[#2c2c2e] border border-[#3a3a3c] rounded text-[12px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff] disabled:opacity-50"
              />
            </div>
            
            {/* 环境变量 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-[#636366] uppercase">
                  {t('inspector.envVars') || 'Environment'}
                </label>
                <button
                  onClick={addEnvVar}
                  disabled={status === 'connected'}
                  className="text-[11px] text-[#0a84ff] hover:text-[#5ac8fa] disabled:opacity-50"
                >
                  + Add
                </button>
              </div>
              {envVars.map((env, index) => (
                <div key={index} className="flex gap-1 mb-1">
                  <input
                    type="text"
                    value={env.key}
                    onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                    disabled={status === 'connected'}
                    placeholder="KEY"
                    className="flex-1 px-2 py-1 bg-[#2c2c2e] border border-[#3a3a3c] rounded text-[11px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff] disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={env.value}
                    onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                    disabled={status === 'connected'}
                    placeholder="value"
                    className="flex-1 px-2 py-1 bg-[#2c2c2e] border border-[#3a3a3c] rounded text-[11px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff] disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvVar(index)}
                    disabled={status === 'connected'}
                    className="w-6 h-6 flex items-center justify-center text-[#ff3b30] hover:text-[#ff6961] hover:bg-[#ff3b30]/10 rounded disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs: Tools / Resources / Prompts */}
          <div className="flex border-b border-[#3a3a3c]">
            <button
              onClick={() => setActiveTab('tools')}
              className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                activeTab === 'tools'
                  ? 'text-[#0a84ff] border-b-2 border-[#0a84ff]'
                  : 'text-[#636366] hover:text-white'
              }`}
            >
              {t('inspector.tools') || 'Tools'} ({tools.length})
            </button>
            <button
              onClick={() => setActiveTab('resources')}
              className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                activeTab === 'resources'
                  ? 'text-[#0a84ff] border-b-2 border-[#0a84ff]'
                  : 'text-[#636366] hover:text-white'
              }`}
            >
              {t('inspector.resources') || 'Resources'} ({resources.length})
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`flex-1 px-2 py-2 text-[11px] font-medium transition-colors ${
                activeTab === 'prompts'
                  ? 'text-[#0a84ff] border-b-2 border-[#0a84ff]'
                  : 'text-[#636366] hover:text-white'
              }`}
            >
              {t('inspector.prompts') || 'Prompts'} ({prompts.length})
            </button>
          </div>

          {/* 列表内容 */}
          <div className="flex-1 overflow-y-auto">
            {/* Tools Tab */}
            {activeTab === 'tools' && (
              tools.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-[#636366]">
                  {status === 'connected' 
                    ? (t('inspector.noTools') || 'No tools available')
                    : (t('inspector.connectFirst') || 'Connect to see tools')
                  }
                </div>
              ) : (
                <div className="space-y-0.5 px-1 py-1">
                  {tools.map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => handleSelectTool(tool)}
                      className={`w-full text-left px-2 py-2 rounded transition-colors ${
                        selectedTool?.name === tool.name
                          ? 'bg-[#0a84ff]/20 text-[#0a84ff]'
                          : 'text-white hover:bg-[#3a3a3c]/50'
                      }`}
                    >
                      <div className="text-[12px] font-medium truncate">{tool.name}</div>
                      {tool.description && (
                        <div className="text-[11px] text-[#636366] truncate mt-0.5">
                          {tool.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )
            )}

            {/* Resources Tab */}
            {activeTab === 'resources' && (
              resources.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-[#636366]">
                  {status === 'connected' 
                    ? (t('inspector.noResources') || 'No resources available')
                    : (t('inspector.connectFirst') || 'Connect to see resources')
                  }
                </div>
              ) : (
                <div className="space-y-0.5 px-1 py-1">
                  {resources.map((resource) => (
                    <div
                      key={resource.uri}
                      className="px-2 py-2 rounded text-white hover:bg-[#3a3a3c]/50"
                    >
                      <div className="text-[12px] font-medium truncate">{resource.name}</div>
                      <div className="text-[11px] text-[#636366] truncate mt-0.5">
                        {resource.uri}
                      </div>
                      {resource.description && (
                        <div className="text-[11px] text-[#636366] truncate mt-0.5">
                          {resource.description}
                        </div>
                      )}
                      {resource.mimeType && (
                        <div className="text-[10px] text-[#98989d] mt-1 px-1.5 py-0.5 bg-[#2c2c2e] rounded inline-block">
                          {resource.mimeType}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Prompts Tab */}
            {activeTab === 'prompts' && (
              prompts.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-[#636366]">
                  {status === 'connected' 
                    ? (t('inspector.noPrompts') || 'No prompts available')
                    : (t('inspector.connectFirst') || 'Connect to see prompts')
                  }
                </div>
              ) : (
                <div className="space-y-0.5 px-1 py-1">
                  {prompts.map((prompt) => (
                    <div
                      key={prompt.name}
                      className="px-2 py-2 rounded text-white hover:bg-[#3a3a3c]/50"
                    >
                      <div className="text-[12px] font-medium truncate">{prompt.name}</div>
                      {prompt.description && (
                        <div className="text-[11px] text-[#636366] truncate mt-0.5">
                          {prompt.description}
                        </div>
                      )}
                      {prompt.arguments && prompt.arguments.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {prompt.arguments.map((arg) => (
                            <span
                              key={arg.name}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                arg.required 
                                  ? 'bg-[#ff3b30]/20 text-[#ff6961]' 
                                  : 'bg-[#2c2c2e] text-[#98989d]'
                              }`}
                            >
                              {arg.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* 右侧：工具详情 + 结果 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTool ? (
            <>
              {/* 工具详情头部（固定） */}
              <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[#3a3a3c]">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 mr-3">
                    <h2 className="text-[15px] font-semibold text-white truncate">{selectedTool.name}</h2>
                    {selectedTool.description && (
                      <p className="text-[12px] text-[#98989d] mt-1 line-clamp-2">{selectedTool.description}</p>
                    )}
                  </div>
                  <button
                    onClick={handleRunTool}
                    disabled={isRunning || status !== 'connected'}
                    className="flex-shrink-0 px-4 py-1.5 bg-[#34c759] text-white rounded-lg text-[13px] font-medium hover:bg-[#34c759]/80 disabled:opacity-50 transition-colors"
                  >
                    {isRunning ? (t('inspector.running') || 'Running...') : (t('inspector.run') || 'Run')}
                  </button>
                </div>
              </div>

              {/* 参数表单区域（可滚动，限制最大高度） */}
              <div className="flex-shrink-0 max-h-[40%] overflow-y-auto border-b border-[#3a3a3c]">
                <div className="p-4">
                  {renderToolForm()}
                </div>
              </div>

              {/* 结果区域（填充剩余空间，可滚动） */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <h3 className="text-[12px] text-[#636366] uppercase mb-2">
                  {t('inspector.result') || 'Result'}
                </h3>
                {resultError ? (
                  <div className="p-3 bg-[#ff3b30]/10 border border-[#ff3b30]/30 rounded-lg">
                    <p className="text-[13px] text-[#ff3b30]">{resultError}</p>
                  </div>
                ) : result !== null ? (
                  <div className="rounded-lg overflow-hidden">
                    <SyntaxHighlighter
                      language="json"
                      style={atomOneDark}
                      customStyle={{
                        margin: 0,
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        backgroundColor: '#2c2c2e',
                      }}
                    >
                      {JSON.stringify(result, null, 2)}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <div className="text-[13px] text-[#636366]">
                    {t('inspector.noResult') || 'Run the tool to see results'}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto text-[#636366] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
                <p className="text-[13px] text-[#636366]">
                  {status === 'connected'
                    ? (t('inspector.selectTool') || 'Select a tool from the list')
                    : (t('inspector.connectToStart') || 'Connect to an MCP server to start')
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部日志区域 */}
      <div className="h-32 border-t border-[#3a3a3c] overflow-hidden flex flex-col">
        <div className="px-3 py-1.5 text-[11px] text-[#636366] uppercase border-b border-[#3a3a3c] flex-shrink-0">
          {t('inspector.logs') || 'Logs'}
        </div>
        <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] text-[#98989d] bg-[#0c0c0c]">
          {logs.length === 0 ? (
            <span className="text-[#636366]">{t('inspector.noLogs') || 'No logs yet'}</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="leading-relaxed">{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
