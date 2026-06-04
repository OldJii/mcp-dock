/**
 * Electron Preload 脚本
 * 安全地暴露主进程 API 给渲染进程
 */
import { contextBridge, ipcRenderer } from 'electron';
// API 定义
const api = {
    // 配置管理
    config: {
        read: () => ipcRenderer.invoke('config:read'),
        write: (config) => ipcRenderer.invoke('config:write', config),
        getServers: () => ipcRenderer.invoke('config:get-servers'),
        installServer: (serverId, serverConfig) => ipcRenderer.invoke('config:install-server', serverId, serverConfig),
        uninstallServer: (serverId) => ipcRenderer.invoke('config:uninstall-server', serverId),
        updateServer: (serverId, serverConfig) => ipcRenderer.invoke('config:update-server', serverId, serverConfig),
    },
    // 环境检测
    env: {
        checkRuntime: (runtime) => ipcRenderer.invoke('env:check-runtime', runtime),
        getAllRuntimes: () => ipcRenderer.invoke('env:get-all-runtimes'),
        getNpxPath: () => ipcRenderer.invoke('env:get-npx-path'),
        getUvxPath: () => ipcRenderer.invoke('env:get-uvx-path'),
    },
    // 历史记录
    history: {
        list: () => ipcRenderer.invoke('history:list'),
        restore: (timestamp) => ipcRenderer.invoke('history:restore', timestamp),
        getDiff: (timestamp) => ipcRenderer.invoke('history:get-diff', timestamp),
    },
    // 系统
    system: {
        getPlatform: () => ipcRenderer.invoke('system:get-platform'),
        openExternal: (url) => ipcRenderer.invoke('system:open-external', url),
        getConfigPath: () => ipcRenderer.invoke('system:get-config-path'),
    },
};
// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', api);
