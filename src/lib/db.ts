// ===== SUPABASE DATABASE LAYER =====
import { createClient } from '@supabase/supabase-js';
import { Product, Transaction, TransactionItem, Settings } from './types';

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
      items: (row.transaction_items ?? []).map((ti: any) => ({
        product_id: ti.product_id,
        name: ti.name,
        qty: ti.qty,
        cost_usd: Number(ti.cost_usd),
        price_usd: Number(ti.price_usd),
        price_syp: Number(ti.price_syp),
        subtotal_syp: Number(ti.subtotal_syp),
        subtotal_usd: Number(ti.subtotal_usd),
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
