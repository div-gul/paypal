import React from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
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

  // Deduplicate consecutive analysis_run entries — keep only the most recent one per
  // simulated date so the feed is not flooded by repeated plan-generation events.
  const deduplicatedLog = activityLog.filter((log, index, all) => {
    if (log.type !== 'analysis_run') return true;
    // Drop if the next item is an identical analysis_run on the same simulated date
    const next = all[index + 1];
    return !(next && next.type === 'analysis_run' && next.simulatedDate === log.simulatedDate);
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-ink">Restock Activity</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          Autonomous decisions, simulation timeline, and order audit logs.
        </p>
      </div>

      {deduplicatedLog.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-8 h-8 text-secondary" />}
          title="No activity recorded yet"
          description="Autonomous evaluations, schedule triggers, and order approvals will appear here."
        />
      ) : (
        <Card variant="elevated" className="divide-y divide-secondary-tint/40 p-0 overflow-hidden">
          {deduplicatedLog.map((log) => {
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
    </div>
  );
};
