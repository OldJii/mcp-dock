/**
 * 导入 Skill 模态框
 * 支持从 GitHub URL 解析、预览、选择客户端并安装 Skills
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import ClientIcon from './ClientIcon';
import { useElectronAPI, type ClientInfo, type SkillClientType, type DiscoveredSkill } from '../lib/electron';
import { toast } from './Toast';

interface ImportSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clients: ClientInfo[];
}

type Step = 'input' | 'select' | 'install';

export default function ImportSkillModal({
  isOpen,
  onClose,
  onSuccess,
  clients,
}: ImportSkillModalProps) {
  const { t } = useTranslation();
  const api = useElectronAPI();

  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [discoveredSkills, setDiscoveredSkills] = useState<DiscoveredSkill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Set<number>>(new Set());
  const [selectedClients, setSelectedClients] = useState<SkillClientType[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState({ current: 0, total: 0 });

  const skillClients = clients.filter(c => c.installed && c.supportsSkills);

  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setUrl('');
      setIsParsing(false);
      setParseError('');
      setDiscoveredSkills([]);
      setSelectedSkills(new Set());
      setSelectedClients(skillClients.map(c => c.id as SkillClientType));
      setIsInstalling(false);
      setInstallProgress({ current: 0, total: 0 });
    }
  }, [isOpen]);

  const handleParse = async () => {
    if (!url.trim()) return;
    setIsParsing(true);
    setParseError('');

    try {
      const result = await api.skills.parseImportUrl(url.trim());
      if (result.success && result.skills.length > 0) {
        setDiscoveredSkills(result.skills);
        if (result.skills.length === 1) {
          setSelectedSkills(new Set([0]));
          setStep('install');
        } else {
          setSelectedSkills(new Set(result.skills.map((_, i) => i)));
          setStep('select');
        }
      } else {
        setParseError(result.error || t('importSkill.noSkillFound'));
      }
    } catch (error) {
      setParseError((error as Error).message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isParsing && url.trim()) {
      handleParse();
    }
  };

  const toggleSkill = (index: number) => {
    setSelectedSkills(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleClient = (clientId: SkillClientType) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(c => c !== clientId)
        : [...prev, clientId]
    );
  };

  const handleInstall = async () => {
    if (selectedClients.length === 0) return;

    const skillsToInstall = discoveredSkills.filter((_, i) => selectedSkills.has(i));
    if (skillsToInstall.length === 0) return;

    setIsInstalling(true);
    setInstallProgress({ current: 0, total: skillsToInstall.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < skillsToInstall.length; i++) {
      setInstallProgress({ current: i + 1, total: skillsToInstall.length });
      try {
        const result = await api.skills.installFromDiscovered(skillsToInstall[i], selectedClients);
        if (result.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setIsInstalling(false);

    if (successCount > 0) {
      toast.success(
        t('importSkill.installSuccess', { count: successCount }) ||
        `Successfully imported ${successCount} skill(s)`
      );
      onSuccess();
      onClose();
    }
    if (failCount > 0) {
      toast.error(
        t('importSkill.installFailed', { count: failCount }) ||
        `Failed to import ${failCount} skill(s)`
      );
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'input': return t('importSkill.title') || 'Import Skill';
      case 'select': return t('importSkill.selectSkills') || 'Select Skills';
      case 'install': return t('importSkill.installTitle') || 'Install Skill';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getStepTitle()} size="lg">
      <div className="space-y-4">
        {/* Step 1: URL 输入 */}
        {step === 'input' && (
          <>
            <p className="text-[12px] text-[#98989d]">
              {t('importSkill.hint') || 'Paste a GitHub repository URL containing SKILL.md files'}
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://github.com/owner/repo or owner/repo"
                className="flex-1 px-3 py-2 bg-[#1c1c1e] border border-[#3a3a3c] rounded-lg text-[13px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0a84ff]"
                autoFocus
                disabled={isParsing}
              />
              <button
                onClick={handleParse}
                disabled={isParsing || !url.trim()}
                className="px-4 py-2 bg-[#0a84ff] text-white rounded-lg text-[13px] font-medium hover:bg-[#0a84ff]/80 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                {isParsing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('importSkill.parsing') || 'Parsing...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    {t('importSkill.parse') || 'Scan'}
                  </>
                )}
              </button>
            </div>

            {parseError && (
              <div className="flex items-start gap-2 p-3 bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-lg">
                <svg className="w-4 h-4 text-[#ff3b30] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-[12px] text-[#ff3b30]">{parseError}</p>
              </div>
            )}

            <div className="border-t border-[#3a3a3c] pt-3">
              <p className="text-[11px] text-[#636366]">
                {t('importSkill.supportedFormats') || 'Supported formats:'}
              </p>
              <ul className="mt-1.5 space-y-1">
                {[
                  'https://github.com/owner/repo',
                  'https://github.com/owner/repo/tree/main/path/to/skill',
                  'owner/repo',
                ].map(example => (
                  <li key={example}>
                    <button
                      onClick={() => setUrl(example)}
                      className="text-[11px] text-[#636366] hover:text-[#0a84ff] font-mono transition-colors"
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Step 2: 多 Skills 选择 */}
        {step === 'select' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-[#98989d]">
                {t('importSkill.multipleFound', { count: discoveredSkills.length }) ||
                  `Found ${discoveredSkills.length} skills in this repository. Select the ones you want to import:`}
              </p>
              <button
                onClick={() => {
                  if (selectedSkills.size === discoveredSkills.length) {
                    setSelectedSkills(new Set());
                  } else {
                    setSelectedSkills(new Set(discoveredSkills.map((_, i) => i)));
                  }
                }}
                className="text-[12px] text-[#0a84ff] hover:text-[#0a84ff]/80 transition-colors whitespace-nowrap ml-3 flex-shrink-0"
              >
                {selectedSkills.size === discoveredSkills.length
                  ? (t('importSkill.deselectAll') || 'Deselect All')
                  : (t('importSkill.selectAll') || 'Select All')}
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {discoveredSkills.map((skill, index) => (
                <button
                  key={index}
                  onClick={() => toggleSkill(index)}
                  className={`
                    w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left
                    ${selectedSkills.has(index)
                      ? 'bg-[#0a84ff]/10 border-[#0a84ff]/30'
                      : 'bg-[#3a3a3c] border-[#3a3a3c] hover:border-[#636366]'
                    }
                  `}
                >
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                    ${selectedSkills.has(index) ? 'bg-[#0a84ff] border-[#0a84ff]' : 'border-[#636366]'}
                  `}>
                    {selectedSkills.has(index) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-medium text-white">{skill.name}</h4>
                    <p className="text-[11px] text-[#636366] mt-0.5 truncate">
                      {skill.path || '/'}
                    </p>
                    {skill.skillMdContent && (
                      <p className="text-[11px] text-[#98989d] mt-1 line-clamp-2">
                        {skill.skillMdContent.split('\n').find(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'))?.trim() || ''}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setStep('input')}
                className="btn btn-secondary"
              >
                {t('importSkill.back') || 'Back'}
              </button>
              <button
                onClick={() => setStep('install')}
                disabled={selectedSkills.size === 0}
                className="btn btn-primary disabled:opacity-50"
              >
                {t('importSkill.next') || 'Next'} ({selectedSkills.size})
              </button>
            </div>
          </>
        )}

        {/* Step 3: 选择客户端并安装 */}
        {step === 'install' && (
          <>
            {/* 已选 Skills 预览 */}
            <div className="space-y-2">
              <p className="text-[12px] text-[#98989d]">
                {discoveredSkills.length > 1
                  ? (t('importSkill.selectedSkills', { count: selectedSkills.size }) || `${selectedSkills.size} skill(s) selected:`)
                  : ''
                }
              </p>
              {discoveredSkills
                .filter((_, i) => selectedSkills.has(i))
                .map((skill, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-[#3a3a3c] rounded-lg">
                    <div className="w-8 h-8 rounded-lg bg-[#0a84ff]/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[#0a84ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-medium text-white truncate">{skill.name}</h4>
                      <p className="text-[11px] text-[#636366] truncate">
                        {skill.repository.url}
                      </p>
                    </div>
                  </div>
                ))}
            </div>

            {/* 客户端选择 */}
            <div>
              <label className="block text-[12px] text-[#98989d] mb-2">
                {t('skill.selectClients') || 'Select clients to install this skill to:'}
              </label>
              {skillClients.length === 0 ? (
                <p className="text-[12px] text-[#636366]">
                  {t('skill.noClientsSupport') || 'No installed clients support Skills'}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {skillClients.map(client => {
                    const clientId = client.id as SkillClientType;
                    const isSelected = selectedClients.includes(clientId);
                    return (
                      <button
                        key={client.id}
                        onClick={() => toggleClient(clientId)}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
                          ${isSelected
                            ? 'border-[#0a84ff] bg-[#0a84ff]/10'
                            : 'border-[#3a3a3c] hover:border-[#636366]'
                          }
                        `}
                      >
                        <ClientIcon clientId={client.id} size={20} />
                        <span className="text-[13px] text-white">{client.name}</span>
                        {isSelected && (
                          <svg className="w-4 h-4 text-[#0a84ff] ml-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 安装进度 */}
            {isInstalling && installProgress.total > 1 && (
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] text-[#98989d]">
                  <span>{t('importSkill.installing') || 'Installing...'}</span>
                  <span>{installProgress.current}/{installProgress.total}</span>
                </div>
                <div className="h-1.5 bg-[#3a3a3c] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0a84ff] rounded-full transition-all duration-300"
                    style={{ width: `${(installProgress.current / installProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-between pt-2">
              <button
                onClick={() => discoveredSkills.length > 1 ? setStep('select') : setStep('input')}
                className="btn btn-secondary"
                disabled={isInstalling}
              >
                {t('importSkill.back') || 'Back'}
              </button>
              <button
                onClick={handleInstall}
                disabled={isInstalling || selectedClients.length === 0}
                className="btn btn-primary disabled:opacity-50 flex items-center gap-2"
              >
                {isInstalling ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('importSkill.installing') || 'Installing...'}
                  </>
                ) : (
                  t('importSkill.install') || 'Import & Install'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
