/**
 * 历史记录页面 - Surge 风格
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useElectronAPI, type DiffResult, type ClientType } from '../lib/electron';
import Modal from '../components/Modal';
import ClientIcon from '../components/ClientIcon';
import { toast } from '../components/Toast';

interface BackupInfo {
  timestamp: string;
  filename: string;
  size: number;
  serverCount: number;
  skillCount: number;
  clients: ClientType[];
}

export default function History() {
  const { t } = useTranslation();
  const api = useElectronAPI();
  
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDiff, setSelectedDiff] = useState<DiffResult | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async (showToast = false) => {
    setIsLoading(true);
    try {
      const list = await api.history.list();
      setBackups(list);
      if (showToast) {
        toast.success(t('history.refreshed') || 'History refreshed');
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
      if (showToast) {
        toast.error(t('history.refreshFailed') || 'Failed to refresh');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDiff = async (timestamp: string) => {
    try {
      const diff = await api.history.getDiff(timestamp);
      setSelectedDiff(diff);
    } catch (error) {
      console.error('Failed to get diff:', error);
    }
  };

  const handleRestore = async (timestamp: string) => {
    if (!confirm(t('history.confirmRestore'))) return;

    setIsRestoring(true);
    try {
      const success = await api.history.restore(timestamp);
      if (success) {
        alert(t('history.restoreSuccess'));
        loadBackups();
      } else {
        alert(t('history.restoreFailed'));
      }
    } catch (error) {
      console.error('Failed to restore:', error);
      alert(t('history.restoreFailed'));
    } finally {
      setIsRestoring(false);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (minutes < 1) return t('history.justNow') || 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return formatTime(timestamp);
    } catch {
      return timestamp;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleClearAll = async () => {
    if (!confirm(t('history.confirmClearAll') || 'Are you sure you want to clear all history?')) return;

    setIsClearing(true);
    try {
      const success = await api.history.clearAll();
      if (success) {
        setBackups([]);
      } else {
        alert(t('history.clearFailed') || 'Failed to clear history');
      }
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert(t('history.clearFailed') || 'Failed to clear history');
    } finally {
      setIsClearing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1c1c1e]">
        <div className="w-8 h-8 border-2 border-[#3a3a3c] border-t-[#0a84ff] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1c1c1e]">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a3a3c]">
        <div className="flex items-center gap-4">
          <h1 className="text-[15px] font-semibold text-white">
            {t('history.title')}
          </h1>
          <span className="text-[12px] text-[#98989d]">
            {backups.length} {t('history.backups') || 'backups'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {backups.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={isClearing}
              className="px-2.5 py-1 rounded text-[12px] text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors disabled:opacity-50"
            >
              {isClearing ? t('history.clearing') || 'Clearing...' : t('history.clearAll') || 'Clear All'}
            </button>
          )}
          <button
            onClick={() => loadBackups(true)}
            className="p-1.5 rounded text-[#98989d] hover:text-white hover:bg-[#3a3a3c] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto">
        {backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full bg-[#3a3a3c] flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[#636366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[13px] text-white mb-1">{t('history.empty')}</p>
            <p className="text-[12px] text-[#636366]">{t('history.emptyHint')}</p>
          </div>
        ) : (
          <div className="p-4">
            <div className="card overflow-hidden">
              {backups.map((backup, index) => (
                <div
                  key={backup.timestamp}
                  className={`
                    flex items-center gap-3 px-4 py-3
                    ${index !== backups.length - 1 ? 'border-b border-[#3a3a3c]' : ''}
                  `}
                >
                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-white">
                        {formatTime(backup.timestamp)}
                      </span>
                      <span className="text-[11px] text-[#636366]">
                        {formatRelativeTime(backup.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-[#98989d]">
                        {backup.serverCount} {t('history.servers')}
                      </span>
                      {(backup.skillCount || 0) > 0 && (
                        <>
                          <span className="text-[11px] text-[#636366]">•</span>
                          <span className="text-[11px] text-[#98989d]">
                            {backup.skillCount} {t('history.skills') || 'Skills'}
                          </span>
                        </>
                      )}
                      <span className="text-[11px] text-[#636366]">•</span>
                      <span className="text-[11px] text-[#636366]">
                        {formatSize(backup.size)}
                      </span>
                      {backup.clients && backup.clients.length > 0 && (
                        <>
                          <span className="text-[11px] text-[#636366]">•</span>
                          <span className="text-[11px] text-[#636366] flex items-center gap-1">
                            {backup.clients.map(c => (
                              <ClientIcon key={c} clientId={c} size={12} />
                            ))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleViewDiff(backup.timestamp)}
                      className="px-2.5 py-1 rounded text-[12px] text-[#98989d] hover:text-white hover:bg-[#3a3a3c] transition-colors"
                    >
                      {t('history.view')}
                    </button>
                    <button
                      onClick={() => handleRestore(backup.timestamp)}
                      disabled={isRestoring}
                      className="px-2.5 py-1 rounded text-[12px] text-[#0a84ff] hover:bg-[#0a84ff]/10 transition-colors disabled:opacity-50"
                    >
                      {t('history.restore')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 差异查看模态框 */}
      <Modal
        isOpen={!!selectedDiff}
        onClose={() => setSelectedDiff(null)}
        title={t('history.view')}
        size="lg"
      >
        {selectedDiff && (
          <div className="space-y-4">
            {/* MCP Servers 变更统计 */}
            <div>
              <p className="text-[11px] text-[#636366] mb-2">MCP Servers</p>
              <div className="flex gap-2 flex-wrap">
                {selectedDiff.added.length > 0 && (
                  <span className="tag tag-success">
                    +{selectedDiff.added.length} {t('history.added')}
                  </span>
                )}
                {selectedDiff.removed.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-[11px] bg-[#ff3b30]/15 text-[#ff3b30]">
                    -{selectedDiff.removed.length} {t('history.removed')}
                  </span>
                )}
                {selectedDiff.modified.length > 0 && (
                  <span className="tag tag-warning">
                    ~{selectedDiff.modified.length} {t('history.modified')}
                  </span>
                )}
                {selectedDiff.added.length === 0 && 
                 selectedDiff.removed.length === 0 && 
                 selectedDiff.modified.length === 0 && (
                  <span className="text-[12px] text-[#636366]">
                    {t('history.noChanges')}
                  </span>
                )}
              </div>
            </div>

            {/* Skills 变更统计 */}
            {((selectedDiff.skillsAdded?.length || 0) > 0 || (selectedDiff.skillsRemoved?.length || 0) > 0) && (
              <div>
                <p className="text-[11px] text-[#636366] mb-2">Skills</p>
                <div className="flex gap-2 flex-wrap">
                  {(selectedDiff.skillsAdded?.length || 0) > 0 && (
                    <span className="tag tag-success">
                      +{selectedDiff.skillsAdded.length} {t('history.added')}
                    </span>
                  )}
                  {(selectedDiff.skillsRemoved?.length || 0) > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-[#ff3b30]/15 text-[#ff3b30]">
                      -{selectedDiff.skillsRemoved.length} {t('history.removed')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* MCP Servers 变更详情 */}
            {(selectedDiff.added.length > 0 || selectedDiff.removed.length > 0 || selectedDiff.modified.length > 0) && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {selectedDiff.added.map((id) => (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#34c759]/10 border border-[#34c759]/20">
                    <span className="text-[#34c759] text-[12px]">+</span>
                    <span className="text-white font-mono text-[12px]">{id}</span>
                    <span className="text-[10px] text-[#636366]">Server</span>
                  </div>
                ))}
                {selectedDiff.removed.map((id) => (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#ff3b30]/10 border border-[#ff3b30]/20">
                    <span className="text-[#ff3b30] text-[12px]">-</span>
                    <span className="text-white font-mono text-[12px]">{id}</span>
                    <span className="text-[10px] text-[#636366]">Server</span>
                  </div>
                ))}
                {selectedDiff.modified.map((id) => (
                  <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#ff9f0a]/10 border border-[#ff9f0a]/20">
                    <span className="text-[#ff9f0a] text-[12px]">~</span>
                    <span className="text-white font-mono text-[12px]">{id}</span>
                    <span className="text-[10px] text-[#636366]">Server</span>
                  </div>
                ))}
              </div>
            )}

            {/* Skills 变更详情 */}
            {((selectedDiff.skillsAdded?.length || 0) > 0 || (selectedDiff.skillsRemoved?.length || 0) > 0) && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {selectedDiff.skillsAdded?.map((name) => (
                  <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#34c759]/10 border border-[#34c759]/20">
                    <span className="text-[#34c759] text-[12px]">+</span>
                    <span className="text-white font-mono text-[12px]">{name}</span>
                    <span className="text-[10px] text-[#636366]">Skill</span>
                  </div>
                ))}
                {selectedDiff.skillsRemoved?.map((name) => (
                  <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#ff3b30]/10 border border-[#ff3b30]/20">
                    <span className="text-[#ff3b30] text-[12px]">-</span>
                    <span className="text-white font-mono text-[12px]">{name}</span>
                    <span className="text-[10px] text-[#636366]">Skill</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
