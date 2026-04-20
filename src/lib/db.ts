// ===== SUPABASE DATABASE LAYER =====
import { createClient } from '@supabase/supabase-js';
import { Product, Transaction, TransactionItem, Settings, CashBoxState, CashBoxOperation, DebtRecord } from './types';

// المتغيرات البيئية
const SUPABASE_URL = import.meta.env.VITE_url as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_anon as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// PRODUCTS
// ============================================================
export const DB = {
  // --- جلب المنتجات ---
  getProducts: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('getProducts error:', error);
      return [];
    }
    return (data as Product[]) ?? [];
  },

  // --- إضافة منتج ---
  addProduct: async (product: Omit<Product, 'id' | 'created_at'>): Promise<Product | null> => {
    const { data, error } = await supabase
      .from('products')
      .insert([product])
      .select()
      .single();

    if (error) {
      console.error('addProduct error:', error);
      return null;
    }
    return data as Product;
  },

  // --- تعديل منتج ---
  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product | null> => {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('updateProduct error:', error);
      return null;
    }
    return data as Product;
  },

  // --- حذف منتج ---
  deleteProduct: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('deleteProduct error:', error);
      return false;
    }
    return true;
  },

  // --- تخفيض كميات بعد البيع ---
  decrementQuantities: async (items: { id: string; qty: number }[]): Promise<boolean> => {
    for (const item of items) {
      const { error } = await supabase.rpc('decrement_quantity', {
        p_id: item.id,
        p_qty: item.qty,
      });
      if (error) {
        // fallback: update directly
        const { data: prod } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.id)
          .single();
        if (prod) {
          await supabase
            .from('products')
            .update({ quantity: prod.quantity - item.qty })
            .eq('id', item.id);
        }
      }
    }
    return true;
  },

  // ============================================================
  // TRANSACTIONS
  // ============================================================

  // --- جلب الفواتير مع بنودها ---
  getTransactions: async (): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items (*)
      `)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('getTransactions error:', error);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      timestamp: row.timestamp,
      total_usd: Number(row.total_usd),
      total_syp: Number(row.total_syp),
      profit_usd: Number(row.profit_usd),
      profit_syp: Number(row.profit_syp),
      exchange_rate_at_sale: Number(row.exchange_rate_at_sale),
      cash_syp: Number(row.cash_syp ?? 0),
      cash_usd: Number(row.cash_usd ?? 0),
      items: (row.transaction_items ?? []).map((ti: any) => ({
        product_id: ti.product_id,
        name: ti.name,
        qty: ti.qty,
        cost_usd: Number(ti.cost_usd),
        price_usd: Number(ti.price_usd),
        price_syp: Number(ti.price_syp),
        subtotal_syp: Number(ti.subtotal_syp),
        subtotal_usd: Number(ti.subtotal_usd),
        currency: (ti.currency ?? 'SYP') as 'SYP' | 'USD',
      })) as TransactionItem[],
    }));
  },

  // --- عدد الفواتير (لتوليد رقم الفاتورة) ---
  getTransactionCount: async (): Promise<number> => {
    const { count, error } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    if (error) return 0;
    return count ?? 0;
  },

  // --- إضافة فاتورة مع بنودها ---
  saveTransaction: async (transaction: Transaction): Promise<boolean> => {
    // 1. أدخل الفاتورة الرئيسية
    const { error: txnError } = await supabase
      .from('transactions')
      .insert([{
        id: transaction.id,
        invoice_number: transaction.invoice_number,
        timestamp: transaction.timestamp,
        total_usd: transaction.total_usd,
        total_syp: transaction.total_syp,
        profit_usd: transaction.profit_usd,
        profit_syp: transaction.profit_syp,
        exchange_rate_at_sale: transaction.exchange_rate_at_sale,
        cash_syp: transaction.cash_syp,
        cash_usd: transaction.cash_usd,
      }]);

    if (txnError) {
      console.error('saveTransaction error:', txnError);
      return false;
    }

    // 2. أدخل البنود
    const items = transaction.items.map(item => ({
      transaction_id: transaction.id,
      product_id: item.product_id,
      name: item.name,
      qty: item.qty,
      cost_usd: item.cost_usd,
      price_usd: item.price_usd,
      price_syp: item.price_syp,
      subtotal_syp: item.subtotal_syp,
      subtotal_usd: item.subtotal_usd,
      currency: item.currency,
    }));

    const { error: itemsError } = await supabase
      .from('transaction_items')
      .insert(items);

    if (itemsError) {
      console.error('saveTransactionItems error:', itemsError);
      return false;
    }

    return true;
  },

  // --- حذف جميع الفواتير ---
  deleteAllTransactions: async (): Promise<boolean> => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .neq('id', ''); // حذف الكل

    if (error) {
      console.error('deleteAllTransactions error:', error);
      return false;
    }
    return true;
  },

  // ============================================================
  // CASH BOX (الصندوقان)
  // ============================================================

  // جلب رصيد الصندوقين (مجموع المبيعات - السحوبات)
  getCashBoxState: async (): Promise<CashBoxState> => {
    // مجموع المبيعات من جدول transactions
    const { data: txns } = await supabase
      .from('transactions')
      .select('cash_syp, cash_usd');

    // مجموع السحوبات من جدول cash_box_withdrawals
    const { data: withdrawals } = await supabase
      .from('cash_box_withdrawals')
      .select('currency, amount');

    let balance_syp = 0;
    let balance_usd = 0;

    (txns ?? []).forEach((t: any) => {
      balance_syp += Number(t.cash_syp ?? 0);
      balance_usd += Number(t.cash_usd ?? 0);
    });

    (withdrawals ?? []).forEach((w: any) => {
      if (w.currency === 'SYP') balance_syp -= Number(w.amount ?? 0);
      else if (w.currency === 'USD') balance_usd -= Number(w.amount ?? 0);
    });

    return { balance_syp, balance_usd };
  },

  // سجل سحب من الصندوق
  withdrawFromCashBox: async (currency: 'SYP' | 'USD', amount: number, note: string, type?: string): Promise<boolean> => {
    const { error } = await supabase
      .from('cash_box_withdrawals')
      .insert([{
        id: 'wdw_' + Date.now(),
        currency,
        amount,
        note,
        type: type ?? (amount < 0 ? 'deposit' : 'withdrawal'),
        timestamp: new Date().toISOString(),
      }]);

    if (error) {
      console.error('withdrawFromCashBox error:', error);
      return false;
    }
    return true;
  },

  // إيداع أرباح في الصندوق (يُضاف للصندوق فقط، ويُؤخذ من صافي الربح في التقارير)
  depositProfitToCashBox: async (currency: 'SYP' | 'USD', amount: number, note: string): Promise<boolean> => {
    const { error } = await supabase
      .from('cash_box_withdrawals')
      .insert([{
        id: 'wdw_' + Date.now(),
        currency,
        amount: -amount,  // سالب = إضافة للصندوق
        note: note || 'إيداع أرباح',
        type: 'profit_deposit',
        timestamp: new Date().toISOString(),
      }]);

    if (error) {
      console.error('depositProfitToCashBox error:', error);
      return false;
    }
    return true;
  },

  // جلب إجمالي إيداعات الأرباح (لخصمها من صافي الربح في الداشبورد)
  getProfitDeposits: async (): Promise<{ syp: number; usd: number }> => {
    const { data, error } = await supabase
      .from('cash_box_withdrawals')
      .select('currency, amount')
      .eq('type', 'profit_deposit');

    if (error || !data) return { syp: 0, usd: 0 };

    let syp = 0;
    let usd = 0;
    data.forEach((row: any) => {
      // amount مخزون كـ -X لذا نأخذ القيمة المطلقة
      const abs = Math.abs(Number(row.amount ?? 0));
      if (row.currency === 'SYP') syp += abs;
      else if (row.currency === 'USD') usd += abs;
    });
    return { syp, usd };
  },

  // جلب سجل عمليات الصندوق
  getCashBoxOperations: async (): Promise<CashBoxOperation[]> => {
    const { data, error } = await supabase
      .from('cash_box_withdrawals')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('getCashBoxOperations error:', error);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      type: (row.type ?? 'withdrawal') as CashBoxOperation['type'],
      currency: row.currency as 'SYP' | 'USD',
      amount: Number(row.amount),
      note: row.note,
      timestamp: row.timestamp,
    }));
  },

  // ============================================================
  // DEBT RECORDS (دفتر الدين)
  // ============================================================

  saveDebtRecord: async (debt: DebtRecord): Promise<boolean> => {
    // تحقق هل يوجد دين غير مسدد لنفس العميل
    const { data: existing } = await supabase
      .from('debt_records')
      .select('*')
      .eq('customer_name', debt.customer_name)
      .neq('status', 'paid')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      const old = existing[0];
      const mergedItems = [...(debt.items ?? []), ...(old.items ?? [])];
      const newTotalSYP = Number(old.total_syp ?? 0) + debt.total_syp;
      const newTotalUSD = Number(old.total_usd ?? 0) + debt.total_usd;
      const { error } = await supabase
        .from('debt_records')
        .update({
          items: mergedItems,
          total_syp: newTotalSYP,
          total_usd: newTotalUSD,
          timestamp: debt.timestamp,
          note: debt.note || old.note,
        })
        .eq('id', old.id);
      if (error) { console.error('mergeDebtRecord error:', error); return false; }
      return true;
    }

    const { error } = await supabase
      .from('debt_records')
      .insert([{
        id: debt.id,
        invoice_number: debt.invoice_number,
        customer_name: debt.customer_name,
        note: debt.note,
        timestamp: debt.timestamp,
        items: debt.items,
        total_syp: debt.total_syp,
        total_usd: debt.total_usd,
        paid_syp: debt.paid_syp,
        paid_usd: debt.paid_usd,
        status: debt.status,
      }]);

    if (error) {
      console.error('saveDebtRecord error:', error);
      return false;
    }
    return true;
  },

  getDebtRecords: async (): Promise<DebtRecord[]> => {
    const { data, error } = await supabase
      .from('debt_records')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('getDebtRecords error:', error);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      invoice_number: row.invoice_number,
      customer_name: row.customer_name,
      note: row.note,
      timestamp: row.timestamp,
      items: row.items ?? [],
      total_syp: Number(row.total_syp ?? 0),
      total_usd: Number(row.total_usd ?? 0),
      paid_syp: Number(row.paid_syp ?? 0),
      paid_usd: Number(row.paid_usd ?? 0),
      status: row.status as DebtRecord['status'],
    }));
  },

  updateDebtPayment: async (
    id: string,
    paid_syp: number,
    paid_usd: number,
    status: DebtRecord['status']
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('debt_records')
      .update({ paid_syp, paid_usd, status })
      .eq('id', id);

    if (error) {
      console.error('updateDebtPayment error:', error);
      return false;
    }
    return true;
  },

  deleteDebtRecord: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('debt_records')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('deleteDebtRecord error:', error);
      return false;
    }
    return true;
  },

  // ============================================================
  // SETTINGS
  // ============================================================

  getSettings: async (): Promise<Settings> => {
    const defaultSettings: Settings = {
      exchange_rate: 1600,
      company_name: 'وتين تك',
      exchange_rate_updated: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) return defaultSettings;

    return {
      exchange_rate: Number(data.exchange_rate),
      company_name: data.company_name,
      exchange_rate_updated: data.exchange_rate_updated,
    };
  },

  saveSettings: async (settings: Settings): Promise<boolean> => {
    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 1,
        exchange_rate: settings.exchange_rate,
        company_name: settings.company_name,
        exchange_rate_updated: settings.exchange_rate_updated,
      });

    if (error) {
      console.error('saveSettings error:', error);
      return false;
    }
    return true;
  },

  // ============================================================
  // RESET ALL (Factory Reset)
  // ============================================================
  wipeAll: async (): Promise<boolean> => {
    await supabase.from('transactions').delete().neq('id', '');
    await supabase.from('products').delete().neq('id', '');
    await supabase.from('cash_box_withdrawals').delete().neq('id', '');
    await supabase.from('debt_records').delete().neq('id', '');
    await supabase.from('settings').upsert({
      id: 1,
      exchange_rate: 1600,
      company_name: 'وتين تك',
      exchange_rate_updated: new Date().toISOString(),
    });
    return true;
  },

  // ============================================================
  // EXPORT / IMPORT (Backup)
  // ============================================================
  exportData: async () => {
    const [products, transactions, settings] = await Promise.all([
      DB.getProducts(),
      DB.getTransactions(),
      DB.getSettings(),
    ]);
    return { products, transactions, settings };
  },

  importData: async (data: {
    products: Product[];
    transactions: Transaction[];
    settings: Settings;
  }): Promise<boolean> => {
    try {
      // مسح البيانات القديمة
      await supabase.from('transactions').delete().neq('id', '');
      await supabase.from('products').delete().neq('id', '');

      // استيراد المنتجات
      if (data.products.length > 0) {
        await supabase.from('products').insert(data.products);
      }

      // استيراد الفواتير مع بنودها
      for (const txn of data.transactions) {
        await DB.saveTransaction(txn);
      }

      // استيراد الإعدادات
      await DB.saveSettings(data.settings);

      return true;
    } catch (err) {
      console.error('importData error:', err);
      return false;
    }
  },
};
// ===== END SUPABASE DATABASE LAYER =====
