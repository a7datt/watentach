export interface Product {
  id: string;
  name: string;
  barcode: string;
  cost_usd: number;
  price_usd: number;
  quantity: number;
  created_at: string;
}

export interface TransactionItem {
  product_id: string;
  name: string;
  qty: number;
  cost_usd: number;
  price_usd: number;
  price_syp: number;
  subtotal_syp: number;
  subtotal_usd: number;
  currency: 'SYP' | 'USD'; // عملة البيع لهذا المنتج
}

export interface Transaction {
  id: string;
  invoice_number: string;
  timestamp: string;
  items: TransactionItem[];
  total_usd: number;
  total_syp: number;
  profit_usd: number;
  profit_syp: number;
  exchange_rate_at_sale: number;
  cash_syp: number;  // ما ذهب للصندوق السوري
  cash_usd: number;  // ما ذهب للصندوق الدولاري
}

export interface Settings {
  exchange_rate: number;
  exchange_rate_updated: string;
  company_name: string;
}

// نوع عمليات الصندوق
export interface CashBoxOperation {
  id: string;
  type: 'sale' | 'withdrawal' | 'profit_withdrawal' | 'deposit' | 'profit_deposit';
  currency: 'SYP' | 'USD';
  amount: number;
  note?: string;
  timestamp: string;
}

// حالة الصندوقين
export interface CashBoxState {
  balance_syp: number;
  balance_usd: number;
}

// سجل الدين
export interface DebtRecord {
  id: string;
  customer_name: string;
  note?: string;
  timestamp: string;
  items: TransactionItem[];
  total_syp: number;
  total_usd: number;
  paid_syp: number;
  paid_usd: number;
  status: 'unpaid' | 'partial' | 'paid';
  invoice_number: string;
}
