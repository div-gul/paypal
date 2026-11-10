import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useShopPilot } from '../context/ShopPilotContext';
import { api } from '../api/client';
import { useDeliveryAddresses, formatDeliveryAddress } from '../context/DeliveryAddressContext';
import { DeliveryAddressFormDialog } from './DeliveryAddressManager';
import { formatPaise } from '../services/currency';
import { Button } from './ui/Button';
import { ProductImage } from './ui/ProductImage';
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
  MapPin,
  Plus,
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
    script.onerror = () => reject(new Error('Could not load PayPal checkout. Check your connection and PayPal Client ID.'));
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
  const [showAddressForm, setShowAddressForm] = useState(false);
  const paypalButtonContainer = useRef<HTMLDivElement>(null);
  const orderAddressKeyRef = useRef('');
  const { addresses, selectedAddress, select } = useDeliveryAddresses();
  const strategyRef = useRef(checkoutModal.strategy);
  strategyRef.current = checkoutModal.strategy;

  const { strategy, orderId, approvalUrl, paymentState, itemsPurchased } = checkoutModal;
  const runId = checkoutModal.runId || activeRun?.id;
  const isOrderPlaced = paymentState === 'CAPTURED';
  const isSandbox = providerConfig?.mode === 'sandbox';
  const isPayPal = providerConfig?.mode === 'sandbox' || providerConfig?.mode === 'live';
  const isLive = providerConfig?.mode === 'live';
  const pendingApprovalsCount = activeRun?.status === 'approved'
    ? 0
    : recommendations.filter(r => r.approvalStatus !== 'approved' && r.approvalStatus !== 'rejected' && (r.requiresApproval || r.isSubstitution)).length;
  const needsApproval = activeRun?.id === runId && (pendingApprovalsCount > 0 || activeRun?.status === 'needs_approval');
  const checkoutItemCount = strategy?.storeBaskets.reduce((count, basket) => count + basket.items.length, 0) || 0;

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
    if (!checkoutModal.isOpen) {
      orderAddressKeyRef.current = '';
      return;
    }
    if (!isPayPal || !strategy || !runId || !selectedAddress || paymentState === 'CAPTURED' || checkoutItemCount === 0) return;
    const addressKey = `${runId}:${selectedAddress.id}`;
    if (orderAddressKeyRef.current === addressKey) return;
    orderAddressKeyRef.current = addressKey;
    let cancelled = false;
    setIsPreparing(true);
    createPayPalOrder(runId, strategy, selectedAddress.id)
      .catch(error => { if (!cancelled) setErrorMessage(error.message || 'Could not create PayPal order.'); })
      .finally(() => { if (!cancelled) setIsPreparing(false); });
    return () => { cancelled = true; };
  }, [checkoutModal.isOpen, isPayPal, strategy, runId, paymentState, checkoutItemCount, createPayPalOrder, selectedAddress?.id]);

  useEffect(() => {
    if (!approvalUrl || !isPayPal) {
      setQrImage(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(approvalUrl, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then(dataUrl => { if (!cancelled) setQrImage(dataUrl); })
      .catch(error => { if (!cancelled) setErrorMessage(error.message || 'Could not generate the PayPal checkout QR code.'); });
    return () => { cancelled = true; };
  }, [approvalUrl, isPayPal]);

  // Render the official PayPal button
  useEffect(() => {
    if (!checkoutModal.isOpen || !isPayPal || !providerConfig?.clientId || !strategy || !runId || !orderId || isOrderPlaced || checkoutItemCount === 0) return;
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
  }, [checkoutModal.isOpen, isPayPal, providerConfig, strategy, runId, orderId, isOrderPlaced, checkoutItemCount, capturePayPalOrder, cancelPayPalOrder]);

  // Poll server for status
  useEffect(() => {
    if (!checkoutModal.isOpen || !isPayPal || !strategy || !runId || !orderId || isOrderPlaced || checkoutItemCount === 0) return;
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
  }, [checkoutModal.isOpen, isPayPal, strategy, runId, orderId, isOrderPlaced, checkoutItemCount, getCheckoutStatus]);

  if (!checkoutModal.isOpen || !strategy) return null;

  const handleMockPayment = async () => {
    if (!selectedAddress) {
      setErrorMessage('Add a delivery address before checkout.');
      return;
    }
    if (needsApproval) return;
    setIsPreparing(true);
    setErrorMessage(null);
    try {
      await confirmMockPayment(strategy, selectedAddress.id);
    } catch (error: any) {
      setErrorMessage(error.message || 'Mock checkout failed.');
    } finally {
      setIsPreparing(false);
    }
  };

  const handleRetry = () => {
    orderAddressKeyRef.current = '';
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
                  {isLive ? 'Live' : isSandbox ? 'Sandbox' : 'Mock'}
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
                <p className="text-ink-muted text-xs mt-1">{isLive ? 'PayPal confirmed this live capture.' : 'PayPal Sandbox confirmed capture. No real money was moved.'} This confirms payment only; no physical grocery delivery was arranged.</p>
                <div className="inline-block mt-2 bg-paper text-ink-muted px-3 py-1 rounded-lg tabular-nums font-semibold text-xs border border-secondary-tint">
                  Simulated order {orderId} {checkoutModal.orderCreatedAt ? `• ${new Date(checkoutModal.orderCreatedAt).toLocaleString('en-IN')}` : ''}
                </div>
              </div>
              {checkoutModal.deliveryAddress && <div className="rounded-xl border border-secondary-tint bg-surface p-3 text-left"><p className="flex items-center gap-2 text-xs font-bold text-ink"><MapPin className="h-4 w-4 text-brand" />Delivery address · {checkoutModal.deliveryAddress.label}</p><p className="mt-1 text-xs font-semibold text-ink">{checkoutModal.deliveryAddress.fullName} · {checkoutModal.deliveryAddress.mobileNumber}</p><p className="mt-1 text-xs leading-relaxed text-ink-muted">{formatDeliveryAddress(checkoutModal.deliveryAddress)}, {checkoutModal.deliveryAddress.country}</p></div>}
              <div className="bg-paper rounded-xl border border-secondary-tint p-4 text-left space-y-3 shadow-soft">
                <div className="flex items-center gap-2 font-bold text-ink text-xs border-b border-secondary-tint pb-2">
                  <PackageCheck className="w-4 h-4 text-good" />
                  <span>Paid Grocery Order Receipt</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {itemsPurchased?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-ink text-xs gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <ProductImage
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          size="sm"
                          className="w-7 h-7 rounded-lg"
                        />
                        <span className="truncate">{item.quantity}× {item.product.name}</span>
                      </div>
                      <span className="font-semibold text-ink tabular-nums shrink-0">{formatPaise(item.totalPaise)}</span>
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
                  {isLive
                    ? 'LIVE PAYMENT — real funds may be charged.'
                    : isSandbox
                      ? 'Sandbox payment, no real money — test transaction only; no live funds will be charged.'
                      : 'Mock checkout mode — no live transaction will be processed.'}
                </p>
              </div>

              <div className="rounded-xl border border-secondary-tint bg-surface p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-xs font-bold text-ink"><MapPin className="h-4 w-4 text-brand" />Delivery address</p>{!selectedAddress && <Button size="sm" variant="outline" onClick={() => setShowAddressForm(true)} icon={<Plus className="h-3.5 w-3.5" />}>Add address</Button>}</div>
                {selectedAddress ? <>
                  <label className="block text-[11px] font-medium text-ink-muted">Selected address<select aria-label="Select delivery address" value={selectedAddress.id} disabled={isPreparing} onChange={event => { void select(event.target.value).catch((error: any) => setErrorMessage(error.message || 'Could not change the address.')); }} className="mt-1 w-full rounded-lg border border-secondary-tint bg-paper px-3 py-2 text-xs text-ink min-h-[40px]">{addresses.map(address => <option key={address.id} value={address.id}>{address.label} · {address.city}, {address.state} {address.pinCode}</option>)}</select></label>
                  <p className="text-xs text-ink-muted">{selectedAddress.fullName} · {selectedAddress.mobileNumber}<br />{formatDeliveryAddress(selectedAddress)}, India</p>
                </> : <p className="text-xs text-ink-muted">Save an address to continue. You can enter any valid Indian PIN code; catalog prices remain simulated reference data.</p>}
                <p className="text-[10px] leading-relaxed text-ink-muted">Product listings and prices are simulated demo data based on the Katraj, Pune reference catalog. Actual marketplace availability and delivery coverage are not verified.</p>
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
                    Order Summary ({checkoutItemCount} items)
                  </span>
                  <span className="tabular-nums font-bold text-sm text-ink">{formatPaise(checkoutItemCount > 0 ? strategy.grandTotalPaise : 0)}</span>
                </div>

                {checkoutItemCount === 0 && (
                  <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                    There are no items to purchase, so checkout is unavailable. Close this window and generate a new restock plan.
                  </div>
                )}

                {/* Dual INR and USD note */}
                {isPayPal && providerConfig?.currency === 'USD' && checkoutModal.chargedAmount && (
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
                          <div key={idx} className="flex justify-between items-center text-xs py-0.5 gap-2">
                            <span className="flex items-center gap-2 truncate pr-2 text-ink">
                              <ProductImage
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                size="sm"
                                className="w-7 h-7 rounded-lg"
                              />
                              <span className="truncate">
                                <strong>{item.quantity}×</strong> {item.product.name}
                              </span>
                              {item.isSubstitution && (
                                <span className="ml-1 text-[10px] font-semibold text-secondary bg-secondary-tint border border-secondary/20 px-1 py-0.5 rounded shrink-0">
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
              {isPayPal ? (
                <div className="space-y-4 border-t border-secondary-tint pt-4">
                  {isPreparing && <p className="text-center text-xs text-ink-muted">Preparing secure PayPal order…</p>}
                  {!providerConfig?.clientId && providerConfig && (
                    <p className="text-center text-xs text-danger">PayPal Client ID is missing. Set PAYPAL_CLIENT_ID in backend/.env.</p>
                  )}
                  {orderId && selectedAddress && <div ref={paypalButtonContainer} className={needsApproval ? 'pointer-events-none opacity-40' : ''} />}
                  {approvalUrl && (
                    <div className="rounded-xl border border-secondary-tint bg-paper p-4 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-32 h-32 bg-surface border border-secondary-tint rounded-xl flex items-center justify-center shrink-0 shadow-soft">
                        {qrImage ? (
                          <img src={qrImage} alt={`QR code linking to PayPal ${isLive ? 'live' : 'Sandbox'} order`} className="w-28 h-28" />
                        ) : (
                          <QrCode className="w-8 h-8 text-ink-muted" />
                        )}
                      </div>
                      <div className="space-y-1.5 text-center sm:text-left">
                        <h4 className="font-bold text-ink text-xs">{isLive ? 'Scan to pay with PayPal' : 'Scan to pay with PayPal Sandbox'}</h4>
                        <p className="text-[11px] text-ink-muted">Open the buyer approval page on your mobile device. Payment status updates automatically.</p>
                        <a
                          href={approvalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
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
                  disabled={isPreparing || needsApproval || !selectedAddress}
                  className="w-full"
                >
                  {isPreparing ? 'Processing mock checkout…' : 'Run mock checkout (no PayPal transaction)'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      {showAddressForm && <DeliveryAddressFormDialog selectOnSave onClose={() => setShowAddressForm(false)} />}
    </div>
  );
};
