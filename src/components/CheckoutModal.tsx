import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { formatPaise } from '../services/currency';
import {
  CheckCircle,
  X,
  CreditCard,
  Truck,
  ShieldCheck,
  ArrowRight,
  PackageCheck,
  AlertCircle,
} from 'lucide-react';

export const CheckoutModal: React.FC = () => {
  const { checkoutModal, closeCheckoutModal, confirmSimulatedPayment } = useShopPilot();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!checkoutModal.isOpen || !checkoutModal.strategy) {
    return null;
  }

  const { strategy, orderId, timestamp, itemsPurchased } = checkoutModal;
  const isOrderPlaced = Boolean(orderId);

  const handlePay = async () => {
    setIsProcessing(true);
    // Simulate realistic 1.5s network roundtrip to PayPal Sandbox
    await new Promise(resolve => setTimeout(resolve, 1200));
    setIsProcessing(false);
    await confirmSimulatedPayment(strategy);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-paypal-darkBlue via-paypal-blue to-paypal-lightBlue text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-paypal-yellow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight">PayPal</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-paypal-yellow text-slate-900 uppercase">
                  Sandbox Simulation
                </span>
              </div>
              <p className="text-xs text-blue-100">
                {isOrderPlaced ? 'Payment Authorized & Pantry Restocked' : 'Review & Authorize Proposed Restock Basket'}
              </p>
            </div>
          </div>

          <button
            onClick={closeCheckoutModal}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {isOrderPlaced ? (
            /* Phase 2: Order Placed & Restock Confirmed */
            <div className="space-y-4 text-center py-3">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Simulated Order Confirmed!
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  Transaction completed via PayPal Sandbox simulation at {timestamp}.
                </p>
                <div className="inline-block mt-2 bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-mono font-semibold text-xs border border-slate-200">
                  Transaction ID: {orderId}
                </div>
              </div>

              {/* Replenished Items Summary */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-left space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-slate-200 pb-2">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  <span>Pantry Stock Replenished to Target:</span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {itemsPurchased?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-700 text-xs">
                      <span>
                        • {item.quantity}x {item.product.name}
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {formatPaise(item.totalPaise)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                  <span>Total Settled:</span>
                  <span className="font-mono text-emerald-700">
                    {formatPaise(strategy.grandTotalPaise)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={closeCheckoutModal}
                  className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Return to Dashboard & View Updated Inventory
                </button>
              </div>
            </div>
          ) : (
            /* Phase 1: Review Order & Pay */
            <div className="space-y-4">
              {/* Sandbox notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-blue-900">
                <AlertCircle className="w-4 h-4 text-paypal-lightBlue shrink-0 mt-0.5" />
                <p>
                  <strong>Autonomous Payment Sandbox:</strong> This demonstration simulates authorized checkout via PayPal sandbox credentials. Completing this step immediately adds the purchased goods to your pantry stock.
                </p>
              </div>

              {/* Strategy Details */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200/70 pb-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Selected Strategy
                    </span>
                    <h4 className="font-bold text-slate-900 text-xs">{strategy.title}</h4>
                  </div>
                  <span className="font-mono font-extrabold text-sm text-slate-900">
                    {formatPaise(strategy.grandTotalPaise)}
                  </span>
                </div>

                {/* Sub-Baskets Breakdown */}
                <div className="space-y-2.5">
                  {strategy.storeBaskets.map(sb => (
                    <div key={sb.storeId} className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                      <div className="flex justify-between items-center font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                            {sb.storeName}
                          </span>
                          <span>Fulfillment ({sb.items.length} item{sb.items.length === 1 ? '' : 's'})</span>
                        </span>
                        <span className="font-mono text-slate-900">{formatPaise(sb.totalPaise)}</span>
                      </div>

                      {/* Itemized List in Checkout */}
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {sb.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px] text-slate-700">
                            <span className="truncate pr-2">
                              <strong>{item.quantity}x</strong> {item.product.name}
                            </span>
                            <span className="font-mono font-medium shrink-0">
                              {formatPaise(item.totalPaise)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="text-[10px] text-slate-500 space-y-0.5 pt-1.5 border-t border-slate-100">
                        <div className="flex justify-between">
                          <span>Items Subtotal:</span>
                          <span>{formatPaise(sb.productSubtotalPaise)}</span>
                        </div>
                        <div className="flex justify-between text-amber-700">
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3" /> Delivery Fee:
                          </span>
                          <span>{formatPaise(sb.deliveryFeePaise)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Handling Fee + Taxes:</span>
                          <span>{formatPaise(sb.handlingFeePaise + sb.taxPaise)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safe Guard & Approval Validation */}
              <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Policy check: All items have been verified against household restock thresholds and brand substitution policies.
                </span>
              </div>

              {/* PayPal Sandbox Action Button */}
              <button
                onClick={handlePay}
                disabled={isProcessing}
                className="w-full py-3.5 px-4 rounded-xl bg-paypal-yellow hover:bg-yellow-400 text-slate-900 font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2 text-slate-900">
                    <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                    Authorizing PayPal Sandbox Transaction...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="font-black italic text-paypal-blue">PayPal</span>
                    <span>Pay {formatPaise(strategy.grandTotalPaise)} (Sandbox)</span>
                    <ArrowRight className="w-4 h-4 text-slate-900" />
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
