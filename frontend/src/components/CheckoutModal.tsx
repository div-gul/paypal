import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { formatPaise } from '../services/currency';
import {
  CheckCircle,
  X,
  CreditCard,
  Truck,
  ArrowRight,
  PackageCheck,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CheckoutModalProps {
  onNavigateToApprovals?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onNavigateToApprovals }) => {
  const {
    checkoutModal,
    closeCheckoutModal,
    confirmSimulatedPayment,
    activeRun,
    recommendations,
  } = useShopPilot();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  if (!checkoutModal.isOpen || !checkoutModal.strategy) {
    return null;
  }

  const { strategy, orderId, timestamp, itemsPurchased } = checkoutModal;
  const isOrderPlaced = Boolean(orderId);

  // Count items pending user confirmation
  const pendingApprovalsCount =
    activeRun?.status === 'approved'
      ? 0
      : recommendations.filter(
          r =>
            r.approvalStatus !== 'approved' &&
            r.approvalStatus !== 'rejected' &&
            (r.requiresApproval || r.isSubstitution)
        ).length;

  const needsApproval =
    pendingApprovalsCount > 0 || (activeRun?.status === 'needs_approval' && activeRun?.status !== 'approved');

  const handlePay = async () => {
    if (needsApproval) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await confirmSimulatedPayment(strategy);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment simulation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const decisionReasons: string[] = activeRun?.decisionReasons || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-paypal-darkBlue border-b-4 border-paypal-yellow text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-paypal-yellow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight">PayPal</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-paypal-yellow text-slate-900 uppercase">
                  Simulated
                </span>
              </div>
              <p className="text-xs text-blue-100">
                {isOrderPlaced ? 'Payment Authorized & Pantry Restocked' : 'Review & Confirm Restock Order'}
              </p>
            </div>
          </div>

          <button
            onClick={closeCheckoutModal}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs font-sans">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Notice:</strong> {errorMessage}
              </div>
            </div>
          )}

          {isOrderPlaced ? (
            /* Order Placed & Restock Confirmed */
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 font-heading">
                  Order Confirmed!
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Simulated payment with PayPal — no real money will be charged.
                </p>
                <div className="inline-block mt-2 bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-mono font-semibold text-xs border border-slate-200">
                  Transaction #{orderId} • {timestamp}
                </div>
              </div>

              {/* Replenished Items Summary */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-left space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-xs border-b border-slate-200 pb-2">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  <span>Pantry Stock Restocked</span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {itemsPurchased?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-700 text-xs">
                      <span>
                        • {item.quantity}× {item.product.name}
                      </span>
                      <span className="font-semibold text-slate-900 font-sans tabular-nums">
                        {formatPaise(item.totalPaise)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                  <span>Total Settled:</span>
                  <span className="font-sans tabular-nums text-emerald-700">
                    {formatPaise(strategy.grandTotalPaise)}
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <button
                  onClick={closeCheckoutModal}
                  className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Back to Pantry
                </button>
              </div>
            </div>
          ) : (
            /* Review Order & Pay */
            <div className="space-y-4">
              {/* Exact Sandbox Notice Requirement */}
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 flex items-center gap-2.5 text-blue-900">
                <CreditCard className="w-4 h-4 text-paypal-lightBlue shrink-0" />
                <p className="text-xs text-blue-900 font-medium">
                  Simulated payment with PayPal — no real money will be charged
                </p>
              </div>

              {/* Household Verification Reassurance & Pending Warning */}
              {needsApproval ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start justify-between gap-3 text-amber-900">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-xs text-amber-900 block font-semibold">
                        Approval Required Before Checkout
                      </strong>
                      <p className="text-xs text-amber-800 mt-0.5">
                        {pendingApprovalsCount || 1} item swap{(pendingApprovalsCount || 1) === 1 ? '' : 's'} waiting for your review. Please confirm brand substitutions to enable order authorization.
                      </p>
                    </div>
                  </div>
                  {onNavigateToApprovals && (
                    <button
                      onClick={() => {
                        closeCheckoutModal();
                        onNavigateToApprovals();
                      }}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
                    >
                      Review Swaps
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-3 flex items-center justify-between text-emerald-900">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium">
                      Order verified against your weekly budget and pantry replenishment guidelines.
                    </span>
                  </div>
                  {decisionReasons.length > 0 && (
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-0.5 ml-2 cursor-pointer shrink-0"
                    >
                      <span>Why this?</span>
                      {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              )}

              {/* Collapsible "Why this?" Verification Rationale */}
              {showDetails && decisionReasons.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1.5">
                  <span className="font-semibold text-slate-800 block text-[11px] uppercase tracking-wider">
                    Verification Details:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    {decisionReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Store Sub-Baskets Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-slate-900 font-heading">
                    Order Summary ({strategy.storeBaskets.reduce((acc, sb) => acc + sb.items.length, 0)} items)
                  </span>
                  <span className="font-sans tabular-nums font-bold text-sm text-slate-900">
                    Total: {formatPaise(strategy.grandTotalPaise)}
                  </span>
                </div>

                <div className="space-y-3">
                  {strategy.storeBaskets.map(sb => {
                    return (
                      <div key={sb.storeId} className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5 shadow-2xs">
                        {/* Store Header */}
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 capitalize">
                              {sb.storeName}
                            </span>
                            <span className="text-xs text-slate-500">
                              ({sb.items.length} item{sb.items.length === 1 ? '' : 's'})
                            </span>
                          </div>
                          <span className="font-sans tabular-nums font-bold text-xs text-slate-900">
                            {formatPaise(sb.totalPaise)}
                          </span>
                        </div>

                        {/* Items in this Store Sub-basket */}
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {sb.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs py-0.5">
                              <span className="truncate pr-3 text-slate-700">
                                <strong className="text-slate-900">{item.quantity}×</strong> {item.product.name}
                                {item.isSubstitution && (
                                  <span className="ml-1.5 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded">
                                    Swap
                                  </span>
                                )}
                              </span>
                              <span className="font-sans tabular-nums font-medium text-slate-800 shrink-0">
                                {formatPaise(item.totalPaise)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Store Sub-basket Fee Breakdown */}
                        <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                          <div className="flex justify-between">
                            <span>Items Subtotal:</span>
                            <span className="font-sans tabular-nums font-medium text-slate-700">
                              {formatPaise(sb.productSubtotalPaise)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="flex items-center gap-1">
                              <Truck className="w-3 h-3 text-slate-400" /> Delivery Fee:
                            </span>
                            <span className="font-sans tabular-nums font-medium text-slate-700">
                              {sb.deliveryFeePaise === 0 ? (
                                <span className="text-emerald-700 font-semibold">Free</span>
                              ) : (
                                formatPaise(sb.deliveryFeePaise)
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Handling & Platform Fee:</span>
                            <span className="font-sans tabular-nums font-medium text-slate-700">
                              {formatPaise(sb.handlingFeePaise)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Taxes (GST 5%):</span>
                            <span className="font-sans tabular-nums font-medium text-slate-700">
                              {formatPaise(sb.taxPaise)}
                            </span>
                          </div>

                          {/* Minimum Order Shortfall Notice */}
                          {sb.minOrderShortfallPaise > 0 && (
                            <div className="flex justify-between text-amber-700 font-medium pt-0.5">
                              <span>Minimum order shortfall:</span>
                              <span className="font-sans tabular-nums font-semibold">
                                +{formatPaise(sb.minOrderShortfallPaise)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PayPal Payment Button */}
              <div id="paypal-button-container" className="pt-2">
                {needsApproval ? (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <span>Approve {pendingApprovalsCount || 1} item swap{(pendingApprovalsCount || 1) === 1 ? '' : 's'} to continue</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePay}
                    disabled={isProcessing}
                    className="w-full py-3.5 px-4 rounded-xl bg-paypal-yellow hover:bg-yellow-400 text-slate-900 font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2 text-slate-900">
                        <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                        Processing Simulated Payment...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="font-black italic text-paypal-blue text-base">PayPal</span>
                        <span className="font-sans tabular-nums">
                          Simulate Payment ({formatPaise(strategy.grandTotalPaise)})
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-900" />
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
