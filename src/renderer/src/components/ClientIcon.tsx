/**
 * MCP Client 图标组件
 * 使用本地 icon 目录中的图标
 */

import { type ClientType, type SkillClientType } from '../lib/electron';

import cursorIcon from '../../assets/icons/cursor.png';
import claudeCodeIcon from '../../assets/icons/claude-code.png';
import geminiIcon from '../../assets/icons/gemini.png';
import codexIcon from '../../assets/icons/codex.png';
import windsurfIcon from '../../assets/icons/windsurf.png';
import zedIcon from '../../assets/icons/zed.webp';
import traeIcon from '../../assets/icons/trae.png';
import vscodeIcon from '../../assets/icons/vscode.png';
import opencodeIcon from '../../assets/icons/opencode.png';
import antigravityIcon from '../../assets/icons/antigravity.png';
import kiroIcon from '../../assets/icons/kiro.png';
import openclawIcon from '../../assets/icons/openclaw.png';

const ClientIconMap: Partial<Record<ClientType | SkillClientType, string>> = {
  cursor: cursorIcon,
  'claude-code': claudeCodeIcon,
  'gemini-cli': geminiIcon,
  'codex-cli': codexIcon,
  windsurf: windsurfIcon,
  zed: zedIcon,
  trae: traeIcon,
  'trae-cn': traeIcon,
  vscode: vscodeIcon,
  opencode: opencodeIcon,
  antigravity: antigravityIcon,
  kiro: kiroIcon,
  openclaw: openclawIcon,
};

interface ClientIconProps {
  clientId: ClientType | SkillClientType | string;
  size?: number;
  className?: string;
}

/**
 * 客户端图标组件
 */
export default function ClientIcon({ 
  clientId, 
  size = 20, 
  className = '',
}: ClientIconProps) {
  const iconSrc = ClientIconMap[clientId as ClientType];
  
  // 如果有图标文件，使用图片
  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={clientId}
        width={size}
        height={size}
        className={`inline-block object-contain ${className}`}
      />
    );
  }
  
  // JetBrains: 钻石形 IDE 图标
  if (clientId === 'jetbrains') {
    return (
      <div
        className={`inline-flex items-center justify-center rounded bg-[#000000] ${className}`}
        style={{ width: size, height: size }}
      >
        <svg className="w-3/5 h-3/5" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" fill="white"/>
          <text x="5" y="17" fontSize="11" fontFamily="sans-serif" fontWeight="bold" fill="black">JB</text>
        </svg>
      </div>
    );
  }

  // Agent Skills (.agents): 统一标准图标
  if (clientId === 'agent-skills') {
    return (
      <div
        className={`inline-flex items-center justify-center rounded bg-[#8b5cf6] ${className}`}
        style={{ width: size, height: size }}
      >
        <svg className="w-1/2 h-1/2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
      </div>
    );
  }

  // 默认图标
  return (
    <div
      className={`inline-flex items-center justify-center rounded bg-[#636366] ${className}`}
      style={{ width: size, height: size }}
    >
      <svg className="w-1/2 h-1/2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    </div>
  );
}
