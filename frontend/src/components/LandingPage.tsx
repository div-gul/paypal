import React, { useState, useEffect, useRef } from 'react';
import { AuthUser, api } from '../api/client';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Menu,
  X,
  Code,
  CheckCircle,
} from 'lucide-react';

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
  const [isDemoLaunching, setIsDemoLaunching] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [savingsMode, setSavingsMode] = useState<'split' | 'single'>('split');
  const [heroAnimated, setHeroAnimated] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Trigger hero entrance sequence on mount
  useEffect(() => {
    const timer = setTimeout(() => setHeroAnimated(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Sticky compact bar appears only after hero leaves the viewport
  useEffect(() => {
    if (!heroRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);

  // Existing demo launcher logic
  const handleInstantDemo = async () => {
    setIsDemoLaunching(true);
    setDemoError('');
    try {
      await api.login('guest_paypal@example.com', 'GUEST_paypal@1502');
      onEnterDemo();
    } catch {
      try {
        onEnterDemo();
      } catch (err: any) {
        setDemoError(err?.message || 'Could not launch demo. Please try logging in manually.');
      }
    } finally {
      setIsDemoLaunching(false);
    }
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const scrollAmount = 400;
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans selection:bg-teal selection:text-white antialiased">
      {/* Skip to Content for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-teal focus:text-white focus:rounded-full focus:shadow-landing-soft focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Sticky Compact Bar: slides in after hero leaves viewport */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 h-14 bg-paper/95 backdrop-blur border-b border-mist transition-transform duration-300 ease-out flex items-center justify-between px-4 sm:px-8 ${showStickyBar ? 'translate-y-0' : '-translate-y-full pointer-events-none'
          }`}
        aria-hidden={!showStickyBar}
      >
        <a
          href="#"
          className="font-serif-italic text-2xl text-ink hover:text-teal transition"
          aria-label="ShopPilot AI - Back to top"
        >
          ShopPilot
        </a>
        <div className="flex items-center gap-3">
          <a
            href="#how-it-works"
            className="hidden sm:inline-block text-sm text-ink-muted hover:text-ink font-medium transition"
          >
            How it works
          </a>
          <button
            onClick={handleInstantDemo}
            disabled={isDemoLaunching}
            className="bg-[#14232B] hover:bg-[#0F4C5C] text-white text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2 rounded-full transition shadow-sm cursor-pointer inline-flex items-center gap-1.5"
            style={{ backgroundColor: '#14232B', color: '#ffffff' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0F4C5C')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#14232B')}
          >
            <span>{isDemoLaunching ? 'Launching…' : 'Try the demo'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: NAV + HERO (Full-bleed section) */}
      {/* ============================================================== */}
      <header
        ref={heroRef}
        className="relative overflow-hidden min-h-[600px] h-[88vh] max-h-[850px] bg-night-teal bg-[#0A3540] flex flex-col justify-between"
        style={{ backgroundColor: '#0A3540' }}
      >
        {/* Single Hero Image */}
        <img
          src="/images/hero%20desktop.png"
          alt="A teal kitchen in morning light with a nearly empty milk bottle and a basket of eggs on the counter"
          fetchPriority="high"
          loading="eager"
          className="absolute inset-0 w-full h-full object-cover object-[30%_50%] pointer-events-none"
        />

        {/* Gradients ensuring WCAG 4.5:1 text contrast */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,53,64,0.92) 0%, rgba(10,53,64,0.65) 42%, rgba(10,53,64,0.2) 75%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[45%] pointer-events-none"
          style={{
            background: 'linear-gradient(to top, #0A3540 0%, rgba(10,53,64,0.85) 35%, rgba(10,53,64,0.3) 70%, transparent 100%)',
          }}
        />

        {/* Transparent Nav on Hero */}
        <nav
          aria-label="Primary Navigation"
          className="relative z-20 px-4 sm:px-8 py-5 flex items-center justify-between w-full max-w-[1440px] mx-auto"
        >
          {/* Desktop Left Links */}
          <div className="hidden lg:flex items-center gap-6 text-sm text-white/90 font-medium">
            <a href="#how-it-works" className="hover:text-white transition">
              How it works
            </a>
            <a href="#savings" className="hover:text-white transition">
              Savings
            </a>
            <a href="#control" className="hover:text-white transition">
              Your control
            </a>
            <a href="#under-the-hood" className="hover:text-white transition">
              Under the hood
            </a>
          </div>

          {/* Wordmark Center (Left on Mobile) */}
          <a
            href="#"
            className="font-serif-italic text-[30px] leading-none text-white hover:opacity-90 transition"
            aria-label="ShopPilot AI Homepage"
          >
            ShopPilot
          </a>

          {/* Desktop Right Actions with Glass Capsule */}
          <div className="hidden lg:flex items-center gap-3 p-1.5 pl-4 rounded-full border border-white/25 bg-white/12 backdrop-blur-[14px] shadow-landing-soft">
            {currentUser ? (
              <button
                onClick={onGoToApp}
                className="text-sm font-medium text-white hover:text-sand transition cursor-pointer px-2 py-1"
              >
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => onOpenAuth('login')}
                className="text-sm font-medium text-white/90 hover:text-white transition cursor-pointer px-2 py-1"
              >
                Sign in
              </button>
            )}
            <button
              onClick={handleInstantDemo}
              disabled={isDemoLaunching}
              className="bg-orange bg-[#C2561A] hover:bg-orange-hover hover:bg-[#A8450F] text-white text-sm font-medium px-5 py-2.5 rounded-full transition shadow-landing-soft cursor-pointer inline-flex items-center gap-1.5"
              style={{ backgroundColor: '#C2561A', color: '#ffffff' }}
            >
              <span>{isDemoLaunching ? 'Launching…' : 'Try the demo'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Nav Right: Orange button + Hamburger with Glass Capsule */}
          <div className="flex lg:hidden items-center gap-1.5 p-1 pl-1 rounded-full border border-white/25 bg-white/12 backdrop-blur-[14px] shadow-landing-soft">
            <button
              onClick={handleInstantDemo}
              disabled={isDemoLaunching}
              className="bg-orange bg-[#C2561A] hover:bg-orange-hover hover:bg-[#A8450F] text-white text-xs font-semibold px-3.5 py-2 rounded-full transition shadow-landing-soft cursor-pointer inline-flex items-center gap-1"
              style={{ backgroundColor: '#C2561A', color: '#ffffff' }}
            >
              <span>{isDemoLaunching ? '…' : 'Try the demo'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-white p-1.5 rounded-full hover:bg-white/10 transition cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </nav>

        {/* Hero Content Bottom-Left + Glass Card Bottom-Right */}
        <div className="relative z-10 px-4 sm:px-8 pb-8 sm:pb-12 pt-16 flex flex-col lg:flex-row lg:items-end justify-between gap-8 max-w-[1280px] w-full mx-auto">
          {/* Content Left */}
          <div className="max-w-[640px] space-y-5 text-white">
            <h1 className="landing-h1 font-bold text-white tracking-tight">
              <span
                className={`block transition-all duration-700 ease-out ${heroAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
              >
                Your kitchen
              </span>
              <span
                className={`block font-serif-italic text-[#FFF4D6] transition-all duration-700 delay-100 ease-out ${heroAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
              >
                restocks itself.
              </span>
            </h1>

            <p
              className={`landing-body text-white/90 transition-all duration-700 delay-200 ease-out ${heroAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
            >
              ShopPilot tracks what you use, finds the cheapest way to restock across Zepto, Blinkit and Instamart,
              and pays with PayPal. You only step in when something needs your OK.
            </p>

            <div
              className={`pt-1 flex flex-wrap items-center gap-4 transition-all duration-700 delay-300 ease-out ${heroAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
            >
              <button
                onClick={handleInstantDemo}
                disabled={isDemoLaunching}
                className="bg-orange bg-[#C2561A] hover:bg-orange-hover hover:bg-[#A8450F] text-white text-base font-semibold px-6 py-3.5 rounded-full transition shadow-landing-soft cursor-pointer inline-flex items-center gap-2"
                style={{ backgroundColor: '#C2561A', color: '#ffffff' }}
              >
                <span>{isDemoLaunching ? 'Launching Demo…' : 'Try the demo'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#how-it-works"
                className="text-white hover:text-white/80 font-medium text-sm transition underline underline-offset-4 cursor-pointer"
              >
                See how it works
              </a>
            </div>

            {demoError && (
              <div role="alert" className="text-sand text-xs font-medium bg-night-teal/80 p-2.5 rounded-lg border border-sand/30">
                {demoError}
              </div>
            )}

            <p
              className={`landing-caption text-white/70 transition-all duration-700 delay-300 ease-out ${heroAnimated ? 'opacity-100' : 'opacity-0'
                }`}
            >
              The demo uses PayPal's sandbox and simulated store prices. No real money moves.
            </p>
          </div>

          {/* Glass Card Bottom-Right */}
          <aside
            aria-label="Order summary highlight"
            className={`w-full lg:w-[260px] p-5 rounded-card-sm border border-white/25 bg-white/12 backdrop-blur-[14px] text-white shadow-landing-soft transition-all duration-700 delay-400 ease-out shrink-0 ${heroAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
          >
            <span className="landing-caption text-white/80 uppercase tracking-wider block font-medium">
              This week's demo order
            </span>
            <div className="font-serif-italic text-[56px] leading-tight text-white my-1">
              ₹103 saved
            </div>
            <p className="landing-caption text-white/85">
              One store and one delivery fee instead of two.
            </p>
          </aside>
        </div>

        {/* Mobile Nav Full-Screen Drawer */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-night-teal/95 backdrop-blur-md p-6 flex flex-col justify-between"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-4">
              <span className="font-serif-italic text-3xl text-white">ShopPilot</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-white p-2 rounded-lg hover:bg-white/10 cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex flex-col gap-6 py-8 text-xl font-medium text-white">
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-sand transition"
              >
                How it works
              </a>
              <a
                href="#savings"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-sand transition"
              >
                Savings
              </a>
              <a
                href="#control"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-sand transition"
              >
                Your control
              </a>
              <a
                href="#under-the-hood"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-sand transition"
              >
                Under the hood
              </a>
              {!currentUser && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('login');
                  }}
                  className="text-left text-white/90 hover:text-white transition cursor-pointer pt-4 border-t border-white/15"
                >
                  Sign in
                </button>
              )}
            </div>
            <div className="pt-4 border-t border-white/15">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleInstantDemo();
                }}
                disabled={isDemoLaunching}
                className="w-full bg-orange bg-[#C2561A] hover:bg-orange-hover hover:bg-[#A8450F] text-white py-3.5 rounded-full font-semibold text-center transition cursor-pointer flex items-center justify-center gap-2"
                style={{ backgroundColor: '#C2561A', color: '#ffffff' }}
              >
                <span>{isDemoLaunching ? 'Launching…' : 'Try the demo'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Landmark */}
      <main id="main-content">
        {/* ============================================================== */}
        {/* SECTION 2: STATEMENT (seamless fade from hero into white) */}
        {/* ============================================================== */}
        <section className="relative bg-white pt-24 sm:pt-32 pb-20 sm:pb-28 px-4 sm:px-6 lg:px-8 border-b border-mist overflow-hidden">
          {/* Eased Night-Teal Scrim Gradient extending from the hero */}
          <div
            className="absolute inset-x-0 top-0 h-44 sm:h-56 pointer-events-none"
          />

          <div className="max-w-[980px] mx-auto text-center space-y-6 sm:space-y-8 relative z-10">
            <p className="text-[28px] sm:text-[40px] leading-[1.25] text-ink font-normal">
              India made groceries arrive in ten minutes. It also gave us the 11:30 pm{' '}
              <span className="font-serif-italic text-teal">milk run</span>, the third tub of curd{' '}
              <span className="text-ink-muted">nobody needed, and</span>{' '}
              <span className="font-serif-italic text-teal">two delivery fees</span>{' '}
              <span className="text-ink-muted">for one dinner.</span>
            </p>
            <p className="text-base sm:text-xl text-ink-muted font-normal max-w-[640px] mx-auto leading-relaxed">
              ShopPilot handles the boring part, so your kitchen just keeps working.
            </p>
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 3: HOW IT WORKS (mist) */}
        {/* ============================================================== */}
        <section id="how-it-works" className="bg-mist py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1280px] mx-auto space-y-8">
            {/* Header with Prev/Next Controls */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="landing-h2 font-bold text-ink">How ShopPilot works</h2>
              </div>
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => scrollCarousel('left')}
                  className="w-11 h-11 rounded-full bg-white border border-mist text-ink hover:text-teal hover:border-teal transition flex items-center justify-center cursor-pointer shadow-landing-soft"
                  aria-label="Scroll previous card"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => scrollCarousel('right')}
                  className="w-11 h-11 rounded-full bg-white border border-mist text-ink hover:text-teal hover:border-teal transition flex items-center justify-center cursor-pointer shadow-landing-soft"
                  aria-label="Scroll next card"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Horizontally Scrolling Card Carousel */}
            <div
              ref={carouselRef}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') scrollCarousel('left');
                if (e.key === 'ArrowRight') scrollCarousel('right');
              }}
              className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 pt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded-card-lg"
              aria-label="How it works 4-step sequence"
            >
              {/* Step 1 */}
              <div className="w-[85vw] sm:w-[380px] shrink-0 snap-start bg-white rounded-card-lg p-4 sm:p-5 shadow-landing-soft flex flex-col justify-between space-y-4">
                <div className="aspect-[4/3] rounded-card-sm overflow-hidden bg-mist/50 border border-mist p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-bold text-teal pb-2 border-b border-mist">
                    <span>Pantry Inventory</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-teal border border-teal/20">Live Count</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-white border border-mist flex items-center justify-between">
                      <span className="font-semibold text-ink">Whole Wheat Bread</span>
                      <span className="font-bold text-teal bg-mist px-2 py-0.5 rounded-full text-[10px]">7 days left</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-mist flex items-center justify-between">
                      <span className="font-semibold text-ink">Toned Milk (1 L)</span>
                      <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full text-[10px]">1.2 days left</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-mist flex items-center justify-between">
                      <span className="font-semibold text-ink">Farm Fresh Eggs</span>
                      <span className="font-bold text-teal bg-mist px-2 py-0.5 rounded-full text-[10px]">4 days left</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-ink-muted flex items-center justify-between pt-1">
                    <span>Tracking daily burn rate</span>
                    <span className="font-bold text-ink">Household Autopilot</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <h3 className="landing-h3 font-bold text-ink">It keeps count</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">
                    Tell it what's in your pantry and how fast you use it. It shows how many days each item will last.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="w-[85vw] sm:w-[380px] shrink-0 snap-start bg-white rounded-card-lg p-4 sm:p-5 shadow-landing-soft flex flex-col justify-between space-y-4">
                <div className="aspect-[4/3] rounded-card-sm overflow-hidden bg-mist/50 border border-mist p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-bold text-teal pb-2 border-b border-mist">
                    <span>Restock Forecast</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-orange-hover border border-orange-hover/20">Scheduled: Tuesday</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-white border border-mist flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-ink block">Amul Toned Milk</span>
                        <span className="text-[10px] text-red-600 font-medium">Depletes before Tuesday</span>
                      </div>
                      <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded text-[10px]">Queued</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-mist flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-ink block">Instant Coffee (100g)</span>
                        <span className="text-[10px] text-ink-muted">17.5 days stock remaining</span>
                      </div>
                      <span className="font-medium text-ink-muted bg-paper px-2 py-0.5 rounded text-[10px]">Deferred</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-ink-muted flex items-center justify-between pt-1">
                    <span>Only critical depletion restocked</span>
                    <span className="font-bold text-teal">0 Extra Trips</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <h3 className="landing-h3 font-bold text-ink">It sees it coming</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">
                    Anything that will run out before the next delivery goes on the list. Items with plenty left wait, so you skip extra trips.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="w-[85vw] sm:w-[380px] shrink-0 snap-start bg-white rounded-card-lg p-4 sm:p-5 shadow-landing-soft flex flex-col justify-between space-y-4">
                <div className="aspect-[4/3] rounded-card-sm overflow-hidden bg-mist/50 border border-mist p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-bold text-teal pb-2 border-b border-mist">
                    <span>Multi-Store Optimizer</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-teal border border-teal/20">Zepto vs Blinkit</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-teal/10 border border-teal/30 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-teal block">Single Store (Zepto)</span>
                        <span className="text-[10px] text-ink-muted">1 delivery • No split fee</span>
                      </div>
                      <span className="font-bold text-teal tabular-nums text-sm">₹935.35</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-mist flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-ink block">Multi-Store Split</span>
                        <span className="text-[10px] text-ink-muted">2 separate deliveries</span>
                      </div>
                      <span className="font-medium text-ink-muted tabular-nums text-xs">₹1,038.75</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-teal font-semibold flex items-center justify-between pt-1">
                    <span>Recommended strategy</span>
                    <span className="bg-teal text-white px-2 py-0.5 rounded-full text-[10px] font-bold">Save ₹103</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <h3 className="landing-h3 font-bold text-ink">It finds the cheapest basket</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">
                    Compares Zepto, Blinkit and Instamart including delivery and handling fees, then picks one store or a split, whichever costs less.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="w-[85vw] sm:w-[380px] shrink-0 snap-start bg-white rounded-card-lg p-4 sm:p-5 shadow-landing-soft flex flex-col justify-between space-y-4">
                <div className="aspect-[4/3] rounded-card-sm overflow-hidden bg-mist/50 border border-mist p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-bold text-teal pb-2 border-b border-mist">
                    <span>PayPal Sandbox</span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-good border border-good/20">Verified Capture</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 rounded-lg bg-white border border-mist flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-ink block">Order #8Y927556R15890845</span>
                        <span className="text-[10px] text-ink-muted">₹935.35 at ₹85/$1</span>
                      </div>
                      <span className="font-bold text-good bg-good/15 px-2 py-0.5 rounded text-[10px]">Captured</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-mist flex items-center justify-between">
                      <span className="font-semibold text-ink">Inventory Auto-Restocked</span>
                      <span className="font-bold text-teal bg-mist px-2 py-0.5 rounded text-[10px]">+Milk, +Bread</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-ink-muted flex items-center justify-between pt-1">
                    <span>Status: Restocked &amp; Confirmed</span>
                    <span className="font-bold text-good">COMPLETED</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <h3 className="landing-h3 font-bold text-ink">You approve, PayPal pays</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">
                    Brand swaps and big orders wait for your OK. Pay with PayPal and your pantry updates once the payment goes through.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 4: SAVINGS DEMO (paper) */}
        {/* ============================================================== */}
        <section id="savings" className="bg-paper py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-mist">
          <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column (45% / 5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <h2 className="landing-h2 font-bold text-ink leading-tight">
                One delivery fee beats two.
              </h2>
              <p className="landing-body text-ink-muted">
                A split across stores can win on item prices and still lose after fees. ShopPilot adds it all up before it suggests anything.
              </p>
            </div>

            {/* Right Column (55% / 7 cols) */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-card-lg p-6 sm:p-8 shadow-landing-soft border border-mist space-y-6">
                {/* Segmented Control Radio Group */}
                <div
                  role="radiogroup"
                  aria-label="Delivery strategy comparison"
                  className="bg-paper p-1 rounded-full flex gap-1 border border-mist"
                >
                  <button
                    role="radio"
                    aria-checked={savingsMode === 'split'}
                    onClick={() => setSavingsMode('split')}
                    className={`flex-1 py-2.5 px-4 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer ${savingsMode === 'split'
                      ? 'bg-white text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                      }`}
                  >
                    Split across stores
                  </button>
                  <button
                    role="radio"
                    aria-checked={savingsMode === 'single'}
                    onClick={() => setSavingsMode('single')}
                    className={`flex-1 py-2.5 px-4 rounded-full text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-2 ${savingsMode === 'single'
                      ? 'bg-white text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                      }`}
                  >
                    <span>One store</span>
                    {savingsMode === 'single' && (
                      <span className="bg-mist text-teal border border-teal/20 px-2 py-0.5 rounded-full text-[11px] font-bold">
                        You save ₹103
                      </span>
                    )}
                  </button>
                </div>

                {/* Price Breakdown with 200ms Crossfade */}
                {/* Figures verified against demo seed in shared/services/basketOptimizer.ts */}
                <div className="space-y-3 transition-opacity duration-200">
                  <div className="flex items-center justify-between text-sm py-1 border-b border-mist">
                    <span className="text-ink-muted">Items subtotal</span>
                    <span className="font-semibold text-ink tabular-nums">
                      {savingsMode === 'split' ? '₹875.00' : '₹887.00'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm py-1 border-b border-mist">
                    <span className="text-ink-muted">Delivery charges</span>
                    <span className="font-semibold text-ink tabular-nums">
                      {savingsMode === 'split' ? '₹29.00' : '₹0.00'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm py-1 border-b border-mist">
                    <span className="text-ink-muted">Platform & handling fees</span>
                    <span className="font-semibold text-ink tabular-nums">
                      {savingsMode === 'split' ? '₹134.75' : '₹48.35'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-base sm:text-lg font-bold text-ink pt-2">
                    <div className="space-y-0.5">
                      <span>Total payable</span>
                      <span className="block text-xs font-normal text-ink-muted">
                        {savingsMode === 'split' ? '2 separate deliveries' : '1 consolidated delivery'}
                      </span>
                    </div>
                    <span className={`tabular-nums ${savingsMode === 'single' ? 'text-teal font-extrabold text-xl' : ''}`}>
                      {savingsMode === 'split' ? '₹1,038.75' : '₹935.35'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <span className="landing-caption text-ink-muted">
                    Simulated prices from the demo.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 5: TELL IT YOUR RULES (mist) */}
        {/* ============================================================== */}
        <section id="control" className="bg-mist py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1280px] mx-auto space-y-12">
            <div>
              <h2 className="landing-h2 font-bold text-ink max-w-[62ch]">
                Tell it your rules in plain English.
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left: App Rules Box */}
              <div className="lg:col-span-6 bg-white rounded-card-sm p-6 sm:p-8 shadow-landing-soft border border-mist space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-mist flex items-center justify-center text-teal shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="landing-caption text-ink-muted font-medium block">Household rule prompt</span>
                    <p className="text-base sm:text-lg font-semibold text-ink mt-1">
                      "Order weekly on Tuesdays, keep it under ₹3,500, and ask me before swapping brands."
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="bg-mist text-teal font-semibold text-xs px-3.5 py-1.5 rounded-full border border-teal/15">
                    Day: Tuesday
                  </span>
                  <span className="bg-mist text-teal font-semibold text-xs px-3.5 py-1.5 rounded-full border border-teal/15">
                    Weekly budget: ₹3,500
                  </span>
                  <span className="bg-mist text-teal font-semibold text-xs px-3.5 py-1.5 rounded-full border border-teal/15">
                    Brand swaps: ask first
                  </span>
                </div>

                <p className="landing-caption text-ink-muted pt-2 border-t border-mist">
                  The AI reads your sentence. You confirm before anything is saved.
                </p>
              </div>

              {/* Right: Three Stacked Pill Cards */}
              <div className="lg:col-span-6 space-y-3.5">
                {/* Pill 1 */}
                <div className="bg-white rounded-card-sm p-4 sm:p-5 shadow-landing-soft border border-mist flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-mist flex items-center justify-center text-teal font-bold shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-ink">Swaps wait for you</h3>
                    <p className="text-xs sm:text-sm text-ink-muted">
                      If your usual brand is out, it suggests the closest match and asks first.
                    </p>
                  </div>
                </div>

                {/* Pill 2 (Fully rounded on desktop) */}
                <div className="bg-white rounded-[28px] md:rounded-full p-4 sm:p-5 shadow-landing-soft border border-teal/20 flex items-center gap-4 ring-1 ring-teal/10">
                  <div className="w-10 h-10 rounded-full bg-mist flex items-center justify-center text-teal font-bold shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-ink">Budget stays capped</h3>
                    <p className="text-xs sm:text-sm text-ink-muted">
                      Orders over your limit wait for your OK.
                    </p>
                  </div>
                </div>

                {/* Pill 3 */}
                <div className="bg-white rounded-card-sm p-4 sm:p-5 shadow-landing-soft border border-mist flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-mist flex items-center justify-center text-teal font-bold shrink-0">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-ink">Checked before charging</h3>
                    <p className="text-xs sm:text-sm text-ink-muted">
                      The server re-checks your rules before every payment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 6: UNDER THE HOOD (paper) */}
        {/* ============================================================== */}
        <section id="under-the-hood" className="bg-paper py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-mist">
          <div className="max-w-[1280px] mx-auto space-y-10">
            <div>
              <h2 className="landing-h2 font-bold text-ink">Built to be checked.</h2>
              <p className="landing-body text-ink-muted mt-2">Everything here runs in the demo.</p>
            </div>

            {/* 12-Column Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Card A: 6 Columns */}
              <div className="md:col-span-6 bg-white rounded-card-lg p-6 sm:p-7 shadow-landing-soft border border-mist flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="landing-h3 font-bold text-ink">PayPal Orders, in the sandbox</h3>
                  <p className="text-sm text-ink-muted max-w-[54ch]">
                    Our server creates and captures the order. Charged in USD at ₹85 = $1. Your pantry restocks only after the capture is confirmed.
                  </p>
                </div>
                <div className="rounded-card-sm overflow-hidden border border-mist bg-paper p-4 text-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-mist pb-2">
                    <span className="font-bold text-ink">PayPal Sandbox Activity</span>
                    <span className="text-[10px] font-bold text-teal bg-mist px-2.5 py-0.5 rounded-full border border-teal/20">
                      Webhook Verified
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Order ID:</span>
                      <span className="text-ink font-semibold">8Y927556R15890845</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Capture Amount:</span>
                      <span className="text-teal font-bold">$11.00 USD (₹935.35)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Event:</span>
                      <span className="text-ink">PAYMENT.CAPTURE.COMPLETED</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Verification:</span>
                      <span className="text-good font-bold">SUCCESS (/v1/notifications)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card B: 6 Columns */}
              <div className="md:col-span-6 bg-white rounded-card-lg p-6 sm:p-7 shadow-landing-soft border border-mist flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="landing-h3 font-bold text-ink">AI proposes. Code decides.</h3>
                  <p className="text-sm text-ink-muted">
                    The AI turns your sentence into rules and suggests swaps. Plain code enforces your budget and approvals.
                  </p>
                </div>
                <div className="p-4 rounded-card-sm bg-mist/60 border border-mist text-xs text-ink space-y-2 font-mono">
                  <div className="text-teal font-semibold">Deterministic Policy Engine</div>
                  <div className="text-ink-muted">Regex parsing • Candidate scoring • Strict budget validation</div>
                </div>
              </div>

              {/* Card D: 12 Columns */}
              <div className="md:col-span-12 bg-white rounded-card-lg p-6 sm:p-7 shadow-landing-soft border border-mist space-y-4">
                <h3 className="landing-h3 font-bold text-ink">What's real and what's simulated</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                  <div className="p-4 rounded-card-sm bg-paper border border-mist space-y-1.5">
                    <span className="font-bold text-teal block">Real</span>
                    <p className="text-ink-muted leading-relaxed">
                      PayPal sandbox payments, AI rules and swaps.
                    </p>
                  </div>
                  <div className="p-4 rounded-card-sm bg-paper border border-mist space-y-1.5">
                    <span className="font-bold text-slate block">Simulated</span>
                    <p className="text-ink-muted leading-relaxed">
                      Store prices and delivery.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 7: FINAL CTA (full-width teal section) */}
        {/* ============================================================== */}
        <section
          className="relative overflow-hidden bg-teal bg-[#0F4C5C] text-white py-24 sm:py-32 lg:py-36 px-4 sm:px-6 lg:px-8"
          style={{ backgroundColor: '#0F4C5C' }}
        >
          {/* Inner Content Container */}
          <div className="max-w-[1280px] mx-auto relative">
            {/* Four Scattered Photos in Corners */}
            <img
              src="/images/pantry.png"
              alt=""
              className="absolute -top-12 sm:-top-16 -left-4 sm:-left-8 lg:-left-14 w-44 sm:w-60 lg:w-72 h-52 sm:h-72 lg:h-80 object-cover rounded-[24px] shadow-2xl shadow-black/40 -rotate-3 opacity-90 sm:opacity-95 lg:opacity-100 pointer-events-none"
            />
            <img
              src="/images/breakfast_table.png"
              alt=""
              className="absolute -top-12 sm:-top-16 -right-4 sm:-right-8 lg:-right-14 w-44 sm:w-60 lg:w-72 h-52 sm:h-72 lg:h-80 object-cover rounded-[24px] shadow-2xl shadow-black/40 rotate-3 opacity-90 sm:opacity-95 lg:opacity-100 pointer-events-none"
            />
            <img
              src="/images/family_cooking.png"
              alt=""
              className="hidden sm:block absolute -bottom-12 sm:-bottom-16 -left-4 sm:-left-8 lg:-left-12 w-52 sm:w-64 lg:w-76 h-44 sm:h-56 lg:h-64 object-cover rounded-[24px] shadow-2xl shadow-black/40 rotate-2 opacity-90 sm:opacity-95 lg:opacity-100 pointer-events-none"
            />
            <img
              src="/images/spices.png"
              alt=""
              className="hidden sm:block absolute -bottom-12 sm:-bottom-16 -right-4 sm:-right-8 lg:-right-12 w-52 sm:w-64 lg:w-76 h-44 sm:h-56 lg:h-64 object-cover rounded-[24px] shadow-2xl shadow-black/40 -rotate-2 opacity-90 sm:opacity-95 lg:opacity-100 pointer-events-none"
            />

            {/* Center Content */}
            <div className="relative z-10 max-w-[620px] mx-auto text-center space-y-6 py-8 sm:py-16 lg:py-20">
              <h2 className="landing-h2 font-bold text-white tracking-tight">
                See your pantry run itself.
              </h2>
              <p className="landing-body text-white/90 mx-auto">
                Open the demo and fast-forward a week.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={handleInstantDemo}
                  disabled={isDemoLaunching}
                  className="bg-orange bg-[#C2561A] hover:bg-orange-hover hover:bg-[#A8450F] text-white text-base font-semibold px-8 py-4 rounded-full transition shadow-landing-soft cursor-pointer inline-flex items-center gap-2"
                >
                  <span>{isDemoLaunching ? 'Launching Demo…' : 'Try the demo'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="https://github.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="border border-white/30 hover:bg-white/10 text-white text-sm font-semibold px-6 py-4 rounded-full transition cursor-pointer inline-flex items-center gap-2"
                >
                  <Code className="w-4 h-4" />
                  <span>View the code</span>
                </a>
              </div>

              <p className="landing-caption text-white/70 pt-2">
                Sandbox payments. Simulated prices. No real money moves.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================== */}
      {/* SECTION 8: FOOTER (paper) */}
      {/* ============================================================== */}
      <footer className="bg-paper border-t border-mist py-14 px-4 sm:px-6 lg:px-8 text-xs text-ink-muted">
        <div className="max-w-[1280px] mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <span className="font-serif-italic text-3xl text-ink">ShopPilot</span>
            <div className="flex flex-wrap items-center gap-6 font-medium text-ink-muted">
              <a href="#how-it-works" className="hover:text-teal transition">
                How it works
              </a>
              <a href="#savings" className="hover:text-teal transition">
                Savings
              </a>
              <a href="#control" className="hover:text-teal transition">
                Your control
              </a>
              <a href="#under-the-hood" className="hover:text-teal transition">
                Under the hood
              </a>
              <a
                href="https://github.com/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-teal transition"
              >
                GitHub
              </a>
            </div>
          </div>

          <div className="pt-6 border-t border-mist flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] leading-relaxed">
            <div className="space-y-1">
              <div>Built for Build What's Next with PayPal and AI. • MIT License</div>
              <div>Sandbox checkout and simulated quick-commerce prices. No real money moves.</div>
            </div>
            <div className="text-ink-muted">
              Images are AI-generated.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
