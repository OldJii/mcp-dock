/**
 * 运行时图标组件
 * 使用本地 icon 目录中的图标
 */

// 导入本地图标
import nodeIcon from '../../assets/icons/Node.js.png';
import pythonIcon from '../../assets/icons/Python.png';

// 运行时类型
export type RuntimeType = 'node' | 'python';

// 运行时图标映射
const RuntimeIconMap: Record<RuntimeType, string> = {
  node: nodeIcon,
  python: pythonIcon,
};

interface RuntimeIconProps {
  runtime: RuntimeType;
  size?: number;
  className?: string;
}

/**
 * 运行时图标组件
 */
export default function RuntimeIcon({ 
  runtime, 
  size = 20, 
  className = '',
}: RuntimeIconProps) {
  const iconSrc = RuntimeIconMap[runtime];
  
  return (
    <img
      src={iconSrc}
      alt={runtime}
      width={size}
      height={size}
      className={`inline-block object-contain ${className}`}
    />
  );
}
