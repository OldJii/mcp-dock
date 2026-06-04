/**
 * 应用布局组件 - Surge 风格
 * 支持左侧菜单宽度可拖拽调整
 */

import { ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useElectronAPI } from '../lib/electron';

interface LayoutProps {
  children: ReactNode;
}

// 侧边栏宽度限制
const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 280;
const DEFAULT_SIDEBAR_WIDTH = MIN_SIDEBAR_WIDTH;

// 图标组件
const Icons = {
  Store: ({ active }: { active?: boolean }) => (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
    </svg>
  ),
  Installed: ({ active }: { active?: boolean }) => (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  Inspector: ({ active }: { active?: boolean }) => (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
  History: ({ active }: { active?: boolean }) => (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Settings: ({ active }: { active?: boolean }) => (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const api = useElectronAPI();
  const [version, setVersion] = useState('');
  
  // 侧边栏宽度状态
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? Math.min(Math.max(parseInt(saved, 10), MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH) : DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.system.getVersion().then(setVersion);
  }, []);

  // 保存侧边栏宽度
  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  // 处理拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.min(Math.max(e.clientX, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // 分组导航
  const navGroups = [
    {
      label: t('nav.discover') || 'DISCOVER',
      items: [
        { path: '/store', icon: Icons.Store, label: t('nav.store') },
      ],
    },
    {
      label: t('nav.manage') || 'MANAGE',
      items: [
        { path: '/library', icon: Icons.Installed, label: t('nav.library') || 'Library' },
        { path: '/inspector', icon: Icons.Inspector, label: t('nav.inspector') || 'Inspector' },
      ],
    },
    {
      label: t('nav.system') || 'SYSTEM',
      items: [
        { path: '/history', icon: Icons.History, label: t('nav.history') },
        { path: '/settings', icon: Icons.Settings, label: t('nav.settings') },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-[#1c1c1e] text-white overflow-hidden">
      {/* 侧边栏 */}
      <aside 
        ref={sidebarRef}
        style={{ width: sidebarWidth }}
        className="flex-shrink-0 bg-[#2c2c2e] flex flex-col border-r border-[#3a3a3c] relative"
      >
        {/* 顶部拖拽区域 - 支持窗口拖动 */}
        <div className="h-[52px] drag-region flex-shrink-0" />

        {/* 导航菜单 */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {navGroups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex > 0 ? 'mt-4' : ''}>
              <div className="px-4 py-1 text-[10px] font-semibold text-[#636366] uppercase tracking-wider truncate">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path || 
                  (item.path === '/store' && (location.pathname.startsWith('/detail') || location.pathname.startsWith('/skill'))) ||
                  (item.path === '/library' && location.pathname === '/installed');
                
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center gap-3 mx-2 px-3 py-[7px] rounded-md text-[13px]
                      transition-colors duration-100
                      ${isActive 
                        ? 'bg-[#3a3a3c] text-white font-medium' 
                        : 'text-[#98989d] hover:text-white hover:bg-[#3a3a3c]/50'
                      }
                    `}
                  >
                    <Icon active={isActive} />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* 底部状态 */}
        <div className="p-3 border-t border-[#3a3a3c]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#98989d]">{version ? `v${version}` : ''}</span>
            <div className="flex items-center gap-1.5">
              <span className="status-dot active" />
              <span className="text-[#98989d]">Ready</span>
            </div>
          </div>
        </div>

        {/* 拖拽调整宽度的手柄 */}
        <div
          onMouseDown={handleMouseDown}
          className={`
            absolute top-0 right-0 w-1 h-full cursor-col-resize
            hover:bg-[#0a84ff]/50 transition-colors
            ${isResizing ? 'bg-[#0a84ff]' : ''}
          `}
        />
      </aside>

      {/* 主内容区域 - 移除顶部白条 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部拖拽区域 - 只保留拖拽功能，无视觉元素 */}
        <div className="h-[52px] drag-region flex-shrink-0" />
        
        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
