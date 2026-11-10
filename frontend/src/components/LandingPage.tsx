import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  ShoppingBag,
  TrendingDown,
  Layers,
  Bot,
  Zap,
  CheckCircle2,
  ArrowRight,
  Clock,
  CreditCard,
  AlertTriangle,
  ChevronRight,
  Store,
  Lock,
  Sliders,
  Package,
  BarChart3,
  Check,
} from 'lucide-react';
import { AuthUser, api } from '../api/client';

interface LandingPageProps {
  onEnterDemo: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  currentUser?: AuthUser | null;
  onGoToApp?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterDemo,
  onOpenAuth,
  currentUser,
  onGoToApp,
}) => {
  const [activeStoryAct, setActiveStoryAct] = useState<'chaos' | 'intelligence' | 'autonomy'>('chaos');
  const [isDemoLaunching, setIsDemoLaunching] = useState(false);
  const [demoError, setDemoError] = useState('');

  // Interactive Live Price Calculator items
  const [selectedBasketItems, setSelectedBasketItems] = useState<string[]>([
    'item-milk',
    'item-bread',
    'item-eggs',
    'item-oats',
  ]);

  const STAPLE_OPTIONS = [
    {
      id: 'item-milk',
      name: 'Amul Taaza Toned Milk',
      weight: '1 L',
      category: 'Dairy',
      image: '/products/amul-milk.jpg',
      zepto: 54,
      blinkit: 56,
      instamart: 55,
    },
    {
      id: 'item-bread',
      name: 'Harvest Gold 100% Atta Bread',
      weight: '400g',
      category: 'Bakery & Bread',
      image: '/products/harvest-gold-bread.jpg',
      zepto: 50,
      blinkit: 50,
      instamart: 52,
    },
    {
      id: 'item-eggs',
      name: 'Eggoz Farm Fresh White Eggs',
      weight: '6 pcs',
      category: 'Eggs & Meat',
      image: '/products/eggoz-eggs.jpg',
      zepto: 68,
      blinkit: 72,
      instamart: 70,
    },
    {
      id: 'item-oats',
      name: 'Quaker Rolled Whole Oats',
      weight: '1 kg',
      category: 'Breakfast',
      image: '/products/quaker-oats.jpg',
      zepto: 185,
      blinkit: 195,
      instamart: 190,
    },
    {
      id: 'item-detergent',
      name: 'Surf Excel Matic Front Load',
      weight: '2 L',
      category: 'Household',
      image: '/products/surf-excel.jpg',
      zepto: 410,
      blinkit: 425,
      instamart: 420,
    },
    {
      id: 'item-coffee',
      name: 'Nescafé Classic Instant Coffee',
      weight: '100g',
      category: 'Beverages',
      image: '/products/nescafe-coffee.jpg',
      zepto: 320,
      blinkit: 335,
      instamart: 330,
    },
  ];

  const toggleBasketItem = (id: string) => {
    setSelectedBasketItems(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Compute live calculator totals
  const activeItems = STAPLE_OPTIONS.filter(opt => selectedBasketItems.includes(opt.id));
  const zeptoItemsTotal = activeItems.reduce((acc, it) => acc + it.zepto, 0);
  const blinkitItemsTotal = activeItems.reduce((acc, it) => acc + it.blinkit, 0);
  const instamartItemsTotal = activeItems.reduce((acc, it) => acc + it.instamart, 0);

  // Delivery + Platform fee modeling
  const zeptoDelivery = zeptoItemsTotal >= 299 ? 0 : 25;
  const zeptoPlatform = 5;
  const zeptoGrandTotal = zeptoItemsTotal > 0 ? zeptoItemsTotal + zeptoDelivery + zeptoPlatform : 0;

  const blinkitDelivery = blinkitItemsTotal >= 499 ? 15 : 35;
  const blinkitPlatform = 7;
  const blinkitGrandTotal = blinkitItemsTotal > 0 ? blinkitItemsTotal + blinkitDelivery + blinkitPlatform : 0;

  const instamartDelivery = instamartItemsTotal >= 399 ? 10 : 30;
  const instamartPlatform = 6;
  const instamartGrandTotal = instamartItemsTotal > 0 ? instamartItemsTotal + instamartDelivery + instamartPlatform : 0;

  // Best recommended single-store or split
  const bestTotal = Math.min(...[zeptoGrandTotal, blinkitGrandTotal, instamartGrandTotal].filter(t => t > 0));
  const worstTotal = Math.max(zeptoGrandTotal, blinkitGrandTotal, instamartGrandTotal);
  const savings = Math.max(0, worstTotal - bestTotal);

  const handleInstantDemo = async () => {
    setIsDemoLaunching(true);
    setDemoError('');
    try {
      await api.login('guest_paypal@example.com', 'GUEST_paypal@1502');
      onEnterDemo();
    } catch {
      // If login fails, try invoking demo handler directly
      try {
        onEnterDemo();
      } catch (err: any) {
        setDemoError(err?.message || 'Could not launch demo. Please try logging in manually.');
      }
    } finally {
      setIsDemoLaunching(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-brand selection:text-white font-sans antialiased">
      {/* Top Floating Announcement Bar */}
      <div className="bg-brand-dark text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-2 relative z-50">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-bold tracking-wider uppercase">
          PayPal Sandbox Enabled
        </span>
        <span className="hidden sm:inline">
          Autonomous Grocery Restock & Multi-Store Arbitrage Engine.
        </span>
        <button
          onClick={handleInstantDemo}
          className="underline hover:text-brand-tint font-semibold cursor-pointer inline-flex items-center gap-1"
        >
          Try Live Demo <ArrowRight className="w-3 h-3 inline" />
        </button>
      </div>

      {/* Sticky Frosted Header */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-secondary-tint/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white shadow-soft">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-ink">ShopPilot</span>
                <span className="px-1.5 py-0.2 rounded-md bg-brand-tint text-brand text-[10px] font-extrabold tracking-wider uppercase">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-ink-muted -mt-0.5 hidden sm:block">
                Powered by PayPal REST APIs
              </p>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-ink-muted">
            <a href="#story" className="hover:text-ink transition">
              The Story
            </a>
            <a href="#how-it-works" className="hover:text-ink transition">
              How It Works
            </a>
            <a href="#price-engine" className="hover:text-ink transition">
              Arbitrage Engine
            </a>
            <a href="#paypal-security" className="hover:text-ink transition">
              PayPal Guardrails
            </a>
            <a href="#architecture" className="hover:text-ink transition">
              Tech Stack
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <button
                onClick={onGoToApp}
                className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-bold transition shadow-soft flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => onOpenAuth('login')}
                  className="px-3.5 py-2 text-xs font-semibold text-ink hover:text-brand hover:bg-secondary-tint/40 rounded-xl transition cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={handleInstantDemo}
                  disabled={isDemoLaunching}
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-bold transition shadow-soft flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Zap className="w-3.5 h-3.5 text-accent-tint fill-current" />
                  <span>{isDemoLaunching ? 'Launching…' : 'Try Live Demo'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {/* HERO SECTION */}
        <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden bg-surface border-b border-secondary-tint/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-tint border border-brand/20 text-brand text-xs font-bold shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-brand" />
                <span>Next-Gen Autonomous Household Commerce</span>
                <span className="w-1.5 h-1.5 rounded-full bg-good animate-pulse" />
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-6xl font-black text-ink tracking-tight leading-[1.08]">
                Your Kitchen on Autopilot.{' '}
                <span className="text-brand">
                  Never Run Out of Groceries Again.
                </span>
              </h1>

              {/* Storytelling Subhead */}
              <p className="text-sm sm:text-lg text-ink-muted leading-relaxed font-normal max-w-2xl mx-auto">
                The quick-commerce restock headache solved. ShopPilot AI monitors your pantry burn rates,
                optimizes real-time basket prices across <strong>Zepto</strong>, <strong>Blinkit</strong>, and{' '}
                <strong>Instamart</strong>, and autonomously executes seamless checkout with{' '}
                <strong>PayPal Sandbox</strong>.
              </p>

              {/* CTA Group */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <button
                  onClick={handleInstantDemo}
                  disabled={isDemoLaunching}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-sm shadow-card hover:shadow-soft transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer group"
                >
                  <Zap className="w-4 h-4 text-accent-tint fill-current group-hover:scale-110 transition-transform" />
                  <span>{isDemoLaunching ? 'Launching Simulation…' : 'Launch Interactive Demo'}</span>
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </button>

                <a
                  href="#story"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-surface border border-secondary-tint hover:bg-secondary-tint/40 text-ink font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Explore The Story & Design</span>
                  <ChevronRight className="w-4 h-4 text-ink-muted" />
                </a>
              </div>

              {demoError && (
                <p className="text-xs text-danger font-medium">{demoError}</p>
              )}

              {/* Trust Indicators */}
              <div className="pt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
                  Real Indian Retail Packaging
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
                  Delivery & Platform Fee Arbitrage
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
                  Human-in-the-Loop Brand Guardrails
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-good shrink-0" />
                  PayPal Buyer Protection
                </span>
              </div>
            </div>

            {/* Windowed Interactive Product Mockup Frame */}
            <div className="mt-14 max-w-5xl mx-auto">
              <div className="rounded-2xl border border-secondary-tint bg-surface shadow-card overflow-hidden ring-1 ring-black/5">
                {/* Browser Top Chrome */}
                <div className="bg-paper px-4 py-3 border-b border-secondary-tint flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-400/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-yellow-400/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-green-400/80 inline-block" />
                    <span className="text-[11px] font-mono text-ink-muted ml-2 hidden sm:inline">
                      shoppilot.local/dashboard
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-good bg-good-tint border border-good/25 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-good animate-ping" />
                    <span>Autonomous Pilot Active</span>
                  </div>
                </div>

                {/* Dashboard Showcase Content Grid */}
                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-5 bg-surface">
                  {/* Column 1: Live Pantry Snapshot */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-ink-muted uppercase tracking-wider">
                        1. Pantry Telemetry
                      </span>
                      <span className="text-[10px] font-bold text-danger bg-danger-tint px-2 py-0.5 rounded-full">
                        Milk Depleted in 1.2d
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="p-3 rounded-xl border border-secondary-tint/80 bg-paper/60 flex items-center gap-3">
                        <img
                          src="/products/amul-milk.jpg"
                          alt="Amul Milk"
                          className="w-14 h-14 object-contain rounded-lg border border-secondary-tint bg-white p-1"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-ink truncate">Amul Taaza Milk</h4>
                          <p className="text-[10px] text-ink-muted">1 L • 0.5 L in pantry</p>
                          <span className="text-[10px] font-semibold text-danger flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" /> Auto-Restock Triggered
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border border-secondary-tint/80 bg-paper/60 flex items-center gap-3">
                        <img
                          src="/products/harvest-gold-bread.jpg"
                          alt="Harvest Gold Bread"
                          className="w-14 h-14 object-contain rounded-lg border border-secondary-tint bg-white p-1"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-ink truncate">100% Atta Bread</h4>
                          <p className="text-[10px] text-ink-muted">400g • Harvest Gold</p>
                          <span className="text-[10px] font-semibold text-good flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Healthy (4 packs left)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Multi-Store Price Comparison */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-ink-muted uppercase tracking-wider">
                        2. Multi-Store Arbitrage
                      </span>
                      <span className="text-[10px] font-bold text-brand bg-brand-tint px-2 py-0.5 rounded-full">
                        Saves ₹103
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-3 rounded-xl border-2 border-brand bg-brand-tint/20 space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-brand">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-brand" />
                            Zepto (Consolidated)
                          </span>
                          <span className="text-sm">₹935</span>
                        </div>
                        <p className="text-[10px] text-ink-muted leading-tight">
                          Consolidated single-store basket avoids multi-store split delivery fees.
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl border border-secondary-tint bg-paper/60 flex items-center justify-between text-ink-muted">
                        <span className="font-medium">Swiggy Instamart</span>
                        <span className="font-semibold text-ink">₹985 (+₹50)</span>
                      </div>

                      <div className="p-2.5 rounded-xl border border-secondary-tint bg-paper/60 flex items-center justify-between text-ink-muted">
                        <span className="font-medium">Blinkit (Split items)</span>
                        <span className="font-semibold text-ink">₹1,038 (+₹103)</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: PayPal Sandbox Settlement */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-ink-muted uppercase tracking-wider">
                        3. PayPal Checkout
                      </span>
                      <span className="text-[10px] font-bold text-brand bg-brand-tint px-2 py-0.5 rounded-full">
                        Zero Friction
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-secondary-tint/90 bg-paper space-y-3 shadow-xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink-muted">Order Payable</span>
                        <span className="font-bold text-ink text-sm">₹935.35</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-ink-muted pb-2 border-b border-secondary-tint">
                        <span>Converted for PayPal</span>
                        <span className="font-mono font-semibold text-ink">$11.00 USD</span>
                      </div>

                      <div className="w-full py-2 px-3 rounded-lg bg-[#FFC439] hover:bg-[#F2BA36] text-[#003087] font-black text-xs text-center shadow-xs flex items-center justify-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>PayPal Sandbox One-Click</span>
                      </div>

                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-good font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Instant Capture & Cryptographic Receipt</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Frame Strip */}
                <div className="bg-paper/80 px-4 py-2.5 border-t border-secondary-tint flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-good" />
                    <strong>15 Authentic Indian Products Loaded</strong> (Amul, Harvest Gold, Surf Excel, Nescafé)
                  </span>
                  <button
                    onClick={handleInstantDemo}
                    className="font-bold text-brand hover:underline cursor-pointer flex items-center gap-1"
                  >
                    Open live sandbox in browser <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: THE STORY (Why we built this) */}
        <section id="story" className="py-20 sm:py-28 bg-surface border-b border-secondary-tint/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <span className="text-xs font-extrabold text-accent uppercase tracking-widest">
                The Narrative
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
                The Quick-Commerce Paradox
              </h2>
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                India invented 10-minute grocery delivery. But instead of freeing up our lives, it created
                a daily micro-stress cycle: emergency midnight orders, duplicate items rotting in the fridge,
                and paying ₹100s in split delivery fees.
              </p>
            </div>

            {/* Act Selection Tabs */}
            <div className="flex justify-center mb-10">
              <div className="inline-flex p-1 rounded-xl bg-paper border border-secondary-tint">
                <button
                  onClick={() => setActiveStoryAct('chaos')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeStoryAct === 'chaos'
                      ? 'bg-brand text-white shadow-soft'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Act I: The Chaos
                </button>
                <button
                  onClick={() => setActiveStoryAct('intelligence')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeStoryAct === 'intelligence'
                      ? 'bg-brand text-white shadow-soft'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Act II: The Intelligence
                </button>
                <button
                  onClick={() => setActiveStoryAct('autonomy')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeStoryAct === 'autonomy'
                      ? 'bg-brand text-white shadow-soft'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Act III: The Autonomy
                </button>
              </div>
            </div>

            {/* Story Act Content Cards */}
            <div className="max-w-4xl mx-auto">
              {activeStoryAct === 'chaos' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                  <div className="p-6 rounded-2xl bg-danger/5 border border-danger/20 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-ink text-base">The 11:30 PM Emergency Run</h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      You discover the milk carton is empty when making chai for tomorrow morning. You open
                      Blinkit, rush an order, and pay surge handling fees.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-danger/5 border border-danger/20 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
                      <TrendingDown className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-ink text-base">The Multi-App Split Tax</h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Milk is cheaper on Zepto, but your favorite sourdough bread is only on Blinkit. Splitting
                      means paying two delivery fees and two platform charges.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-danger/5 border border-danger/20 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-ink text-base">Duplicate Food Waste</h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Without telemetry, you buy another tub of curd only to discover two unopened tubs already
                      expiring in the crisper drawer.
                    </p>
                  </div>
                </div>
              )}

              {activeStoryAct === 'intelligence' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                  <div className="p-6 rounded-2xl bg-brand/5 border border-brand/20 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-ink text-base">Pantry Burn-Rate Telemetry</h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      ShopPilot models consumption rates (e.g. 0.8 L/day of milk). It predicts stockouts 3 days
                      ahead so you never face a morning emergency.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-brand/5 border border-brand/20 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-ink text-base">Cross-Store Arbitrage Engine</h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Our basket optimizer evaluates item prices AND delivery fee cliffs across Zepto, Blinkit,
                      and Instamart, recommending the mathematically cheapest checkout.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-brand/5 border border-brand/20 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                      <Package className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-ink text-base">Real Retail Packaging Catalog</h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Zero generic stock vectors. Every item matches real Indian grocery packaging (Amul,
                      Harvest Gold, Quaker, Surf Excel) for instant household recognition.
                    </p>
                  </div>
                </div>
              )}

              {activeStoryAct === 'autonomy' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                  <div className="p-6 rounded-2xl bg-good/5 border border-good/20 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-good/10 text-good flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-ink text-base">Human-in-the-Loop Guardrails</h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      You set the safety rules. Regular staples restock automatically; any unexpected brand swap
                      triggers an "Ask Before Swap" prompt for your confirmation.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-good/5 border border-good/20 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-good/10 text-good flex items-center justify-center">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-ink text-base">PayPal Autonomous Settlement</h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Seamless one-click PayPal Sandbox checkout with tokenized order execution, automatic
                      INR-to-USD conversion, and zero credit card risk.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-good/5 border border-good/20 space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-good/10 text-good flex items-center justify-center">
                      <Lock className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-ink text-base">Tamper-Proof Audit Trail</h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Every autonomous decision, simulation time step, and PayPal capture is cryptographically
                      recorded in the Activity audit log for total peace of mind.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 2: HOW IT WORKS (The 4-Step Loop) */}
        <section id="how-it-works" className="py-20 sm:py-28 bg-paper border-b border-secondary-tint/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <span className="text-xs font-extrabold text-brand uppercase tracking-widest">
                The Architecture
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
                How ShopPilot AI Operates
              </h2>
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                A closed-loop autonomous system combining household telemetry, algorithmic market comparison,
                and PayPal's trusted payment rail.
              </p>
            </div>

            {/* 4 Step Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="p-6 rounded-2xl bg-surface border border-secondary-tint shadow-soft relative flex flex-col justify-between">
                <span className="text-3xl font-black text-secondary-tint/60 absolute top-4 right-4">01</span>
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-tint text-brand flex items-center justify-center font-bold">
                    <Package className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-ink text-base">Sense & Telemetry</h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Maintains real-time stock levels, pack weights, unit-aware steppers (e.g. 0.5L steps), and
                    daily burn rates for all your household essentials.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-secondary-tint/60 text-[11px] font-semibold text-brand">
                  Live Stockout Countdown →
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-6 rounded-2xl bg-surface border border-secondary-tint shadow-soft relative flex flex-col justify-between">
                <span className="text-3xl font-black text-secondary-tint/60 absolute top-4 right-4">02</span>
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-tint text-accent flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-ink text-base">Simulate & Forecast</h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    ShopPilot's temporal simulator advances virtual time to test next-cycle stock depletion.
                    Items reaching safety minimums are automatically queued.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-secondary-tint/60 text-[11px] font-semibold text-accent">
                  Emergency vs Regular Batch →
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-2xl bg-surface border border-secondary-tint shadow-soft relative flex flex-col justify-between">
                <span className="text-3xl font-black text-secondary-tint/60 absolute top-4 right-4">03</span>
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-good-tint text-good flex items-center justify-center font-bold">
                    <Store className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-ink text-base">Multi-Store Arbitrage</h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Evaluates prices across Zepto, Blinkit, and Instamart. Computes delivery fee tiers to determine
                    if a single consolidated store beats multi-store splits.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-secondary-tint/60 text-[11px] font-semibold text-good">
                  Fee-Aware Optimization →
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-6 rounded-2xl bg-surface border border-secondary-tint shadow-soft relative flex flex-col justify-between">
                <span className="text-3xl font-black text-secondary-tint/60 absolute top-4 right-4">04</span>
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FFC439]/20 text-[#003087] flex items-center justify-center font-bold">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-ink text-base">PayPal Settlement</h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Creates order intent via PayPal REST API v2, opens official sandbox checkout popup,
                    captures funds, and updates pantry inventory automatically.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-secondary-tint/60 text-[11px] font-semibold text-[#003087]">
                  Instant Captures & Webhooks →
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: INTERACTIVE MULTI-STORE PRICE ENGINE SIMULATOR */}
        <section id="price-engine" className="py-20 sm:py-28 bg-surface border-b border-secondary-tint/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-14">
              <span className="text-xs font-extrabold text-brand uppercase tracking-widest">
                Interactive Playground
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
                Try the Multi-Store Arbitrage Engine
              </h2>
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                Select your household staples below to see how ShopPilot calculates the delivery fee cliffs
                and saves up to ₹103 per order.
              </p>
            </div>

            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Selectable Basket Items */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-secondary-tint">
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    Select Household Items for Restock:
                  </span>
                  <span className="text-xs text-ink-muted font-medium">
                    {selectedBasketItems.length} selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STAPLE_OPTIONS.map(opt => {
                    const isSelected = selectedBasketItems.includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        onClick={() => toggleBasketItem(opt.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? 'bg-brand-tint/30 border-brand ring-1 ring-brand/30 shadow-xs'
                            : 'bg-paper/60 border-secondary-tint/80 hover:bg-paper'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition ${
                            isSelected ? 'bg-brand text-white' : 'border border-secondary-tint bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>

                        <img
                          src={opt.image}
                          alt={opt.name}
                          className="w-10 h-10 object-contain rounded-lg border border-secondary-tint bg-white p-0.5 shrink-0"
                        />

                        <div className="min-w-0 flex-1 text-left">
                          <h4 className="text-xs font-bold text-ink truncate">{opt.name}</h4>
                          <p className="text-[10px] text-ink-muted">{opt.weight} • ~₹{opt.zepto}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Live Comparison Calculation Card */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl border-2 border-brand/40 bg-surface p-6 shadow-card space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-ink">Arbitrage Calculation</h3>
                      <p className="text-[11px] text-ink-muted">Consolidated Store Comparison</p>
                    </div>
                    {savings > 0 && (
                      <span className="px-2.5 py-1 rounded-full bg-good-tint text-good font-extrabold text-xs">
                        Save ₹{savings}
                      </span>
                    )}
                  </div>

                  {/* Store Breakdown List */}
                  <div className="space-y-3">
                    {/* Zepto */}
                    <div className="p-3.5 rounded-xl border border-brand bg-brand-tint/20 space-y-1.5">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-xs text-brand flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                          Zepto (Recommended)
                        </span>
                        <span className="text-sm text-brand font-black">₹{zeptoGrandTotal}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-ink-muted">
                        <span>Items: ₹{zeptoItemsTotal}</span>
                        <span>Delivery: ₹{zeptoDelivery} • Fee: ₹{zeptoPlatform}</span>
                      </div>
                    </div>

                    {/* Blinkit */}
                    <div className="p-3.5 rounded-xl border border-secondary-tint bg-paper/60 space-y-1.5">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-xs text-ink">Blinkit</span>
                        <span className="text-sm text-ink">₹{blinkitGrandTotal}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-ink-muted">
                        <span>Items: ₹{blinkitItemsTotal}</span>
                        <span>Delivery: ₹{blinkitDelivery} • Fee: ₹{blinkitPlatform}</span>
                      </div>
                    </div>

                    {/* Instamart */}
                    <div className="p-3.5 rounded-xl border border-secondary-tint bg-paper/60 space-y-1.5">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-xs text-ink">Swiggy Instamart</span>
                        <span className="text-sm text-ink">₹{instamartGrandTotal}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-ink-muted">
                        <span>Items: ₹{instamartItemsTotal}</span>
                        <span>Delivery: ₹{instamartDelivery} • Fee: ₹{instamartPlatform}</span>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation Rationale */}
                  <div className="p-3 rounded-xl bg-paper border border-secondary-tint text-xs text-ink-muted space-y-1">
                    <div className="font-semibold text-ink flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-accent" />
                      ShopPilot Optimization Insight:
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Buying items separately from multiple stores incurs combined delivery fees of ₹70+.
                      Consolidating into Zepto achieves the free-delivery threshold and delivers the lowest
                      net price.
                    </p>
                  </div>

                  {/* Direct Launch CTA */}
                  <button
                    onClick={handleInstantDemo}
                    className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-xs shadow-soft transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Run This Basket in Live App</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: BENTO GRID OF CORE INNOVATIONS */}
        <section className="py-20 sm:py-28 bg-paper border-b border-secondary-tint/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <span className="text-xs font-extrabold text-brand uppercase tracking-widest">
                Features & Innovations
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
                Designed for Reliability & User Control
              </h2>
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                Every component is built around human agency, financial safety, and authentic Indian retail catalogs.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Bento Card 1: Large Span */}
              <div className="md:col-span-2 p-8 rounded-3xl bg-surface border border-secondary-tint shadow-soft flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-tint text-brand flex items-center justify-center font-bold">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-ink">
                    Strict Brand Swap Policies: "Ask Before Swap"
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    Unlike naive AI agents that substitute arbitrary generic brands, ShopPilot respects your
                    preferences. If Chitale milk or India Gate basmati rice is out of stock, it will{' '}
                    <strong>never purchase an alternate</strong> without explicitly prompting you for
                    confirmation first.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-paper border border-secondary-tint flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-secondary" />
                    <span className="font-bold text-ink">Per-Item Policy Rules:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-secondary-tint text-secondary font-bold text-[11px]">
                      Ask Before Swap
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-paper border border-secondary-tint text-ink-muted text-[11px]">
                      Auto-Swap
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-brand-tint text-brand font-bold text-[11px]">
                      Exact Brand Only
                    </span>
                  </div>
                </div>
              </div>

              {/* Bento Card 2: PayPal Sandbox Integration */}
              <div className="p-8 rounded-3xl bg-surface border border-secondary-tint shadow-soft flex flex-col justify-between space-y-6" id="paypal-security">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFC439]/20 text-[#003087] flex items-center justify-center font-bold">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-ink">
                    PayPal Sandbox Settlement Rail
                  </h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Official PayPal JavaScript SDK and REST v2 orders. Converts INR paise to USD cents,
                    renders the native PayPal popup, and triggers cryptographic webhook callbacks on capture.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-good-tint/40 border border-good/25 text-good text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Tested & verified with developer sandbox buyer accounts.</span>
                </div>
              </div>

              {/* Bento Card 3: Time-Travel Simulation */}
              <div className="p-8 rounded-3xl bg-surface border border-secondary-tint shadow-soft flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-accent-tint text-accent flex items-center justify-center font-bold">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-ink">
                    Time-Travel Sandbox Controls
                  </h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Advance virtual days (+1, +3, +7 days) to watch the agent evaluate depletion, generate
                    approval notices, and auto-build upcoming orders in real time.
                  </p>
                </div>

                <div className="text-[11px] text-ink-muted font-mono bg-paper p-3 rounded-xl border border-secondary-tint">
                  <code>POST /api/clock/advance &#123; days: 3 &#125;</code>
                </div>
              </div>

              {/* Bento Card 4: Two-Span Authentic Retail Packaging */}
              <div className="md:col-span-2 p-8 rounded-3xl bg-surface border border-secondary-tint shadow-soft flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-tint text-brand flex items-center justify-center font-bold">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-ink">
                    15+ Authentic Indian Packaging Products
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    Clean, authentic retail product photography with high-DPI thumbnails, lazy-loading, and
                    fallback category icons for effortless household pantry scanning.
                  </p>
                </div>

                {/* Product Thumbnail Row */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {[
                    { img: '/products/amul-milk.jpg', name: 'Amul' },
                    { img: '/products/harvest-gold-bread.jpg', name: 'Harvest' },
                    { img: '/products/eggoz-eggs.jpg', name: 'Eggoz' },
                    { img: '/products/quaker-oats.jpg', name: 'Quaker' },
                    { img: '/products/surf-excel.jpg', name: 'Surf Excel' },
                    { img: '/products/nescafe-coffee.jpg', name: 'Nescafé' },
                  ].map((p, i) => (
                    <div key={i} className="p-2 rounded-xl bg-paper border border-secondary-tint text-center">
                      <img
                        src={p.img}
                        alt={p.name}
                        className="w-12 h-12 object-contain mx-auto mb-1 rounded"
                      />
                      <span className="text-[10px] font-bold text-ink block truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: ARCHITECTURE & TECH STACK */}
        <section id="architecture" className="py-20 sm:py-28 bg-surface border-b border-secondary-tint/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
              <span className="text-xs font-extrabold text-secondary uppercase tracking-widest">
                Technical Specifications
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
                Built for Speed, Security & Scalability
              </h2>
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                Modern full-stack TypeScript monorepo with strict unit isolation and automated test verification.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
              <div className="p-5 rounded-2xl bg-paper border border-secondary-tint space-y-2">
                <span className="text-[10px] font-extrabold text-brand uppercase tracking-wider block">Frontend</span>
                <h4 className="font-bold text-ink text-sm">React 18 & Vite</h4>
                <p className="text-ink-muted">
                  Tailwind CSS, Lucide icons, responsive 390px mobile navigation, and unit-tested components.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-paper border border-secondary-tint space-y-2">
                <span className="text-[10px] font-extrabold text-accent uppercase tracking-wider block">Backend</span>
                <h4 className="font-bold text-ink text-sm">Express & Node 20</h4>
                <p className="text-ink-muted">
                  Better-SQLite3 persistence, Zod request validation, cookie session security, and multi-tenant isolation.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-paper border border-secondary-tint space-y-2">
                <span className="text-[10px] font-extrabold text-[#003087] uppercase tracking-wider block">Payment Rail</span>
                <h4 className="font-bold text-ink text-sm">PayPal Sandbox REST API</h4>
                <p className="text-ink-muted">
                  v2/checkout/orders, real popup flow, currency conversion (INR ➔ USD), and HMAC webhook verification.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-paper border border-secondary-tint space-y-2">
                <span className="text-[10px] font-extrabold text-good uppercase tracking-wider block">Verification</span>
                <h4 className="font-bold text-ink text-sm">Vitest Suite (55 Tests)</h4>
                <p className="text-ink-muted">
                  Autonomous decision tests, fee calculation invariants, and brand swap guardrails passing 100%.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: CLOSING CTA HERO BANNER */}
        <section className="py-20 sm:py-28 bg-brand-dark text-white relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/25 text-white text-xs font-bold tracking-wider uppercase shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-accent-tint" />
              Live & Fully Integrated
            </span>

            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white">
              Ready to Experience Autonomous Household Commerce?
            </h2>

            <p className="text-sm sm:text-base text-white/90 max-w-2xl mx-auto leading-relaxed font-normal">
              Explore the live app now. Adjust your pantry inventory, advance simulation time, test multi-store
              price arbitrage, and complete a PayPal Sandbox checkout in seconds.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleInstantDemo}
                disabled={isDemoLaunching}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-accent hover:bg-accent-dark text-white font-bold text-sm shadow-card transition-all cursor-pointer flex items-center justify-center gap-2 group"
              >
                <Zap className="w-4 h-4 text-white fill-current group-hover:scale-110 transition-transform" />
                <span>{isDemoLaunching ? 'Launching Demo…' : 'Launch Instant Demo (Guest)'}</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => onOpenAuth('register')}
                className="w-full sm:w-auto px-7 py-4 rounded-xl bg-white hover:bg-slate-100 text-brand-dark font-bold text-sm transition shadow-card cursor-pointer"
              >
                Create Personal Workspace
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-secondary-tint py-10 text-xs text-ink-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-brand flex items-center justify-center text-white">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-ink">ShopPilot AI</span>
            <span>• Built for PayPal Hackathon • Autonomous Restock</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#story" className="hover:text-ink transition">The Story</a>
            <a href="#how-it-works" className="hover:text-ink transition">How It Works</a>
            <a href="#price-engine" className="hover:text-ink transition">Arbitrage</a>
            <button
              onClick={handleInstantDemo}
              className="text-brand font-bold hover:underline cursor-pointer"
            >
              Demo Account
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
