import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart3, Calendar, ChevronDown, ChevronUp, TrendingUp, PackageSearch, ListOrdered, Landmark, DollarSign, ArrowDownCircle, FileText, X, Printer, Share2, Building2 } from 'lucide-react';
import { DB } from '../lib/db';
import { Transaction, Product, CashBoxState } from '../lib/types';
import { formatCurrencySYP, formatCurrencyUSD, formatDate } from '../lib/utils';
import { useToast } from '../components/Toast';
import { isToday, isThisWeek, isThisMonth, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Settings } from '../lib/types';
import html2canvas from 'html2canvas';

type FilterType = 'today' | 'week' | 'month' | 'custom';

export default function DashboardTab() {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cashBox, setCashBox] = useState<CashBoxState>({ balance_syp: 0, balance_usd: 0 });
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState<FilterType>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // سحب من الصندوق
  const [withdrawCurrency, setWithdrawCurrency] = useState<'SYP' | 'USD'>('SYP');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // سحب الأرباح
  const [profitWithdrawCurrency, setProfitWithdrawCurrency] = useState<'SYP' | 'USD'>('SYP');
  const [withdrawingProfit, setWithdrawingProfit] = useState(false);

  // عرض الفاتورة
  const [receiptTxn, setReceiptTxn] = useState<Transaction | null>(null);
  const hiddenReceiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [txns, prods, sett, cb] = await Promise.all([
      DB.getTransactions(),
      DB.getProducts(),
      DB.getSettings(),
      DB.getCashBoxState(),
    ]);
    setTransactions(txns);
    setProducts(prods);
    setSettings(sett);
    setCashBox(cb);
    setLoading(false);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(txn => {
      const date = parseISO(txn.timestamp);
      switch (filterType) {
        case 'today': return isToday(date);
        case 'week': return isThisWeek(date, { weekStartsOn: 6 });
        case 'month': return isThisMonth(date);
        case 'custom':
          if (!customStart || !customEnd) return true;
          return isWithinInterval(date, {
            start: startOfDay(new Date(customStart)),
            end: endOfDay(new Date(customEnd))
          });
        default: return true;
      }
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, filterType, customStart, customEnd]);

  const stats = useMemo(() => {
    let profitUSD = 0;
    let profitSYP = 0;
    filteredTransactions.forEach(txn => {
      profitUSD += txn.profit_usd;
      profitSYP += txn.profit_syp;
    });
    const inventoryValueUSD = products.reduce((sum, p) => sum + (p.cost_usd * p.quantity), 0);
    return { profitUSD, profitSYP, inventoryValueUSD };
  }, [filteredTransactions, products]);

  // الأرباح الكاملة (كل الوقت) للصندوقين
  const totalProfitSYP = transactions.reduce((s, t) => s + t.profit_syp, 0);
  const totalProfitUSD = transactions.reduce((s, t) => s + t.profit_usd, 0);

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setExpandedRows(newSet);
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', 'error'); return; }
    const balance = withdrawCurrency === 'SYP' ? cashBox.balance_syp : cashBox.balance_usd;
    if (amount > balance) { showToast('المبلغ أكبر من رصيد الصندوق', 'error'); return; }
    setWithdrawing(true);
    const ok = await DB.withdrawFromCashBox(withdrawCurrency, amount, withdrawNote || 'سحب من الصندوق');
    if (ok) {
      showToast('تم السحب بنجاح', 'success');
      setWithdrawAmount('');
      setWithdrawNote('');
      const cb = await DB.getCashBoxState();
      setCashBox(cb);
    } else {
      showToast('حدث خطأ أثناء السحب', 'error');
    }
    setWithdrawing(false);
  };

  const handleProfitWithdraw = async () => {
    const amount = profitWithdrawCurrency === 'SYP' ? totalProfitSYP : totalProfitUSD;
    if (amount <= 0) { showToast('لا توجد أرباح متاحة للسحب', 'warning'); return; }
    const balance = profitWithdrawCurrency === 'SYP' ? cashBox.balance_syp : cashBox.balance_usd;
    if (amount > balance) { showToast('الأرباح أكبر من رصيد الصندوق الحالي', 'warning'); return; }
    setWithdrawingProfit(true);
    const ok = await DB.withdrawFromCashBox(profitWithdrawCurrency, amount, 'سحب أرباح');
    if (ok) {
      showToast('تم سحب الأرباح بنجاح', 'success');
      const cb = await DB.getCashBoxState();
      setCashBox(cb);
    } else {
      showToast('حدث خطأ أثناء سحب الأرباح', 'error');
    }
    setWithdrawingProfit(false);
  };

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
        const filename = `invoice_${receiptTxn?.invoice_number}.png`;
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'فاتورة مبيعات' }); showToast('تمت المشاركة', 'success'); }
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

  const printReceipt = () => { window.print(); };

  return (
    <div className="flex flex-col relative h-full">
      {/* HEADER */}
      <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center shadow-sm border border-gray-100 mb-3">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
          <BarChart3 className="text-primary" size={18} /> لوحة التحكم
        </h1>
        <button onClick={loadData} className="text-xs text-primary font-bold bg-primary-light/50 px-3 py-1 rounded-lg">تحديث</button>
      </div>

      <div className="flex-1 flex flex-col gap-3 pb-8">

        {/* FILTER BAR */}
        <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-1">
          {(['today','week','month','custom'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilterType(f)}
              className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1 ${filterType === f ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              {f === 'today' ? 'اليوم' : f === 'week' ? 'الأسبوع' : f === 'month' ? 'الشهر' : <><Calendar size={14} /> مخصص</>}
            </button>
          ))}
        </div>

        {filterType === 'custom' && (
          <div className="flex gap-2 bg-white p-2.5 rounded-xl shadow-sm border border-primary-light">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 font-bold mb-1 block">من</label>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-gray-200 focus:border-primary outline-none text-xs font-bold" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 font-bold mb-1 block">إلى</label>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-gray-200 focus:border-primary outline-none text-xs font-bold" />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold">جاري التحميل...</p>
          </div>
        ) : (
          <>
            {/* STATS CARDS */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* الصندوق السوري */}
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-green-500" />
                <div className="flex justify-between items-start mb-1.5">
                  <div className="text-[10px] font-bold text-gray-500">الصندوق السوري</div>
                  <div className="w-6 h-6 rounded-md bg-green-50 text-green-600 flex items-center justify-center"><Landmark size={12} /></div>
                </div>
                <div className="text-sm font-black text-gray-900 truncate">{formatCurrencySYP(cashBox.balance_syp)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">مبيعات - سحوبات</div>
              </div>

              {/* الصندوق الدولاري */}
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-blue-500" />
                <div className="flex justify-between items-start mb-1.5">
                  <div className="text-[10px] font-bold text-gray-500">الصندوق الدولاري</div>
                  <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center"><DollarSign size={12} /></div>
                </div>
                <div className="text-sm font-black text-gray-900 truncate">{formatCurrencyUSD(cashBox.balance_usd)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">مبيعات - سحوبات</div>
              </div>

              {/* صافي الربح */}
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-success" />
                <div className="flex justify-between items-start mb-1.5">
                  <div className="text-[10px] font-bold text-gray-500">صافي الربح ({filterType === 'today' ? 'اليوم' : filterType === 'week' ? 'الأسبوع' : filterType === 'month' ? 'الشهر' : 'المحدد'})</div>
                  <div className="w-6 h-6 rounded-md bg-green-50 text-success flex items-center justify-center"><TrendingUp size={12} /></div>
                </div>
                <div className="text-sm font-black text-gray-900 truncate">{formatCurrencyUSD(stats.profitUSD)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{formatCurrencySYP(stats.profitSYP)}</div>
              </div>

              {/* قيمة المخزون */}
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-warning" />
                <div className="flex justify-between items-start mb-1.5">
                  <div className="text-[10px] font-bold text-gray-500">قيمة المخزون</div>
                  <div className="w-6 h-6 rounded-md bg-orange-50 text-warning flex items-center justify-center"><PackageSearch size={12} /></div>
                </div>
                <div className="text-sm font-black text-gray-900 truncate">{formatCurrencyUSD(stats.inventoryValueUSD)}</div>
              </div>
            </div>

            {/* WITHDRAW CARD */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5 mb-3">
                <ArrowDownCircle size={16} className="text-primary" /> سحب من الصندوق
              </h3>
              {/* Tab selector */}
              <div className="flex bg-gray-100 rounded-lg p-0.5 mb-3">
                <button
                  onClick={() => setWithdrawCurrency('SYP')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${withdrawCurrency === 'SYP' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}
                >ل.س</button>
                <button
                  onClick={() => setWithdrawCurrency('USD')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${withdrawCurrency === 'USD' ? 'bg-blue-500 text-white shadow' : 'text-gray-500'}`}
                >$</button>
              </div>
              <div className="text-xs text-gray-500 mb-2 font-medium">
                الرصيد المتاح: <span className="font-bold text-gray-800">
                  {withdrawCurrency === 'SYP' ? formatCurrencySYP(cashBox.balance_syp) : formatCurrencyUSD(cashBox.balance_usd)}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder={`المبلغ ${withdrawCurrency === 'SYP' ? '(ل.س)' : '($)'}`}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
                />
                <input
                  type="text"
                  value={withdrawNote}
                  onChange={e => setWithdrawNote(e.target.value)}
                  placeholder="ملاحظة (اختياري)"
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
                />
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing || !withdrawAmount}
                  className="w-full h-10 bg-primary text-white font-bold text-sm rounded-xl disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {withdrawing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'تأكيد السحب'}
                </button>
              </div>
            </div>

            {/* PROFIT WITHDRAW CARD */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5 mb-3">
                <TrendingUp size={16} className="text-success" /> سحب الأرباح
              </h3>
              <div className="flex bg-gray-100 rounded-lg p-0.5 mb-3">
                <button
                  onClick={() => setProfitWithdrawCurrency('SYP')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${profitWithdrawCurrency === 'SYP' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}
                >ل.س</button>
                <button
                  onClick={() => setProfitWithdrawCurrency('USD')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${profitWithdrawCurrency === 'USD' ? 'bg-blue-500 text-white shadow' : 'text-gray-500'}`}
                >$</button>
              </div>
              <div className="bg-green-50 rounded-xl p-3 mb-3 text-xs text-green-700">
                <div className="font-bold mb-1">إجمالي الأرباح المتراكمة:</div>
                <div>ل.س: {formatCurrencySYP(totalProfitSYP)}</div>
                <div>$: {formatCurrencyUSD(totalProfitUSD)}</div>
              </div>
              <div className="text-xs text-gray-600 mb-3 font-medium">
                سيتم سحب: <span className="font-bold text-gray-900">
                  {profitWithdrawCurrency === 'SYP' ? formatCurrencySYP(totalProfitSYP) : formatCurrencyUSD(totalProfitUSD)}
                </span> من الصندوق {profitWithdrawCurrency === 'SYP' ? 'السوري' : 'الدولاري'}
              </div>
              <button
                onClick={handleProfitWithdraw}
                disabled={withdrawingProfit}
                className="w-full h-10 bg-success text-white font-bold text-sm rounded-xl disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {withdrawingProfit ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'سحب الأرباح'}
              </button>
            </div>

            {/* SALES TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col mt-1">
              <div className="px-3 py-2.5 bg-gray-50/80 border-b border-gray-100 font-bold text-sm text-gray-800 flex items-center gap-1.5 shrink-0">
                <ListOrdered size={16} className="text-primary" /> سجل المبيعات
              </div>
              <div className="overflow-x-auto no-scrollbar flex-1 pb-4">
                {filteredTransactions.length === 0 ? (
                  <div className="py-10 flex flex-col items-center justify-center text-gray-400">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                      <Calendar size={20} className="text-gray-300" />
                    </div>
                    <p className="font-semibold text-xs">لا توجد مبيعات في هذه الفترة</p>
                  </div>
                ) : (
                  <table className="w-full text-right text-xs border-collapse min-w-[520px]">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500">
                        <th className="py-2.5 px-3 font-bold"># رقم</th>
                        <th className="py-2.5 px-3 font-bold">التاريخ</th>
                        <th className="py-2.5 px-3 font-bold">ل.س</th>
                        <th className="py-2.5 px-3 font-bold">$</th>
                        <th className="py-2.5 px-3 font-bold">الربح</th>
                        <th className="py-2.5 px-3 font-bold text-center">📄</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map(txn => {
                        const isExpanded = expandedRows.has(txn.id);
                        return (
                          <React.Fragment key={txn.id}>
                            <tr className={`border-b border-gray-50 hover:bg-primary-light/30 transition-colors ${isExpanded ? 'bg-primary-light/20' : ''}`}>
                              <td
                                className="py-3 px-3 font-bold text-gray-900 cursor-pointer"
                                onClick={() => toggleRow(txn.id)}
                              >
                                <div className="flex items-center gap-1.5">
                                  {isExpanded ? <ChevronUp size={14} className="text-primary" /> : <ChevronDown size={14} className="text-gray-400" />}
                                  #{txn.invoice_number}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-gray-600 font-medium cursor-pointer" dir="ltr" onClick={() => toggleRow(txn.id)}>{formatDate(txn.timestamp)}</td>
                              <td className="py-3 px-3 font-bold text-green-700 cursor-pointer" onClick={() => toggleRow(txn.id)}>
                                {txn.cash_syp > 0 ? txn.cash_syp.toLocaleString('en-US') : '—'}
                              </td>
                              <td className="py-3 px-3 font-bold text-blue-700 cursor-pointer" onClick={() => toggleRow(txn.id)}>
                                {txn.cash_usd > 0 ? `$${txn.cash_usd.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-3 px-3 font-bold text-success cursor-pointer" onClick={() => toggleRow(txn.id)}>${txn.profit_usd.toFixed(2)}</td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  onClick={() => setReceiptTxn(txn)}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-50 hover:bg-primary-light text-gray-500 hover:text-primary transition-colors border border-gray-100"
                                >
                                  <FileText size={13} />
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className="p-0 border-b border-gray-100 bg-gray-50/80">
                                  <div className="px-6 py-2">
                                    <table className="w-full text-right text-[11px]">
                                      <thead>
                                        <tr className="text-gray-400 border-b border-gray-200">
                                          <th className="py-1 font-semibold">الصنف</th>
                                          <th className="py-1 font-semibold text-center">الكمية</th>
                                          <th className="py-1 font-semibold">العملة</th>
                                          <th className="py-1 font-semibold">المجموع</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {txn.items.map((item, idx) => (
                                          <tr key={idx} className="border-b border-gray-100/50 last:border-0 text-gray-700">
                                            <td className="py-1.5 font-bold">{item.name}</td>
                                            <td className="py-1.5 text-center font-bold">{item.qty}</td>
                                            <td className="py-1.5">
                                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.currency === 'USD' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                                {item.currency === 'USD' ? '$' : 'ل.س'}
                                              </span>
                                            </td>
                                            <td className="py-1.5 font-bold text-gray-900">
                                              {item.currency === 'USD' ? `$${item.subtotal_usd.toFixed(2)}` : `${item.subtotal_syp.toLocaleString('en-US')} ل.س`}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* RECEIPT MODAL */}
      {receiptTxn && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-[340px] rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
              <span className="font-bold text-sm text-gray-800">الفاتورة #{receiptTxn.invoice_number}</span>
              <button onClick={() => setReceiptTxn(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"><X size={18} /></button>
            </div>
            {/* Content */}
            <div className="p-5">
              <div className="text-center mb-4">
                <Building2 size={22} className="mx-auto text-gray-700 mb-1" />
                <div className="font-bold text-base text-gray-900">{settings?.company_name}</div>
                <div className="text-gray-500 text-xs">فاتورة مبيعات</div>
                <div className="mt-2 border-t border-dashed border-gray-300 pt-2 flex justify-between text-[11px] text-gray-500">
                  <span>#{receiptTxn.invoice_number}</span>
                  <span dir="ltr">{formatDate(receiptTxn.timestamp)}</span>
                </div>
              </div>
              <table className="w-full text-right text-xs mb-3">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400">
                    <th className="py-1 font-semibold">المنتج</th>
                    <th className="py-1 text-center font-semibold w-8">الكمية</th>
                    <th className="py-1 font-semibold">المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptTxn.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 font-semibold text-gray-800">{item.name}</td>
                      <td className="py-1.5 text-center font-bold text-gray-600">{item.qty}</td>
                      <td className="py-1.5 font-bold text-primary">
                        {item.currency === 'USD' ? `$${item.subtotal_usd.toFixed(2)}` : `${item.subtotal_syp.toLocaleString('en-US')} ل.س`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gray-200 pt-2">
                {receiptTxn.cash_syp > 0 && (
                  <div className="flex justify-between text-xs font-bold text-gray-800 mb-1">
                    <span className="text-gray-500">الإجمالي ل.س</span>
                    <span>{formatCurrencySYP(receiptTxn.cash_syp)}</span>
                  </div>
                )}
                {receiptTxn.cash_usd > 0 && (
                  <div className="flex justify-between text-xs font-bold text-gray-800">
                    <span className="text-gray-500">الإجمالي $</span>
                    <span>{formatCurrencyUSD(receiptTxn.cash_usd)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="w-full max-w-[340px] mt-3 flex gap-2">
            <button onClick={printReceipt} className="flex-1 bg-white text-gray-700 font-bold h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm shadow">
              <Printer size={15} /> طباعة
            </button>
            <button onClick={shareReceipt} className="flex-1 bg-success text-white font-bold h-10 rounded-lg flex items-center justify-center gap-1.5 text-sm shadow">
              <Share2 size={15} /> مشاركة
            </button>
            <button onClick={() => setReceiptTxn(null)} className="flex-none px-4 bg-gray-800 text-white font-bold h-10 rounded-lg text-sm shadow">
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Hidden element for share */}
      {receiptTxn && (
        <div ref={hiddenReceiptRef} style={{ position: 'absolute', left: '-9999px', top: 0, width: '340px', zIndex: -1 }} dir="rtl">
          <div className="bg-white p-5">
            <div className="text-center mb-4">
              <div className="font-bold text-base text-gray-900">{settings?.company_name}</div>
              <div className="text-gray-500 text-xs">فاتورة مبيعات</div>
              <div className="mt-2 border-t border-dashed border-gray-300 pt-2 flex justify-between text-[11px] text-gray-500">
                <span>#{receiptTxn.invoice_number}</span>
                <span dir="ltr">{formatDate(receiptTxn.timestamp)}</span>
              </div>
            </div>
            <table className="w-full text-right text-xs mb-3">
              <thead><tr className="border-b border-gray-200"><th className="py-1">المنتج</th><th className="py-1 text-center">الكمية</th><th className="py-1">المجموع</th></tr></thead>
              <tbody>
                {receiptTxn.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-50">
                    <td className="py-1.5 font-semibold">{item.name}</td>
                    <td className="py-1.5 text-center">{item.qty}</td>
                    <td className="py-1.5 font-bold">{item.currency === 'USD' ? `$${item.subtotal_usd.toFixed(2)}` : `${item.subtotal_syp.toLocaleString('en-US')} ل.س`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t pt-2">
              {receiptTxn.cash_syp > 0 && <div className="flex justify-between text-xs font-bold mb-1"><span>الإجمالي ل.س</span><span>{formatCurrencySYP(receiptTxn.cash_syp)}</span></div>}
              {receiptTxn.cash_usd > 0 && <div className="flex justify-between text-xs font-bold"><span>الإجمالي $</span><span>{formatCurrencyUSD(receiptTxn.cash_usd)}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
