import React, { useState, useEffect, useRef } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { formatPaise, paiseToUsd } from '../services/currency';
import { api } from '../api/client';
import { ErrorBoundary } from './ui/ErrorBoundary';
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
  Receipt,
} from 'lucide-react';

interface CheckoutModalProps {
  onNavigateToApprovals?: () => void;
}

interface PublicConfig {
  paypalClientId: string;
  paypalMode: 'mock' | 'sandbox';
  currency: string;
  usdRate: number;
}

export const CheckoutModalContent: React.FC<CheckoutModalProps> = ({ onNavigateToApprovals }) => {
  const {
    checkoutModal,
    closeCheckoutModal,
    confirmSimulatedPayment,
    completeCheckout,
    activeRun,
    pendingSwaps,
  } = useShopPilot();

  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [sdkLoading, setSdkLoading] = useState(false);

  const paypalButtonRenderedRef = useRef(false);

  // 1. Fetch & cache public PayPal config on mount
  useEffect(() => {
    let isMounted = true;
    api
      .getPublicConfig()
      .then(cfg => {
        if (isMounted) {
          setPublicConfig(cfg);
        }
      })
      .catch(err => {
        console.warn('Could not load public PayPal config, defaulting to mock:', err);
        if (isMounted) {
          setPublicConfig({
            paypalClientId: '',
            paypalMode: 'mock',
            currency: 'USD',
            usdRate: 85,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!checkoutModal.isOpen || !checkoutModal.strategy) {
    return null;
  }

  const {
    strategy,
    orderId,
    captureId,
    usdAmount,
    inrAmount,
    payerEmail,
    timestamp,
    itemsPurchased,
  } = checkoutModal;

  const isOrderPlaced = Boolean(orderId);
  const usdRate = publicConfig?.usdRate || 85;
  const inrTotalPaise = inrAmount || strategy.grandTotalPaise;
  const usdConversion = paiseToUsd(inrTotalPaise, usdRate);
  const displayUsd = usdAmount || usdConversion.usd;

  // Count items pending user confirmation (strictly pending brand swaps)
  const pendingApprovalsCount = (pendingSwaps || []).length;
  const needsApproval = pendingApprovalsCount > 0;

  // Handle Mock payment flow
  const handleMockPay = async () => {
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

  // 2. Dynamic PayPal SDK loading and button rendering for sandbox mode
  const isSandboxMode = publicConfig?.paypalMode === 'sandbox' && Boolean(publicConfig?.paypalClientId);

  useEffect(() => {
    if (!isSandboxMode || isOrderPlaced || needsApproval) {
      return;
    }

    let isMounted = true;
    setSdkLoading(true);

    const scriptId = 'paypal-sdk-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const renderButtons = () => {
      const container = document.getElementById('paypal-button-container');
      if (!container || !isMounted) return;

      container.innerHTML = ''; // Clean container before rendering
      try {
        const paypal = (window as any).paypal;
        if (!paypal || !paypal.Buttons) {
          console.warn('PayPal Buttons API not ready yet');
          return;
        }

        paypal
          .Buttons({
            style: {
              layout: 'vertical',
              color: 'gold',
              shape: 'rect',
              label: 'paypal',
              height: 44,
            },
            createOrder: async () => {
              setErrorMessage(null);
              setIsProcessing(true);
              try {
                let runId = activeRun?.id;
                if (!runId) {
                  const planRes = await api.planRun({ strategy: strategy.type });
                  runId = planRes.run.id;
                }
                const orderData = await api.createCheckoutOrder(runId);
                return orderData.orderId;
              } catch (err: any) {
                const safeMsg = err.message || 'Unable to create PayPal order';
                setErrorMessage(safeMsg);
                setIsProcessing(false);
                throw err;
              }
            },
            onApprove: async (data: { orderId: string }) => {
              setIsProcessing(true);
              setErrorMessage(null);
              try {
                const runId = activeRun?.id;
                const captureRes = await api.captureCheckoutOrder(data.orderId, runId);
                const allPurchasedItems = strategy.storeBaskets.flatMap(b => b.items);

                await completeCheckout({
                  strategy,
                  orderId: data.orderId,
                  captureId: captureRes.receipt?.paypalCaptureId || captureRes.receipt?.id,
                  usdAmount: captureRes.receipt?.usdAmount || displayUsd,
                  inrAmount: captureRes.receipt?.amountPaise || inrTotalPaise,
                  payerEmail: captureRes.receipt?.payerEmail,
                  timestamp: new Date().toLocaleTimeString(),
                  itemsPurchased: allPurchasedItems,
                });
              } catch (err: any) {
                setErrorMessage(err.message || 'Failed to capture PayPal payment. Please check your credentials.');
              } finally {
                setIsProcessing(false);
              }
            },
            onError: (err: any) => {
              console.error('[PayPal Buttons Error]:', err);
              setErrorMessage(
                'PayPal checkout encountered an issue. Ensure you are using a PayPal Sandbox Personal Buyer account.'
              );
              setIsProcessing(false);
            },
            onCancel: (data: any) => {
              console.info('[PayPal Checkout Cancelled]:', data);
              setIsProcessing(false);
            },
          })
          .render('#paypal-button-container')
          .then(() => {
            if (isMounted) {
              setSdkLoading(false);
              paypalButtonRenderedRef.current = true;
            }
          })
          .catch((err: any) => {
            console.error('Error rendering PayPal Buttons:', err);
            if (isMounted) setSdkLoading(false);
          });
      } catch (err) {
        console.error('Failed to initialize PayPal Buttons:', err);
        if (isMounted) setSdkLoading(false);
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
        publicConfig!.paypalClientId
      )}&currency=USD&intent=capture`;
      script.async = true;
      script.onload = () => {
        if (isMounted) renderButtons();
      };
      script.onerror = () => {
        if (isMounted) {
          setErrorMessage('Failed to load PayPal SDK from PayPal servers. Check internet connection.');
          setSdkLoading(false);
        }
      };
      document.body.appendChild(script);
    } else {
      if ((window as any).paypal?.Buttons) {
        renderButtons();
      } else {
        script.addEventListener('load', renderButtons);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isSandboxMode, strategy, activeRun, isOrderPlaced, needsApproval, publicConfig]);

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
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    isSandboxMode
                      ? 'bg-emerald-400 text-slate-900'
                      : 'bg-paypal-yellow text-slate-900'
                  }`}
                >
                  {isSandboxMode ? 'Sandbox Live' : 'Simulated'}
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
            /* Order Placed & Restock Confirmed - Rich Receipt */
            <div className="space-y-5 py-2">
              <div className="text-center">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle className="w-8 h-8" />
                </div>

                <h3 className="text-lg font-bold text-slate-900 font-heading mt-2">
                  Order & Payment Settled!
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  {isSandboxMode
                    ? 'Successfully processed and captured via PayPal Sandbox.'
                    : 'Simulated payment with PayPal — no real money charged.'}
                </p>
              </div>

              {/* Official Receipt Card */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                    <Receipt className="w-4 h-4 text-brand-600" />
                    <span>Payment Receipt</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">{timestamp}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Order ID</span>
                    <span className="font-mono font-medium text-slate-800 break-all">{orderId}</span>
                  </div>
                  {captureId && (
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Capture ID</span>
                      <span className="font-mono font-medium text-slate-800 break-all">{captureId}</span>
                    </div>
                  )}
                  {payerEmail && (
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Payer Account</span>
                      <span className="text-slate-800 font-medium">{payerEmail}</span>
                    </div>
                  )}
                </div>

                {/* Dual Currency Settlement Amount */}
                <div className="bg-white rounded-lg border border-slate-200 p-3 flex justify-between items-center">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Settled</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-extrabold text-slate-900 font-sans tabular-nums">
                        {formatPaise(inrTotalPaise)}
                      </span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ${displayUsd} USD
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">₹{usdRate}/$1 USD</span>
                </div>
              </div>

              {/* Replenished Items Summary */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-xs border-b border-slate-200 pb-2">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  <span>Pantry Replenishment Details</span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {itemsPurchased?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-700 text-xs">
                      <span>
                        • {item?.quantity || 1}× {item?.product?.name || (item as any)?.name || 'Product'}
                      </span>
                      <span className="font-semibold text-slate-900 font-sans tabular-nums">
                        {formatPaise(item?.totalPaise || 0)}
                      </span>
                    </div>
                  ))}
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
              {/* Dual Amount Banner */}
              <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3 text-blue-900">
                <CreditCard className="w-5 h-5 text-paypal-lightBlue shrink-0 mt-0.5" />
                <div className="space-y-1 w-full">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-blue-950">Payment Breakdown (Dual Currency)</span>
                    <span className="text-[11px] font-mono font-semibold text-blue-700">₹{usdRate} = $1.00 USD</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-extrabold text-blue-950 font-sans tabular-nums">
                      {formatPaise(strategy.grandTotalPaise)}
                    </span>
                    <span className="text-xs font-bold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded border border-blue-200">
                      ${usdConversion.usd} USD
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    {isSandboxMode
                      ? 'PayPal processes in USD. Your PayPal Sandbox account will be authorized for $' +
                        usdConversion.usd +
                        ' USD.'
                      : 'Simulated payment with PayPal — no real money will be charged.'}
                  </p>
                </div>
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
                        {pendingApprovalsCount || 1} item swap{(pendingApprovalsCount || 1) === 1 ? '' : 's'} waiting for
                        your review. Please confirm brand substitutions to enable order authorization.
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
              {(() => {
                const storeBaskets = Array.isArray(strategy?.storeBaskets) ? strategy.storeBaskets : [];
                const totalItemCount = storeBaskets.reduce(
                  (acc, sb) => acc + (Array.isArray(sb?.items) ? sb.items.length : 0),
                  0
                );

                return (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-bold text-slate-900 font-heading">
                        Order Summary ({totalItemCount} items)
                      </span>
                      <div className="text-right">
                        <span className="font-sans tabular-nums font-bold text-sm text-slate-900">
                          {formatPaise(strategy?.grandTotalPaise || 0)}
                        </span>
                        <span className="text-xs text-slate-500 ml-1.5">(${usdConversion.usd} USD)</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {storeBaskets.map(sb => {
                        const items = Array.isArray(sb?.items) ? sb.items : [];
                        const storeName = sb?.storeName || sb?.storeId || 'Store';
                        const totalPaise = sb?.totalPaise || 0;
                        const productSubtotal = sb?.productSubtotalPaise || 0;
                        const deliveryFee = sb?.deliveryFeePaise || 0;
                        const handlingFee = sb?.handlingFeePaise || 0;
                        const taxPaise = sb?.taxPaise || 0;
                        const shortfall = sb?.minOrderShortfallPaise || 0;

                        return (
                          <div
                            key={sb?.storeId || Math.random()}
                            className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5 shadow-2xs"
                          >
                            {/* Store Header */}
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 capitalize">
                                  {storeName}
                                </span>
                                <span className="text-xs text-slate-500">
                                  ({items.length} item{items.length === 1 ? '' : 's'})
                                </span>
                              </div>
                              <span className="font-sans tabular-nums font-bold text-xs text-slate-900">
                                {formatPaise(totalPaise)}
                              </span>
                            </div>

                            {/* Items in this Store Sub-basket */}
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {items.map((item, idx) => {
                                const productName = item?.product?.name || (item as any)?.itemName || (item as any)?.name || 'Product';
                                const itemTotal = item?.totalPaise || 0;

                                return (
                                  <div key={idx} className="flex justify-between items-center text-xs py-0.5">
                                    <span className="truncate pr-3 text-slate-700">
                                      <strong className="text-slate-900">{item.quantity || 1}×</strong> {productName}
                                      {item.isSubstitution && (
                                        <span className="ml-1.5 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded">
                                          Swap
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-sans tabular-nums font-medium text-slate-800 shrink-0">
                                      {formatPaise(itemTotal)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Store Sub-basket Fee Breakdown */}
                            <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                              <div className="flex justify-between">
                                <span>Items Subtotal:</span>
                                <span className="font-sans tabular-nums font-medium text-slate-700">
                                  {formatPaise(productSubtotal)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Truck className="w-3 h-3 text-slate-400" /> Delivery Fee:
                                </span>
                                <span className="font-sans tabular-nums font-medium text-slate-700">
                                  {deliveryFee === 0 ? (
                                    <span className="text-emerald-700 font-semibold">Free</span>
                                  ) : (
                                    formatPaise(deliveryFee)
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Handling & Platform Fee:</span>
                                <span className="font-sans tabular-nums font-medium text-slate-700">
                                  {formatPaise(handlingFee)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Taxes (GST 5%):</span>
                                <span className="font-sans tabular-nums font-medium text-slate-700">
                                  {formatPaise(taxPaise)}
                                </span>
                              </div>

                              {shortfall > 0 && (
                                <div className="flex justify-between text-amber-700 font-medium pt-0.5">
                                  <span>Minimum order shortfall:</span>
                                  <span className="font-sans tabular-nums font-semibold">
                                    +{formatPaise(shortfall)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Payment Action Area */}
              <div className="pt-2">
                {needsApproval ? (
                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <span>
                      Approve {pendingApprovalsCount || 1} item swap{(pendingApprovalsCount || 1) === 1 ? '' : 's'} to
                      continue
                    </span>
                  </button>
                ) : isSandboxMode ? (
                  /* Real PayPal Sandbox Buttons Container */
                  <div className="space-y-2">
                    {sdkLoading && (
                      <div className="py-4 text-center text-slate-500 flex items-center justify-center gap-2 text-xs">
                        <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                        <span>Connecting to PayPal Sandbox...</span>
                      </div>
                    )}
                    <div id="paypal-button-container" className="min-h-[44px]"></div>
                  </div>
                ) : (
                  /* Mock Simulated Payment Button */
                  <button
                    onClick={handleMockPay}
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
                          Simulate Payment ({formatPaise(strategy?.grandTotalPaise || 0)} • ${usdConversion.usd} USD)
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

export const CheckoutModal: React.FC<CheckoutModalProps> = (props) => {
  return (
    <ErrorBoundary fallbackTitle="Unable to display PayPal checkout modal">
      <CheckoutModalContent {...props} />
    </ErrorBoundary>
  );
};
