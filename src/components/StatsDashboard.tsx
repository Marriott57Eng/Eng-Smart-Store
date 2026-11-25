import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, InventorySummary, RequisitionRecord } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Cell, Legend, PieChart, Pie 
} from 'recharts';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { 
  Package, AlertTriangle, XCircle, CheckCircle2, 
  Layers, MapPin, ArrowUpRight, ShieldAlert, Sparkles, RefreshCw, Loader2, 
  ChevronDown, ChevronUp, BarChart3, PieChart as PieChartIcon, TrendingUp, 
  TrendingDown, Boxes, ArrowDownRight, Calendar, ArrowUpDown, Filter,
  ChevronRight, ArrowLeft
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CategoryView } from './CategoryView';

const CATEGORY_CHART_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#E11D48', // Rose
];

interface StatsDashboardProps {
  summary: InventorySummary | null;
  items: InventoryItem[];
  requisitions?: RequisitionRecord[];
  onSelectCategory: (category: string) => void;
  onFilterLowStock: () => void;
  onSelectItem: (item: InventoryItem) => void;
  onAskAI: (prompt: string) => void;
  onRefresh: () => void;
  loading: boolean;
  initialSubTab?: 'overview' | 'categories';
  isLowSpec?: boolean;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  summary,
  items,
  onSelectCategory,
  onFilterLowStock,
  onSelectItem,
  requisitions = [],
  onAskAI,
  onRefresh,
  loading,
  initialSubTab = 'overview',
  isLowSpec = false,
}) => {
  const [viewMode, setViewMode] = useState<'overview' | 'categories'>(initialSubTab || 'overview');

  useEffect(() => {
    if (initialSubTab) {
      setViewMode(initialSubTab);
    }
  }, [initialSubTab]);

  const lowStockItems = useMemo(() => items.filter(i => i.status === 'low' || i.status === 'out'), [items]);

  // --- TIME BOUNDARIES & ANALYTICS ---
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  // Category Movement Filter States
  const [categoryTimeRange, setCategoryTimeRange] = useState<'30days' | 'month' | 'all'>('30days');
  const [categoryChartType, setCategoryChartType] = useState<'bar' | 'pie'>('bar');
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<string | null>(null);

  // Category-wise Requisition & Movement Analytics
  const categoryDisbursementData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfCurMonth = startOfMonth(now);
    const endOfCurMonth = endOfMonth(now);

    // Filter requisitions based on selected time range
    const filteredReqs = requisitions.filter(req => {
      if (!req.isoDate) return true;
      try {
        const d = parseISO(req.isoDate);
        if (categoryTimeRange === '30days') {
          return d >= thirtyDaysAgo;
        } else if (categoryTimeRange === 'month') {
          return isWithinInterval(d, { start: startOfCurMonth, end: endOfCurMonth });
        }
        return true;
      } catch (e) {
        return true;
      }
    });

    // Aggregate by category
    const catMap: Record<string, {
      category: string;
      disbursedQty: number;
      stockInQty: number;
      disbursedCount: number;
      stockInCount: number;
      totalStock: number;
    }> = {};

    // Initialize with all categories present in items
    items.forEach(item => {
      const cat = item.category || 'ทั่วไป';
      if (!catMap[cat]) {
        catMap[cat] = {
          category: cat,
          disbursedQty: 0,
          stockInQty: 0,
          disbursedCount: 0,
          stockInCount: 0,
          totalStock: 0,
        };
      }
      catMap[cat].totalStock += (item.qty || 0);
    });

    // Aggregate transaction movements
    filteredReqs.forEach(req => {
      const cat = req.category || 'ทั่วไป';
      if (!catMap[cat]) {
        catMap[cat] = {
          category: cat,
          disbursedQty: 0,
          stockInQty: 0,
          disbursedCount: 0,
          stockInCount: 0,
          totalStock: 0,
        };
      }
      if (req.type === 'out') {
        catMap[cat].disbursedQty += (req.qty || 0);
        catMap[cat].disbursedCount += 1;
      } else if (req.type === 'in') {
        catMap[cat].stockInQty += (req.qty || 0);
        catMap[cat].stockInCount += 1;
      }
    });

    const list = Object.values(catMap);
    const totalDisbursedOverall = list.reduce((acc, curr) => acc + curr.disbursedQty, 0);

    return list.map(item => ({
      ...item,
      netMovement: item.stockInQty - item.disbursedQty,
      percentage: totalDisbursedOverall > 0 ? Math.round((item.disbursedQty / totalDisbursedOverall) * 100) : 0,
    })).sort((a, b) => b.disbursedQty - a.disbursedQty);
  }, [requisitions, items, categoryTimeRange]);

  // Key Category KPI Highlights
  const categoryKpis = useMemo(() => {
    const totalDisbursed = categoryDisbursementData.reduce((acc, c) => acc + c.disbursedQty, 0);
    const totalStockIn = categoryDisbursementData.reduce((acc, c) => acc + c.stockInQty, 0);
    const topCategory = categoryDisbursementData[0] || null;
    const totalTransactions = categoryDisbursementData.reduce((acc, c) => acc + c.disbursedCount + c.stockInCount, 0);

    return {
      totalDisbursed,
      totalStockIn,
      topCategory: topCategory && topCategory.disbursedQty > 0 ? topCategory : null,
      totalTransactions,
      netTotal: totalStockIn - totalDisbursed,
    };
  }, [categoryDisbursementData]);

  const currentMonthRequisitions = useMemo(() => {
    return requisitions.filter(req => {
      if (req.type !== 'out') return false;
      try {
        const d = parseISO(req.isoDate);
        return isWithinInterval(d, { start: currentMonthStart, end: currentMonthEnd });
      } catch (e) {
        return false;
      }
    });
  }, [requisitions, currentMonthStart, currentMonthEnd]);

  const topItemsThisMonth = useMemo(() => {
    const counts: Record<string, { name: string; qty: number }> = {};
    currentMonthRequisitions.forEach(req => {
      if (!counts[req.itemId]) {
        counts[req.itemId] = { name: req.itemName, qty: 0 };
      }
      counts[req.itemId].qty += req.qty;
    });
    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [currentMonthRequisitions]);

  const monthlyTrend = useMemo(() => {
    const trend: Record<string, number> = {};
    const outReqs = requisitions.filter(r => r.type === 'out');
    outReqs.forEach(req => {
      try {
        const d = parseISO(req.isoDate);
        const monthYear = format(d, 'MMM yy', { locale: th });
        trend[monthYear] = (trend[monthYear] || 0) + req.qty;
      } catch (e) {}
    });
    return Object.entries(trend).map(([month, qty]) => ({ month, qty })).reverse().slice(0, 6).reverse(); 
  }, [requisitions]);

  const outOfStockDurations = useMemo(() => {
    const outItems = items.filter(item => item.status === 'out' && item.outOfStockDate);
    return outItems.map(item => {
      try {
        const outDate = parseISO(item.outOfStockDate!);
        const days = differenceInDays(new Date(), outDate);
        return { name: item.name, days: days < 0 ? 0 : days, date: outDate };
      } catch (e) {
        return { name: item.name, days: 0, date: new Date() };
      }
    }).sort((a, b) => b.days - a.days).slice(0, 5);
  }, [items]);

  const [inlineAnalysis, setInlineAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleInlineAnalysis = async () => {
    if (isAnalyzing) return;
    if (inlineAnalysis && showAnalysis) {
      setShowAnalysis(false);
      return;
    }
    if (inlineAnalysis && !showAnalysis) {
      setShowAnalysis(true);
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setShowAnalysis(true);
      setInlineAnalysis('📡 ขณะนี้ระบบอยู่ในโหมดออฟไลน์ (Offline Mode) การประมวลผลวิเคราะห์เชิงลึกด้วย AI จำเป็นต้องใช้อินเทอร์เน็ตในการติดต่อโมเดล ข้อมูลสรุปตัวเลขและกราฟด้านล่างสามารถดูได้ตามปกติจากแคชในเครื่องครับ');
      return;
    }

    setIsAnalyzing(true);
    setShowAnalysis(true);
    setInlineAnalysis('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'วิเคราะห์เชิงลึกสถานะคลังสินค้า Store FL.6 และแนวโน้มการใช้อะไหล่ พร้อมแผนการสั่งซื้อด่วนและข้อเสนอแนะเชิงกลยุทธ์ โดยจัดย่อหน้าเว้นวรรคให้โปร่งตา ใช้สัญลักษณ์และอิโมจิหัวข้อชัดเจน น่าอ่าน',
          items,
          requisitions: currentMonthRequisitions,
        }),
      });

      if (!res.ok) throw new Error('Network error');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let done = false;
      let textBuffer = '';
      let jsonBuffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          jsonBuffer += chunk;
          const parts = jsonBuffer.split('\n\n');
          jsonBuffer = parts.pop() || '';
          for (const part of parts) {
            if (part.startsWith('data: ')) {
              try {
                const data = JSON.parse(part.slice(6));
                if (data.type === 'chunk') {
                  textBuffer += data.text;
                  setInlineAnalysis(textBuffer);
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (err) {
      setInlineAnalysis('เกิดข้อผิดพลาดในการวิเคราะห์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-3.5 sm:p-5 md:p-6 pt-3 sm:pt-4 space-y-4 pb-28 sm:pb-32 max-w-7xl mx-auto w-full transition-colors duration-200">
      {/* Sub-Navigation Switcher (ภาพรวมคลัง vs หมวดหมู่สินค้า) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 liquid-glass-pill rounded-full shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('overview')}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'overview'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>ภาพรวมคลัง</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('categories')}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              viewMode === 'categories'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>หมวดหมู่สินค้า</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              viewMode === 'categories'
                ? 'bg-white/25 text-white'
                : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
            }`}>
              {summary?.categories.length || 0}
            </span>
          </button>
        </div>

        {viewMode === 'categories' && (
          <button
            type="button"
            onClick={() => setViewMode('overview')}
            className="px-4 py-1.5 rounded-full liquid-glass-pill text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับหน้าภาพรวม</span>
          </button>
        )}
      </div>

      {viewMode === 'categories' ? (
        <div className="pt-1">
          <CategoryView
            summary={summary}
            items={items}
            onSelectCategory={onSelectCategory}
            isLowSpec={isLowSpec}
          />
        </div>
      ) : (
        <>
          {/* Vibrant Gradient Summary Hero Banner */}
          <div className="rounded-3xl p-5 sm:p-6 shadow-xl shadow-blue-600/20 relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white w-full min-w-0">
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-16 w-48 h-48 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between mb-3 relative z-10 flex-wrap gap-2">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-bold text-blue-100 border border-white/20 mb-1.5">
                  ENG Smart Store · Store FL.6
                </span>
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  ภาพรวมคลังอะไหล่ช่าง
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('categories')}
                  className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xs text-white active:scale-95 transition-all text-xs font-bold flex items-center gap-1.5 border border-white/25 cursor-pointer"
                  title="เปิดดูหมวดหมู่สินค้าทั้งหมด"
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>หมวดหมู่ ({summary?.categories.length || 0})</span>
                </button>

                <button
                  onClick={onRefresh}
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xs active:scale-95 transition-all text-white flex items-center gap-1.5 text-xs font-bold border border-white/25 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>รีเฟรช</span>
                </button>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-blue-100/90 mb-4 leading-relaxed relative z-10">
              ติดตามจำนวนคงเหลือ อะไหล่ใกล้หมด และสถิติการเบิก-รับประจำคลังแบบเรียลไทม์
            </p>

            {/* 3 Translucent Key Metric Blocks */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 relative z-10">
              <div className="rounded-2xl p-3.5 sm:p-4 bg-white/15 backdrop-blur-xs border border-white/20">
                <span className="text-[11px] font-bold text-blue-100 block">
                  รายการอะไหล่ทั้งหมด
                </span>
                <span className="text-xl sm:text-3xl font-black text-white tabular-nums mt-1 block">
                  {(summary?.totalItems || items.length).toLocaleString()}
                </span>
                <span className="text-[11px] text-blue-100/80 block font-medium mt-0.5">รายการในคลัง</span>
              </div>

              <div 
                onClick={onFilterLowStock}
                className="rounded-2xl p-3.5 sm:p-4 bg-amber-400/20 hover:bg-amber-400/30 backdrop-blur-xs border border-amber-300/40 cursor-pointer active:scale-[0.98] transition-all"
              >
                <span className="text-[11px] font-bold text-amber-100 block truncate">
                  ใกล้หมด / หมดสต็อก
                </span>
                <span className="text-xl sm:text-3xl font-black tabular-nums text-amber-200 mt-1 block">
                  {lowStockItems.length.toLocaleString()}
                </span>
                <span className="text-[11px] text-amber-100 block font-bold mt-0.5">แตะดูรายการ &rarr;</span>
              </div>

              <div className="rounded-2xl p-3.5 sm:p-4 bg-white/15 backdrop-blur-xs border border-white/20">
                <span className="text-[11px] font-bold text-blue-100 block">
                  จำนวนคงเหลือรวม
                </span>
                <span className="text-xl sm:text-3xl font-black text-white tabular-nums mt-1 block">
                  {(summary?.totalQty || 0).toLocaleString()}
                </span>
                <span className="text-[11px] text-blue-100/80 block font-medium mt-0.5">ชิ้น/หน่วยรวม</span>
              </div>
            </div>
          </div>

          {/* Dedicated Category Mode Banner Card in Overview */}
          <div 
            onClick={() => setViewMode('categories')}
            className="rounded-2xl p-4 liquid-glass-card flex items-center justify-between cursor-pointer hover:border-blue-400/60 active:scale-[0.99] transition-all group w-full min-w-0"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                    ดูสินค้าแยกตามหมวดหมู่
                  </h3>
                  <span className="text-[11px] bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold px-2.5 py-0.5 rounded-full">
                    {summary?.categories.length || 0} หมวดหมู่
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  เลือกดูรายการอะไหล่และยอดคงเหลือตามประเภทงานช่าง
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0 group-hover:translate-x-0.5 transition-transform pr-1">
              <span>เปิดดู</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

      {/* AI Quick Insight Prompt Card */}
      <div className="flex flex-col gap-2.5">
      <div 
        onClick={handleInlineAnalysis}
        className="liquid-glass-card rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-indigo-400/60 active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                ให้ AI ช่วยวิเคราะห์สถานะคลังสินค้า
              </h3>
              <span className="text-[11px] bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold px-2.5 py-0.5 rounded-full">
                AI ช่วยวิเคราะห์
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">แตะเพื่อสรุปภาพรวม อะไหล่ที่เบิกบ่อย และรายการที่ควรสั่งซื้อเพิ่ม</p>
          </div>
        </div>
        {isAnalyzing ? <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" /> : (showAnalysis ? <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />)}
      </div>
      
      {showAnalysis && (
        <div className="liquid-glass-card rounded-2xl p-4 sm:p-5 border-indigo-200/70 dark:border-indigo-500/30 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                AI
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">สรุปผลการวิเคราะห์คลังสินค้า</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">วิเคราะห์จากยอดคงเหลือและประวัติการเบิก-รับล่าสุด</p>
              </div>
            </div>
            <button
              onClick={() => {
                setInlineAnalysis('');
                setIsAnalyzing(false);
                setTimeout(() => handleInlineAnalysis(), 50);
              }}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>วิเคราะห์ใหม่</span>
            </button>
          </div>

          {isAnalyzing && !inlineAnalysis ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 py-6">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
              <div className="text-center">
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">กำลังวิเคราะห์ข้อมูลคลังสินค้า...</p>
                <p className="text-xs text-slate-400 mt-0.5">ตรวจสอบรายการใกล้หมดและแนวโน้มการเบิกใช้</p>
              </div>
            </div>
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed space-y-2.5 prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
              <ReactMarkdown>{inlineAnalysis}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
      </div>

      {/* =========================================================
          กราฟแสดงสถานะการเบิกจ่ายสินค้าแยกตามหมวดหมู่ (RECHARTS)
          ========================================================= */}
      <div className="rounded-3xl liquid-glass-card p-4 sm:p-5 relative overflow-hidden w-full min-w-0">
        {/* Top Header with Title and Interactive Toggles */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200/70 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                สถิติการเบิกออกและรับเข้าแยกตามหมวดหมู่
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                เปรียบเทียบปริมาณการเบิกใช้งานและการรับอะไหล่เข้าคลังในแต่ละหมวดหมู่
              </p>
            </div>
          </div>

          {/* Interactive Filters (Time Range & Chart Type) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Time Range Filter */}
            <div className="flex items-center p-1 rounded-full liquid-glass-pill text-xs">
              <button
                type="button"
                onClick={() => setCategoryTimeRange('30days')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                  categoryTimeRange === '30days'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                30 วันล่าสุด
              </button>
              <button
                type="button"
                onClick={() => setCategoryTimeRange('month')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                  categoryTimeRange === 'month'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                เดือนนี้
              </button>
              <button
                type="button"
                onClick={() => setCategoryTimeRange('all')}
                className={`px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                  categoryTimeRange === 'all'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                ทั้งหมด
              </button>
            </div>

            {/* Chart Type Toggle */}
            <div className="flex items-center p-1 rounded-full liquid-glass-pill text-xs">
              <button
                type="button"
                onClick={() => setCategoryChartType('bar')}
                title="ดูกราฟแท่งเปรียบเทียบ"
                className={`px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1 font-bold ${
                  categoryChartType === 'bar'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">กราฟแท่ง</span>
              </button>
              <button
                type="button"
                onClick={() => setCategoryChartType('pie')}
                title="ดูกราฟสัดส่วน"
                className={`p-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 font-bold ${
                  categoryChartType === 'pie'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <PieChartIcon className="w-4 h-4" />
                <span className="hidden sm:inline">สัดส่วน %</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick KPI Strip for Category Movement */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          <div className="liquid-glass-pill rounded-2xl p-3 border border-blue-400/20 bg-blue-500/5 dark:bg-blue-950/20 shadow-2xs">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-bold mb-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>เบิกจ่ายรวม</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {categoryKpis.totalDisbursed} <span className="text-xs font-semibold text-slate-400">ชิ้น</span>
            </div>
          </div>

          <div className="liquid-glass-pill rounded-2xl p-3 border border-emerald-400/20 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-2xs">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>รับเข้ารวม</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {categoryKpis.totalStockIn} <span className="text-xs font-semibold text-slate-400">ชิ้น</span>
            </div>
          </div>

          <div className="liquid-glass-pill rounded-2xl p-3 border border-indigo-400/20 bg-indigo-500/5 dark:bg-indigo-950/20 shadow-2xs">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-bold mb-1 truncate">
              <Boxes className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">หมวดที่เบิกสูงสุด</span>
            </div>
            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate" title={categoryKpis.topCategory?.category || '-'}>
              {categoryKpis.topCategory ? categoryKpis.topCategory.category : '-'}
            </div>
            {categoryKpis.topCategory && (
              <span className="text-[10.5px] text-indigo-500 font-bold block">
                {categoryKpis.topCategory.disbursedQty} ชิ้น ({categoryKpis.topCategory.percentage}%)
              </span>
            )}
          </div>

          <div className="liquid-glass-pill rounded-2xl p-3 border border-violet-400/20 bg-violet-500/5 dark:bg-violet-950/20 shadow-2xs">
            <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400 text-xs font-bold mb-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>การเคลื่อนไหวสุทธิ</span>
            </div>
            <div className={`text-lg sm:text-xl font-black ${
              categoryKpis.netTotal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {categoryKpis.netTotal >= 0 ? `+${categoryKpis.netTotal}` : categoryKpis.netTotal}{' '}
              <span className="text-xs font-semibold text-slate-400">ชิ้น</span>
            </div>
          </div>
        </div>

        {/* Main Chart Area */}
        <div className="w-full">
          {categoryDisbursementData.length === 0 || (categoryKpis.totalDisbursed === 0 && categoryKpis.totalStockIn === 0) ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Boxes className="w-8 h-8 opacity-40" />
              <p className="text-xs sm:text-sm font-semibold">ยังไม่มีประวัติการเบิกจ่ายหรือรับเข้าในหมวดหมู่ช่วงเวลานี้</p>
            </div>
          ) : categoryChartType === 'bar' ? (
            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryDisbursementData.slice(0, 10)}
                  margin={{ top: 10, right: 15, left: -10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b" opacity={0.15} />
                  <XAxis 
                    dataKey="category" 
                    tick={{ fontSize: 11 }} 
                    stroke="#94a3b8" 
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={45}
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(100, 116, 139, 0.08)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="liquid-glass-card rounded-2xl p-3.5 border border-white/40 dark:border-white/10 shadow-2xl backdrop-blur-2xl text-xs space-y-1.5 min-w-[190px]">
                            <p className="font-extrabold text-sm text-slate-900 dark:text-white border-b border-white/20 pb-1 flex items-center justify-between">
                              <span>{label}</span>
                              <span className="text-[10px] text-blue-500 font-bold">{data.percentage}% ของยอดเบิก</span>
                            </p>
                            <div className="space-y-1 pt-0.5">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold">
                                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                                  เบิกจ่าย (ออก):
                                </span>
                                <span className="font-black text-slate-900 dark:text-white">
                                  {data.disbursedQty} ชิ้น ({data.disbursedCount} ครั้ง)
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                                  รับเข้า (เข้า):
                                </span>
                                <span className="font-black text-slate-900 dark:text-white">
                                  {data.stockInQty} ชิ้น ({data.stockInCount} ครั้ง)
                                </span>
                              </div>
                              <div className="flex items-center justify-between border-t border-slate-200/40 dark:border-white/10 pt-1 text-[11px]">
                                <span className="text-slate-500 dark:text-slate-400">สต็อกคงเหลือปัจจุบัน:</span>
                                <span className="font-extrabold text-slate-700 dark:text-slate-200">{data.totalStock} ชิ้น</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    wrapperStyle={{ fontSize: '11.5px', paddingBottom: '12px' }} 
                  />
                  <Bar 
                    dataKey="disbursedQty" 
                    name="ยอดเบิกจ่าย (ออก)" 
                    fill="#3B82F6" 
                    radius={[6, 6, 0, 0]} 
                    isAnimationActive={!isLowSpec}
                    cursor="pointer"
                    onClick={(entry: any) => {
                      const cat = entry?.category || entry?.payload?.category;
                      if (cat) onSelectCategory(cat);
                    }}
                  />
                  <Bar 
                    dataKey="stockInQty" 
                    name="ยอดรับเข้า (เข้า)" 
                    fill="#10B981" 
                    radius={[6, 6, 0, 0]} 
                    isAnimationActive={!isLowSpec}
                    cursor="pointer"
                    onClick={(entry: any) => {
                      const cat = entry?.category || entry?.payload?.category;
                      if (cat) onSelectCategory(cat);
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Donut / Pie Chart */}
              <div className="h-72 md:col-span-6 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDisbursementData.filter(d => d.disbursedQty > 0)}
                      dataKey="disbursedQty"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                      isAnimationActive={!isLowSpec}
                      cursor="pointer"
                      onClick={(entry: any) => {
                        const cat = entry?.category || entry?.name || entry?.payload?.category;
                        if (cat) onSelectCategory(cat);
                      }}
                    >
                      {categoryDisbursementData.filter(d => d.disbursedQty > 0).map((entry, index) => (
                        <Cell 
                          key={`cell-${entry.category}`} 
                          fill={CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="liquid-glass-card rounded-2xl p-3 border border-white/40 dark:border-white/10 shadow-2xl backdrop-blur-2xl text-xs">
                              <p className="font-extrabold text-slate-900 dark:text-white mb-1">{data.category}</p>
                              <p className="text-blue-600 dark:text-blue-400 font-bold">
                                ยอดเบิก: {data.disbursedQty} ชิ้น ({data.percentage}%)
                              </p>
                              <p className="text-slate-500 text-[11px]">จำนวนครั้งที่เบิก: {data.disbursedCount} ครั้ง</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart Legend & Breakdown List */}
              <div className="md:col-span-6 space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-none">
                {categoryDisbursementData.filter(d => d.disbursedQty > 0).slice(0, 7).map((cat, idx) => (
                  <div
                    key={cat.category}
                    onClick={() => onSelectCategory(cat.category)}
                    className="flex items-center justify-between p-2 rounded-xl liquid-glass-pill hover:bg-blue-500/10 transition-all cursor-pointer border border-white/40 dark:border-white/5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span 
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs" 
                        style={{ backgroundColor: CATEGORY_CHART_COLORS[idx % CATEGORY_CHART_COLORS.length] }} 
                      />
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{cat.category}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                        {cat.disbursedQty} ชิ้น
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detailed Category Movement Expandable Badges Strip */}
        <div className="mt-4 pt-3.5 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            💡 คลิกที่แท่งกราฟหรือชื่อหมวดหมู่เพื่อกรองรายการสินค้าในหมวดนั้นทันที
          </span>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> เบิกออก
            </span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> รับเข้า
            </span>
          </div>
        </div>
      </div>

      {/* Responsive Analytics & Breakdown Grid (1 col on phone, 2 cols on tablet/desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4.5 w-full min-w-0">
        {/* Low Stock Alert Section */}
        {lowStockItems.length > 0 && (
          <div className="liquid-glass-card rounded-[28px] border-2 border-amber-300 dark:border-amber-600/60 bg-white dark:bg-slate-900 p-5 shadow-lg w-full min-w-0">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">รายการสต็อกที่ต้องเติม ({lowStockItems.length})</h2>
              </div>
              <button
                onClick={onFilterLowStock}
                className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
              >
                ดูทั้งหมด
              </button>
            </div>

            <div className="space-y-2.5">
              {lowStockItems.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="bg-amber-500/10 dark:bg-amber-950/30 hover:bg-amber-500/20 dark:hover:bg-amber-950/50 border border-amber-400/30 dark:border-amber-700/40 rounded-2xl p-3 flex items-center justify-between cursor-pointer transition-all active:scale-98 shadow-2xs backdrop-blur-md"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.id} • {item.category} • ที่เก็บ: {item.location}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-extrabold text-amber-600 dark:text-amber-400 block">
                      เหลือ {item.qty} {item.unit}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">Min: {item.minStock}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Breakdown Section */}
        <div className="liquid-glass-card rounded-[28px] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-lg w-full min-w-0">
          <div className="flex items-center gap-2 mb-3.5">
            <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">สัดส่วนสินค้าตามหมวดหมู่</h2>
          </div>

          <div className="space-y-2.5">
            {summary?.categories.map((cat) => {
              const percentage = Math.round((cat.count / (summary.totalItems || 1)) * 100);
              return (
                <div
                  key={cat.name}
                  onClick={() => onSelectCategory(cat.name)}
                  className="p-2.5 rounded-2xl hover:bg-blue-500/10 dark:hover:bg-slate-800/80 border border-transparent hover:border-white/40 dark:hover:border-white/10 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{cat.name}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      {cat.count} รายการ ({cat.totalQty} ชิ้น)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/50 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden border border-white/40 dark:border-white/10">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Analytics: Top Items This Month */}
        {topItemsThisMonth.length > 0 && (
          <div className="liquid-glass-card rounded-[28px] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-lg w-full min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">รายการเบิกสูงสุดเดือนนี้</h2>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItemsThisMonth} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', backgroundColor: 'rgba(15,23,42,0.94)', color: '#f8fafc' }} />
                  <Bar dataKey="qty" name="จำนวนที่เบิก" fill="#10B981" radius={[0, 6, 6, 0]} isAnimationActive={!isLowSpec} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Analytics: Monthly Trend */}
        {monthlyTrend.length > 0 && (
          <div className="liquid-glass-card rounded-[28px] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-lg w-full min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpRight className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">แนวโน้มการเบิกจ่าย (ยอดรวม)</h2>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <RechartsTooltip cursor={{fill: 'rgba(100,116,139,0.08)'}} contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', backgroundColor: 'rgba(15,23,42,0.94)', color: '#f8fafc' }} />
                  <Bar dataKey="qty" name="จำนวนรวม" fill="#3B82F6" radius={[6, 6, 0, 0]} isAnimationActive={!isLowSpec} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Analytics: Out of Stock Duration */}
        {outOfStockDurations.length > 0 && (
          <div className="liquid-glass-card rounded-[28px] border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-lg lg:col-span-2 w-full min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
              <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">สินค้าหมดสต๊อกนานที่สุด (วัน)</h2>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outOfStockDurations} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <RechartsTooltip cursor={{fill: 'rgba(100,116,139,0.08)'}} contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', backgroundColor: 'rgba(15,23,42,0.94)', color: '#f8fafc' }} />
                  <Bar dataKey="days" name="จำนวนวัน" fill="#EF4444" radius={[6, 6, 0, 0]} isAnimationActive={!isLowSpec}>
                    {outOfStockDurations.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.days > 7 ? '#EF4444' : '#F87171'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

