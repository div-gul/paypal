import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useShopPilot } from '../context/ShopPilotContext';
import { api } from '../api/client';
import { formatPaise } from '../services/currency';
import {
  CheckCircle,
  X,
  CreditCard,
  PackageCheck,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  QrCode,
  ExternalLink,
} from 'lucide-react';

interface PayPalButtons {
  Buttons: (options: Record<string, any>) => { render: (container: HTMLElement) => Promise<void> };
}

declare global {
  interface Window {
    paypal?: PayPalButtons;
    __shopPilotPayPalSdk?: Promise<void>;
  }
}

function loadPayPalSdk(clientId: string, currency: string): Promise<void> {
  if (window.paypal) return Promise.resolve();
  if (window.__shopPilotPayPalSdk) return window.__shopPilotPayPalSdk;
  const sdkPromise: Promise<void> = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`;
    script.async = true;
    script.onload = () => window.paypal ? resolve() : reject(new Error('PayPal SDK did not initialize'));
    script.onerror = () => reject(new Error('Could not load PayPal checkout. Check your connection and Sandbox Client ID.'));
    document.head.appendChild(script);
  }).catch(error => {
    window.__shopPilotPayPalSdk = undefined;
    throw error;
  });
  window.__shopPilotPayPalSdk = sdkPromise;
  return sdkPromise;
}

export const CheckoutModal: React.FC<{ onNavigateToApprovals?: () => void }> = ({ onNavigateToApprovals }) => {
  const {
    checkoutModal,
    closeCheckoutModal,
    createPayPalOrder,
    capturePayPalOrder,
    getCheckoutStatus,
    cancelPayPalOrder,
    confirmMockPayment,
    openCheckoutModal,
    activeRun,
    recommendations,
  } = useShopPilot();
  const [providerConfig, setProviderConfig] = useState<Awaited<ReturnType<typeof api.getCheckoutConfig>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const paypalButtonContainer = useRef<HTMLDivElement>(null);
  const strategyRef = useRef(checkoutModal.strategy);
  strategyRef.current = checkoutModal.strategy;

  const { strategy, orderId, approvalUrl, paymentState, itemsPurchased } = checkoutModal;
  const runId = checkoutModal.runId || activeRun?.id;
  const isOrderPlaced = paymentState === 'CAPTURED';
  const isSandbox = providerConfig?.mode === 'sandbox';
  const pendingApprovalsCount = activeRun?.status === 'approved'
    ? 0
    : recommendations.filter(r => r.approvalStatus !== 'approved' && r.approvalStatus !== 'rejected' && (r.requiresApproval || r.isSubstitution)).length;
  const needsApproval = activeRun?.id === runId && (pendingApprovalsCount > 0 || activeRun?.status === 'needs_approval');

  useEffect(() => {
    if (!checkoutModal.isOpen) return;
    let cancelled = false;
    setErrorMessage(null);
    api.getCheckoutConfig()
      .then(config => { if (!cancelled) setProviderConfig(config); })
      .catch(error => { if (!cancelled) setErrorMessage(error.message || 'Could not load checkout configuration.'); });
    return () => { cancelled = true; };
  }, [checkoutModal.isOpen]);

  // Create or recover a persistent server-side PayPal order; the same approval link feeds the QR code.
  useEffect(() => {
    if (!checkoutModal.isOpen || !isSandbox || !strategy || !runId || orderId || paymentState === 'CAPTURED') return;
    let cancelled = false;
    setIsPreparing(true);
    createPayPalOrder(runId, strategy)
      .catch(error => { if (!cancelled) setErrorMessage(error.message || 'Could not create PayPal Sandbox order.'); })
      .finally(() => { if (!cancelled) setIsPreparing(false); });
    return () => { cancelled = true; };
  }, [checkoutModal.isOpen, isSandbox, strategy, runId, orderId, paymentState, createPayPalOrder]);

  useEffect(() => {
    if (!approvalUrl || !isSandbox) {
      setQrImage(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(approvalUrl, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then(dataUrl => { if (!cancelled) setQrImage(dataUrl); })
      .catch(error => { if (!cancelled) setErrorMessage(error.message || 'Could not generate the PayPal checkout QR code.'); });
    return () => { cancelled = true; };
  }, [approvalUrl, isSandbox]);

  // Render the official PayPal button. Approval always goes through the backend capture endpoint.
  useEffect(() => {
    if (!checkoutModal.isOpen || !isSandbox || !providerConfig?.clientId || !strategy || !runId || !orderId || isOrderPlaced) return;
    let cancelled = false;
    const container = paypalButtonContainer.current;
    if (!container) return;
    container.replaceChildren();
    loadPayPalSdk(providerConfig.clientId, providerConfig.currency)
      .then(async () => {
        if (cancelled || !container || !window.paypal) return;
        await window.paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', label: 'paypal', tagline: false },
          createOrder: () => orderId,
          onApprove: async (data: { orderID?: string }) => {
            try {
              await capturePayPalOrder(data.orderID || orderId, runId, strategyRef.current!);
            } catch (error: any) {
              setErrorMessage(error.message || 'PayPal did not confirm the payment capture.');
            }
          },
          onCancel: async () => {
            try { await cancelPayPalOrder(runId, orderId); }
            catch (error: any) { setErrorMessage(error.message || 'Could not confirm payment cancellation.'); }
          },
          onError: (error: any) => setErrorMessage(error?.message || 'PayPal checkout failed. You can retry this order.'),
        }).render(container);
      })
      .catch(error => { if (!cancelled) setErrorMessage(error.message || 'PayPal checkout could not be loaded.'); });
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [checkoutModal.isOpen, isSandbox, providerConfig, strategy, runId, orderId, isOrderPlaced, capturePayPalOrder, cancelPayPalOrder]);

  // Poll the server so a second device's approval is captured and reflected in this session.
  useEffect(() => {
    if (!checkoutModal.isOpen || !isSandbox || !strategy || !runId || !orderId || isOrderPlaced) return;
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const status = await getCheckoutStatus(runId, strategyRef.current!);
        if (!cancelled && (status.paymentState === 'FAILED' || status.paymentState === 'CANCELLED')) {
          setErrorMessage(status.paymentState === 'CANCELLED' ? 'PayPal checkout was cancelled. You can retry this order.' : 'PayPal payment failed. Your order is available to retry.');
        }
      } catch {
        // Keep polling through short network interruptions; the server owns payment state.
      }
    };
    void checkStatus();
    const timer = window.setInterval(() => { void checkStatus(); }, 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [checkoutModal.isOpen, isSandbox, strategy, runId, orderId, isOrderPlaced, getCheckoutStatus]);

  if (!checkoutModal.isOpen || !strategy) return null;

  const handleMockPayment = async () => {
    if (needsApproval) return;
    setIsPreparing(true);
    setErrorMessage(null);
    try {
      await confirmMockPayment(strategy);
    } catch (error: any) {
      setErrorMessage(error.message || 'Mock checkout failed.');
    } finally {
      setIsPreparing(false);
    }
  };

  const handleRetry = () => {
    closeCheckoutModal();
    window.setTimeout(() => openCheckoutModal(strategy), 0);
  };
  const decisionReasons: string[] = activeRun?.decisionReasons || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-paypal-darkBlue border-b-4 border-paypal-yellow text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-paypal-yellow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight">PayPal</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-paypal-yellow text-slate-900 uppercase">
                  {isSandbox ? 'Sandbox' : 'Mock'}
                </span>
              </div>
              <p className="text-xs text-blue-100">{isOrderPlaced ? 'Payment Captured' : 'Review & Pay for Restock Order'}</p>
            </div>
          </div>
          <button onClick={closeCheckoutModal} className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer" aria-label="Close dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs font-sans">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div><strong>Notice:</strong> {errorMessage}</div>
            </div>
          )}

          {isOrderPlaced ? (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-heading">Payment Confirmed!</h3>
                <p className="text-slate-500 text-xs mt-1">PayPal Sandbox confirmed capture. No live funds were moved.</p>
                <div className="inline-block mt-2 bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-mono font-semibold text-xs border border-slate-200">
                  PayPal order {orderId} {checkoutModal.timestamp ? `• ${checkoutModal.timestamp}` : ''}
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-left space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-xs border-b border-slate-200 pb-2">
                  <PackageCheck className="w-4 h-4 text-emerald-600" /><span>Paid Grocery Order</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {itemsPurchased?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-slate-700 text-xs">
                      <span>• {item.quantity}× {item.product.name}</span>
                      <span className="font-semibold text-slate-900 tabular-nums">{formatPaise(item.totalPaise)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                  <span>Grocery total:</span><span className="tabular-nums text-emerald-700">{formatPaise(strategy.grandTotalPaise)}</span>
                </div>
              </div>
              <button onClick={closeCheckoutModal} className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition cursor-pointer">Done</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 flex items-center gap-2.5 text-blue-900">
                <CreditCard className="w-4 h-4 text-paypal-lightBlue shrink-0" />
                <p className="text-xs font-medium">
                  {isSandbox ? 'PayPal Sandbox checkout — test payment only; no live funds will be moved.' : 'Mock checkout mode — no PayPal transaction will be created.'}
                </p>
              </div>

              {needsApproval ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start justify-between gap-3 text-amber-900">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div><strong className="text-xs block font-semibold">Approval Required Before Checkout</strong><p className="text-xs text-amber-800 mt-0.5">{pendingApprovalsCount || 1} product approval{(pendingApprovalsCount || 1) === 1 ? '' : 's'} still need review.</p></div>
                  </div>
                  {onNavigateToApprovals && <button onClick={() => { closeCheckoutModal(); onNavigateToApprovals(); }} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs">Review Swaps</button>}
                </div>
              ) : (
                <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl p-3 flex items-center justify-between text-emerald-900">
                  <div className="flex items-center gap-2 text-xs"><CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /><span className="font-medium">Order verified against your budget and restock guidelines.</span></div>
                  {decisionReasons.length > 0 && <button onClick={() => setShowDetails(!showDetails)} className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-0.5 ml-2 cursor-pointer shrink-0"><span>Why this?</span>{showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>}
                </div>
              )}

              {showDetails && decisionReasons.length > 0 && <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1.5"><span className="font-semibold text-slate-800 block text-[11px] uppercase tracking-wider">Verification Details:</span><ul className="list-disc list-inside space-y-1 text-[11px]">{decisionReasons.map((reason, idx) => <li key={idx}>{reason}</li>)}</ul></div>}

              <div className="space-y-3">
                <div className="flex justify-between items-center px-1"><span className="text-xs font-bold text-slate-900 font-heading">Order Summary ({strategy.storeBaskets.reduce((count, basket) => count + basket.items.length, 0)} items)</span><span className="font-sans tabular-nums font-bold text-sm text-slate-900">{formatPaise(strategy.grandTotalPaise)}</span></div>
                {isSandbox && providerConfig?.currency === 'USD' && checkoutModal.chargedAmount && <p className="text-[11px] rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-slate-800">PayPal will charge <strong>USD {checkoutModal.chargedAmount}</strong> using the explicitly configured INR conversion rate. Grocery total remains {formatPaise(strategy.grandTotalPaise)}.</p>}
                <div className="space-y-3">
                  {strategy.storeBaskets.map(basket => (
                    <div key={basket.storeId} className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5 shadow-2xs">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2"><div className="flex items-center gap-2"><span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 capitalize">{basket.storeName}</span><span className="text-xs text-slate-500">({basket.items.length} items)</span></div><span className="font-sans tabular-nums font-bold text-xs text-slate-900">{formatPaise(basket.totalPaise)}</span></div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">{basket.items.map((item, idx) => <div key={idx} className="flex justify-between items-center text-xs py-0.5"><span className="truncate pr-3 text-slate-700"><strong className="text-slate-900">{item.quantity}×</strong> {item.product.name}{item.isSubstitution && <span className="ml-1.5 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">Swap</span>}</span><span className="font-sans tabular-nums font-medium text-slate-800 shrink-0">{formatPaise(item.totalPaise)}</span></div>)}</div>
                      <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500"><span>Delivery and handling</span><span className="font-medium text-slate-700">{formatPaise(basket.deliveryFeePaise + basket.handlingFeePaise)}</span></div>
                    </div>
                  ))}
                </div>
              </div>

              {isSandbox ? (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  {isPreparing && <p className="text-center text-xs text-slate-500">Creating secure PayPal Sandbox order…</p>}
                  {!providerConfig?.clientId && providerConfig && <p className="text-center text-xs text-rose-700">PayPal Sandbox Client ID is missing. Set PAYPAL_CLIENT_ID in backend/.env.</p>}
                  {orderId && <div ref={paypalButtonContainer} className={needsApproval ? 'pointer-events-none opacity-40' : ''} />}
                  {approvalUrl && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-32 h-32 bg-white border border-slate-200 rounded-lg flex items-center justify-center shrink-0">
                        {qrImage ? <img src={qrImage} alt="QR code linking to this PayPal Sandbox order" className="w-28 h-28" /> : <QrCode className="w-8 h-8 text-slate-400" />}
                      </div>
                      <div className="space-y-1.5 text-center sm:text-left">
                        <h4 className="font-bold text-slate-900">Scan to continue with PayPal Sandbox</h4>
                        <p className="text-[11px] text-slate-600">This QR opens the buyer approval page for this order. Keep this page open to see payment status update.</p>
                        <a href={approvalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-brand-700 hover:text-brand-900 font-semibold">Open PayPal checkout <ExternalLink className="w-3 h-3" /></a>
                        <p className="text-[11px] text-slate-500">Order total: <strong className="text-slate-800">{formatPaise(strategy.grandTotalPaise)}</strong>{checkoutModal.currency && ` • PayPal ${checkoutModal.currency} ${checkoutModal.chargedAmount || ''}`}</p>
                      </div>
                    </div>
                  )}
                  {paymentState === 'CANCELLED' && <button onClick={handleRetry} className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs">Retry PayPal checkout</button>}
                  {paymentState === 'FAILED' && <button onClick={handleRetry} className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs">Retry payment</button>}
                  {orderId && <p className="text-center text-[11px] text-slate-500">Payment status: {paymentState || 'PENDING'} · This page checks PayPal for approval and capture.</p>}
                </div>
              ) : (
                <button onClick={handleMockPayment} disabled={isPreparing || needsApproval} className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs shadow-md transition disabled:opacity-50">{isPreparing ? 'Processing mock checkout…' : 'Run mock checkout (no PayPal transaction)'}</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
