import React from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { X, CheckCircle2, Server, Info } from 'lucide-react';
import { Button } from './ui/Button';

export const IntegrationInfoModal: React.FC = () => {
  const { showDemoInfoModal, setShowDemoInfoModal } = useShopPilot();

  if (!showDemoInfoModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-surface rounded-xl max-w-2xl w-full shadow-card border border-secondary-tint overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-brand-dark text-white p-5 flex items-center justify-between border-b border-brand-dark">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-brand-tint">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">Grocery Data Integration Boundaries & Architecture</h3>
          </div>
          <button
            onClick={() => setShowDemoInfoModal(false)}
            className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-ink leading-relaxed font-sans">
          {/* Status Banner */}
          <div className="bg-secondary-tint border border-secondary/20 rounded-xl p-3.5 text-secondary flex items-start gap-3">
            <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wide text-secondary">
                Data Transparency Declaration
              </h4>
              <p className="mt-1 text-ink-muted">
                <strong>Demo mode — simulated store prices and availability.</strong> ShopPilot AI currently operates exclusively with mock grocery datasets for Blinkit, Zepto, and Swiggy Instamart. The application does not claim live connections to external quick-commerce private APIs.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-ink text-sm">Adapter Abstraction Architecture</h4>
            <p className="text-ink-muted">
              To maintain clean modularity and ensure seamless transition to production, all store-specific behavior is encapsulated behind the <code className="bg-paper text-ink px-1.5 py-0.5 rounded border border-secondary-tint">IGroceryStoreAdapter</code> interface:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 rounded-xl border border-secondary-tint bg-paper space-y-1">
                <div className="font-bold text-ink flex items-center justify-between">
                  <span>Blinkit Adapter</span>
                  <span className="text-[10px] bg-secondary-tint text-secondary px-2 py-0.5 rounded-full font-semibold border border-secondary/20">MOCK</span>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Simulates 12-min delivery, ₹199 min order, ₹25 delivery fee, and free delivery over ₹499.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-secondary-tint bg-paper space-y-1">
                <div className="font-bold text-ink flex items-center justify-between">
                  <span>Zepto Adapter</span>
                  <span className="text-[10px] bg-secondary-tint text-secondary px-2 py-0.5 rounded-full font-semibold border border-secondary/20">MOCK</span>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Simulates 10-min delivery, ₹149 min order, ₹20 delivery fee, and free delivery over ₹399.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-secondary-tint bg-paper space-y-1">
                <div className="font-bold text-ink flex items-center justify-between">
                  <span>Instamart Adapter</span>
                  <span className="text-[10px] bg-secondary-tint text-secondary px-2 py-0.5 rounded-full font-semibold border border-secondary/20">MOCK</span>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Simulates 16-min delivery, ₹199 min order, ₹29 delivery fee, and free delivery over ₹499.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-secondary-tint">
            <h4 className="font-bold text-ink text-sm">Future Live Integration Path</h4>
            <ul className="space-y-2 text-ink-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-good shrink-0 mt-0.5" />
                <span>
                  <strong className="text-ink">Authorized Partner API Integration:</strong> Implement live adapters via formal B2B partner APIs or authorized OAuth integrations once access agreements are established.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-good shrink-0 mt-0.5" />
                <span>
                  <strong className="text-ink">Delivery Pincode / Geolocation:</strong> Live quick-commerce dark stores vary inventory by precise user lat/long. Real adapters will dynamically inject the user delivery address.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-good shrink-0 mt-0.5" />
                <span>
                  <strong className="text-ink">Pre-Checkout Re-Validation Safeguard:</strong> Before firing an autonomous order, the backend must verify that stock remains available and pricing has not surged beyond authorized thresholds.
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-secondary-tint flex justify-end">
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowDemoInfoModal(false)}
            >
              Understood
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
