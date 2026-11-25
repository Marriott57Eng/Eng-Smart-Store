import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Package, BarChart3, Bot, ClipboardList, Layers, ShieldCheck, ShoppingCart } from 'lucide-react';

export type AppTab = 'inventory' | 'history' | 'orders' | 'voice' | 'dashboard' | 'categories' | 'admin' | 'users';

interface MobileNavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  lowStockCount?: number;
  requisitionCount?: number;
  pendingOrdersCount?: number;
  isAdmin?: boolean;
  isLiveActive?: boolean;
}

interface NavItem {
  id: AppTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  isCenter?: boolean;
  isUrgent?: boolean;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = React.memo(({
  activeTab,
  setActiveTab,
  lowStockCount = 0,
  requisitionCount = 0,
  pendingOrdersCount = 0,
  isAdmin = false,
  isLiveActive = false,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tabs: NavItem[] = isAdmin
    ? [
        { id: 'inventory', label: 'คลัง', icon: Package },
        { id: 'history', label: 'เบิก-รับ', icon: ClipboardList, badge: requisitionCount },
        { id: 'categories', label: 'หมวดหมู่', icon: Layers },
        { id: 'voice', label: isLiveActive ? 'คุยสด' : 'ถาม AI', icon: Bot, isCenter: true },
        { id: 'orders', label: 'สั่งซื้อ', icon: ShoppingCart, badge: pendingOrdersCount, isUrgent: pendingOrdersCount > 0 },
        { id: 'dashboard', label: 'ภาพรวม', icon: BarChart3, badge: lowStockCount > 0 ? lowStockCount : undefined, isUrgent: false },
        { id: 'admin', label: 'ผู้ดูแล', icon: ShieldCheck },
      ]
    : [
        { id: 'inventory', label: 'คลังอะไหล่', icon: Package },
        { id: 'history', label: 'เบิก-รับ', icon: ClipboardList, badge: requisitionCount },
        { id: 'voice', label: isLiveActive ? 'คุยสด AI' : 'ถาม AI', icon: Bot, isCenter: true },
        { id: 'orders', label: 'สั่งซื้อ', icon: ShoppingCart, badge: pendingOrdersCount, isUrgent: pendingOrdersCount > 0 },
        { id: 'dashboard', label: 'ภาพรวม', icon: BarChart3, badge: lowStockCount > 0 ? lowStockCount : undefined, isUrgent: false },
      ];

  const navContent = (
    <nav 
      aria-label="เมนูหลักด้านล่าง"
      style={{
        position: 'fixed',
        bottom: 'max(8px, calc(env(safe-area-inset-bottom, 0px) * 0.4 + 6px))',
        left: '50%',
        transform: 'translateX(-50%)',
        WebkitTransform: 'translateX(-50%)',
        paddingBottom: 'max(4px, calc(env(safe-area-inset-bottom, 0px) * 0.3 + 2px))',
        paddingLeft: 'max(8px, env(safe-area-inset-left, 8px))',
        paddingRight: 'max(8px, env(safe-area-inset-right, 8px))',
        zIndex: 60,
      }}
      className="lg:hidden flex w-[calc(100%-16px)] sm:w-[calc(100%-28px)] max-w-lg sm:max-w-xl md:max-w-2xl liquid-glass rounded-[28px] px-2 sm:px-3 pt-1.5 items-center justify-around shadow-[0_10px_34px_rgba(15,23,42,0.18)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.85)] pointer-events-auto select-none"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id || (tab.id === 'admin' && activeTab === 'users');

        if (tab.isCenter) {
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
              className="relative -top-3.5 sm:-top-4 flex flex-col items-center justify-center transition-transform active:scale-95 px-1 cursor-pointer shrink-0 min-w-[54px]"
              aria-label={tab.label}
            >
              {isLiveActive && (
                <span className="absolute -top-1 right-0.5 flex h-3 w-3 z-20">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 ring-2 ring-white dark:ring-slate-900"></span>
                </span>
              )}
              <div
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 relative border-2 ${
                  isLiveActive
                    ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white border-red-300/60 shadow-red-500/40'
                    : isActive
                    ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white border-white/50 shadow-blue-500/40 scale-105'
                    : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-white/30 shadow-blue-600/30'
                }`}
              >
                <Icon className="w-5.5 h-5.5 relative z-10" />
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-bold mt-0.5 tracking-tight whitespace-nowrap ${
                  isLiveActive
                    ? 'text-red-600 dark:text-red-400'
                    : isActive
                    ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-2xl relative transition-all duration-150 cursor-pointer min-h-[46px] sm:min-h-[48px] active:scale-95 ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-500/12 dark:bg-blue-500/15'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            aria-label={tab.label}
          >
            <Icon className={`w-4.5 h-4.5 sm:w-5 sm:h-5 mb-0.5 ${isActive ? 'stroke-[2.3]' : 'stroke-[1.9]'}`} />
            <span className={`text-[10px] sm:text-[11px] tracking-tight whitespace-nowrap ${isActive ? 'font-bold text-blue-600 dark:text-blue-400' : 'font-medium'}`}>
              {tab.label}
            </span>

            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`absolute top-0.5 right-1 px-1 min-w-[16px] h-4 text-[9px] font-bold tabular-nums text-white rounded-full flex items-center justify-center ring-1 ring-white dark:ring-slate-900 ${
                  tab.isUrgent ? 'bg-amber-500' : 'bg-blue-600 dark:bg-blue-500'
                }`}
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(navContent, document.body);
});

MobileNavbar.displayName = 'MobileNavbar';
