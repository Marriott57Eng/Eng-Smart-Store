import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '',
  showLabel = false 
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center h-9 px-2.5 rounded-full border transition-all active:scale-95 cursor-pointer shadow-2xs ${
        isDark
          ? 'bg-slate-800/90 border-slate-700/80 text-amber-400 hover:bg-slate-700 hover:border-amber-400/60'
          : 'bg-white/90 border-slate-200/90 text-slate-700 hover:text-blue-600 hover:bg-blue-50/60 hover:border-blue-200'
      } ${className}`}
      title={isDark ? 'สลับเป็นโทนสว่าง (Light Mode)' : 'สลับเป็นโทนมืด (Dark Mode)'}
      aria-label="สลับธีม สว่าง/มืด"
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-slate-700" />
        )}
      </div>
      {showLabel && (
        <span className="ml-1.5 text-xs font-bold tracking-tight">
          {isDark ? 'โทนมืด' : 'โทนสว่าง'}
        </span>
      )}
    </button>
  );
};
