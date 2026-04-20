import React, { useState, useCallback } from 'react';
import { ShoppingCart, Package, BarChart3, Settings, BookOpen } from 'lucide-react';
import PosTab from './tabs/PosTab';
import InventoryTab from './tabs/InventoryTab';
import DashboardTab from './tabs/DashboardTab';
import SettingsTab from './tabs/SettingsTab';
import DebtTab from './tabs/DebtTab';
import { ToastProvider } from './components/Toast';

type TabId = 'pos' | 'inventory' | 'dashboard' | 'debt' | 'settings';

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('pos');
  const [cartCount, setCartCount] = useState(0);
  const [debtUnpaidCount, setDebtUnpaidCount] = useState(0);

  const handleUnpaidCountChange = useCallback((count: number) => {
    setDebtUnpaidCount(count);
  }, []);

  const navItems = [
    { id: 'pos' as TabId, icon: ShoppingCart, label: 'البيع', count: cartCount },
    { id: 'inventory' as TabId, icon: Package, label: 'المخزون', count: 0 },
    { id: 'dashboard' as TabId, icon: BarChart3, label: 'التحكم', count: 0 },
    { id: 'debt' as TabId, icon: BookOpen, label: 'دفتر الدين', count: debtUnpaidCount },
    { id: 'settings' as TabId, icon: Settings, label: 'الإعدادات', count: 0 },
  ];

  return (
    <div className="flex flex-col h-screen justify-between overflow-hidden bg-[#F8FAFC]">
      <main className="flex-1 overflow-y-auto mb-[60px] p-2 sm:p-4 no-scrollbar w-full max-w-7xl mx-auto">
        {activeTab === 'pos' && <PosTab setCartCount={setCartCount} />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'debt' && <DebtTab onUnpaidCountChange={handleUnpaidCountChange} />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      <nav className="fixed bottom-0 w-full h-[60px] bg-white border-t border-border-color z-40">
        <div className="flex h-full max-w-xl mx-auto relative px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors duration-200 ${isActive ? 'text-primary' : 'text-text-secondary'}`}
              >
                <div className="relative mt-1">
                  <Icon size={19} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                  {!!item.count && (
                    <span className="absolute -top-2 -right-2 bg-danger text-white text-[9px] font-bold min-w-[15px] h-[15px] px-0.5 flex items-center justify-center rounded-full shadow-sm">
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
                {isActive && <div className="absolute top-0 w-8 h-0.5 bg-primary rounded-b-full" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
