import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Camera, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  ArrowRight, 
  RefreshCw, 
  Search, 
  Plus, 
  Minus, 
  Building2, 
  Calendar, 
  Hash, 
  Boxes, 
  Check, 
  Eye, 
  EyeOff,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { InventoryItem, User } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

export interface ScannedInvoiceItem {
  lineNumber: number;
  rawName: string;
  partCode?: string;
  quantity: number;
  unit: string;
  unitPrice?: number | null;
  totalPrice?: number | null;
  matchedItemId?: string | null;
  matchedItemName?: string | null;
  matchConfidence?: number;
  note?: string;
  selected: boolean;
}

export interface ScannedInvoiceData {
  documentType: string;
  documentTypeName: string;
  documentNumber: string;
  documentDate: string;
  supplierName: string;
  supplierTaxId?: string;
  poNumber?: string;
  receiverName?: string;
  totalAmount?: number | null;
  items: ScannedInvoiceItem[];
  summaryNotes?: string;
}

interface InvoiceScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItems: InventoryItem[];
  currentUser: User | null;
  onConfirmBulkStockIn: (data: {
    items: Array<{
      itemId: string;
      itemName: string;
      qty: number;
      unit: string;
      currentQty?: number;
      category?: string;
      location?: string;
    }>;
    documentNumber: string;
    supplierName: string;
    requestedBy: string;
    purpose: string;
    note: string;
  }) => Promise<void>;
}

export const InvoiceScanModal: React.FC<InvoiceScanModalProps> = ({
  isOpen,
  onClose,
  inventoryItems,
  currentUser,
  onConfirmBulkStockIn,
}) => {
  useScrollLock(isOpen);

  const [step, setStep] = useState<'upload' | 'scanning' | 'review'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [imageName, setImageName] = useState<string>('');
  const [scanStatusText, setScanStatusText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Extracted Document Information
  const [docNumber, setDocNumber] = useState<string>('');
  const [docDate, setDocDate] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>(currentUser?.name || 'ช่างเทคนิค');
  const [purposeNote, setPurposeNote] = useState<string>('');
  const [additionalNote, setAdditionalNote] = useState<string>('');

  // Scanned Items
  const [items, setItems] = useState<ScannedInvoiceItem[]>([]);
  const [activeItemSearchIndex, setActiveItemSearchIndex] = useState<number | null>(null);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState<string>('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setImagePreview(null);
      setImageName('');
      setErrorMessage('');
      setIsSubmitting(false);
      setReceiverName(currentUser?.name || 'ช่างเทคนิค');
      setPurposeNote('');
      setAdditionalNote('');
      setItems([]);
      setActiveItemSearchIndex(null);
    }
  }, [isOpen, currentUser]);

  // Handle image selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setErrorMessage('กรุณาเลือกไฟล์ภาพ (JPG, PNG, WebP) หรือ PDF');
      return;
    }

    // Limit to 15MB
    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('ขนาดไฟล์เกิน 15MB กรุณาเลือกไฟล์ที่มีขนาดเล็กลง');
      return;
    }

    setImageName(file.name);
    setImageMime(file.type || 'image/jpeg');
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Perform Gemini Vision OCR Scan
  const handleStartScan = async () => {
    if (!imagePreview) {
      setErrorMessage('กรุณาถ่ายรูปหรือเลือกไฟล์เอกสารก่อนสแกน');
      return;
    }

    setStep('scanning');
    setErrorMessage('');
    setScanStatusText('กำลังเตรียมข้อมูลเอกสารและเชื่อมต่อ AI Vision...');

    try {
      const statusTimer1 = setTimeout(() => {
        setScanStatusText('Gemini 2.5 Flash กำลังถอดรหัสข้อความและตารางสินค้า...');
      }, 1200);

      const statusTimer2 = setTimeout(() => {
        setScanStatusText('กำลังจับคู่รหัสอะไหล่กับคลัง Store FL.6 อัตโนมัติ...');
      }, 2800);

      const response = await fetch('/api/scan/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imagePreview,
          mimeType: imageMime,
          catalogItems: inventoryItems.map(i => ({
            id: i.id,
            name: i.name,
            category: i.category,
            unit: i.unit,
            qty: i.qty,
            minStock: i.minStock,
            location: i.location,
          })),
        }),
      });

      clearTimeout(statusTimer1);
      clearTimeout(statusTimer2);

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'ไม่สามารถวิเคราะห์เอกสารได้');
      }

      const scanResult: ScannedInvoiceData = resData.data;

      // Fill extracted header fields
      setDocNumber(scanResult.documentNumber || '');
      setDocDate(scanResult.documentDate || new Date().toLocaleDateString('th-TH'));
      setSupplierName(scanResult.supplierName || '');
      setPoNumber(scanResult.poNumber || '');
      setPurposeNote(`รับสินค้าเข้าคลัง${scanResult.documentNumber ? ` ตามเอกสาร ${scanResult.documentNumber}` : ''}`);

      // Map scanned items with default selection
      const initialItems: ScannedInvoiceItem[] = (scanResult.items || []).map((it, idx) => {
        // If matchedItemId exists, verify in current inventory
        let matchedId = it.matchedItemId;
        let matchedName = it.matchedItemName;
        
        if (matchedId) {
          const invItem = inventoryItems.find(inv => inv.id === matchedId);
          if (invItem) {
            matchedName = invItem.name;
          } else {
            matchedId = null;
            matchedName = null;
          }
        }

        // If no match found, try fuzzy match on frontend as secondary fallback
        if (!matchedId) {
          const rawLower = (it.rawName || '').toLowerCase();
          const pCodeLower = (it.partCode || '').toLowerCase();
          const fallbackMatch = inventoryItems.find(inv => {
            const invName = inv.name.toLowerCase();
            const invId = inv.id.toLowerCase();
            return (
              (pCodeLower && (invName.includes(pCodeLower) || invId.includes(pCodeLower))) ||
              (rawLower.length > 3 && (invName.includes(rawLower) || rawLower.includes(invName)))
            );
          });
          if (fallbackMatch) {
            matchedId = fallbackMatch.id;
            matchedName = fallbackMatch.name;
          }
        }

        return {
          lineNumber: it.lineNumber || idx + 1,
          rawName: it.rawName || 'สินค้าไม่ระบุชื่อ',
          partCode: it.partCode || '',
          quantity: Math.max(1, Number(it.quantity) || 1),
          unit: it.unit || 'ชิ้น',
          unitPrice: it.unitPrice || null,
          totalPrice: it.totalPrice || null,
          matchedItemId: matchedId || null,
          matchedItemName: matchedName || null,
          matchConfidence: it.matchConfidence || (matchedId ? 0.9 : 0),
          note: it.note || '',
          selected: Boolean(matchedId), // Auto-select matched items
        };
      });

      setItems(initialItems);
      setStep('review');
    } catch (err: any) {
      console.error('Scan error:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการสแกน กรุณาลองใหม่อีกครั้ง');
      setStep('upload');
    }
  };

  // Item quantity adjustment
  const handleItemQtyChange = (index: number, newQty: number) => {
    const clamped = Math.max(1, newQty);
    setItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: clamped } : item));
  };

  // Toggle item checkbox
  const handleToggleItemSelect = (index: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
  };

  // Select / Unselect all
  const handleToggleSelectAll = () => {
    const allSelected = items.every(i => i.selected);
    setItems(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  // Re-link / match with an inventory item
  const handleSelectInventoryItem = (itemIndex: number, inventoryItem: InventoryItem) => {
    setItems(prev => prev.map((it, i) => {
      if (i === itemIndex) {
        return {
          ...it,
          matchedItemId: inventoryItem.id,
          matchedItemName: inventoryItem.name,
          unit: it.unit || inventoryItem.unit,
          matchConfidence: 1.0,
          selected: true, // Auto check when matched
        };
      }
      return it;
    }));
    setActiveItemSearchIndex(null);
    setCatalogSearchTerm('');
  };

  // Unlink item match
  const handleUnlinkItem = (itemIndex: number) => {
    setItems(prev => prev.map((it, i) => {
      if (i === itemIndex) {
        return {
          ...it,
          matchedItemId: null,
          matchedItemName: null,
          matchConfidence: 0,
        };
      }
      return it;
    }));
  };

  // Filter inventory items for manual item picker dropdown
  const filteredCatalogItems = useMemo(() => {
    if (!catalogSearchTerm.trim()) return inventoryItems.slice(0, 20);
    const term = catalogSearchTerm.toLowerCase();
    return inventoryItems
      .filter(i => 
        i.name.toLowerCase().includes(term) ||
        i.id.toLowerCase().includes(term) ||
        (i.category && i.category.toLowerCase().includes(term)) ||
        (i.location && i.location.toLowerCase().includes(term))
      )
      .slice(0, 30);
  }, [inventoryItems, catalogSearchTerm]);

  // Selected summary stats
  const selectedItems = items.filter(i => i.selected && i.matchedItemId);
  const totalUnits = selectedItems.reduce((sum, i) => sum + i.quantity, 0);

  // Submit Bulk Stock-In
  const handleConfirmSubmit = async () => {
    if (selectedItems.length === 0) {
      setErrorMessage('กรุณาเลือกรายการสินค้าที่จับคู่กับระบบแล้วอย่างน้อย 1 รายการ');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payloadItems = selectedItems.map(it => {
        const invItem = inventoryItems.find(inv => inv.id === it.matchedItemId);
        return {
          itemId: it.matchedItemId!,
          itemName: it.matchedItemName || it.rawName,
          qty: it.quantity,
          unit: it.unit || invItem?.unit || 'ชิ้น',
          currentQty: invItem?.qty || 0,
          category: invItem?.category || 'ทั่วไป',
          location: invItem?.location || 'Store FL.6',
        };
      });

      await onConfirmBulkStockIn({
        items: payloadItems,
        documentNumber: docNumber.trim(),
        supplierName: supplierName.trim(),
        requestedBy: receiverName.trim() || currentUser?.name || 'ช่างเทคนิค',
        purpose: purposeNote.trim() || `รับสินค้าเข้าคลัง${docNumber ? ` (${docNumber})` : ''}`,
        note: additionalNote.trim() || (supplierName ? `ซัพพลายเออร์: ${supplierName}` : ''),
      });

      onClose();
    } catch (err: any) {
      console.error('Submit bulk stock in error:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกสต็อก');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-4xl bg-white dark:bg-[#1E1B18] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 flex flex-col max-h-[92vh] overflow-hidden z-10"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent dark:from-blue-500/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  สแกนใบส่งของ & Invoice รับของเข้าสโตร์
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-400/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Gemini AI Vision
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ถ่ายรูปใบส่งของ (DO) หรือ Invoice เพื่อดึงรายการและรับเข้าคลังแบบ One-Click
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* STEP 1: UPLOAD / CAMERA VIEW */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Image Preview Box or Empty Dropzone */}
              {imagePreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-900 max-h-80 flex items-center justify-center group">
                  <img
                    src={imagePreview}
                    alt="Document preview"
                    className="max-h-80 w-auto object-contain"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-90 transition-opacity flex flex-col justify-between p-4 text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md">
                        {imageName || 'เอกสารที่พร้อมสแกน'}
                      </span>
                      <button
                        onClick={() => {
                          setImagePreview(null);
                          setImageName('');
                        }}
                        className="px-2.5 py-1 rounded-full bg-red-500/80 hover:bg-red-600 text-xs font-bold transition-all"
                      >
                        เปลี่ยนรูปใหม่
                      </button>
                    </div>
                    <div className="text-center pb-2">
                      <p className="text-xs text-white/80">ตรวจดูว่าตัวหนังสือและตารางชัดเจน เพื่อความแม่นยำสูงสุด</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 dark:border-white/20 rounded-3xl p-8 sm:p-12 text-center bg-slate-50/50 dark:bg-white/[0.02] flex flex-col items-center justify-center gap-4 transition-all hover:border-blue-500 dark:hover:border-blue-400">
                  <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                    <FileText className="w-8 h-8" />
                  </div>

                  <div className="max-w-md">
                    <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      ถ่ายรูปหรืออัปโหลดเอกสารใบส่งของ
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      รองรับ Delivery Order (DO), ใบกำกับภาษี/ใบส่งสินค้า (Tax Invoice), ใบเสร็จรับเงิน หรือเอกสารจัดซื้อทั้งไทยและอังกฤษ
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                    {/* Camera Button */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      เปิดกล้องถ่ายเอกสาร
                    </button>

                    {/* File Upload Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-2xl liquid-glass-pill hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2 border border-slate-300 dark:border-white/10 active:scale-95 transition-all cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      เลือกไฟล์รูปภาพ / PDF
                    </button>
                  </div>

                  {/* Hidden native inputs */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* Start Scan Button */}
              {imagePreview && (
                <div className="pt-2">
                  <button
                    onClick={handleStartScan}
                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-blue-500/25 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    เริ่มสแกนและถอดรหัสด้วย AI (Analyze Document)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SCANNING PROGRESS VIEW */}
          {step === 'scanning' && (
            <div className="py-12 sm:py-16 flex flex-col items-center justify-center text-center space-y-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Loader2 className="w-10 h-10 animate-spin" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-xs font-black shadow-md animate-bounce">
                  ✨
                </div>
              </div>

              <div className="space-y-1.5 max-w-sm">
                <h4 className="text-lg font-black text-slate-900 dark:text-white">
                  ระบบกำลังวิเคราะห์เอกสาร...
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium animate-pulse">
                  {scanStatusText}
                </p>
              </div>

              <div className="w-48 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-progress" />
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & CONFIRM TABLE */}
          {step === 'review' && (
            <div className="space-y-5">
              {/* Document Header Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                    <Hash className="w-3.5 h-3.5 text-blue-500" />
                    เลขที่เอกสาร / DO No.
                  </label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder="เช่น DO-660421"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    วันที่เอกสาร
                  </label>
                  <input
                    type="text"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    placeholder="เช่น 14/10/2026"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                    ซัพพลายเออร์ / ร้านค้า
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="เช่น บริษัท สหอะไหล่ จำกัด"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
                    เลขที่ใบสั่งซื้อ PO อ้างอิง
                  </label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="เช่น PO-2026-001 (ถ้ามี)"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-blue-500"
                  />
                </div>
              </div>

              {/* Items Section Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-blue-600" />
                    รายการที่ตรวจพบจากเอกสาร ({items.length} รายการ)
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    เลือกรับเข้า {selectedItems.length} รายการ ({totalUnits} ชิ้น)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {items.every(i => i.selected) ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    สแกนใหม่
                  </button>
                </div>
              </div>

              {/* Items List / Table */}
              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border border-dashed rounded-2xl">
                    ไม่พบรายการสินค้าที่ระบุในเอกสาร
                  </div>
                ) : (
                  items.map((item, idx) => {
                    const invItem = item.matchedItemId ? inventoryItems.find(i => i.id === item.matchedItemId) : null;
                    const prevQty = invItem?.qty ?? 0;
                    const nextQty = prevQty + item.quantity;
                    const isMatched = Boolean(item.matchedItemId);

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                          item.selected
                            ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60 shadow-xs'
                            : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/10 opacity-70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          {/* Left: Checkbox + Name */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleItemSelect(idx)}
                              disabled={!isMatched}
                              className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                              title={!isMatched ? "กรุณาจับคู่กับสินค้าในระบบก่อนเลือกรับเข้า" : "เลือกรับเข้ารายการนี้"}
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                                <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {item.rawName}
                                </h5>
                                {item.partCode && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    Part: {item.partCode}
                                  </span>
                                )}
                              </div>

                              {/* Matching Status & Selection */}
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                {isMatched ? (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="font-bold">จับคู่สำเร็จ:</span>
                                    <span className="font-semibold">{item.matchedItemName} ({item.matchedItemId})</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveItemSearchIndex(idx);
                                        setCatalogSearchTerm('');
                                      }}
                                      className="ml-1 text-[11px] underline text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 cursor-pointer font-bold"
                                    >
                                      เปลี่ยน
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      ยังไม่ได้จับคู่กับสต็อก
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveItemSearchIndex(idx);
                                        setCatalogSearchTerm('');
                                      }}
                                      className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow-xs active:scale-95 transition-all cursor-pointer"
                                    >
                                      ค้นหาและจับคู่
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Quantity & Stock Impact */}
                          <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                            {/* Stock Preview */}
                            {isMatched && (
                              <div className="text-right text-xs">
                                <span className="text-slate-400 block text-[10px]">สต็อกในระบบ</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                  {prevQty} → <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{nextQty}</span> {item.unit}
                                </span>
                              </div>
                            )}

                            {/* Quantity Stepper */}
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl p-1 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleItemQtyChange(idx, item.quantity - 1)}
                                className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-90"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => handleItemQtyChange(idx, parseInt(e.target.value) || 1)}
                                className="w-12 text-center text-xs sm:text-sm font-black text-slate-900 dark:text-white bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleItemQtyChange(idx, item.quantity + 1)}
                                className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-90"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <span className="text-xs font-semibold text-slate-500 w-8">
                              {item.unit}
                            </span>
                          </div>
                        </div>

                        {/* Search Picker Drawer for this item */}
                        {activeItemSearchIndex === idx && (
                          <div className="mt-3.5 pt-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-slate-900/50 p-3 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                เลือกสินค้าในคลังที่ตรงกับ: "{item.rawName}"
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveItemSearchIndex(null)}
                                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white"
                              >
                                ปิด
                              </button>
                            </div>

                            {/* Search bar */}
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                              <input
                                type="text"
                                value={catalogSearchTerm}
                                onChange={(e) => setCatalogSearchTerm(e.target.value)}
                                placeholder="พิมพ์รหัสหรือชื่ออะไหล่ในคลัง..."
                                autoFocus
                                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-800 text-xs font-semibold focus:outline-blue-500"
                              />
                            </div>

                            {/* Item options */}
                            <div className="max-h-48 overflow-y-auto divide-y divide-slate-200/50 dark:divide-white/5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10">
                              {filteredCatalogItems.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400">
                                  ไม่พบสินค้าที่ตรงกับคำค้นหา
                                </div>
                              ) : (
                                filteredCatalogItems.map((inv) => (
                                  <button
                                    key={inv.id}
                                    type="button"
                                    onClick={() => handleSelectInventoryItem(idx, inv)}
                                    className="w-full text-left p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                                  >
                                    <div>
                                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                                        {inv.name}
                                      </span>
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                        รหัส: {inv.id} • หมวด: {inv.category} • ตำแหน่ง: {inv.location || 'Store FL.6'}
                                      </span>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                                        คงเหลือ: {inv.qty} {inv.unit}
                                      </span>
                                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                        เลือกรายการนี้
                                      </span>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Submitting Details */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    👤 ผู้รับเข้าคลัง
                  </label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    📝 วัตถุประสงค์ / งานที่นำเข้า
                  </label>
                  <input
                    type="text"
                    value={purposeNote}
                    onChange={(e) => setPurposeNote(e.target.value)}
                    placeholder="เช่น รับสินค้าเข้าตามใบส่งของ"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-slate-50/80 dark:bg-white/[0.02]">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {step === 'review' ? (
              <span>
                พร้อมรับเข้า: <strong className="text-slate-900 dark:text-white">{selectedItems.length}</strong> รายการ | รวม <strong className="text-blue-600 dark:text-blue-400">{totalUnits}</strong> ชิ้น
              </span>
            ) : (
              <span>รองรับไฟล์ภาพจากมือถือ แท็บเล็ต และคอมพิวเตอร์</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs sm:text-sm hover:bg-white dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              ยกเลิก
            </button>

            {step === 'review' && (
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting || selectedItems.length === 0}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังบันทึกรับเข้าคลัง...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ยืนยันรับเข้าคลัง ({selectedItems.length} รายการ)
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
