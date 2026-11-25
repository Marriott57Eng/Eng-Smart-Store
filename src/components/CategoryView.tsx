import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { InventorySummary, InventoryItem } from '../types';
import { 
  Layers, Package, Zap, Droplet, Flame,
  Wind, Bath, Palette, DoorOpen, Radio, ChevronRight,
  Boxes, AlertCircle, AlertTriangle
} from 'lucide-react';
import { getCategoryImageUrl, CATEGORY_IMAGE_MAP } from '../utils/imageMap';

interface CategoryViewProps {
  summary: InventorySummary | null;
  items: InventoryItem[];
  onSelectCategory: (category: string) => void;
  isLowSpec?: boolean;
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  summary,
  items,
  onSelectCategory,
  isLowSpec = false,
}) => {
  // Precompute out-of-stock and low-stock counts per category in a single O(N) pass
  const categoryStatsMap = useMemo(() => {
    const map: Record<string, { outCount: number; lowCount: number }> = {};
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const cat = item.category || 'ทั่วไป';
      if (!map[cat]) {
        map[cat] = { outCount: 0, lowCount: 0 };
      }
      if (item.status === 'out' || item.qty <= 0) {
        map[cat].outCount++;
      } else if (item.status === 'low' && item.qty > 0) {
        map[cat].lowCount++;
      }
    }
    return map;
  }, [items]);

  const getCategoryIcon = (name: string) => {
    const iconClass = "w-4 h-4 text-blue-600 dark:text-blue-400";
    switch (name) {
      case 'เคมี':
        return <Droplet className={iconClass} />;
      case 'ท่อ':
        return <Layers className={iconClass} />;
      case 'ไฟฟ้า':
      case 'Lighting':
        return <Zap className={iconClass} />;
      case 'แอร์':
        return <Wind className={iconClass} />;
      case 'สุขภัณฑ์':
        return <Bath className={iconClass} />;
      case 'สี+Grouting':
        return <Palette className={iconClass} />;
      case 'Fire Alarm':
        return <Flame className={iconClass} />;
      case 'ประตู':
        return <DoorOpen className={iconClass} />;
      case 'เน็ต+โทรศัพท์':
        return <Radio className={iconClass} />;
      default:
        return <Package className={iconClass} />;
    }
  };

  const getCategoryDescription = (name: string) => {
    return CATEGORY_IMAGE_MAP[name]?.description || 'อุปกรณ์และอะไหล่ช่างประจำคลัง';
  };

  return (
    <div className="p-3 sm:p-4 md:p-5 space-y-3.5 pb-28 sm:pb-32 max-w-7xl mx-auto w-full min-w-0 overflow-x-hidden transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between liquid-glass-card p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              หมวดหมู่อะไหล่ในคลัง
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              เลือกหมวดหมู่เพื่อดูรายการอะไหล่ ({summary?.categories.length || 0} หมวดหมู่)
            </p>
          </div>
        </div>
      </div>

      {/* Category Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 w-full min-w-0">
        {summary?.categories.map((cat, idx) => {
          const catImg = getCategoryImageUrl(cat.name);
          const stats = categoryStatsMap[cat.name] || { outCount: 0, lowCount: 0 };
          const outOfStockItemsInCat = stats.outCount;
          const lowStockItemsInCat = stats.lowCount;

          const cardClassName = "rounded-2xl overflow-hidden liquid-glass-card hover:border-blue-400/60 transition-all cursor-pointer group flex flex-col justify-between relative w-full min-w-0 box-border";

          const cardContent = (
            <>
              {/* Category Image Banner with Overlay */}
              <div className="relative h-24 sm:h-28 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <img
                  src={catImg}
                  alt={cat.name}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover ${isLowSpec ? '' : 'group-hover:scale-105 transition-transform duration-300'}`}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />
                
                {/* Category Badge & Icon */}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-white/95 dark:bg-slate-900/90 flex items-center justify-center shrink-0 shadow-sm">
                      {getCategoryIcon(cat.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-sm sm:text-base leading-tight truncate">
                        {cat.name}
                      </h3>
                      <span className="text-[11px] text-slate-200 tabular-nums">
                        {cat.count} รายการ
                      </span>
                    </div>
                  </div>

                  {/* Stock status pills */}
                  <div className="flex items-center gap-1 shrink-0">
                    {outOfStockItemsInCat > 0 && (
                      <span className="bg-red-500/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 tabular-nums shadow-xs">
                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                        <span>หมด {outOfStockItemsInCat}</span>
                      </span>
                    )}

                    {lowStockItemsInCat > 0 && (
                      <span className="bg-amber-400/95 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 tabular-nums shadow-xs">
                        <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                        <span>ใกล้หมด {lowStockItemsInCat}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Details */}
              <div className="p-3.5 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    {getCategoryDescription(cat.name)}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 tabular-nums">
                    คงเหลือรวม <span className="text-blue-600 dark:text-blue-400 font-extrabold">{cat.totalQty.toLocaleString()}</span> หน่วย
                  </p>
                </div>

                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/8 group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-indigo-600 text-slate-500 dark:text-slate-400 group-hover:text-white flex items-center justify-center shrink-0 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </>
          );

          if (isLowSpec) {
            return (
              <div
                key={cat.name}
                onClick={() => onSelectCategory(cat.name)}
                className={cardClassName}
              >
                {cardContent}
              </div>
            );
          }

          return (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.2,
                ease: [0.16, 1, 0.3, 1],
                delay: Math.min(idx * 0.02, 0.16),
              }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelectCategory(cat.name)}
              className={cardClassName}
            >
              {cardContent}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
