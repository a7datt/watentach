// ===== DATABASE LAYER =====
// Replace these functions with real API calls when backend is ready

import { Product, Transaction, Settings } from './types';

const SEED_PRODUCTS: Product[] = [
  { id: "prod_1", name:"كولا 330ml", barcode:"5000112637939", cost_usd:0.30, price_usd:0.50, quantity:50, created_at: new Date().toISOString() },
  { id: "prod_2", name:"شيبس ليز", barcode:"4890008100309", cost_usd:0.20, price_usd:0.40, quantity:30, created_at: new Date().toISOString() },
  { id: "prod_3", name:"مياه معدنية", barcode:"6281006531229", cost_usd:0.10, price_usd:0.20, quantity:100, created_at: new Date().toISOString() }
];

export const DB = {
  getProducts: (): Product[] => {
    try {
      const data = localStorage.getItem('wt_products');
      if (!data) {
        DB.saveProducts(SEED_PRODUCTS);
        return SEED_PRODUCTS;
      }
      const parsed = JSON.parse(data);
      if (parsed.length === 0) {
        DB.saveProducts(SEED_PRODUCTS);
        return SEED_PRODUCTS;
      }
      return parsed;
    } catch {
      return SEED_PRODUCTS;
    }
  },
  
  saveProducts: (data: Product[]): void => {
    localStorage.setItem('wt_products', JSON.stringify(data));
  },

  getTransactions: (): Transaction[] => {
    const data = localStorage.getItem('wt_transactions');
    return data ? JSON.parse(data) : [];
  },
  
  saveTransactions: (data: Transaction[]): void => {
    localStorage.setItem('wt_transactions', JSON.stringify(data));
  },

  getSettings: (): Settings => {
    const defaultSettings: Settings = {
      exchange_rate: 1600,
      company_name: "وتين تك",
      exchange_rate_updated: new Date().toISOString()
    };
    try {
      const data = localStorage.getItem('wt_settings');
      return data ? JSON.parse(data) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  },
  
  saveSettings: (data: Settings): void => {
    localStorage.setItem('wt_settings', JSON.stringify(data));
  },
};
// ===== END DATABASE LAYER =====
