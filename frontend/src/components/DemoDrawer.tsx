import React from 'react';
import { useShopPilot } from '../context/ShopPilotContext';
import { TimeMachine } from './TimeMachine';
import { BackendHealthBadge } from './BackendHealthBadge';
import {
  X,
  RotateCcw,
  Sliders,
  Info,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { Button } from './ui/Button';

export interface DemoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoDrawer: React.FC<DemoDrawerProps> = ({ isOpen, onClose }) => {
  const { resetToInitialDemo, setShowDemoInfoModal, isLoading } = useShopPilot();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md bg-surface h-full shadow-card border-l border-secondary-tint z-10 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-secondary-tint flex items-center justify-between bg-paper">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-tint text-brand flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-ink text-sm">Demo & Testing Controls</h3>
              <p className="text-[11px] text-ink-muted">Fast-forward household time and test auto-restocking</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-secondary-tint/50 cursor-pointer transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-5 space-y-6 flex-1 text-ink">
          {/* Time Machine & Clock (brand-dark) */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block">
              Simulation Clock
            </span>
            <TimeMachine />
          </div>

          {/* Integration Boundaries & Architecture Info */}
          <div className="rounded-xl border border-secondary-tint p-4 bg-paper space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Info className="w-4 h-4 text-brand" />
                Integration Architecture
              </span>
              <BackendHealthBadge />
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              ShopPilot uses local mock store adapters with strict validation,
              autonomous budget caps, and simulated PayPal 1-Click checkout.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowDemoInfoModal(true);
                onClose();
              }}
              icon={<ShieldCheck className="w-3.5 h-3.5 text-secondary" />}
              className="w-full"
            >
              View System Architecture
            </Button>
          </div>

          {/* Reset Demo State */}
          <div className="rounded-xl border border-danger/25 p-4 bg-danger/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-danger flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-danger" />
                Reset Sandbox State
              </span>
            </div>
            <p className="text-[11px] text-danger/90 leading-relaxed">
              Restore default demo items (Milk, Eggs, Bread, Oats, Coffee, Detergent) and reset simulation clock to Day 0.
            </p>
            <Button
              variant="danger"
              size="sm"
              isLoading={isLoading}
              onClick={async () => {
                await resetToInitialDemo();
                onClose();
              }}
              className="w-full"
            >
              Reset to Factory Demo State
            </Button>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-secondary-tint bg-paper flex items-center justify-between text-[11px] text-ink-muted">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-good" />
            <span>ShopPilot AI • Hackathon Ready</span>
          </span>
          <button
            onClick={onClose}
            className="font-semibold text-ink hover:underline cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
