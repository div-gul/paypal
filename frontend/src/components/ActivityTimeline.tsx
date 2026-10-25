import React, { useState } from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import {
  History,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Layers,
  Shield,
  Filter,
} from 'lucide-react';
import { ActivityLogItem } from '../types';

export const ActivityTimeline: React.FC = () => {
  const { activityLog } = useShopPilot();
  const [filterType, setFilterType] = useState<string>('all');

  const filteredLog = activityLog.filter(item => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const getLogIcon = (type: ActivityLogItem['type']) => {
    switch (type) {
      case 'time_advanced':
        return <Clock className="w-4 h-4 text-indigo-600" />;
      case 'analysis_run':
        return <Sparkles className="w-4 h-4 text-brand-600" />;
      case 'recommendation_made':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'stockout_warning':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'checkout_completed':
        return <CreditCard className="w-4 h-4 text-amber-600" />;
      case 'pantry_updated':
        return <Layers className="w-4 h-4 text-blue-600" />;
      case 'approval_requested':
      case 'approval_granted':
      case 'approval_rejected':
      case 'policy_applied':
        return <Shield className="w-4 h-4 text-purple-600" />;
      default:
        return <History className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Auditable Autonomous Decision Timeline
          </h2>
          <p className="text-xs text-slate-500">
            Immutable log recording every consumption step, agent rationale, approval event, and checkout action.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 cursor-pointer focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Events ({activityLog.length})</option>
            <option value="time_advanced">Time Fast-Forwards</option>
            <option value="stockout_warning">Stockout Alerts</option>
            <option value="approval_requested">Approvals</option>
            <option value="checkout_completed">Checkout Transactions</option>
            <option value="pantry_updated">Pantry Updates</option>
          </select>
        </div>
      </div>

      {/* Timeline List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {filteredLog.map(item => {
          const simDateStr = new Date(item.simulatedDate).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs hover:bg-slate-100/60 transition"
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                {getLogIcon(item.type)}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.title}</span>
                    {item.statusBadge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                        {item.statusBadge}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Sim Date: <span className="font-semibold text-slate-600">{simDateStr}</span>
                  </div>
                </div>

                <p className="text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
