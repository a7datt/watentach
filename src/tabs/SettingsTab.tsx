import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Save, Download, Upload, Trash2, AlertTriangle, Building2, ArrowRightLeft, Database } from 'lucide-react';
import { DB } from '../lib/db';
import { Settings } from '../lib/types';
import { useToast } from '../components/Toast';
import { formatDate } from '../lib/utils';

export default function SettingsTab() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rateInput, setRateInput] = useState('');
  
  const [modalType, setModalType] = useState<'import' | 'delete_txns' | 'wipe_all' | null>(null);
  const [importDataPreview, setImportDataPreview] = useState<any>(null);
  const [wipeConfirmation, setWipeConfirmation] = useState('');

  useEffect(() => {
    const s = DB.getSettings();
    setSettings(s);
    setRateInput(s.exchange_rate.toString());
  }, []);

  const handleSaveRate = () => {
    const r = parseFloat(rateInput);
    if (isNaN(r) || r <= 0) {
      showToast('سعر الصرف غير صالح', 'error');
      return;
    }
    const newSettings: Settings = {
      ...settings!,
      exchange_rate: r,
      exchange_rate_updated: new Date().toISOString()
    };
    DB.saveSettings(newSettings);
    setSettings(newSettings);
    showToast('تم الحفظ بنجاح', 'success');
  };

  const exportData = () => {
    const data = {
      products: DB.getProducts(),
      transactions: DB.getTransactions(),
      settings: DB.getSettings()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    a.download = `watain_backup_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم التصدير بنجاح', 'success');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.products && json.transactions && json.settings) {
          setImportDataPreview(json);
          setModalType('import');
        } else {
          showToast('ملف البيانات غير صالح', 'error');
        }
      } catch (err) {
        showToast('خطأ في قراءة الملف', 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImport = () => {
    if (!importDataPreview) return;
    DB.saveProducts(importDataPreview.products);
    DB.saveTransactions(importDataPreview.transactions);
    DB.saveSettings(importDataPreview.settings);
    setSettings(importDataPreview.settings);
    setRateInput(importDataPreview.settings.exchange_rate.toString());
    showToast('تم الاستيراد بنجاح', 'success');
    setModalType(null);
  };

  const handleDeleteTxns = () => {
    DB.saveTransactions([]);
    showToast('تم المسح بنجاح', 'success');
    setModalType(null);
  };

  const handleWipeAll = () => {
    if (wipeConfirmation !== 'تأكيد') {
      showToast('يرجى كتابة كلمة "تأكيد"', 'error');
      return;
    }
    localStorage.removeItem('wt_products');
    localStorage.removeItem('wt_transactions');
    localStorage.removeItem('wt_settings');
    window.location.reload();
  };

  return (
    <div className="flex flex-col relative h-full">
      {/* HEADER */}
      <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center shadow-sm border border-gray-100 mb-3">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
          <SettingsIcon className="text-primary" size={18} /> الإعدادات
        </h1>
      </div>

      <div className="flex-1 flex flex-col gap-4 pb-8 max-w-md mx-auto w-full">
        
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-white rounded-2xl shadow border border-gray-100 flex items-center justify-center mx-auto mb-3">
             <Building2 size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-1">{settings?.company_name}</h2>
          <p className="text-gray-500 text-xs font-bold">نظام نقاط البيع v1.0</p>
        </div>

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
            <input 
              type="number" 
              min="1" step="1"
              value={rateInput}
              onChange={e => setRateInput(e.target.value)}
              className="flex-1 h-10 px-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 outline-none font-bold text-center bg-gray-50 text-sm"
              dir="ltr"
            />
            <button 
              onClick={handleSaveRate}
              className="px-4 bg-primary text-white font-bold rounded-lg flex items-center gap-1.5 hover:bg-primary-dark transition-colors text-sm"
            >
              <Save size={16} /> حفظ
            </button>
          </div>

          <div className="mt-3 bg-orange-50 border border-orange-100 p-2.5 rounded-lg flex items-start gap-1.5 text-warning text-[10px] font-bold">
            <AlertTriangle className="shrink-0 mt-0.5" size={14} />
            <p className="leading-tight">تنبيه: التغيير يؤثر على المبيعات الجديدة فقط.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2.5">
          <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
            <Database size={16} className="text-primary" /> البيانات
          </h3>
          
          <button 
            onClick={exportData}
            className="w-full h-10 bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-lg flex items-center justify-center gap-1.5 text-sm"
          >
            <Download size={16} className="text-primary" /> نسخ احتياطي
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-10 bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-lg flex items-center justify-center gap-1.5 text-sm"
          >
            <Upload size={16} className="text-success" /> استعادة
          </button>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4 flex flex-col gap-2.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1 h-full bg-danger" />
          <h3 className="text-sm font-bold text-danger mb-1 flex items-center gap-1.5">
            <AlertTriangle size={16} /> منطقة الخطر
          </h3>
          
          <button 
            onClick={() => setModalType('delete_txns')}
            className="w-full h-10 bg-red-50 border border-red-100 text-danger font-bold rounded-lg flex items-center justify-center gap-1.5 text-sm"
          >
            <Trash2 size={16} /> مسح السجلات
          </button>
          
          <button 
            onClick={() => { setWipeConfirmation(''); setModalType('wipe_all'); }}
            className="w-full h-10 bg-danger text-white font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-danger/20 text-sm"
          >
            <Trash2 size={16} /> ضبط المصنع
          </button>
        </div>
      </div>

      {/* MODALS */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModalType(null)}>
          <div className="bg-white w-full max-w-[320px] rounded-2xl shadow-xl p-5 text-center" onClick={e => e.stopPropagation()}>
            
            {modalType === 'import' && (
              <>
                <Upload size={32} className="text-primary mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900 mb-1">استعادة البيانات</h3>
                <p className="text-gray-500 mb-3 text-xs">سيتم استبدال البيانات الحالية.</p>
                <div className="bg-gray-50 p-2 rounded-lg mb-4 text-xs font-bold text-gray-700">
                  سيتم استيراد {importDataPreview?.products?.length || 0} منتج.
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setModalType(null)} className="flex-1 h-10 rounded-lg font-bold bg-gray-100 text-gray-700 text-sm">إلغاء</button>
                  <button onClick={confirmImport} className="flex-1 h-10 rounded-lg font-bold bg-primary text-white text-sm">تأكيد</button>
                </div>
              </>
            )}

            {modalType === 'delete_txns' && (
              <>
                <Trash2 size={32} className="text-danger mx-auto mb-3" />
                <h3 className="text-base font-bold text-gray-900 mb-1">مسح المبيعات</h3>
                <p className="text-gray-500 mb-4 text-xs">سيتم حذف سجل الفواتير، وتبقى المنتجات.</p>
                <div className="flex gap-2">
                  <button onClick={() => setModalType(null)} className="flex-1 h-10 rounded-lg font-bold bg-gray-100 text-gray-700 text-sm">إلغاء</button>
                  <button onClick={handleDeleteTxns} className="flex-1 h-10 rounded-lg font-bold bg-danger text-white text-sm">مسح</button>
                </div>
              </>
            )}

            {modalType === 'wipe_all' && (
              <>
                <AlertTriangle size={32} className="text-danger mx-auto mb-2 animate-pulse" />
                <h3 className="text-base font-black text-danger mb-1">ضبط المصنع!</h3>
                <p className="text-gray-500 mb-3 text-[11px] font-bold">لا يمكن التراجع. اكتب "تأكيد":</p>
                <input 
                  type="text" 
                  value={wipeConfirmation}
                  onChange={e => setWipeConfirmation(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border-2 border-gray-200 focus:border-danger outline-none mb-4 text-center font-bold text-sm"
                  placeholder="تأكيد"
                />
                <div className="flex gap-2">
                  <button onClick={() => setModalType(null)} className="flex-1 h-10 rounded-lg font-bold bg-gray-100 text-gray-700 text-sm">إلغاء</button>
                  <button 
                    onClick={handleWipeAll}
                    disabled={wipeConfirmation !== 'تأكيد'}
                    className="flex-1 h-10 rounded-lg font-bold bg-danger text-white disabled:opacity-50 text-sm"
                  >
                    مسح كلي
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
