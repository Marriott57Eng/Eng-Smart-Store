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
      className={`relative inline-flex items-center justify-center h-9 px-2.5 rounded-lg border transition-colors active:scale-95 cursor-pointer ${
        isDark
          ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700 hover:border-amber-400/60'
          : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-200/70 hover:border-slate-300'
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
