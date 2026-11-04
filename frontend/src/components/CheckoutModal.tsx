import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useShopPilot } from '../context/ShopPilotContext';
import { api } from '../api/client';
import { formatPaise } from '../services/currency';
import { Button } from './ui/Button';
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
  ShieldCheck,
  Info,
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

  // Create or recover a persistent server-side PayPal order
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

  // Render the official PayPal button
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

  // Poll server for status
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
        // Keep polling through short network interruptions
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
      <div className="bg-surface rounded-xl max-w-xl w-full shadow-card border border-secondary-tint overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header styled in brand-dark with high contrast */}
        <div className="bg-brand-dark text-white p-5 flex items-center justify-between border-b border-brand-dark">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-brand-tint">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">PayPal</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-tint text-brand-dark uppercase">
                  {isSandbox ? 'Sandbox' : 'Mock'}
                </span>
              </div>
              <p className="text-xs text-brand-tint/80">{isOrderPlaced ? 'Payment Captured' : 'Review & Pay for Restock Order'}</p>
            </div>
          </div>
          <button
            onClick={closeCheckoutModal}
            className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs font-sans text-ink">
          {errorMessage && (
            <div className="bg-danger/10 border border-danger/25 rounded-xl p-3 flex items-start gap-2.5 text-danger">
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <div><strong>Notice:</strong> {errorMessage}</div>
            </div>
          )}

          {isOrderPlaced ? (
            /* Success Screen with Receipt Summary */
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 bg-good/15 text-good rounded-full flex items-center justify-center mx-auto shadow-soft">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink font-heading">Payment Confirmed!</h3>
                <p className="text-ink-muted text-xs mt-1">PayPal Sandbox confirmed capture. No real money was moved.</p>
                <div className="inline-block mt-2 bg-paper text-ink-muted px-3 py-1 rounded-lg tabular-nums font-semibold text-xs border border-secondary-tint">
                  PayPal order {orderId} {checkoutModal.timestamp ? `• ${checkoutModal.timestamp}` : ''}
                </div>
              </div>
              <div className="bg-paper rounded-xl border border-secondary-tint p-4 text-left space-y-3 shadow-soft">
                <div className="flex items-center gap-2 font-bold text-ink text-xs border-b border-secondary-tint pb-2">
                  <PackageCheck className="w-4 h-4 text-good" />
                  <span>Paid Grocery Order Receipt</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {itemsPurchased?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-ink text-xs">
                      <span>• {item.quantity}× {item.product.name}</span>
                      <span className="font-semibold text-ink tabular-nums">{formatPaise(item.totalPaise)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-secondary-tint flex justify-between font-bold text-ink text-sm">
                  <span>Grocery total:</span>
                  <span className="tabular-nums text-good">{formatPaise(strategy.grandTotalPaise)}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="md"
                onClick={closeCheckoutModal}
                className="w-full"
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Sandbox payment note */}
              <div className="bg-secondary-tint text-secondary border border-secondary/20 rounded-xl p-3 flex items-center gap-2.5">
                <Info className="w-4 h-4 shrink-0" />
                <p className="text-xs font-medium">
                  {isSandbox
                    ? 'Sandbox payment, no real money — test transaction only; no live funds will be charged.'
                    : 'Mock checkout mode — no live transaction will be processed.'}
                </p>
              </div>

              {needsApproval ? (
                <div className="bg-accent-tint border border-accent/25 rounded-xl p-3.5 flex items-start justify-between gap-3 text-accent-dark">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-accent-dark shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-xs block font-semibold">Approval Required Before Checkout</strong>
                      <p className="text-xs text-accent-dark/90 mt-0.5">{pendingApprovalsCount || 1} product approval{(pendingApprovalsCount || 1) === 1 ? '' : 's'} still need review.</p>
                    </div>
                  </div>
                  {onNavigateToApprovals && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => { closeCheckoutModal(); onNavigateToApprovals(); }}
                      className="shrink-0"
                    >
                      Review Swaps
                    </Button>
                  )}
                </div>
              ) : (
                <div className="bg-good/15 border border-good/30 rounded-xl p-3 flex items-center justify-between text-good">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-4 h-4 text-good shrink-0" />
                    <span className="font-medium">Order verified against your budget and restock guidelines.</span>
                  </div>
                  {decisionReasons.length > 0 && (
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="text-[11px] text-good hover:underline font-semibold flex items-center gap-0.5 ml-2 cursor-pointer shrink-0"
                    >
                      <span>Why this?</span>
                      {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              )}

              {/* "Why this is cheapest" reasoning box (Secondary / Slate AI token) */}
              {showDetails && decisionReasons.length > 0 && (
                <div className="bg-secondary-tint/40 border border-secondary-tint rounded-xl p-3 text-xs text-ink-muted space-y-1.5">
                  <div className="flex items-center gap-1.5 text-secondary font-semibold uppercase text-[10px] tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                    <span>Why This Is Cheapest:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    {decisionReasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
                  </ul>
                </div>
              )}

              {/* Order Summary & Dual Currency Display */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-ink">
                    Order Summary ({strategy.storeBaskets.reduce((count, basket) => count + basket.items.length, 0)} items)
                  </span>
                  <span className="tabular-nums font-bold text-sm text-ink">{formatPaise(strategy.grandTotalPaise)}</span>
                </div>

                {/* Dual INR and USD note */}
                {isSandbox && providerConfig?.currency === 'USD' && checkoutModal.chargedAmount && (
                  <div className="rounded-xl bg-paper border border-secondary-tint p-3 text-ink flex items-center justify-between text-xs tabular-nums">
                    <span>
                      USD Amount: <strong className="text-ink">USD ${checkoutModal.chargedAmount}</strong>
                    </span>
                    <span className="text-ink-muted text-[11px]">
                      Grocery total: {formatPaise(strategy.grandTotalPaise)}
                    </span>
                  </div>
                )}

                {/* Store-grouped lines */}
                <div className="space-y-3">
                  {strategy.storeBaskets.map(basket => (
                    <div key={basket.storeId} className="bg-surface rounded-xl border border-secondary-tint p-3.5 space-y-2.5 shadow-soft">
                      <div className="flex justify-between items-center border-b border-secondary-tint pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary-tint text-secondary capitalize">
                            {basket.storeName}
                          </span>
                          <span className="text-xs text-ink-muted">({basket.items.length} items)</span>
                        </div>
                        <span className="tabular-nums font-bold text-xs text-ink">{formatPaise(basket.totalPaise)}</span>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {basket.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs py-0.5">
                            <span className="truncate pr-3 text-ink">
                              <strong>{item.quantity}×</strong> {item.product.name}
                              {item.isSubstitution && (
                                <span className="ml-1.5 text-[10px] font-semibold text-secondary bg-secondary-tint border border-secondary/20 px-1 py-0.5 rounded">
                                  Swap
                                </span>
                              )}
                            </span>
                            <span className="tabular-nums font-medium text-ink shrink-0">{formatPaise(item.totalPaise)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-secondary-tint flex justify-between text-[11px] text-ink-muted">
                        <span>Delivery and handling</span>
                        <span className="font-medium text-ink tabular-nums">{formatPaise(basket.deliveryFeePaise + basket.handlingFeePaise)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PayPal Sandbox / Mock Checkout Area */}
              {isSandbox ? (
                <div className="space-y-4 border-t border-secondary-tint pt-4">
                  {isPreparing && <p className="text-center text-xs text-ink-muted">Preparing secure PayPal Sandbox order…</p>}
                  {!providerConfig?.clientId && providerConfig && (
                    <p className="text-center text-xs text-danger">PayPal Sandbox Client ID is missing. Set PAYPAL_CLIENT_ID in backend/.env.</p>
                  )}
                  {orderId && <div ref={paypalButtonContainer} className={needsApproval ? 'pointer-events-none opacity-40' : ''} />}
                  {approvalUrl && (
                    <div className="rounded-xl border border-secondary-tint bg-paper p-4 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-32 h-32 bg-surface border border-secondary-tint rounded-xl flex items-center justify-center shrink-0 shadow-soft">
                        {qrImage ? (
                          <img src={qrImage} alt="QR code linking to PayPal Sandbox order" className="w-28 h-28" />
                        ) : (
                          <QrCode className="w-8 h-8 text-ink-muted" />
                        )}
                      </div>
                      <div className="space-y-1.5 text-center sm:text-left">
                        <h4 className="font-bold text-ink text-xs">Scan to pay with PayPal Sandbox</h4>
                        <p className="text-[11px] text-ink-muted">Open the buyer approval page on your mobile device. Payment status updates automatically.</p>
                        <a
                          href={approvalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline font-semibold"
                        >
                          Open PayPal checkout <ExternalLink className="w-3 h-3" />
                        </a>
                        <p className="text-[11px] text-ink-muted tabular-nums">
                          Order total: <strong className="text-ink">{formatPaise(strategy.grandTotalPaise)}</strong>
                          {checkoutModal.currency && ` • PayPal ${checkoutModal.currency} ${checkoutModal.chargedAmount || ''}`}
                        </p>
                      </div>
                    </div>
                  )}
                  {paymentState === 'CANCELLED' && (
                    <Button variant="outline" size="md" onClick={handleRetry} className="w-full">
                      Retry PayPal checkout
                    </Button>
                  )}
                  {paymentState === 'FAILED' && (
                    <Button variant="outline" size="md" onClick={handleRetry} className="w-full">
                      Retry payment
                    </Button>
                  )}
                  {orderId && (
                    <p className="text-center text-[11px] text-ink-muted">
                      Payment status: {paymentState || 'PENDING'} · Waiting for PayPal capture confirmation.
                    </p>
                  )}
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleMockPayment}
                  disabled={isPreparing || needsApproval}
                  className="w-full"
                >
                  {isPreparing ? 'Processing mock checkout…' : 'Run mock checkout (no PayPal transaction)'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
