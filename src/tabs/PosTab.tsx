import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, Search, Trash2, Minus, Plus, Printer, Share2, Package, Tag, Store, Repeat, CheckCircle, Building2, ShoppingCart, BookOpen, X, Pencil } from 'lucide-react';
import BarcodeScanner from '../components/BarcodeScanner';
import { DB } from '../lib/db';
import { Product, Settings, Transaction, DebtRecord } from '../lib/types';
import { useToast } from '../components/Toast';
import { formatCurrencySYP, formatCurrencyUSD, formatDate } from '../lib/utils';
import html2canvas from 'html2canvas';

interface PosTabProps {
  setCartCount: (count: number) => void;
}

interface CartItem extends Product {
  cart_qty: number;
  sale_currency: 'SYP' | 'USD';
  custom_price?: number; // سعر معدّل اختياري
}

// ============================================================
// Modal تعديل السعر والعملة لعنصر في السلة
// ============================================================
interface EditItemModalProps {
  item: CartItem;
  exchangeRate: number;
  onSave: (id: string, currency: 'SYP' | 'USD', customPrice: number | undefined) => void;
  onClose: () => void;
}

function EditItemModal({ item, exchangeRate, onSave, onClose }: EditItemModalProps) {
  const [currency, setCurrency] = useState<'SYP' | 'USD'>(item.sale_currency);
  const [useCustom, setUseCustom] = useState(item.custom_price !== undefined);
  const [priceInput, setPriceInput] = useState(() => {
    if (item.custom_price !== undefined) {
      return String(item.custom_price);
    }
    return currency === 'SYP'
      ? String(Math.round(item.price_usd * exchangeRate))
      : String(item.price_usd);
  });

  // عند تغيير العملة نحوّل السعر تلقائياً
  const handleCurrencyChange = (c: 'SYP' | 'USD') => {
    if (useCustom && priceInput) {
      const val = parseFloat(priceInput);
      if (!isNaN(val)) {
        if (c === 'USD' && currency === 'SYP') {
          setPriceInput(String(+(val / exchangeRate).toFixed(4)));
        } else if (c === 'SYP' && currency === 'USD') {
          setPriceInput(String(Math.round(val * exchangeRate)));
        }
      }
    } else {
      // اعرض السعر الافتراضي للعملة الجديدة
      setPriceInput(c === 'SYP'
        ? String(Math.round(item.price_usd * exchangeRate))
        : String(item.price_usd));
    }
    setCurrency(c);
  };

  const handleSave = () => {
    let finalPrice: number | undefined = undefined;
    if (useCustom && priceInput) {
      const val = parseFloat(priceInput);
      if (!isNaN(val) && val > 0) finalPrice = val;
    }
    onSave(item.id, currency, finalPrice);
    onClose();
  };

  const defaultPrice = currency === 'SYP'
    ? Math.round(item.price_usd * exchangeRate)
    : item.price_usd;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white w-full max-w-[320px] rounded-2xl shadow-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
            <Pencil size={15} className="text-primary" /> تعديل المنتج
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"><X size={17} /></button>
        </div>

        <div className="text-xs font-bold text-gray-700 bg-gray-50 rounded-lg px-3 py-2 mb-4 truncate">{item.name}</div>

        {/* اختيار العملة */}
        <div className="mb-4">
          <label className="text-xs font-bold text-gray-500 mb-2 block">عملة البيع</label>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => handleCurrencyChange('SYP')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${currency === 'SYP' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🇸🇾 ليرة سورية
            </button>
            <button
              onClick={() => handleCurrencyChange('USD')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${currency === 'USD' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🇺🇸 دولار
            </button>
          </div>
        </div>

        {/* تعديل السعر */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-gray-500">السعر</label>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400">تعديل يدوي</span>
              <button
                onClick={() => {
                  setUseCustom(!useCustom);
                  if (!useCustom) {
                    setPriceInput(String(defaultPrice));
                  }
                }}
                className={`w-9 h-5 rounded-full transition-all relative ${useCustom ? 'bg-primary' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${useCustom ? 'left-4.5 right-0.5' : 'left-0.5'}`} style={{ left: useCustom ? '18px' : '2px' }} />
              </button>
            </div>
          </div>

          {useCustom ? (
            <div className="relative">
              <input
                type="number"
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                className="w-full h-10 px-3 pl-12 rounded-xl border-2 border-primary focus:ring-1 focus:ring-primary outline-none text-sm font-bold"
                placeholder={String(defaultPrice)}
                autoFocus
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                {currency === 'SYP' ? 'ل.س' : '$'}
              </span>
            </div>
          ) : (
            <div className="h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">
                {currency === 'SYP'
                  ? `${Math.round(item.price_usd * exchangeRate).toLocaleString('en-US')} ل.س`
                  : `$${item.price_usd}`}
              </span>
              <span className="text-[10px] text-gray-400">السعر الأصلي</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl">إلغاء</button>
          <button onClick={handleSave} className="flex-1 h-10 bg-primary text-white font-bold text-sm rounded-xl shadow">حفظ</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal تأكيد الدفع مع تفصيل المبالغ المستلمة
// ============================================================
interface CheckoutModalProps {
  totalSYP: number;
  totalUSD: number;
  hasSYP: boolean;
  hasUSD: boolean;
  onConfirm: (receivedSYP: number, receivedUSD: number) => void;
  onClose: () => void;
  loading: boolean;
}

function CheckoutModal({ totalSYP, totalUSD, hasSYP, hasUSD, onConfirm, onClose, loading }: CheckoutModalProps) {
  const [recSYP, setRecSYP] = useState(hasSYP ? String(Math.round(totalSYP)) : '');
  const [recUSD, setRecUSD] = useState(hasUSD ? String(totalUSD) : '');

  const handleConfirm = () => {
    const syp = parseFloat(recSYP) || 0;
    const usd = parseFloat(recUSD) || 0;
    onConfirm(syp, usd);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-base text-gray-800 flex items-center gap-1.5">
            <CheckCircle size={18} className="text-success" /> تأكيد الدفع
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"><X size={18} /></button>
        </div>

        {/* ملخص الفاتورة */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <div className="text-xs font-bold text-gray-500 mb-1.5">المبلغ المطلوب</div>
          {hasSYP && (
            <div className="flex justify-between text-sm font-bold">
              <span className="text-gray-600">ل.س</span>
              <span className="text-green-700">{formatCurrencySYP(totalSYP)}</span>
            </div>
          )}
          {hasUSD && (
            <div className="flex justify-between text-sm font-bold mt-0.5">
              <span className="text-gray-600">$</span>
              <span className="text-blue-700">{formatCurrencyUSD(totalUSD)}</span>
            </div>
          )}
        </div>

        {/* حقول المبالغ المستلمة */}
        <div className="mb-1">
          <div className="text-xs font-bold text-gray-500 mb-2">ما استلمته من الزبون <span className="text-gray-400 font-normal">(اختياري)</span></div>
          <div className="flex flex-col gap-2.5">
            <div>
              <label className="text-[11px] font-bold text-green-700 mb-1 block flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> المبلغ بالليرة السورية
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={recSYP}
                  onChange={e => setRecSYP(e.target.value)}
                  placeholder="0"
                  className="w-full h-10 px-3 pl-12 rounded-xl border border-gray-200 focus:border-green-400 focus:ring-1 focus:ring-green-300 outline-none text-sm font-bold"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">ل.س</span>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-blue-700 mb-1 block flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" /> المبلغ بالدولار
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={recUSD}
                  onChange={e => setRecUSD(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 px-3 pl-8 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-300 outline-none text-sm font-bold"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">$</span>
              </div>
            </div>
          </div>
        </div>

        {/* ملاحظة */}
        {(parseFloat(recSYP) > 0 || parseFloat(recUSD) > 0) && (
          <div className="mt-3 bg-blue-50 rounded-xl p-2.5 text-[11px] text-blue-700 font-medium">
            {parseFloat(recSYP) > 0 && <div>🟢 {formatCurrencySYP(parseFloat(recSYP))} → الصندوق السوري</div>}
            {parseFloat(recUSD) > 0 && <div className="mt-0.5">🔵 {formatCurrencyUSD(parseFloat(recUSD))} → الصندوق الدولاري</div>}
          </div>
        )}

        {(parseFloat(recSYP) === 0 && parseFloat(recUSD) === 0 && recSYP === '' && recUSD === '') && (
          <div className="mt-3 bg-gray-50 rounded-xl p-2.5 text-[11px] text-gray-500">
            إذا تركتهما فارغَين، سيُسجّل المبلغ حسب عملة كل منتج تلقائياً
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 h-11 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl">إلغاء</button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 h-11 bg-primary text-white font-bold text-sm rounded-xl shadow-md disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {loading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><CheckCircle size={16} /> إتمام البيع</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PosTab
// ============================================================
export default function PosTab({ setCartCount }: PosTabProps) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [pulsingProductId, setPulsingProductId] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // تعديل عنصر
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  // modal تأكيد الدفع
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // دين
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtCustomerName, setDebtCustomerName] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [savingDebt, setSavingDebt] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);
  const hiddenReceiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [prods, sett] = await Promise.all([DB.getProducts(), DB.getSettings()]);
    setProducts(prods);
    setSettings(sett);
    setLoading(false);
  };

  useEffect(() => {
    const totalItems = cart.reduce((sum, item) => sum + item.cart_qty, 0);
    setCartCount(totalItems);
  }, [cart, setCartCount]);

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery)
    );
  }, [products, searchQuery]);

  const handleScan = (code: string) => {
    setSearchQuery(code);
    const matchedProduct = products.find(p => p.barcode === code);
    if (matchedProduct) {
      setPulsingProductId(matchedProduct.id);
      setTimeout(() => setPulsingProductId(null), 1500);
      showToast('تم العثور على المنتج', 'success');
    } else {
      showToast('المنتج غير موجود', 'error');
    }
  };

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.cart_qty >= product.quantity) {
          showToast(`يوجد ${product.quantity} قطعة فقط متوفرة`, 'error');
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, cart_qty: item.cart_qty + 1 } : item);
      }
      return [...prev, { ...product, cart_qty: 1, sale_currency: 'SYP', custom_price: undefined }];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newQty = item.cart_qty + delta;
          if (newQty > item.quantity) { showToast(`يوجد ${item.quantity} قطعة فقط متوفرة`, 'error'); return item; }
          if (newQty <= 0) return { ...item, cart_qty: 0 };
          return { ...item, cart_qty: newQty };
        }
        return item;
      }).filter(item => item.cart_qty > 0)
    );
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

  const saveItemEdit = (id: string, currency: 'SYP' | 'USD', customPrice: number | undefined) => {
    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, sale_currency: currency, custom_price: customPrice } : item
    ));
  };

  const rate = settings?.exchange_rate || 1600;

  // دالة حساب سعر العنصر الواحد (وحدة) حسب عملته وأي سعر معدّل
  const getItemUnitPrice = (item: CartItem): { price_syp: number; price_usd: number } => {
    if (item.custom_price !== undefined) {
      if (item.sale_currency === 'SYP') {
        return { price_syp: item.custom_price, price_usd: item.custom_price / rate };
      } else {
        return { price_syp: item.custom_price * rate, price_usd: item.custom_price };
      }
    }
    return { price_syp: item.price_usd * rate, price_usd: item.price_usd };
  };

  // إجماليات السلة
  const cartTotals = useMemo(() => {
    let totalSYP = 0;
    let totalUSD = 0;
    cart.forEach(item => {
      const { price_syp, price_usd } = getItemUnitPrice(item);
      if (item.sale_currency === 'SYP') totalSYP += price_syp * item.cart_qty;
      else totalUSD += price_usd * item.cart_qty;
    });
    return { totalSYP, totalUSD };
  }, [cart, rate]);

  const cartHasSYP = cart.some(i => i.sale_currency === 'SYP');
  const cartHasUSD = cart.some(i => i.sale_currency === 'USD');

  // بناء بنود الفاتورة
  const buildTransactionItems = () => {
    let totalProfitUSD = 0;
    let totalProfitSYP = 0;
    let auto_cash_syp = 0;
    let auto_cash_usd = 0;

    const items = cart.map(item => {
      const { price_syp, price_usd } = getItemUnitPrice(item);
      const profit_usd_per_item = price_usd - item.cost_usd;
      const profit_syp_per_item = price_syp - (item.cost_usd * rate);
      totalProfitUSD += profit_usd_per_item * item.cart_qty;
      totalProfitSYP += profit_syp_per_item * item.cart_qty;

      if (item.sale_currency === 'SYP') auto_cash_syp += price_syp * item.cart_qty;
      else auto_cash_usd += price_usd * item.cart_qty;

      return {
        product_id: item.id,
        name: item.name,
        qty: item.cart_qty,
        cost_usd: item.cost_usd,
        price_usd,
        price_syp,
        subtotal_syp: price_syp * item.cart_qty,
        subtotal_usd: price_usd * item.cart_qty,
        currency: item.sale_currency,
      };
    });

    return { items, totalProfitUSD, totalProfitSYP, auto_cash_syp, auto_cash_usd };
  };

  // التحقق من الكميات
  const validateCart = (): boolean => {
    for (const item of cart) {
      const dbProduct = products.find(p => p.id === item.id);
      if (!dbProduct || dbProduct.quantity < item.cart_qty) {
        showToast(`الكمية غير متوفرة لمنتج ${item.name}`, 'error');
        return false;
      }
    }
    return true;
  };

  // عند ضغط "إتمام الدفع" — افتح modal التأكيد
  const handleCheckoutClick = () => {
    if (!settings || cart.length === 0) return;
    if (!validateCart()) return;
    setShowCheckoutModal(true);
  };

  // تنفيذ الدفع الفعلي بعد تأكيد المبالغ
  const handleCheckoutConfirm = async (receivedSYP: number, receivedUSD: number) => {
    if (!settings) return;
    setCheckingOut(true);

    const txnCount = await DB.getTransactionCount();
    const invoiceNumber = String(txnCount + 1).padStart(5, '0');
    const { items: transactionItems, totalProfitUSD, totalProfitSYP, auto_cash_syp, auto_cash_usd } = buildTransactionItems();

    // استخدم المبالغ المدخلة إذا وُجدت، وإلا استخدم الحسابات التلقائية
    const final_cash_syp = receivedSYP > 0 ? receivedSYP : auto_cash_syp;
    const final_cash_usd = receivedUSD > 0 ? receivedUSD : auto_cash_usd;

    const newTransaction: Transaction = {
      id: 'txn_' + Date.now(),
      invoice_number: invoiceNumber,
      timestamp: new Date().toISOString(),
      items: transactionItems,
      total_usd: cartTotals.totalUSD,
      total_syp: cartTotals.totalSYP,
      profit_usd: totalProfitUSD,
      profit_syp: totalProfitSYP,
      exchange_rate_at_sale: rate,
      cash_syp: final_cash_syp,
      cash_usd: final_cash_usd,
    };

    const saved = await DB.saveTransaction(newTransaction);
    if (!saved) {
      showToast('حدث خطأ أثناء حفظ الفاتورة', 'error');
      setCheckingOut(false);
      return;
    }

    await DB.decrementQuantities(cart.map(c => ({ id: c.id, qty: c.cart_qty })));
    setProducts(products.map(p => {
      const ci = cart.find(c => c.id === p.id);
      return ci ? { ...p, quantity: p.quantity - ci.cart_qty } : p;
    }));

    setLastTransaction(newTransaction);
    setCart([]);
    setShowCheckoutModal(false);
    setIsReceiptModalOpen(true);
    showToast('تم إتمام البيع بنجاح', 'success');
    setCheckingOut(false);
  };

  const handleSellAsDebt = async () => {
    if (!debtCustomerName.trim()) { showToast('يرجى إدخال اسم العميل', 'error'); return; }
    if (!settings || cart.length === 0) return;
    if (!validateCart()) return;

    setSavingDebt(true);
    const txnCount = await DB.getTransactionCount();
    const invoiceNumber = 'D' + String(txnCount + 1).padStart(5, '0');
    const { items: transactionItems } = buildTransactionItems();

    const debtRecord: DebtRecord = {
      id: 'debt_' + Date.now(),
      invoice_number: invoiceNumber,
      customer_name: debtCustomerName.trim(),
      note: debtNote.trim() || undefined,
      timestamp: new Date().toISOString(),
      items: transactionItems,
      total_syp: cartTotals.totalSYP,
      total_usd: cartTotals.totalUSD,
      paid_syp: 0, paid_usd: 0,
      status: 'unpaid',
    };

    const saved = await DB.saveDebtRecord(debtRecord);
    if (!saved) { showToast('حدث خطأ أثناء حفظ الدين', 'error'); setSavingDebt(false); return; }

    await DB.decrementQuantities(cart.map(c => ({ id: c.id, qty: c.cart_qty })));
    setProducts(products.map(p => {
      const ci = cart.find(c => c.id === p.id);
      return ci ? { ...p, quantity: p.quantity - ci.cart_qty } : p;
    }));

    setCart([]);
    setIsDebtModalOpen(false);
    setDebtCustomerName('');
    setDebtNote('');
    showToast(`تم تسجيل الدين للعميل ${debtRecord.customer_name}`, 'success');
    setSavingDebt(false);
  };

  const printReceipt = () => window.print();

  const shareReceipt = async () => {
    if (!hiddenReceiptRef.current) return;
    try {
      showToast('جاري تحضير الفاتورة...', 'info');
      const canvas = await html2canvas(hiddenReceiptRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        foreignObjectRendering: false, logging: false, allowTaint: true,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) { showToast('حدث خطأ', 'error'); return; }
        const filename = `invoice_${lastTransaction?.invoice_number}.png`;
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'فاتورة المبيعات' }); showToast('تمت المشاركة', 'success'); }
          catch { downloadBlob(blob, filename); }
        } else { downloadBlob(blob, filename); }
      }, 'image/png', 0.95);
    } catch { showToast('حدث خطأ أثناء المشاركة', 'error'); }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast('تم تحميل الفاتورة', 'success');
  };

  const ReceiptContent = ({ txn }: { txn: Transaction }) => (
    <div className="bg-white w-full p-5">
      <div className="text-center mb-4">
        <div className="flex justify-center mb-1"><Building2 size={24} className="text-gray-800" /></div>
        <h2 className="text-lg font-bold text-gray-900">{settings?.company_name}</h2>
        <div className="text-gray-500 text-xs font-semibold">فاتورة مبيعات</div>
        <div className="mt-3 border-t border-dashed border-gray-300 pt-3 flex justify-between text-[11px] text-gray-600 font-medium">
          <span>رقم: {txn.invoice_number}</span>
          <span dir="ltr">{formatDate(txn.timestamp)}</span>
        </div>
      </div>
      <table className="w-full text-right text-xs mb-3">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-1.5 font-semibold">المنتج</th>
            <th className="py-1.5 font-semibold text-center w-10">الكمية</th>
            <th className="py-1.5 font-semibold">المجموع</th>
          </tr>
        </thead>
        <tbody>
          {txn.items.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-100 last:border-0">
              <td className="py-2 text-gray-800 font-semibold">{item.name}</td>
              <td className="py-2 text-center font-bold text-gray-600">{item.qty}</td>
              <td className="py-2 font-bold text-primary">
                {item.currency === 'USD'
                  ? formatCurrencyUSD(item.subtotal_usd)
                  : item.subtotal_syp.toLocaleString('en-US') + ' ل.س'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-gray-300 pt-3">
        {txn.cash_syp > 0 && (
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs text-gray-500 font-semibold">إجمالي ل.س</div>
            <div className="text-sm font-bold text-gray-900">{formatCurrencySYP(txn.cash_syp)}</div>
          </div>
        )}
        {txn.cash_usd > 0 && (
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs text-gray-500 font-semibold">إجمالي $</div>
            <div className="text-sm font-bold text-gray-900">{formatCurrencyUSD(txn.cash_usd)}</div>
          </div>
        )}
        <div className="flex justify-between items-center text-[10px] text-gray-400 mt-1">
          <span>سعر الصرف: {txn.exchange_rate_at_sale.toLocaleString('en-US')}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col relative h-full">
      {/* HEADER */}
      <div className="bg-white rounded-xl px-3 py-2.5 flex justify-between items-center z-10 shadow-sm border border-gray-100 mb-3 print:hidden">
        <div className="bg-gray-50 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-gray-100">
          <Repeat size={12} className="text-primary" />
          <span>{settings?.exchange_rate.toLocaleString('en-US')} ل.س/$</span>
        </div>
        <h1 className="text-base font-bold text-primary flex items-center gap-1.5">
          <Store size={18} /> وتين تك
        </h1>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col gap-3 pb-32 print:hidden">
        {/* SEARCH */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text" placeholder="ابحث..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-3 pr-9 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all shadow-sm"
            />
          </div>
          <button onClick={() => setShowScanner(true)}
            className="h-10 px-3 rounded-xl border border-primary text-primary flex items-center gap-1.5 font-bold hover:bg-primary-light transition-colors bg-white shadow-sm">
            <Camera size={16} /><span className="text-sm">مسح</span>
          </button>
        </div>

        {/* PRODUCTS GRID */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold">جاري التحميل...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {filteredProducts.map(product => {
              const outOfStock = product.quantity <= 0;
              const pulsing = pulsingProductId === product.id;
              return (
                <div key={product.id} onClick={() => addToCart(product)}
                  className={`bg-white rounded-xl p-3 shadow-sm border cursor-pointer relative overflow-hidden transition-all duration-200
                    ${outOfStock ? 'opacity-50 grayscale pointer-events-none border-gray-200' : 'border-transparent hover:border-primary hover:shadow'}
                    ${pulsing ? 'animate-pulse ring-2 ring-primary ring-offset-1' : ''}`}>
                  <div className={`absolute top-0 right-0 rounded-bl-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-sm
                    ${outOfStock ? 'bg-gray-400' : product.quantity <= 5 ? 'bg-warning' : 'bg-success'}`}>
                    الكمية: {product.quantity}
                  </div>
                  <div className="mt-4 mb-2">
                    <h3 className="font-semibold text-gray-800 line-clamp-2 text-xs leading-tight min-h-[34px] flex items-start gap-1">
                      <Tag size={12} className="shrink-0 mt-0.5 text-gray-400" />{product.name}
                    </h3>
                  </div>
                  <div className="mt-auto pt-1">
                    <div className="text-sm font-bold text-primary">{formatCurrencySYP(product.price_usd * rate)}</div>
                    <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{formatCurrencyUSD(product.price_usd)}</div>
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-8 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Package size={32} className="opacity-30" />
                <p className="text-sm font-medium">لا يوجد منتجات</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======== CART PANEL ======== */}
      <div className={`fixed bottom-[60px] left-0 w-full bg-white rounded-t-2xl shadow-[0_-5px_20px_rgba(0,0,0,0.08)] transition-transform duration-300 z-30 flex flex-col p-4 max-h-[65vh] border-t border-gray-100 ${cart.length > 0 ? 'translate-y-0' : 'translate-y-[120%]'}`}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />

        <div className="flex justify-between items-center mb-3 shrink-0">
          <h2 className="font-bold text-base text-gray-800 flex items-center gap-1.5">
            <ShoppingCart size={18} className="text-primary" /> السلة
          </h2>
          <button onClick={() => setCart([])} className="text-danger flex items-center gap-1 text-xs font-bold bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors">
            <Trash2 size={14} /> مسح
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-2 min-h-[80px]">
          {cart.map(item => {
            const { price_syp, price_usd } = getItemUnitPrice(item);
            const lineTotal = item.sale_currency === 'SYP'
              ? formatCurrencySYP(price_syp * item.cart_qty)
              : formatCurrencyUSD(price_usd * item.cart_qty);
            const hasCustom = item.custom_price !== undefined;

            return (
              <div key={item.id} className="py-2.5 border-b border-gray-50 last:border-0">
                {/* الصف الأول: اسم + شارة العملة + زر تعديل */}
                <div className="flex items-center gap-2 mb-1.5">
                  <h4 className="font-bold text-gray-800 text-xs truncate flex-1 min-w-0">{item.name}</h4>
                  {/* شارة العملة (قراءة فقط، الضغط يفتح التعديل) */}
                  <span
                    onClick={() => setEditingItem(item)}
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer transition-all ${
                      item.sale_currency === 'SYP'
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    {item.sale_currency === 'SYP' ? 'ل.س' : '$'}
                  </span>
                  {/* زر التعديل */}
                  <button
                    onClick={() => setEditingItem(item)}
                    className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                      hasCustom
                        ? 'bg-orange-100 text-orange-600 border border-orange-200'
                        : 'bg-gray-50 text-gray-400 hover:bg-primary-light hover:text-primary border border-gray-100'
                    }`}
                    title="تعديل السعر والعملة"
                  >
                    <Pencil size={11} />
                  </button>
                </div>

                {/* السعر المعدّل — نشير إليه إذا كان مختلفاً */}
                {hasCustom && (
                  <div className="text-[10px] text-orange-600 font-bold mb-1 flex items-center gap-1">
                    <span>✏️ سعر معدّل:</span>
                    <span>{item.sale_currency === 'SYP' ? `${item.custom_price?.toLocaleString('en-US')} ل.س` : `$${item.custom_price}`}</span>
                  </div>
                )}

                {/* الصف الثاني: الإجمالي + أزرار الكمية + حذف */}
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-xs text-primary">{lineTotal}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-gray-50 px-1.5 py-1 rounded-lg border border-gray-100">
                      <button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 rounded-md bg-white text-primary shadow-sm flex items-center justify-center border border-gray-200">
                        <Minus size={13} />
                      </button>
                      <span className="font-bold text-xs w-4 text-center">{item.cart_qty}</span>
                      <button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 rounded-md bg-primary text-white shadow-sm flex items-center justify-center">
                        <Plus size={13} />
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-danger bg-gray-50 p-1.5 rounded-md">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* الإجماليات والأزرار */}
        <div className="border-t border-gray-100 pt-3 flex flex-col gap-2 shrink-0 bg-white">
          <div className="flex flex-col gap-1">
            {cartHasSYP && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs font-bold">الإجمالي ل.س</span>
                <span className="text-sm font-bold text-green-700">{formatCurrencySYP(cartTotals.totalSYP)}</span>
              </div>
            )}
            {cartHasUSD && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-xs font-bold">الإجمالي $</span>
                <span className="text-sm font-bold text-blue-700">{formatCurrencyUSD(cartTotals.totalUSD)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-1">
            <button
              onClick={handleCheckoutClick}
              disabled={checkingOut}
              className="flex-1 h-11 bg-primary text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-1.5 hover:bg-primary-dark transition-all disabled:opacity-60"
            >
              <CheckCircle size={16} /> إتمام الدفع
            </button>
            <button
              onClick={() => setIsDebtModalOpen(true)}
              disabled={checkingOut}
              className="flex-1 h-11 bg-amber-500 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-1.5 hover:bg-amber-600 transition-all disabled:opacity-60"
            >
              <BookOpen size={16} /> بيع كدين
            </button>
          </div>
        </div>
      </div>

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {/* EDIT ITEM MODAL */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          exchangeRate={rate}
          onSave={saveItemEdit}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* CHECKOUT CONFIRM MODAL */}
      {showCheckoutModal && (
        <CheckoutModal
          totalSYP={cartTotals.totalSYP}
          totalUSD={cartTotals.totalUSD}
          hasSYP={cartHasSYP}
          hasUSD={cartHasUSD}
          onConfirm={handleCheckoutConfirm}
          onClose={() => setShowCheckoutModal(false)}
          loading={checkingOut}
        />
      )}

      {/* DEBT MODAL */}
      {isDebtModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-gray-800 flex items-center gap-1.5">
                <BookOpen size={18} className="text-amber-500" /> بيع كدين
              </h3>
              <button onClick={() => setIsDebtModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">اسم العميل *</label>
                <input type="text" value={debtCustomerName} onChange={e => setDebtCustomerName(e.target.value)}
                  placeholder="أدخل اسم العميل..." className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-300 outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">ملاحظة (اختياري)</label>
                <input type="text" value={debtNote} onChange={e => setDebtNote(e.target.value)}
                  placeholder="ملاحظة..." className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-300 outline-none text-sm" />
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 font-medium">
                {cartHasSYP && <div>المبلغ ل.س: {formatCurrencySYP(cartTotals.totalSYP)}</div>}
                {cartHasUSD && <div>المبلغ $: {formatCurrencyUSD(cartTotals.totalUSD)}</div>}
                <div className="mt-1 text-amber-600 text-[11px]">⚠️ لن يُضاف للصندوق حتى يتم السداد</div>
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setIsDebtModalOpen(false)} className="flex-1 h-10 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl">إلغاء</button>
                <button onClick={handleSellAsDebt} disabled={savingDebt || !debtCustomerName.trim()}
                  className="flex-1 h-10 bg-amber-500 text-white font-bold text-sm rounded-xl shadow disabled:opacity-60 flex items-center justify-center gap-1.5">
                  {savingDebt ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'تأكيد الدين'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {isReceiptModalOpen && lastTransaction && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 p-4 print:hidden">
          <div ref={receiptRef} className="bg-white w-full max-w-[340px] rounded-xl shadow-lg overflow-hidden">
            <ReceiptContent txn={lastTransaction} />
          </div>
          <div className="w-full max-w-[340px] mt-4 flex gap-2">
            <button onClick={printReceipt} className="flex-1 bg-white text-gray-700 font-bold h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm">
              <Printer size={16} /> طباعة
            </button>
            <button onClick={shareReceipt} className="flex-1 bg-success text-white font-bold h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm">
              <Share2 size={16} /> مشاركة
            </button>
            <button onClick={() => setIsReceiptModalOpen(false)} className="flex-none px-4 bg-gray-800 text-white font-bold h-10 rounded-lg text-sm">إغلاق</button>
          </div>
        </div>
      )}

      {/* Hidden receipt for sharing */}
      {lastTransaction && (
        <div ref={hiddenReceiptRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '340px', zIndex: -1 }} dir="rtl">
          <ReceiptContent txn={lastTransaction} />
        </div>
      )}

      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 80mm !important; margin: 0 !important; padding: 2mm !important; font-size: 11px !important; color: #000 !important; background: #fff !important; }
        }
      `}} />

      {lastTransaction && (
        <div id="print-area" className="hidden print:block w-[80mm]" dir="rtl">
          <div className="text-center font-bold text-sm mb-1">{settings?.company_name}</div>
          <div className="text-center text-[10px] mb-2 border-b border-black pb-1">فاتورة مبيعات</div>
          <div className="text-[10px] flex justify-between mb-2 font-mono">
            <span>#{lastTransaction.invoice_number}</span>
            <span dir="ltr">{formatDate(lastTransaction.timestamp)}</span>
          </div>
          <table className="w-full text-right text-[10px] mb-2">
            <thead><tr className="border-b border-black font-bold"><th className="py-1">الصنف</th><th className="py-1 text-center">الكمية</th><th className="py-1">المجموع</th></tr></thead>
            <tbody>
              {lastTransaction.items.map((i, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-1 truncate max-w-[90px]">{i.name}</td>
                  <td className="py-1 text-center">{i.qty}</td>
                  <td className="py-1 font-bold">{i.currency === 'USD' ? `$${i.subtotal_usd.toFixed(2)}` : `${i.subtotal_syp.toLocaleString('en-US')} ل.س`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lastTransaction.cash_syp > 0 && (
            <div className="flex justify-between border-t border-black pt-1 mb-0.5 font-bold text-[11px]">
              <span>الإجمالي ل.س:</span><span>{lastTransaction.cash_syp.toLocaleString('en-US')} ل.س</span>
            </div>
          )}
          {lastTransaction.cash_usd > 0 && (
            <div className="flex justify-between pt-0.5 mb-1 font-bold text-[11px]">
              <span>الإجمالي $:</span><span>${lastTransaction.cash_usd.toFixed(2)}</span>
            </div>
          )}
          <div className="text-center mt-3 text-[10px]">شكراً لزيارتكم</div>
        </div>
      )}
    </div>
  );
}
