import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Search, Edit, Trash2, Camera, AlertTriangle, Save, Tag } from 'lucide-react';
import { DB } from '../lib/db';
import { Product, Settings } from '../lib/types';
import { useToast } from '../components/Toast';
import { formatCurrencySYP, formatCurrencyUSD } from '../lib/utils';
import BarcodeScanner from '../components/BarcodeScanner';

type ModalMode = 'add' | 'edit' | null;

export default function InventoryTab() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCostUSD, setFormCostUSD] = useState('');
  const [formPriceUSD, setFormPriceUSD] = useState('');
  const [formQuantity, setFormQuantity] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [prods, sett] = await Promise.all([DB.getProducts(), DB.getSettings()]);
    setProducts(prods);
    setSettings(sett);
    setLoading(false);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery)
    );
  }, [products, searchQuery]);

  const openAddModal = () => {
    setFormId('');
    setFormName('');
    setFormBarcode('');
    setFormCostUSD('');
    setFormPriceUSD('');
    setFormQuantity('');
    setModalMode('add');
  };

  const openEditModal = (product: Product) => {
    setFormId(product.id);
    setFormName(product.name);
    setFormBarcode(product.barcode);
    setFormCostUSD(product.cost_usd.toString());
    setFormPriceUSD(product.price_usd.toString());
    setFormQuantity(product.quantity.toString());
    setModalMode('edit');
  };

  const handleSave = async () => {
    if (!formName || !formBarcode || !formCostUSD || !formPriceUSD || !formQuantity) {
      showToast('يرجى تعبئة جميع الحقول المطلوبة', 'error');
      return;
    }

    if (parseFloat(formPriceUSD) < parseFloat(formCostUSD)) {
      showToast('ملاحظة: سعر البيع أقل من سعر الشراء!', 'warning');
    }

    const costStr = parseFloat(formCostUSD);
    const priceStr = parseFloat(formPriceUSD);
    const qtyStr = parseInt(formQuantity, 10);

    setSaving(true);

    if (modalMode === 'add') {
      const newProduct = await DB.addProduct({
        name: formName,
        barcode: formBarcode,
        cost_usd: costStr,
        price_usd: priceStr,
        quantity: qtyStr,
      });

      if (newProduct) {
        setProducts(prev => [...prev, newProduct]);
        showToast('تمت الإضافة بنجاح', 'success');
      } else {
        showToast('حدث خطأ أثناء الإضافة', 'error');
      }
    } else {
      const updated = await DB.updateProduct(formId, {
        name: formName,
        barcode: formBarcode,
        cost_usd: costStr,
        price_usd: priceStr,
        quantity: qtyStr,
      });

      if (updated) {
        setProducts(prev => prev.map(p => p.id === formId ? updated : p));
        showToast('تم التعديل بنجاح', 'success');
      } else {
        showToast('حدث خطأ أثناء التعديل', 'error');
      }
    }

    setSaving(false);
    setModalMode(null);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setSaving(true);
    const ok = await DB.deleteProduct(confirmDeleteId);
    if (ok) {
      setProducts(prev => prev.filter(p => p.id !== confirmDeleteId));
      showToast('تم الحذف', 'success');
    } else {
      showToast('حدث خطأ أثناء الحذف', 'error');
    }
    setSaving(false);
    setConfirmDeleteId(null);
  };

  const pricePreview = parseFloat(formPriceUSD) * (settings?.exchange_rate || 1600);

  return (
    <div className="flex flex-col relative h-full">
      {/* HEADER */}
      <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center shadow-sm border border-gray-100 mb-3">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
          <Package className="text-primary" size={18} /> المخزون
        </h1>
        <button
          onClick={openAddModal}
          className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={16} /> إضافة
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-3 pb-8">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="بحث..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-3 pr-9 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all bg-white"
          />
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 mt-10">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold">جاري التحميل...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 mt-10">
            <Package size={40} className="opacity-20" />
            <p className="font-semibold text-sm">لا يوجد منتجات مسجلة</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredProducts.map(p => {
              const sypPrice = p.price_usd * (settings?.exchange_rate || 1600);
              const isOutOfStock = p.quantity <= 0;
              const isLowStock = p.quantity > 0 && p.quantity <= 5;

              return (
                <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                        <Tag size={12} className="text-gray-400" /> {p.name}
                      </h3>
                      <div className="text-[10px] text-gray-500 mt-0.5">{p.barcode}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditModal(p)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-lg">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => setConfirmDeleteId(p.id)} className="p-1.5 text-gray-400 hover:text-danger hover:bg-red-50 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-end border-t border-gray-50 pt-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-[10px] text-gray-400">سعر البيع</div>
                        <div className="font-bold text-primary text-sm">{formatCurrencySYP(sypPrice)}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1
                      ${isOutOfStock ? 'bg-red-100 text-danger' : isLowStock ? 'bg-orange-100 text-warning' : 'bg-green-100 text-success'}
                    `}>
                      {isOutOfStock ? <AlertTriangle size={10} /> : null}
                      الكمية: {p.quantity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModalMode(null)}>
          <div className="bg-white w-full max-w-[360px] rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="text-base font-bold text-gray-800">
                {modalMode === 'add' ? 'إضافة منتج' : 'تعديل المنتج'}
              </h2>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الاسم</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:border-primary outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الباركود</label>
                <div className="flex gap-2">
                  <input type="text" value={formBarcode} onChange={e => setFormBarcode(e.target.value)} className="flex-1 h-10 px-3 rounded-lg border border-gray-200 outline-none text-sm" />
                  <button onClick={() => setShowScanner(true)} className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center"><Camera size={18} /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">الشراء ($)</label>
                  <input type="number" value={formCostUSD} onChange={e => setFormCostUSD(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">البيع ($)</label>
                  <input type="number" value={formPriceUSD} onChange={e => setFormPriceUSD(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-200 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">الكمية</label>
                <input type="number" value={formQuantity} onChange={e => setFormQuantity(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-200 outline-none text-sm" />
              </div>

              <div className="bg-primary-light/50 p-2.5 rounded-lg border border-blue-50 mt-1">
                <div className="text-[10px] text-primary font-bold">المعادل بالليرة السورية:</div>
                <div className="text-sm font-black text-primary">{isNaN(pricePreview) ? '0' : formatCurrencySYP(pricePreview)}</div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex gap-2">
              <button onClick={() => setModalMode(null)} className="flex-1 h-10 rounded-lg font-bold bg-white border border-gray-200 text-sm text-gray-600">إلغاء</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-10 rounded-lg font-bold bg-primary text-white text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save size={16} /> حفظ</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white w-full max-w-[300px] rounded-2xl shadow-xl p-5 text-center" onClick={e => e.stopPropagation()}>
            <AlertTriangle size={32} className="text-danger mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900 mb-1">تأكيد الحذف</h3>
            <p className="text-gray-500 text-xs mb-4">هل أنت متأكد من حذف المنتج؟</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 h-10 rounded-lg font-bold bg-gray-100 text-gray-700 text-sm">إلغاء</button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 h-10 rounded-lg font-bold bg-danger text-white text-sm disabled:opacity-60"
              >
                {saving ? '...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && <BarcodeScanner onScan={setFormBarcode} onClose={() => setShowScanner(false)} />}
    </div>
  );
}
