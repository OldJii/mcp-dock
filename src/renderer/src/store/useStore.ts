/**
 * Zustand Store
 * 全局状态管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ServerListItem, SkillListItem, ResourceType } from '../api/registry';

// Inspector 配置状态
interface InspectorState {
  command: string;
  args: string;
  envVars: { key: string; value: string }[];
}

interface StoreState {
  // 资源类型 (MCP Servers / Skills)
  resourceType: ResourceType;
  setResourceType: (type: ResourceType) => void;
  
  // 搜索
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // 分页
  currentPage: number;
  pageSize: number;
  setCurrentPage: (page: number) => void;
  
  // 服务器列表缓存
  serverList: ServerListItem[];
  setServerList: (list: ServerListItem[]) => void;
  
  // Skills 列表缓存
  skillsList: SkillListItem[];
  setSkillsList: (list: SkillListItem[]) => void;
  
  // 已安装服务器 ID 列表 (用于快速查询)
  installedServerIds: Set<string>;
  setInstalledServerIds: (ids: string[]) => void;
  addInstalledServerId: (id: string) => void;
  removeInstalledServerId: (id: string) => void;
  
  // 已安装 Skills ID 列表
  installedSkillIds: Set<string>;
  setInstalledSkillIds: (ids: string[]) => void;
  addInstalledSkillId: (id: string) => void;
  removeInstalledSkillId: (id: string) => void;
  
  // Inspector 状态
  inspectorState: InspectorState;
  setInspectorState: (state: Partial<InspectorState>) => void;
  
  // 重置分页
  resetPagination: () => void;
  
  // 获取服务器列表
  getCurrentServerList: () => ServerListItem[];
}

const VALID_RESOURCE_TYPES = ['mcp', 'skills'] as const;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // 资源类型 - 默认 MCP
      resourceType: 'mcp',
      setResourceType: (type) => set({ 
        resourceType: type, 
        currentPage: 1, 
        searchQuery: '' 
      }),
      
      // 搜索
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
      
      // 分页
      currentPage: 1,
      pageSize: 20,
      setCurrentPage: (page) => set({ currentPage: page }),
      
      // 服务器列表
      serverList: [],
      setServerList: (list) => set({ serverList: list }),
      
      // Skills 列表
      skillsList: [],
      setSkillsList: (list) => set({ skillsList: list }),
      
      // 已安装服务器
      installedServerIds: new Set(),
      setInstalledServerIds: (ids) => set({ installedServerIds: new Set(ids) }),
      addInstalledServerId: (id) => set((state) => {
        const newSet = new Set(state.installedServerIds);
        newSet.add(id);
        return { installedServerIds: newSet };
      }),
      removeInstalledServerId: (id) => set((state) => {
        const newSet = new Set(state.installedServerIds);
        newSet.delete(id);
        return { installedServerIds: newSet };
      }),
      
      // 已安装 Skills
      installedSkillIds: new Set(),
      setInstalledSkillIds: (ids) => set({ installedSkillIds: new Set(ids) }),
      addInstalledSkillId: (id) => set((state) => {
        const newSet = new Set(state.installedSkillIds);
        newSet.add(id);
        return { installedSkillIds: newSet };
      }),
      removeInstalledSkillId: (id) => set((state) => {
        const newSet = new Set(state.installedSkillIds);
        newSet.delete(id);
        return { installedSkillIds: newSet };
      }),
      
      // Inspector 状态
      inspectorState: {
        command: 'npx',
        args: '',
        envVars: [],
      },
      setInspectorState: (newState) => set((state) => ({
        inspectorState: {
          ...state.inspectorState,
          ...newState,
        },
      })),
      
      // 重置分页
      resetPagination: () => set({ currentPage: 1, searchQuery: '' }),
      
      // 获取服务器列表
      getCurrentServerList: () => get().serverList,
    }),
    {
      name: 'mcp-dock-store',
      partialize: (state) => ({
        // 只持久化资源类型和页面大小；早期版本保存的数据源选择不再读取
        resourceType: state.resourceType,
        pageSize: state.pageSize,
      }),
      // 合并恢复的状态时验证值的有效性
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<StoreState> | undefined;
        return {
          ...currentState,
          // 验证 resourceType，无效则使用默认值  
          resourceType: persisted?.resourceType && VALID_RESOURCE_TYPES.includes(persisted.resourceType as any)
            ? persisted.resourceType
            : 'mcp',
          // 验证 pageSize
          pageSize: persisted?.pageSize && typeof persisted.pageSize === 'number' && persisted.pageSize > 0
            ? persisted.pageSize
            : 20,
        };
      },
    }
  )
);
