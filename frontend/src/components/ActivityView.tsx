import React, { useEffect, useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { api } from '../api/client';
import { formatDeliveryAddress } from '../context/DeliveryAddressContext';
import { formatPaise } from '../services/currency';
import { Card, Badge, EmptyState } from './ui';
import {
  Activity,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Sparkles,
} from 'lucide-react';

export const ActivityView: React.FC = () => {
  const { activityLog } = useShopPilot();
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => { void api.getRuns(50).then(result => setOrders(result.runs)).catch(() => setOrders([])); }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'order_placed':
      case 'order_approved':
        return <CheckCircle2 className="w-4 h-4 text-good" />;
      case 'order_blocked':
        return <AlertTriangle className="w-4 h-4 text-danger" />;
      case 'time_advanced':
        return <Clock className="w-4 h-4 text-secondary" />;
      case 'analysis_run':
        return <Sparkles className="w-4 h-4 text-brand" />;
      case 'policy_updated':
        return <Sliders className="w-4 h-4 text-accent" />;
      default:
        return <Activity className="w-4 h-4 text-ink-muted" />;
    }
  };

  const getBadgeVariant = (type: string): 'success' | 'danger' | 'info' | 'warning' | 'neutral' => {
    switch (type) {
      case 'order_placed':
      case 'order_approved':
        return 'success';
      case 'order_blocked':
        return 'danger';
      case 'analysis_run':
        return 'info';
      case 'policy_updated':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-ink">Restock Activity</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          Autonomous decisions, simulation timeline, and payment audit logs.
        </p>
      </div>

      {activityLog.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-8 h-8 text-secondary" />}
          title="No activity recorded yet"
          description="Autonomous evaluations, schedule triggers, and order approvals will appear here."
        />
      ) : (
        <Card variant="elevated" className="divide-y divide-secondary-tint/40 p-0 overflow-hidden">
          {activityLog.map((log) => {
            const simDate = new Date(log.simulatedDate);
            const formattedSimDate = isNaN(simDate.getTime())
              ? log.simulatedDate
              : simDate.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });

            return (
              <div key={log.id} className="p-4 sm:p-5 flex items-start gap-4 hover:bg-paper/50 transition">
                <div className="w-8 h-8 rounded-xl bg-paper border border-secondary-tint/60 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  {getEventIcon(log.type)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink leading-tight">
                      {log.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={getBadgeVariant(log.type)} size="sm">
                        {log.type.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-[11px] text-ink-muted tabular-nums flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-secondary" />
                        {formattedSimDate}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    {log.description}
                  </p>
                </div>
              </div>
            );
          })}
        </Card>
      )}
      <section className="space-y-3" aria-labelledby="simulated-order-history-heading">
        <div><h2 id="simulated-order-history-heading" className="text-xl font-bold text-ink">Simulated order history</h2><p className="mt-1 text-xs text-ink-muted">Payment records and the address snapshot saved with each checkout. No physical delivery is arranged.</p></div>
        {orders.length === 0 ? <Card className="p-5 text-sm text-ink-muted">No simulated orders yet.</Card> : <div className="space-y-3">{orders.map(order => {
          const lineItems = order.selectedStrategyDetails?.storeBaskets?.flatMap((basket: any) => basket.items || []) || [];
          const snapshot = order.addressSnapshot;
          const created = new Date(order.createdAt);
          return <Card key={order.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-ink">Order {order.orderId || order.id}</h3><p className="mt-1 text-[11px] text-ink-muted">{Number.isNaN(created.getTime()) ? order.createdAt : created.toLocaleString('en-IN')}</p></div><Badge variant={order.paymentState === 'CAPTURED' ? 'success' : order.status === 'blocked' ? 'danger' : 'neutral'}>{order.paymentState === 'CAPTURED' ? 'Simulated payment complete' : `Simulated ${String(order.status).replace(/_/g, ' ')}`}</Badge></div>
            {lineItems.length > 0 && <div className="space-y-1 border-t border-secondary-tint pt-2">{lineItems.map((item: any, index: number) => <div key={`${item.product?.id || item.product?.name || 'item'}-${index}`} className="flex justify-between gap-3 text-xs"><span className="text-ink-muted">{item.quantity} × {item.product?.name || item.productName || 'Grocery item'}</span><span className="shrink-0 font-medium text-ink">{formatPaise(item.totalPaise || 0)}</span></div>)}</div>}
            <div className="flex justify-between border-t border-secondary-tint pt-2 text-xs"><span className="text-ink-muted">Final simulated total</span><strong className="text-ink">{formatPaise(order.grandTotalPaise || 0)}</strong></div>
            <div className="rounded-lg bg-paper p-3 text-xs"><p className="font-semibold text-ink">Address used for this order</p>{snapshot ? <p className="mt-1 text-ink-muted">{snapshot.fullName} · {snapshot.mobileNumber}<br />{formatDeliveryAddress(snapshot)}, {snapshot.country}</p> : <p className="mt-1 text-ink-muted">No address snapshot was recorded for this older order.</p>}</div>
          </Card>;
        })}</div>}
      </section>
    </div>
  );
};
