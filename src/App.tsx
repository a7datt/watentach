import React, { useState } from 'react';
import { ShoppingCart, Package, BarChart3, Settings } from 'lucide-react';
import PosTab from './tabs/PosTab';
import InventoryTab from './tabs/InventoryTab';
import DashboardTab from './tabs/DashboardTab';
import SettingsTab from './tabs/SettingsTab';
import { ToastProvider } from './components/Toast';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'dashboard' | 'settings'>('pos');
  const [cartCount, setCartCount] = useState(0);

  const navItems = [
    { id: 'pos', icon: ShoppingCart, label: 'نقطة البيع', count: cartCount },
    { id: 'inventory', icon: Package, label: 'المخزون', count: 0 },
    { id: 'dashboard', icon: BarChart3, label: 'لوحة التحكم', count: 0 },
    { id: 'settings', icon: Settings, label: 'الإعدادات', count: 0 },
  ] as const;

  return (
    <div className="flex flex-col h-screen justify-between overflow-hidden bg-[#F8FAFC]">
      {/* Content wrapper with margin bottom to clear the fixed nav */}
      <main className="flex-1 overflow-y-auto mb-[60px] p-2 sm:p-4 no-scrollbar w-full max-w-7xl mx-auto">
        {activeTab === 'pos' && <PosTab setCartCount={setCartCount} />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      <nav className="fixed bottom-0 w-full h-[60px] bg-white border-t border-border-color z-40">
        <div className="flex h-full max-w-md mx-auto relative px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors duration-200 ${isActive ? 'text-primary' : 'text-text-secondary'}`}
              >
                <div className="relative mt-1">
                  <Icon size={20} className={isActive ? 'stroke-[2.5px]' : 'stroke-2'} />
                  {!!item.count && (
                    <span className="absolute -top-2 -right-2 bg-danger text-white text-[10px] font-bold min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full shadow-sm">
                      {item.count}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold">{item.label}</span>
                {isActive && <div className="absolute top-0 w-8 h-0.5 bg-primary rounded-b-full"></div>}
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
