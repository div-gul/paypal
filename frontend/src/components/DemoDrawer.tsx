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
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 z-10 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm font-heading">Demo & Testing Controls</h3>
              <p className="text-[11px] text-slate-500">Fast-forward household time and test auto-restocking</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer transition"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-5 space-y-6 flex-1">
          {/* Time Machine & Clock */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Simulation Clock
            </span>
            <TimeMachine />
          </div>

          {/* Integration Boundaries & Architecture Info */}
          <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-brand-600" />
                Integration Architecture
              </span>
              <BackendHealthBadge />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              ShopPilot integrates with mock and live catalog adapters (Channel3) with strict sanitization,
              autonomous budget caps, and simulated PayPal 1-Click checkout.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowDemoInfoModal(true);
                onClose();
              }}
              icon={<ShieldCheck className="w-3.5 h-3.5 text-brand-600" />}
              className="w-full"
            >
              View System Architecture
            </Button>
          </div>

          {/* Reset Demo State */}
          <div className="rounded-2xl border border-rose-200 p-4 bg-rose-50/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                Reset Sandbox State
              </span>
            </div>
            <p className="text-[11px] text-rose-700 leading-relaxed">
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
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            ShopPilot AI • Hackathon Ready
          </span>
          <button
            onClick={onClose}
            className="font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
