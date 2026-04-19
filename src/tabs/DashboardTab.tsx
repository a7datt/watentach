import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Calendar, ChevronDown, ChevronUp, DollarSign, WalletCards, TrendingUp, PackageSearch, ListOrdered } from 'lucide-react';
import { DB } from '../lib/db';
import { Transaction, Product, Settings } from '../lib/types';
import { formatCurrencySYP, formatCurrencyUSD, formatDate } from '../lib/utils';
import { isToday, isThisWeek, isThisMonth, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';

type FilterType = 'today' | 'week' | 'month' | 'custom';

export default function DashboardTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [filterType, setFilterType] = useState<FilterType>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTransactions(DB.getTransactions());
    setProducts(DB.getProducts());
  }, []);

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
    let salesSYP = 0;
    let salesUSD = 0;
    let profitUSD = 0;
    let profitSYP = 0;

    filteredTransactions.forEach(txn => {
      salesSYP += txn.total_syp;
      salesUSD += txn.total_usd;
      profitUSD += txn.profit_usd;
      profitSYP += txn.profit_syp;
    });

    const inventoryValueUSD = products.reduce((sum, p) => sum + (p.cost_usd * p.quantity), 0);

    return { salesSYP, salesUSD, profitUSD, profitSYP, inventoryValueUSD };
  }, [filteredTransactions, products]);

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  return (
    <div className="flex flex-col relative h-full">
      {/* HEADER */}
      <div className="bg-white rounded-xl px-4 py-3 flex justify-between items-center shadow-sm border border-gray-100 mb-3">
        <h1 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
          <BarChart3 className="text-primary" size={18} /> لوحة التحكم
        </h1>
      </div>

      <div className="flex-1 flex flex-col gap-3 pb-8">
        
        {/* FILTER BAR */}
        <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-1">
          <button 
            onClick={() => setFilterType('today')}
            className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${filterType === 'today' ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >اليوم</button>
          <button 
            onClick={() => setFilterType('week')}
            className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${filterType === 'week' ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >الأسبوع</button>
          <button 
            onClick={() => setFilterType('month')}
            className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${filterType === 'month' ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >الشهر</button>
          <button 
            onClick={() => setFilterType('custom')}
            className={`flex-1 min-w-[90px] py-1.5 px-2 rounded-lg text-xs font-bold transition-colors flex justify-center items-center gap-1 ${filterType === 'custom' ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          ><Calendar size={14} /> مخصص</button>
        </div>

        {filterType === 'custom' && (
          <div className="flex gap-2 bg-white p-2.5 rounded-xl shadow-sm border border-primary-light animate-in fade-in slide-in-from-top-2">
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

        {/* STATS CARDS */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-primary" />
            <div className="flex justify-between items-start mb-2">
              <div className="text-[10px] font-bold text-gray-500">إجمالي المبيعات</div>
              <div className="w-6 h-6 rounded-md bg-primary-light text-primary flex items-center justify-center">
                <WalletCards size={12} />
              </div>
            </div>
            <div className="text-sm font-black text-gray-900 truncate">
              {formatCurrencySYP(stats.salesSYP)}
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-blue-400" />
            <div className="flex justify-between items-start mb-2">
              <div className="text-[10px] font-bold text-gray-500">إجمالي المبيعات</div>
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center">
                <DollarSign size={12} />
              </div>
            </div>
            <div className="text-sm font-black text-gray-900 truncate">
              {formatCurrencyUSD(stats.salesUSD)}
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-success" />
            <div className="flex justify-between items-start mb-2">
              <div className="text-[10px] font-bold text-gray-500">صافي الربح</div>
              <div className="w-6 h-6 rounded-md bg-green-50 text-success flex items-center justify-center">
                <TrendingUp size={12} />
              </div>
            </div>
            <div className="text-sm font-black text-gray-900 truncate">
              {formatCurrencyUSD(stats.profitUSD)}
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-warning" />
            <div className="flex justify-between items-start mb-2">
              <div className="text-[10px] font-bold text-gray-500">قيمة المخزون</div>
              <div className="w-6 h-6 rounded-md bg-orange-50 text-warning flex items-center justify-center">
                <PackageSearch size={12} />
              </div>
            </div>
            <div className="text-sm font-black text-gray-900 truncate">
              {formatCurrencyUSD(stats.inventoryValueUSD)}
            </div>
          </div>
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
              <table className="w-full text-right text-xs border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500">
                    <th className="py-2.5 px-3 font-bold"># رقم</th>
                    <th className="py-2.5 px-3 font-bold">التاريخ</th>
                    <th className="py-2.5 px-3 font-bold">ل.س</th>
                    <th className="py-2.5 px-3 font-bold">$</th>
                    <th className="py-2.5 px-3 font-bold">الربح $</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(txn => {
                    const isExpanded = expandedRows.has(txn.id);
                    return (
                      <React.Fragment key={txn.id}>
                        <tr 
                          onClick={() => toggleRow(txn.id)}
                          className={`border-b border-gray-50 hover:bg-primary-light/30 cursor-pointer transition-colors ${isExpanded ? 'bg-primary-light/20' : ''}`}
                        >
                          <td className="py-3 px-3 font-bold text-gray-900 flex items-center gap-1.5">
                            {isExpanded ? <ChevronUp size={14} className="text-primary" /> : <ChevronDown size={14} className="text-gray-400" />}
                            #{txn.invoice_number}
                          </td>
                          <td className="py-3 px-3 text-gray-600 font-medium" dir="ltr">
                            {formatDate(txn.timestamp)}
                          </td>
                          <td className="py-3 px-3 font-bold text-primary">{txn.total_syp.toLocaleString('en-US')}</td>
                          <td className="py-3 px-3 font-bold text-gray-800">${txn.total_usd.toFixed(2)}</td>
                          <td className="py-3 px-3 font-bold text-success">${txn.profit_usd.toFixed(2)}</td>
                        </tr>
                        
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0 border-b border-gray-100 bg-gray-50/80">
                              <div className="px-6 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <table className="w-full text-right text-[11px]">
                                  <thead>
                                    <tr className="text-gray-400 border-b border-gray-200">
                                      <th className="py-1 font-semibold">الصنف</th>
                                      <th className="py-1 font-semibold text-center">الكمية</th>
                                      <th className="py-1 font-semibold">المجموع</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {txn.items.map((item, idx) => (
                                      <tr key={idx} className="border-b border-gray-100/50 last:border-0 text-gray-700">
                                        <td className="py-1.5 font-bold">{item.name}</td>
                                        <td className="py-1.5 text-center font-bold">{item.qty}</td>
                                        <td className="py-1.5 font-bold text-gray-900">${item.subtotal_usd.toFixed(2)}</td>
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
      </div>
    </div>
  );
}
