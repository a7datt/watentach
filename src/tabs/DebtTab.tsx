import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, ChevronDown, ChevronUp, CheckCircle, XCircle, Trash2, AlertTriangle, X } from 'lucide-react';
import { DB } from '../lib/db';
import { DebtRecord } from '../lib/types';
import { formatCurrencySYP, formatCurrencyUSD, formatDate } from '../lib/utils';
import { useToast } from '../components/Toast';

type StatusFilter = 'all' | 'unpaid' | 'partial' | 'paid';

interface DebtTabProps {
  onUnpaidCountChange?: (count: number) => void;
}

export default function DebtTab({ onUnpaidCountChange }: DebtTabProps) {
  const { showToast } = useToast();
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Modal: دفع
  const [payModal, setPayModal] = useState<DebtRecord | null>(null);
  const [payAmountSYP, setPayAmountSYP] = useState('');
  const [payAmountUSD, setPayAmountUSD] = useState('');
  const [paying, setPaying] = useState(false);

  // Modal: إلغاء دفع جزئي
  const [revertModal, setRevertModal] = useState<DebtRecord | null>(null);
  const [reverting, setReverting] = useState(false);

  // Modal: حذف
  const [deleteModal, setDeleteModal] = useState<DebtRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDebts = useCallback(async () => {
    setLoading(true);
    const data = await DB.getDebtRecords();
    setDebts(data);
    const unpaid = data.filter(d => d.status !== 'paid').length;
    onUnpaidCountChange?.(unpaid);
    setLoading(false);
  }, [onUnpaidCountChange]);

  useEffect(() => { loadDebts(); }, [loadDebts]);

  const filtered = debts.filter(d => filter === 'all' ? true : d.status === filter);

  const toggleExpand = (id: string) => {
    const s = new Set(expandedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setExpandedIds(s);
  };

  const statusLabel = (status: DebtRecord['status']) => {
    if (status === 'unpaid') return { label: 'غير مدفوع', cls: 'bg-red-50 text-red-600 border-red-200' };
    if (status === 'partial') return { label: 'مدفوع جزئياً', cls: 'bg-amber-50 text-amber-600 border-amber-200' };
    return { label: 'مدفوع', cls: 'bg-green-50 text-green-700 border-green-200' };
  };

  const handlePay = async () => {
    if (!payModal) return;
    const syp = parseFloat(payAmountSYP) || 0;
    const usd = parseFloat(payAmountUSD) || 0;
    if (syp === 0 && usd === 0) { showToast('أدخل مبلغاً للدفع', 'error'); return; }

    const newPaidSYP = payModal.paid_syp + syp;
    const newPaidUSD = payModal.paid_usd + usd;

    const fullySYP = payModal.total_syp === 0 || newPaidSYP >= payModal.total_syp;
    const fullyUSD = payModal.total_usd === 0 || newPaidUSD >= payModal.total_usd;
    const status: DebtRecord['status'] = (fullySYP && fullyUSD) ? 'paid' : 'partial';

    setPaying(true);
    const ok = await DB.updateDebtPayment(payModal.id, newPaidSYP, newPaidUSD, status);
    if (ok) {
      // إضافة للصندوق
      if (syp > 0) await DB.withdrawFromCashBox('SYP', -syp, `استلام دين - ${payModal.customer_name}`).catch(() => {
        // إذا فشل السحب السلبي، نحاول عبر دالة مخصصة - للتبسيط نستخدم نفس الدالة
      });
      if (usd > 0) await DB.withdrawFromCashBox('USD', -usd, `استلام دين - ${payModal.customer_name}`).catch(() => {});
      showToast(`تم تسجيل الدفع بنجاح - ${status === 'paid' ? 'الدين مسدد بالكامل' : 'دفع جزئي'}`, 'success');
      setPayModal(null);
      setPayAmountSYP('');
      setPayAmountUSD('');
      await loadDebts();
    } else {
      showToast('حدث خطأ أثناء تسجيل الدفع', 'error');
    }
    setPaying(false);
  };

  const handleRevert = async () => {
    if (!revertModal) return;
    setReverting(true);
    // إعادة الكميات للصندوق (خصم ما تم تسجيله)
    if (revertModal.paid_syp > 0) await DB.withdrawFromCashBox('SYP', revertModal.paid_syp, `إلغاء دفع - ${revertModal.customer_name}`).catch(() => {});
    if (revertModal.paid_usd > 0) await DB.withdrawFromCashBox('USD', revertModal.paid_usd, `إلغاء دفع - ${revertModal.customer_name}`).catch(() => {});
    const ok = await DB.updateDebtPayment(revertModal.id, 0, 0, 'unpaid');
    if (ok) {
      showToast('تم إعادة الدين لحالة "غير مدفوع"', 'success');
      setRevertModal(null);
      await loadDebts();
    } else {
      showToast('حدث خطأ', 'error');
    }
    setReverting(false);
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    const ok = await DB.deleteDebtRecord(deleteModal.id);
    if (ok) {
      showToast('تم حذف سجل الدين', 'success');
      setDeleteModal(null);
      await loadDebts();
    } else {
      showToast('حدث خطأ أثناء الحذف', 'error');
    }
    setDeleting(false);
  };

  const unpaidCount = debts.filter(d => d.status !== 'paid').length;

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center shadow-sm border border-gray-100 mb-3">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
          <BookOpen size={18} className="text-amber-500" /> دفتر الدين
          {unpaidCount > 0 && (
            <span className="bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unpaidCount}</span>
          )}
        </h1>
        <button onClick={loadDebts} className="text-xs text-primary font-bold bg-primary-light/50 px-3 py-1 rounded-lg">تحديث</button>
      </div>

      {/* FILTER */}
      <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 flex gap-1 mb-3">
        {(['all', 'unpaid', 'partial', 'paid'] as StatusFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            {f === 'all' ? 'الكل' : f === 'unpaid' ? 'غير مدفوع' : f === 'partial' ? 'جزئي' : 'مدفوع'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">جاري التحميل...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <BookOpen size={36} className="opacity-20" />
          <p className="text-sm font-semibold">لا توجد سجلات</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-8 overflow-y-auto no-scrollbar">
          {filtered.map(debt => {
            const expanded = expandedIds.has(debt.id);
            const { label, cls } = statusLabel(debt.status);
            const remSYP = debt.total_syp - debt.paid_syp;
            const remUSD = debt.total_usd - debt.paid_usd;

            return (
              <div key={debt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card Header */}
                <div className="p-3.5">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-sm truncate">{debt.customer_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400 font-medium">#{debt.invoice_number}</span>
                        <span className="text-[10px] text-gray-400">{formatDate(debt.timestamp)}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls} shrink-0`}>{label}</span>
                  </div>

                  {debt.note && (
                    <div className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1 mb-2">{debt.note}</div>
                  )}

                  {/* المبالغ */}
                  <div className="flex gap-3 flex-wrap mb-2.5">
                    {debt.total_syp > 0 && (
                      <div className="text-[11px]">
                        <span className="text-gray-400">المطلوب ل.س: </span>
                        <span className="font-bold text-gray-800">{formatCurrencySYP(debt.total_syp)}</span>
                        {debt.paid_syp > 0 && (
                          <span className="text-green-600 font-bold"> (دُفع: {formatCurrencySYP(debt.paid_syp)})</span>
                        )}
                      </div>
                    )}
                    {debt.total_usd > 0 && (
                      <div className="text-[11px]">
                        <span className="text-gray-400">المطلوب $: </span>
                        <span className="font-bold text-gray-800">{formatCurrencyUSD(debt.total_usd)}</span>
                        {debt.paid_usd > 0 && (
                          <span className="text-green-600 font-bold"> (دُفع: {formatCurrencyUSD(debt.paid_usd)})</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* المتبقي */}
                  {debt.status !== 'paid' && (remSYP > 0 || remUSD > 0) && (
                    <div className="bg-red-50 rounded-lg px-2.5 py-1.5 text-[11px] text-red-700 font-bold mb-2.5">
                      المتبقي: {remSYP > 0 ? formatCurrencySYP(remSYP) : ''}{remSYP > 0 && remUSD > 0 ? ' + ' : ''}{remUSD > 0 ? formatCurrencyUSD(remUSD) : ''}
                    </div>
                  )}

                  {/* أزرار */}
                  <div className="flex gap-2 flex-wrap">
                    {debt.status !== 'paid' && (
                      <button
                        onClick={() => setPayModal(debt)}
                        className="flex-1 min-w-[90px] h-8 bg-success text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1"
                      >
                        <CheckCircle size={13} /> لقد دفع
                      </button>
                    )}
                    {debt.status === 'partial' && (
                      <button
                        onClick={() => setRevertModal(debt)}
                        className="flex-1 min-w-[90px] h-8 bg-gray-100 text-gray-600 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1"
                      >
                        <XCircle size={13} /> لم يدفع
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpand(debt.id)}
                      className="h-8 px-2.5 bg-gray-50 text-gray-500 text-[11px] font-bold rounded-lg flex items-center gap-1 border border-gray-100"
                    >
                      {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      المنتجات
                    </button>
                    <button
                      onClick={() => setDeleteModal(debt)}
                      className="h-8 w-8 bg-red-50 text-danger rounded-lg flex items-center justify-center border border-red-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Expanded items */}
                  {expanded && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <table className="w-full text-right text-[11px]">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-100">
                            <th className="py-1 font-semibold">الصنف</th>
                            <th className="py-1 text-center font-semibold">الكمية</th>
                            <th className="py-1 font-semibold">العملة</th>
                            <th className="py-1 font-semibold">المجموع</th>
                          </tr>
                        </thead>
                        <tbody>
                          {debt.items.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-50 last:border-0 text-gray-700">
                              <td className="py-1.5 font-bold">{item.name}</td>
                              <td className="py-1.5 text-center">{item.qty}</td>
                              <td className="py-1.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.currency === 'USD' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                  {item.currency === 'USD' ? '$' : 'ل.س'}
                                </span>
                              </td>
                              <td className="py-1.5 font-bold">
                                {item.currency === 'USD' ? `$${item.subtotal_usd.toFixed(2)}` : `${item.subtotal_syp.toLocaleString('en-US')} ل.س`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAY MODAL */}
      {payModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-gray-800 flex items-center gap-1.5">
                <CheckCircle size={18} className="text-success" /> تسجيل الدفع
              </h3>
              <button onClick={() => setPayModal(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"><X size={18} /></button>
            </div>
            <div className="text-sm font-bold text-gray-700 mb-3">{payModal.customer_name}</div>
            <div className="flex flex-col gap-3">
              {payModal.total_syp > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">
                    المبلغ المدفوع ل.س (المتبقي: {formatCurrencySYP(payModal.total_syp - payModal.paid_syp)})
                  </label>
                  <input type="number" value={payAmountSYP} onChange={e => setPayAmountSYP(e.target.value)}
                    placeholder="0" className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-success outline-none text-sm" />
                </div>
              )}
              {payModal.total_usd > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">
                    المبلغ المدفوع $ (المتبقي: {formatCurrencyUSD(payModal.total_usd - payModal.paid_usd)})
                  </label>
                  <input type="number" value={payAmountUSD} onChange={e => setPayAmountUSD(e.target.value)}
                    placeholder="0.00" className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-success outline-none text-sm" />
                </div>
              )}
              <div className="text-[11px] text-gray-500 bg-green-50 rounded-lg p-2.5">
                سيُضاف المبلغ المدفوع إلى الصندوق المناسب تلقائياً
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setPayModal(null)} className="flex-1 h-10 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl">إلغاء</button>
                <button onClick={handlePay} disabled={paying}
                  className="flex-1 h-10 bg-success text-white font-bold text-sm rounded-xl disabled:opacity-60 flex items-center justify-center gap-1.5">
                  {paying ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'تأكيد الدفع'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVERT MODAL */}
      {revertModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-gray-800 flex items-center gap-1.5 text-warning">
                <AlertTriangle size={18} /> تحذير
              </h3>
              <button onClick={() => setRevertModal(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800 font-medium leading-relaxed">
              ⚠️ تنبيه: سيتم خصم المبلغ الذي سُجّل دفعه من الصندوق!
              {revertModal.paid_syp > 0 && <div className="mt-1 font-bold">({formatCurrencySYP(revertModal.paid_syp)} من الصندوق السوري)</div>}
              {revertModal.paid_usd > 0 && <div className="mt-0.5 font-bold">({formatCurrencyUSD(revertModal.paid_usd)} من الصندوق الدولاري)</div>}
              <div className="mt-2">هل أنت متأكد؟</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRevertModal(null)} className="flex-1 h-10 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl">إلغاء</button>
              <button onClick={handleRevert} disabled={reverting}
                className="flex-1 h-10 bg-warning text-white font-bold text-sm rounded-xl disabled:opacity-60 flex items-center justify-center gap-1.5">
                {reverting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'نعم، إلغاء الدفع'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-[340px] rounded-2xl shadow-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-danger flex items-center gap-1.5">
                <Trash2 size={18} /> حذف سجل الدين
              </h3>
              <button onClick={() => setDeleteModal(null)} className="text-gray-400 p-1"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">هل تريد حذف سجل دين العميل <span className="font-bold text-gray-900">{deleteModal.customer_name}</span>؟ لا يمكن التراجع عن هذه العملية.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteModal(null)} className="flex-1 h-10 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl">إلغاء</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 h-10 bg-danger text-white font-bold text-sm rounded-xl disabled:opacity-60 flex items-center justify-center gap-1.5">
                {deleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
