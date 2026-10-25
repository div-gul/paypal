import React from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { X, ShieldAlert, CheckCircle2, Server } from 'lucide-react';

export const IntegrationInfoModal: React.FC = () => {
  const { showDemoInfoModal, setShowDemoInfoModal } = useShopPilot();

  if (!showDemoInfoModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Server className="w-5 h-5 text-brand-400" />
            <h3 className="font-bold text-base">Grocery Data Integration Boundaries & Architecture</h3>
          </div>
          <button
            onClick={() => setShowDemoInfoModal(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          {/* Status Banner */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-amber-950 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wide text-amber-900">
                Data Transparency Declaration
              </h4>
              <p className="mt-1">
                <strong>Demo mode — simulated store prices and availability.</strong> ShopPilot AI currently operates exclusively with mock grocery datasets for Blinkit, Zepto, and Swiggy Instamart. The application does not claim live connections to external quick-commerce private APIs.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">Adapter Abstraction Architecture</h4>
            <p>
              To maintain clean modularity and ensure seamless transition to production, all store-specific behavior is encapsulated behind the <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono">IGroceryStoreAdapter</code> interface:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Blinkit Adapter</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">MOCK</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Simulates 12-min delivery, ₹199 min order, ₹25 delivery fee, and free delivery over ₹499.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Zepto Adapter</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">MOCK</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Simulates 10-min delivery, ₹149 min order, ₹20 delivery fee, and free delivery over ₹399.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Instamart Adapter</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">MOCK</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Simulates 16-min delivery, ₹199 min order, ₹29 delivery fee, and free delivery over ₹499.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h4 className="font-bold text-slate-900 text-sm">Future Live Integration Path</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Authorized Partner API Integration:</strong> Implement live adapters via formal B2B partner APIs or authorized OAuth integrations once access agreements are established.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Delivery Pincode / Geolocation:</strong> Live quick-commerce dark stores vary inventory by precise user lat/long. Real adapters will dynamically inject the user delivery address.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Pre-Checkout Re-Validation Safeguard:</strong> Before firing an autonomous order, the backend must verify that stock remains available and pricing has not surged beyond authorized thresholds.
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={() => setShowDemoInfoModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
