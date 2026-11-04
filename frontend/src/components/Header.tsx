import React from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { Bot, Sliders, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
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

  // Dynamic friendly status pill with icon and text label
  const renderStatusPill = () => {
    if (isLoading) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary-tint text-secondary border border-secondary-tint">
          <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
          <span>Syncing...</span>
        </span>
      );
    }
    if (activeRun?.status === 'needs_approval' || pendingApprovalsCount > 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-tint text-accent-dark border border-accent/25">
          <AlertTriangle className="w-3.5 h-3.5 text-accent-dark" />
          <span>Needs your OK ({pendingApprovalsCount})</span>
        </span>
      );
    }
    if (activeRun?.status === 'auto_approved' || activeRun?.status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-good/15 text-good border border-good/30">
          <CheckCircle2 className="w-3.5 h-3.5 text-good" />
          <span>Ready to order</span>
        </span>
      );
    }
    if (activeRun?.status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-good/15 text-good border border-good/30">
          <CheckCircle2 className="w-3.5 h-3.5 text-good" />
          <span>Restocked & paid</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary-tint text-secondary border border-secondary-tint">
        <span className="w-2 h-2 rounded-full bg-good"></span>
        <span>Pantry on Autopilot</span>
      </span>
    );
  };

  return (
    <header className="glass-header border-b border-secondary-tint sticky top-0 z-30 shadow-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        {/* Brand & Status Pill */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-brand-tint shadow-soft">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-ink">ShopPilot</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-brand-tint text-brand tracking-wider">
                  AI
                </span>
              </div>
              <span className="text-[10px] text-ink-muted block -mt-0.5 hidden sm:block">
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
            icon={<Sliders className="w-3.5 h-3.5 text-secondary" />}
            title="Fast-forward days and simulate restocking"
          >
            <span className="hidden sm:inline text-ink-muted font-normal mr-1 tabular-nums">{formattedSimDate} •</span>
            <span>Demo Controls</span>
          </Button>

          {/* Why this? / Info Modal Button */}
          <button
            onClick={() => setShowDemoInfoModal(true)}
            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-secondary-tint/50 focus-visible:ring-2 focus-visible:ring-brand cursor-pointer transition min-w-[44px] min-h-[44px] flex items-center justify-center"
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
