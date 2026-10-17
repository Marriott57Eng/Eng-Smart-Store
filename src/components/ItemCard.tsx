import React from 'react';
import { motion } from 'motion/react';
import { InventoryItem } from '../types';
import { MapPin, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Check, ShoppingCart, Star } from 'lucide-react';

interface ItemCardProps {
  item: InventoryItem;
  onClick: (item: InventoryItem) => void;
  index?: number;
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (item: InventoryItem) => void;
  onLongPress?: (item: InventoryItem) => void;
  isRecentlyUpdated?: boolean;
  isLowSpec?: boolean;
  onOrderClick?: (item: InventoryItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (item: InventoryItem) => void;
}

export const ItemCard: React.FC<ItemCardProps> = React.memo(({ 
  item, 
  onClick, 
  index = 0,
  isMultiSelectMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPress,
  isRecentlyUpdated = false,
  isLowSpec = false,
  onOrderClick,
  isFavorite = false,
  onToggleFavorite,
}) => {
  // Long press detection for selecting multiple items
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = React.useRef(false);
  const startPosRef = React.useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary mouse button or touch
    if (e.button !== 0) return;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    isLongPressTriggeredRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (onLongPress) {
        onLongPress(item);
      } else if (onToggleSelect) {
        onToggleSelect(item);
      }
    }, 450); // 450ms long press standard
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current || !longPressTimerRef.current) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    startPosRef.current = null;
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    startPosRef.current = null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Category badge
  const getCategoryColor = () => {
    return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700';
  };

  // Status configuration with ultra high-contrast borders, background tints, and badges
  const getStatusConfig = () => {
    if (item.status === 'out' || item.qty <= 0) {
      return {
        cardBorder: isSelected 
          ? 'border-2 border-blue-600 ring-4 ring-blue-500/40' 
          : 'border-2 border-red-500 hover:border-red-600 shadow-[0_6px_20px_-2px_rgba(239,68,68,0.25)] hover:shadow-[0_10px_28px_-2px_rgba(239,68,68,0.35)]',
        cardBg: 'bg-white dark:bg-slate-900',
        topAccent: 'bg-gradient-to-r from-red-600 via-rose-500 to-red-600',
        badge: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-600 text-white shadow-xs border border-red-400">
            <XCircle className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
            <span>หมดจากคลัง</span>
          </span>
        ),
      };
    }
    if (item.status === 'low') {
      return {
        cardBorder: isSelected 
          ? 'border-2 border-blue-600 ring-4 ring-blue-500/40' 
          : 'border-2 border-amber-500 hover:border-amber-600 shadow-[0_6px_20px_-2px_rgba(245,158,11,0.25)] hover:shadow-[0_10px_28px_-2px_rgba(245,158,11,0.35)]',
        cardBg: 'bg-white dark:bg-slate-900',
        topAccent: 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500',
        badge: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-xs border border-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
            <span>ใกล้หมด</span>
          </span>
        ),
      };
    }
    return {
      cardBorder: isSelected 
        ? 'border-2 border-blue-600 ring-4 ring-blue-500/40' 
        : isFavorite
          ? 'border-2 border-amber-400 dark:border-amber-400 ring-2 ring-amber-400/40 shadow-[0_6px_20px_-2px_rgba(251,191,36,0.25)]'
          : 'border-2 border-slate-300 dark:border-slate-700/90 hover:border-blue-500 dark:hover:border-blue-400 shadow-[0_4px_18px_-2px_rgba(15,23,42,0.1),0_2px_6px_-1px_rgba(15,23,42,0.06)] dark:shadow-[0_8px_24px_-2px_rgba(0,0,0,0.65)] hover:shadow-[0_10px_28px_-2px_rgba(15,23,42,0.16)] dark:hover:shadow-[0_12px_32px_-2px_rgba(0,0,0,0.85)]',
      cardBg: isFavorite 
        ? 'bg-amber-50/30 dark:bg-amber-950/20'
        : 'bg-white dark:bg-slate-900',
      topAccent: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500',
      badge: (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs border border-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
          <span>พร้อมเบิก</span>
        </span>
      ),
    };
  };

  const statusConfig = getStatusConfig();

  const handleCardClick = (e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    if (isMultiSelectMode && onToggleSelect) {
      e.stopPropagation();
      onToggleSelect(item);
    } else {
      onClick(item);
    }
  };

  const cardClasses = `item-card-container liquid-glass-card w-full min-w-0 max-w-full box-border rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-5 transition-colors duration-200 cursor-pointer relative group flex flex-col justify-between overflow-hidden select-none touch-manipulation ${
    isSelected 
      ? 'bg-blue-50/95 dark:bg-blue-950/80 border-2 border-blue-600 dark:border-blue-400 ring-4 ring-blue-500/40 shadow-xl' 
      : `${statusConfig.cardBorder} ${statusConfig.cardBg}`
  }`;

  const cardInner = (
    <>
      {/* Specular top edge rim light */}
      <div className="absolute top-0 left-6 right-6 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none rounded-full" />

      {/* High-visibility top accent color bar */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${statusConfig.topAccent}`} />

      <div className="flex gap-3 pt-1">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row with ID, Category, Status & Multi-select checkbox */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Multi-select checkbox trigger */}
              {isMultiSelectMode && (
                <button
                  type="button"
                  aria-label={isSelected ? `ยกเลิกเลือก ${item.name}` : `เลือก ${item.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleSelect) onToggleSelect(item);
                  }}
                  className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 ${
                    isSelected 
                      ? 'bg-blue-600 text-white border border-blue-600 ring-2 ring-blue-500/40' 
                      : 'bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-transparent hover:border-blue-500'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </button>
              )}

              <span className="font-mono text-xs font-black text-white bg-slate-900 dark:bg-slate-800 border border-slate-700/80 px-2.5 py-0.5 rounded-lg shadow-2xs tracking-wider">
                {item.id}
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${getCategoryColor()}`}
              >
                {item.category}
              </span>

              {isFavorite && (
                <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400 shadow-2xs">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                  <span>ปักหมุด</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              {/* Star Favorite Button */}
              {onToggleFavorite && (
                <button
                  type="button"
                  aria-label={isFavorite ? `ยกเลิกปักหมุด ${item.name}` : `ปักหมุดรายการโปรด ${item.name}`}
                  title={isFavorite ? "เลิกปักหมุดรายการโปรด" : "ปักหมุดเป็นรายการโปรด (แสดงด้านบนสุด)"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item);
                  }}
                  className={`p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                    isFavorite 
                      ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-400/40 shadow-xs active:scale-90'
                      : 'text-stone-400 hover:text-amber-500 dark:text-stone-500 dark:hover:text-amber-400 hover:bg-amber-500/10 border border-transparent active:scale-90'
                  }`}
                >
                  <Star className={`w-4 h-4 transition-transform ${isFavorite ? 'fill-amber-400 text-amber-500 scale-105' : ''}`} />
                </button>
              )}
              <div>{statusConfig.badge}</div>
            </div>
          </div>

          {/* Item Name */}
          <h3 className="font-extrabold text-slate-950 dark:text-white text-base sm:text-lg leading-snug line-clamp-2 mt-1.5 tracking-tight">
            {item.name}
          </h3>

          {/* Location info */}
          <div className="flex flex-col gap-1.5 mt-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold bg-slate-100/90 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/80 w-fit">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate max-w-[240px]">{item.location || 'Store FL.6'}</span>
            </div>
            
            {/* Days Out of Stock Alert */}
            {item.status === 'out' && (
              <div className="flex flex-col gap-1 mt-1">
                {item.outOfStockDate ? (
                  <div className="inline-flex flex-col w-fit gap-0.5 text-xs font-bold bg-red-500/15 text-red-800 dark:text-red-300 border border-red-500/40 px-3 py-1.5 rounded-xl shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                      <span>หมดสต็อกตั้งแต่: {new Date(item.outOfStockDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="ml-5 font-black text-red-700 dark:text-red-400">
                      (ขาดสต็อกมาแล้ว {Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24)))} วัน)
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex w-fit items-center gap-1.5 text-xs font-bold bg-red-500/15 text-red-800 dark:text-red-300 border border-red-500/40 px-3 py-1 rounded-xl shadow-2xs">
                    <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>สินค้าหมด (ไม่ได้บันทึกเวลา)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Stock Balance, Order Button & Arrow */}
      <div className="flex items-center justify-between pt-3 border-t-2 border-slate-200 dark:border-slate-800 mt-3 gap-2 flex-wrap min-w-0 w-full">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            เกณฑ์: <span className="font-bold text-slate-800 dark:text-slate-200">{item.minStock} {item.unit}</span>
          </div>

          {/* Prominent Order Button */}
          {(item.status === 'out' || item.status === 'low' || item.qty <= item.minStock) && onOrderClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOrderClick(item);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
              title={`กดเพื่อสั่งซื้อ ${item.name}`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>สั่งซื้อ</span>
            </button>
          )}

          {item.ordered && (
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800 shrink-0" title={item.ordered}>
              ✓ สั่งซื้อแล้ว
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          {/* High-contrast Stock Count Box */}
          <div className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border-2 flex items-baseline gap-1 sm:gap-1.5 shadow-2xs ${
            item.status === 'out' || item.qty <= 0
              ? 'bg-red-500/15 border-red-500/50 text-red-700 dark:text-red-300'
              : item.status === 'low'
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-300'
                : 'bg-emerald-500/15 border-emerald-500/50 text-emerald-800 dark:text-emerald-300'
          }`}>
            <span className="text-[11px] font-bold opacity-75">คงเหลือ:</span>
            <span className="font-black text-lg sm:text-2xl tabular-nums tracking-tight">
              {item.qty.toLocaleString()}
            </span>
            <span className="text-xs font-bold opacity-80">{item.unit}</span>
          </div>

          <div className={`w-8 h-8 rounded-xl border ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600'} flex items-center justify-center transition-all shadow-xs`}>
            {isMultiSelectMode ? (
              <Check className={`w-4 h-4 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
            ) : (
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ 
        layout: { 
          type: "spring",
          stiffness: 350,
          damping: 30,
          mass: 0.8
        },
        opacity: { duration: 0.2 }, 
        scale: { duration: 0.2 } 
      }}
      onClick={handleCardClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={handleContextMenu}
      className={cardClasses}
    >
      {cardInner}
    </motion.div>
  );
});

ItemCard.displayName = 'ItemCard';
