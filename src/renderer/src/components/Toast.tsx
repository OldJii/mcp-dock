/**
 * Toast 组件
 * 全局提示系统
 */

import { useEffect, useState, useCallback } from 'react';
import { create } from 'zustand';

// Toast 类型
export type ToastType = 'success' | 'error' | 'info' | 'warning';

// Toast 项
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Toast Store
interface ToastStore {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));
    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// 便捷方法
export const toast = {
  success: (message: string, duration?: number) => useToast.getState().addToast(message, 'success', duration),
  error: (message: string, duration?: number) => useToast.getState().addToast(message, 'error', duration),
  info: (message: string, duration?: number) => useToast.getState().addToast(message, 'info', duration),
  warning: (message: string, duration?: number) => useToast.getState().addToast(message, 'warning', duration),
};

// Toast 图标
function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case 'success':
      return (
        <svg className="w-4 h-4 text-[#34c759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-4 h-4 text-[#ff3b30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-4 h-4 text-[#ff9f0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-[#0a84ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      );
  }
}

// 单个 Toast 组件
function ToastItem({ toast: t, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // 入场动画
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = useCallback(() => {
    setIsLeaving(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  const bgColor = {
    success: 'bg-[#34c759]/10 border-[#34c759]/30',
    error: 'bg-[#ff3b30]/10 border-[#ff3b30]/30',
    warning: 'bg-[#ff9f0a]/10 border-[#ff9f0a]/30',
    info: 'bg-[#0a84ff]/10 border-[#0a84ff]/30',
  }[t.type];

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm
        ${bgColor}
        transform transition-all duration-200 ease-out
        ${isVisible && !isLeaving ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
      `}
    >
      <ToastIcon type={t.type} />
      <span className="text-[13px] text-white flex-1">{t.message}</span>
      <button
        onClick={handleClose}
        className="p-0.5 rounded text-[#636366] hover:text-white transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Toast 容器组件
export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
