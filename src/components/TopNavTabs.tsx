import React from 'react';
import { Package, ClipboardList, Bot, BarChart3, Layers, ShieldCheck, ShoppingCart } from 'lucide-react';
import { AppTab } from './MobileNavbar';

interface TopNavTabsProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  requisitionCount?: number;
  lowStockCount?: number;
  pendingOrdersCount?: number;
  isAdmin?: boolean;
  isLiveActive?: boolean;
  className?: string;
}

export const TopNavTabs: React.FC<TopNavTabsProps> = React.memo(({
  activeTab,
  setActiveTab,
  requisitionCount = 0,
  lowStockCount = 0,
  pendingOrdersCount = 0,
  isAdmin = false,
  isLiveActive = false,
  className = '',
}) => {
  const tabs = [
    { id: 'inventory' as AppTab, label: 'คลังอะไหล่', icon: Package },
    { 
      id: 'history' as AppTab, 
      label: 'เบิก-รับ', 
      icon: ClipboardList, 
      badge: requisitionCount > 0 ? requisitionCount : undefined 
    },
    ...(isAdmin ? [{ id: 'categories' as AppTab, label: 'หมวดหมู่', icon: Layers }] : []),
    { 
      id: 'orders' as AppTab, 
      label: 'สั่งซื้อ', 
      icon: ShoppingCart, 
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
      isUrgentBadge: pendingOrdersCount > 0
    },
    { 
      id: 'dashboard' as AppTab, 
      label: 'ภาพรวม', 
      icon: BarChart3, 
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      isWarningBadge: lowStockCount > 0
    },
    { 
      id: 'voice' as AppTab, 
      label: isLiveActive ? 'คุยสด AI' : 'ถาม AI', 
      icon: Bot,
      isLive: isLiveActive 
    },
    ...(isAdmin ? [{ id: 'admin' as AppTab, label: 'ผู้ดูแล', icon: ShieldCheck }] : []),
  ];

  return (
    <nav 
      aria-label="เมนูหลัก"
      className={`items-center gap-1 p-1 rounded-full liquid-glass-pill ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id || (tab.id === 'admin' && activeTab === 'users');

        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer select-none relative shrink-0 whitespace-nowrap ${
              isActive
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/25 font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'stroke-[2.3]' : 'stroke-[1.9]'}`} />
            <span>{tab.label}</span>

            {tab.badge !== undefined && (
              <span 
                className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums leading-none ${
                  isActive 
                    ? 'bg-white/25 text-white' 
                    : tab.isUrgentBadge
                      ? 'bg-amber-500 text-white'
                      : (tab as any).isWarningBadge
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200'
                }`}
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}

            {tab.isLive && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>
        );
      })}
    </nav>
  );
});

TopNavTabs.displayName = 'TopNavTabs';
