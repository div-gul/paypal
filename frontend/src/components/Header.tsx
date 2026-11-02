import React from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { Bot, Sliders, Info, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';

export interface HeaderProps {
  onOpenDemoDrawer: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenDemoDrawer }) => {
  const { simulationState, activeRun, recommendations, setShowDemoInfoModal, isLoading } = useShopPilot();

  // Pending approvals counter
  const pendingApprovalsCount =
    activeRun?.status === 'approved'
      ? 0
      : recommendations.filter(
          r =>
            r.approvalStatus !== 'approved' &&
            r.approvalStatus !== 'rejected' &&
            (r.requiresApproval || r.isSubstitution)
        ).length;

  const simDate = new Date(simulationState.simulatedDate);
  const formattedSimDate = simDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Dynamic friendly status pill
  const renderStatusPill = () => {
    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
          <span>Syncing...</span>
        </span>
      );
    }
    if (activeRun?.status === 'needs_approval' || pendingApprovalsCount > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span>Waiting for your approval ({pendingApprovalsCount})</span>
        </span>
      );
    }
    if (activeRun?.status === 'auto_approved' || activeRun?.status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Ready to order</span>
        </span>
      );
    }
    if (activeRun?.status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Restocked & paid</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>Pantry on Autopilot</span>
      </span>
    );
  };

  return (
    <header className="glass-header border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        {/* Brand & Status Pill */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-amber-400 shadow-sm shadow-emerald-600/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900 font-heading">ShopPilot</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-brand-100 text-brand-800 tracking-wider">
                  AI
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block -mt-0.5 hidden sm:block">
                Autonomous Restocking
              </span>
            </div>
          </div>

          {/* Status Dot Pill */}
          <div className="hidden sm:block">{renderStatusPill()}</div>
        </div>

        {/* Right Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="block sm:hidden">{renderStatusPill()}</div>

          {/* Demo Controls Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenDemoDrawer}
            icon={<Sliders className="w-3.5 h-3.5 text-brand-600" />}
            title="Fast-forward days and simulate restocking"
          >
            <span className="hidden sm:inline text-slate-500 font-normal mr-1">{formattedSimDate} •</span>
            <span>Demo Controls</span>
          </Button>

          {/* Why this? / Info Modal Button */}
          <button
            onClick={() => setShowDemoInfoModal(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition"
            title="About ShopPilot AI & Integrations"
            aria-label="System info"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
