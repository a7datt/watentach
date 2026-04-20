import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Save, Download, Upload, Trash2, AlertTriangle, Building2, ArrowRightLeft, Database, Landmark, DollarSign, TrendingUp, ScrollText, X } from 'lucide-react';
import { DB } from '../lib/db';
import { Settings, CashBoxState, CashBoxOperation } from '../lib/types';
import { useToast } from '../components/Toast';
import { formatDate, formatCurrencySYP, formatCurrencyUSD } from '../lib/utils';

type ModalType = 'import' | 'delete_txns' | 'wipe_all'
  | 'withdraw_syp' | 'withdraw_usd' | 'withdraw_profit'
  | 'deposit_syp' | 'deposit_usd' | 'deposit_profit'
  | 'operations_log' | null;

export default function SettingsTab() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [cashBox, setCashBox] = useState<CashBoxState>({ balance_syp: 0, balance_usd: 0 });
  const [operations, setOperations] = useState<CashBoxOperation[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);

  // حالة المودل
  const [modalType, setModalType] = useState<ModalType>(null);
  const [importDataPreview, setImportDataPreview] = useState<any>(null);
  const [wipeConfirmation, setWipeConfirmation] = useState('');

  // حقول السحب
  const [wdAmount, setWdAmount] = useState('');
  const [wdNote, setWdNote] = useState('');
  const [wdLoading, setWdLoading] = useState(false);

  // سحب الأرباح
  const [profitCurrency, setProfitCurrency] = useState<'SYP' | 'USD'>('SYP');
  const [profitLoading, setProfitLoading] = useState(false);

  // إيداع في الصندوق
  const [depositProfitAmount, setDepositProfitAmount] = useState('');
  const [depositProfitCurrency, setDepositProfitCurrency] = useState<'SYP' | 'USD'>('SYP');
  const [depositProfitNote, setDepositProfitNote] = useState('');
  const [depositProfitLoading, setDepositProfitLoading] = useState(false);

  // إجمالي الأرباح (كل الوقت)
  const [totalProfitSYP, setTotalProfitSYP] = useState(0);
  const [totalProfitUSD, setTotalProfitUSD] = useState(0);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [s, cb] = await Promise.all([DB.getSettings(), DB.getCashBoxState()]);
    setSettings(s);
    setRateInput(s.exchange_rate.toString());
    setCashBox(cb);
    // جلب الأرباح الكلية
    const txns = await DB.getTransactions();
    setTotalProfitSYP(txns.reduce((a, t) => a + t.profit_syp, 0));
    setTotalProfitUSD(txns.reduce((a, t) => a + t.profit_usd, 0));
  };

  const openModal = (type: ModalType) => {
    setWdAmount('');
    setWdNote('');
    setWipeConfirmation('');
    setDepositProfitAmount('');
    setDepositProfitNote('');
    setDepositProfitCurrency('SYP');
    setModalType(type);
  };

  const closeModal = () => setModalType(null);

  // ---- سحب عادي ----
  const handleWithdraw = async (currency: 'SYP' | 'USD') => {
    const amount = parseFloat(wdAmount);
    if (!amount || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', 'error'); return; }
    const balance = currency === 'SYP' ? cashBox.balance_syp : cashBox.balance_usd;
    if (amount > balance) { showToast('المبلغ أكبر من رصيد الصندوق', 'error'); return; }
    setWdLoading(true);
    const ok = await DB.withdrawFromCashBox(currency, amount, wdNote || 'سحب من الصندوق');
    if (ok) {
      showToast('تم السحب بنجاح ✓', 'success');
      closeModal();
      await loadAll();
    } else {
      showToast('حدث خطأ أثناء السحب', 'error');
    }
    setWdLoading(false);
  };

  // ---- إيداع عادي (لا يحسب كربح) ----
  const handleDeposit = async (currency: 'SYP' | 'USD') => {
    const amount = parseFloat(wdAmount);
    if (!amount || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', 'error'); return; }
    setWdLoading(true);
    // الإيداع = سحب بمبلغ سالب
    const ok = await DB.withdrawFromCashBox(currency, -amount, wdNote || `إيداع في الصندوق ${currency === 'SYP' ? 'السوري' : 'الدولاري'}`);
    if (ok) {
      showToast('تم الإيداع بنجاح ✓', 'success');
      closeModal();
      await loadAll();
    } else {
      showToast('حدث خطأ أثناء الإيداع', 'error');
    }
    setWdLoading(false);
  };

  // ---- إيداع أرباح ----
  const handleDepositProfit = async () => {
    const amount = parseFloat(depositProfitAmount);
    if (!amount || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', 'error'); return; }
    setDepositProfitLoading(true);
    const ok = await DB.withdrawFromCashBox(depositProfitCurrency, -amount, depositProfitNote || 'إيداع أرباح');
    if (ok) {
      showToast('تم إيداع الأرباح بنجاح ✓', 'success');
      closeModal();
      await loadAll();
    } else {
      showToast('حدث خطأ أثناء الإيداع', 'error');
    }
    setDepositProfitLoading(false);
  };

  // ---- سحب الأرباح ----
  const handleProfitWithdraw = async () => {
    const amount = profitCurrency === 'SYP' ? totalProfitSYP : totalProfitUSD;
    if (amount <= 0) { showToast('لا توجد أرباح متاحة', 'warning'); return; }
    const balance = profitCurrency === 'SYP' ? cashBox.balance_syp : cashBox.balance_usd;
    if (amount > balance) { showToast('الأرباح أكبر من رصيد الصندوق الحالي', 'warning'); return; }
    setProfitLoading(true);
    const ok = await DB.withdrawFromCashBox(profitCurrency, amount, 'سحب أرباح');
    if (ok) {
      showToast('تم سحب الأرباح بنجاح ✓', 'success');
      closeModal();
      await loadAll();
    } else {
      showToast('حدث خطأ أثناء السحب', 'error');
    }
    setProfitLoading(false);
  };

  // ---- سجل السحوبات ----
  const openOperationsLog = async () => {
    setModalType('operations_log');
    setLoadingOps(true);
    const ops = await DB.getCashBoxOperations();
    setOperations(ops);
    setLoadingOps(false);
  };

  // ---- إعدادات ----
  const handleSaveRate = async () => {
    const r = parseFloat(rateInput);
    if (isNaN(r) || r <= 0) { showToast('سعر الصرف غير صالح', 'error'); return; }
    setSaving(true);
    const ns: Settings = { ...settings!, exchange_rate: r, exchange_rate_updated: new Date().toISOString() };
    const ok = await DB.saveSettings(ns);
    if (ok) { setSettings(ns); showToast('تم الحفظ بنجاح', 'success'); }
    else showToast('حدث خطأ', 'error');
    setSaving(false);
  };

  const exportData = async () => {
    const data = await DB.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `watain_backup_${new Date().toISOString().split('T')[0].replace(/-/g,'')}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('تم التصدير بنجاح', 'success');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (json.products && json.transactions && json.settings) { setImportDataPreview(json); setModalType('import'); }
        else showToast('ملف البيانات غير صالح', 'error');
      } catch { showToast('خطأ في قراءة الملف', 'error'); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImport = async () => {
    if (!importDataPreview) return;
    setSaving(true);
    const ok = await DB.importData(importDataPreview);
    if (ok) { await loadAll(); showToast('تم الاستيراد بنجاح', 'success'); }
    else showToast('حدث خطأ', 'error');
    setSaving(false); closeModal();
  };

  const handleDeleteTxns = async () => {
    setSaving(true);
    const ok = await DB.deleteAllTransactions();
    if (ok) showToast('تم المسح بنجاح', 'success'); else showToast('حدث خطأ', 'error');
    setSaving(false); closeModal();
  };

  const handleWipeAll = async () => {
    if (wipeConfirmation !== 'تأكيد') { showToast('يرجى كتابة كلمة "تأكيد"', 'error'); return; }
    setSaving(true);
    await DB.wipeAll(); await loadAll();
    showToast('تم ضبط المصنع', 'success');
    setSaving(false); closeModal();
  };

  // ---- مساعد للـ modal السحب ----
  const WithdrawModalBody = ({ currency }: { currency: 'SYP' | 'USD' }) => {
    const balance = currency === 'SYP' ? cashBox.balance_syp : cashBox.balance_usd;
    const label = currency === 'SYP' ? 'الصندوق السوري' : 'الصندوق الدولاري';
    const color = currency === 'SYP' ? 'text-green-700' : 'text-blue-700';
    const balanceStr = currency === 'SYP' ? formatCurrencySYP(balance) : formatCurrencyUSD(balance);
    const unit = currency === 'SYP' ? 'ل.س' : '$';
    return (
      <>
        <div className={`text-3xl mx-auto mb-1 text-center`}>{currency === 'SYP' ? '🏦' : '💵'}</div>
        <h3 className="text-base font-bold text-gray-900 text-center mb-1">سحب من {label}</h3>
        <div className={`text-center text-sm font-bold ${color} mb-4`}>الرصيد المتاح: {balanceStr}</div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">المبلغ ({unit}) *</label>
            <div className="relative">
              <input type="number" value={wdAmount} onChange={e => setWdAmount(e.target.value)}
                placeholder="0" autoFocus
                className="w-full h-11 px-3 pl-12 rounded-xl border-2 border-gray-200 focus:border-primary outline-none text-sm font-bold" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">{unit}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">ملاحظة (اختياري)</label>
            <input type="text" value={wdNote} onChange={e => setWdNote(e.target.value)}
              placeholder="سبب السحب..."
              className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-primary outline-none text-sm" />
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={closeModal} className="flex-1 h-10 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl">إلغاء</button>
            <button onClick={() => handleWithdraw(currency)} disabled={wdLoading || !wdAmount}
              className="flex-1 h-10 bg-primary text-white font-bold text-sm rounded-xl shadow disabled:opacity-60 flex items-center justify-center gap-1.5">
              {wdLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'تأكيد السحب'}
            </button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex flex-col relative h-full">
      {/* HEADER */}
      <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center shadow-sm border border-gray-100 mb-3">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
          <SettingsIcon className="text-primary" size={18} /> الإعدادات
        </h1>
      </div>

      <div className="flex-1 flex flex-col gap-4 pb-8 max-w-md mx-auto w-full overflow-y-auto no-scrollbar">

        {/* شعار وعنوان */}
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-white rounded-2xl shadow border border-gray-100 flex items-center justify-center mx-auto mb-3">
            <Building2 size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-1">{settings?.company_name}</h2>
          <p className="text-gray-500 text-xs font-bold">نظام نقاط البيع v1.0</p>
        </div>

        {/* EXCHANGE RATE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
            <ArrowRightLeft size={16} className="text-primary" /> سعر الصرف
          </h3>
          <div className="text-center mb-4">
            <div className="text-2xl font-black text-gray-800">
              {settings?.exchange_rate.toLocaleString('en-US')} <span className="text-sm text-gray-500">ل.س / $</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1 font-semibold" dir="ltr">
              {settings?.exchange_rate_updated ? formatDate(settings.exchange_rate_updated) : ''}
            </div>
          </div>
          <div className="flex gap-2">
            <input type="number" min="1" step="1" value={rateInput} onChange={e => setRateInput(e.target.value)}
              className="flex-1 h-10 px-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 outline-none font-bold text-center bg-gray-50 text-sm" dir="ltr" />
            <button onClick={handleSaveRate} disabled={saving}
              className="px-4 bg-primary text-white font-bold rounded-lg flex items-center gap-1.5 hover:bg-primary-dark transition-colors text-sm disabled:opacity-60">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save size={16} /> حفظ</>}
            </button>
          </div>
          <div className="mt-3 bg-orange-50 border border-orange-100 p-2.5 rounded-lg flex items-start gap-1.5 text-warning text-[10px] font-bold">
            <AlertTriangle className="shrink-0 mt-0.5" size={14} />
            <p className="leading-tight">تنبيه: التغيير يؤثر على المبيعات الجديدة فقط.</p>
          </div>
        </div>

        {/* ===== إدارة الصندوق ===== */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
            <Landmark size={16} className="text-primary" /> إدارة الصندوق
          </h3>

          {/* أرصدة */}
          <div className="grid grid-cols-2 gap-2 my-3">
            <div className="bg-green-50 rounded-xl p-2.5 text-center border border-green-100">
              <div className="text-[10px] font-bold text-green-600 mb-1">الصندوق السوري</div>
              <div className="text-sm font-black text-green-800 truncate">{formatCurrencySYP(cashBox.balance_syp)}</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-2.5 text-center border border-blue-100">
              <div className="text-[10px] font-bold text-blue-600 mb-1">الصندوق الدولاري</div>
              <div className="text-sm font-black text-blue-800 truncate">{formatCurrencyUSD(cashBox.balance_usd)}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {/* سحب من الصندوق السوري */}
            <button
              onClick={() => openModal('withdraw_syp')}
              className="w-full h-11 bg-green-50 border border-green-200 text-green-800 font-bold rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-green-100 transition-colors"
            >
              <Landmark size={16} className="text-green-600" /> سحب من الصندوق السوري
            </button>

            {/* سحب من الصندوق الدولاري */}
            <button
              onClick={() => openModal('withdraw_usd')}
              className="w-full h-11 bg-blue-50 border border-blue-200 text-blue-800 font-bold rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-blue-100 transition-colors"
            >
              <DollarSign size={16} className="text-blue-600" /> سحب من الصندوق الدولاري
            </button>

            {/* سحب الأرباح */}
            <button
              onClick={() => openModal('withdraw_profit')}
              className="w-full h-11 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-emerald-100 transition-colors"
            >
              <TrendingUp size={16} className="text-emerald-600" /> سحب الأرباح
            </button>

            <div className="border-t border-gray-100 my-1" />

            {/* إيداع في الصندوق السوري */}
            <button
              onClick={() => openModal('deposit_syp')}
              className="w-full h-11 bg-green-50 border border-green-200 text-green-800 font-bold rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-green-100 transition-colors"
            >
              <Landmark size={16} className="text-green-600" /> إيداع في الصندوق السوري
            </button>

            {/* إيداع في الصندوق الدولاري */}
            <button
              onClick={() => openModal('deposit_usd')}
              className="w-full h-11 bg-blue-50 border border-blue-200 text-blue-800 font-bold rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-blue-100 transition-colors"
            >
              <DollarSign size={16} className="text-blue-600" /> إيداع في الصندوق الدولاري
            </button>

            {/* إيداع أرباح */}
            <button
              onClick={() => openModal('deposit_profit')}
              className="w-full h-11 bg-purple-50 border border-purple-200 text-purple-800 font-bold rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-purple-100 transition-colors"
            >
              <TrendingUp size={16} className="text-purple-600" /> إيداع أرباح
            </button>

            {/* سجل السحوبات */}
            <button
              onClick={openOperationsLog}
              className="w-full h-11 bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-gray-100 transition-colors"
            >
              <ScrollText size={16} className="text-gray-500" /> سجلات العمليات
            </button>
          </div>
        </div>

        {/* DATA */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2.5">
          <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
            <Database size={16} className="text-primary" /> البيانات
          </h3>
          <button onClick={exportData} className="w-full h-10 bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-lg flex items-center justify-center gap-1.5 text-sm">
            <Download size={16} className="text-primary" /> نسخ احتياطي
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="w-full h-10 bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-lg flex items-center justify-center gap-1.5 text-sm">
            <Upload size={16} className="text-success" /> استعادة
          </button>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        </div>

        {/* DANGER ZONE */}
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4 flex flex-col gap-2.5 relative">
          <div className="absolute top-0 right-0 w-1 h-full bg-danger rounded-r-xl" />
          <h3 className="text-sm font-bold text-danger mb-1 flex items-center gap-1.5">
            <AlertTriangle size={16} /> منطقة الخطر
          </h3>
          <button onClick={() => openModal('delete_txns')} className="w-full h-10 bg-red-50 border border-red-100 text-danger font-bold rounded-lg flex items-center justify-center gap-1.5 text-sm">
            <Trash2 size={16} /> مسح السجلات
          </button>
          <button onClick={() => openModal('wipe_all')} className="w-full h-10 bg-danger text-white font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-danger/20 text-sm">
            <Trash2 size={16} /> ضبط المصنع
          </button>
        </div>
      </div>

      {/* ============ MODALS ============ */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeModal}>
          <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-xl p-5" onClick={e => e.stopPropagation()}>

            {/* سحب من السوري */}
            {modalType === 'withdraw_syp' && <WithdrawModalBody currency="SYP" />}

            {/* سحب من الدولاري */}
            {modalType === 'withdraw_usd' && <WithdrawModalBody currency="USD" />}

            {/* إيداع في السوري */}
            {(modalType === 'deposit_syp' || modalType === 'deposit_usd') && (() => {
              const currency = modalType === 'deposit_syp' ? 'SYP' : 'USD';
              const label = currency === 'SYP' ? 'الصندوق السوري' : 'الصندوق الدولاري';
              const unit = currency === 'SYP' ? 'ل.س' : '$';
              const color = currency === 'SYP' ? 'text-green-700' : 'text-blue-700';
              const balance = currency === 'SYP' ? cashBox.balance_syp : cashBox.balance_usd;
              const balanceStr = currency === 'SYP' ? formatCurrencySYP(balance) : formatCurrencyUSD(balance);
              return (
                <>
                  <div className="text-3xl mx-auto mb-1 text-center">{currency === 'SYP' ? '🏦' : '💵'}</div>
                  <h3 className="text-base font-bold text-gray-900 text-center mb-1">إيداع في {label}</h3>
                  <div className={`text-center text-sm font-bold ${color} mb-1`}>الرصيد الحالي: {balanceStr}</div>
                  <div className="text-center text-[10px] text-gray-400 mb-4 bg-gray-50 rounded-lg px-2 py-1">⚡ الإيداع لا يُحسب كربح</div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1 block">المبلغ ({unit}) *</label>
                      <div className="relative">
                        <input type="number" value={wdAmount} onChange={e => setWdAmount(e.target.value)}
                          placeholder="0" autoFocus
                          className="w-full h-11 px-3 pl-12 rounded-xl border-2 border-gray-200 focus:border-primary outline-none text-sm font-bold" />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">{unit}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 mb-1 block">ملاحظة (اختياري)</label>
                      <input type="text" value={wdNote} onChange={e => setWdNote(e.target.value)}
                        placeholder="سبب الإيداع..."
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-primary outline-none text-sm" />
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button onClick={closeModal} className="flex-1 h-10 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl">إلغاء</button>
                      <button onClick={() => handleDeposit(currency)} disabled={wdLoading || !wdAmount}
                        className="flex-1 h-10 bg-primary text-white font-bold text-sm rounded-xl shadow disabled:opacity-60 flex items-center justify-center gap-1.5">
                        {wdLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'تأكيد الإيداع'}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* إيداع أرباح */}
            {modalType === 'deposit_profit' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-base text-gray-900 flex items-center gap-1.5">
                    <TrendingUp size={18} className="text-purple-600" /> إيداع أرباح
                  </h3>
                  <button onClick={closeModal} className="text-gray-400 p-1 rounded-lg"><X size={18} /></button>
                </div>
                <div className="text-center text-[10px] text-gray-400 mb-3 bg-purple-50 rounded-lg px-2 py-1.5 border border-purple-100">
                  💰 إيداع أرباح خارجية في الصندوق
                </div>
                <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
                  <button onClick={() => setDepositProfitCurrency('SYP')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${depositProfitCurrency === 'SYP' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500'}`}>
                    🏦 ليرة سورية
                  </button>
                  <button onClick={() => setDepositProfitCurrency('USD')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${depositProfitCurrency === 'USD' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500'}`}>
                    💵 دولار
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">المبلغ ({depositProfitCurrency === 'SYP' ? 'ل.س' : '$'}) *</label>
                    <div className="relative">
                      <input type="number" value={depositProfitAmount} onChange={e => setDepositProfitAmount(e.target.value)}
                        placeholder="0" autoFocus
                        className="w-full h-11 px-3 pl-12 rounded-xl border-2 border-gray-200 focus:border-purple-400 outline-none text-sm font-bold" />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">{depositProfitCurrency === 'SYP' ? 'ل.س' : '$'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">ملاحظة (اختياري)</label>
                    <input type="text" value={depositProfitNote} onChange={e => setDepositProfitNote(e.target.value)}
                      placeholder="مصدر الأرباح..."
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-purple-400 outline-none text-sm" />
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={closeModal} className="flex-1 h-10 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl">إلغاء</button>
                    <button onClick={handleDepositProfit} disabled={depositProfitLoading || !depositProfitAmount}
                      className="flex-1 h-10 bg-purple-500 text-white font-bold text-sm rounded-xl shadow disabled:opacity-60 flex items-center justify-center gap-1.5">
                      {depositProfitLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'تأكيد الإيداع'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* سحب الأرباح */}
            {modalType === 'withdraw_profit' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-base text-gray-900 flex items-center gap-1.5">
                    <TrendingUp size={18} className="text-emerald-600" /> سحب الأرباح
                  </h3>
                  <button onClick={closeModal} className="text-gray-400 p-1 rounded-lg"><X size={18} /></button>
                </div>

                {/* اختيار العملة */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
                  <button onClick={() => setProfitCurrency('SYP')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${profitCurrency === 'SYP' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500'}`}>
                    🏦 ليرة سورية
                  </button>
                  <button onClick={() => setProfitCurrency('USD')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${profitCurrency === 'USD' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500'}`}>
                    💵 دولار
                  </button>
                </div>

                <div className="bg-emerald-50 rounded-xl p-3 mb-4 border border-emerald-100">
                  <div className="text-xs font-bold text-emerald-700 mb-2">إجمالي الأرباح المتراكمة (كل الوقت)</div>
                  <div className="flex justify-between text-sm font-black">
                    <span className="text-gray-600">ل.س:</span>
                    <span className="text-green-700">{formatCurrencySYP(totalProfitSYP)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black mt-1">
                    <span className="text-gray-600">$:</span>
                    <span className="text-blue-700">{formatCurrencyUSD(totalProfitUSD)}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
                  <div className="text-xs text-gray-500 mb-1">سيتم سحب:</div>
                  <div className="font-black text-gray-900">
                    {profitCurrency === 'SYP' ? formatCurrencySYP(totalProfitSYP) : formatCurrencyUSD(totalProfitUSD)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    من الصندوق {profitCurrency === 'SYP' ? 'السوري' : 'الدولاري'} (رصيده: {profitCurrency === 'SYP' ? formatCurrencySYP(cashBox.balance_syp) : formatCurrencyUSD(cashBox.balance_usd)})
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={closeModal} className="flex-1 h-10 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl">إلغاء</button>
                  <button onClick={handleProfitWithdraw} disabled={profitLoading}
                    className="flex-1 h-10 bg-emerald-500 text-white font-bold text-sm rounded-xl shadow disabled:opacity-60 flex items-center justify-center gap-1.5">
                    {profitLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'سحب الأرباح'}
                  </button>
                </div>
              </>
            )}

            {/* سجل السحوبات */}
            {modalType === 'operations_log' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-base text-gray-900 flex items-center gap-1.5">
                    <ScrollText size={18} className="text-primary" /> سجلات السحوبات
                  </h3>
                  <button onClick={closeModal} className="text-gray-400 p-1 rounded-lg"><X size={18} /></button>
                </div>
                {loadingOps ? (
                  <div className="py-8 flex justify-center">
                    <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : operations.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm font-semibold">لا توجد سحوبات مسجّلة</div>
                ) : (
                  <div className="max-h-[55vh] overflow-y-auto no-scrollbar flex flex-col gap-2">
                    {operations.map(op => (
                      <div key={op.id} className={`rounded-xl p-3 border flex justify-between items-start gap-2 ${op.currency === 'SYP' ? 'bg-green-50 border-green-100' : 'bg-blue-50 border-blue-100'}`}>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-bold truncate ${op.currency === 'SYP' ? 'text-green-800' : 'text-blue-800'}`}>
                            {op.note || 'سحب'}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5" dir="ltr">{formatDate(op.timestamp)}</div>
                        </div>
                        <div className={`text-sm font-black shrink-0 ${op.currency === 'SYP' ? 'text-green-700' : 'text-blue-700'}`}>
                          {op.currency === 'SYP' ? `${op.amount.toLocaleString('en-US')} ل.س` : `$${op.amount.toFixed(2)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={closeModal} className="w-full h-10 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl mt-4">إغلاق</button>
              </>
            )}

            {/* استيراد */}
            {modalType === 'import' && (
              <div className="text-center">
                <Upload size={32} className="text-primary mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900 mb-1">استعادة البيانات</h3>
                <p className="text-gray-500 mb-3 text-xs">سيتم استبدال البيانات الحالية.</p>
                <div className="bg-gray-50 p-2 rounded-lg mb-4 text-xs font-bold text-gray-700">
                  سيتم استيراد {importDataPreview?.products?.length || 0} منتج.
                </div>
                <div className="flex gap-2">
                  <button onClick={closeModal} className="flex-1 h-10 rounded-lg font-bold bg-gray-100 text-gray-700 text-sm">إلغاء</button>
                  <button onClick={confirmImport} disabled={saving} className="flex-1 h-10 rounded-lg font-bold bg-primary text-white text-sm disabled:opacity-60">
                    {saving ? '...' : 'تأكيد'}
                  </button>
                </div>
              </div>
            )}

            {/* مسح المبيعات */}
            {modalType === 'delete_txns' && (
              <div className="text-center">
                <Trash2 size={32} className="text-danger mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900 mb-1">مسح المبيعات</h3>
                <p className="text-gray-500 mb-4 text-xs">سيتم حذف سجل الفواتير، وتبقى المنتجات.</p>
                <div className="flex gap-2">
                  <button onClick={closeModal} className="flex-1 h-10 rounded-lg font-bold bg-gray-100 text-gray-700 text-sm">إلغاء</button>
                  <button onClick={handleDeleteTxns} disabled={saving} className="flex-1 h-10 rounded-lg font-bold bg-danger text-white text-sm disabled:opacity-60">
                    {saving ? '...' : 'مسح'}
                  </button>
                </div>
              </div>
            )}

            {/* ضبط المصنع */}
            {modalType === 'wipe_all' && (
              <div className="text-center">
                <AlertTriangle size={32} className="text-danger mx-auto mb-2 animate-pulse" />
                <h3 className="text-base font-black text-danger mb-1">ضبط المصنع!</h3>
                <p className="text-gray-500 mb-3 text-[11px] font-bold">لا يمكن التراجع. اكتب "تأكيد":</p>
                <input type="text" value={wipeConfirmation} onChange={e => setWipeConfirmation(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border-2 border-gray-200 focus:border-danger outline-none mb-4 text-center font-bold text-sm" placeholder="تأكيد" />
                <div className="flex gap-2">
                  <button onClick={closeModal} className="flex-1 h-10 rounded-lg font-bold bg-gray-100 text-gray-700 text-sm">إلغاء</button>
                  <button onClick={handleWipeAll} disabled={wipeConfirmation !== 'تأكيد' || saving}
                    className="flex-1 h-10 rounded-lg font-bold bg-danger text-white disabled:opacity-50 text-sm">
                    {saving ? '...' : 'مسح كلي'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
