import React, { useState, useEffect, useRef } from 'react';
import { Bot, ArrowLeft, Zap, Mail, KeyRound, CheckCircle2 } from 'lucide-react';
import { api, AuthUser } from '../api/client';

declare global {
  interface Window {
    google?: any;
  }
}

interface Props {
  onAuthenticated: (user: AuthUser) => void;
  initialMode?: 'login' | 'register' | 'forgot' | 'reset';
  initialToken?: string;
  onBack?: () => void;
}

export const AuthScreen: React.FC<Props> = ({ onAuthenticated, initialMode, initialToken, onBack }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(() => {
    if (initialMode) return initialMode;
    const path = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
    if (path === '/register') return 'register';
    if (path === '/forgot-password' || path === '/forgot') return 'forgot';
    if (path === '/reset-password' || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('token'))) {
      return 'reset';
    }
    return 'login';
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(() => {
    if (initialToken) return initialToken;
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('token') || '';
    }
    return '';
  });
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (initialToken) {
      setResetToken(initialToken);
    }
  }, [initialToken]);

  useEffect(() => {
    const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (envClientId) {
      setGoogleClientId(envClientId);
    }
    api.getGoogleAuthConfig()
      .then(cfg => {
        if (cfg.clientId) {
          setGoogleClientId(cfg.clientId);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!googleClientId || (mode !== 'login' && mode !== 'register')) return;

    const scriptId = 'google-identity-services';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) return;
          setBusy(true);
          setError('');
          setInfoMessage('');
          try {
            const result = await api.loginWithGoogle(response.credential);
            window.history.replaceState({}, '', '/');
            onAuthenticated(result.user);
          } catch (err: any) {
            setError(err?.message || 'Google authentication failed.');
          } finally {
            setBusy(false);
          }
        },
      });

      if (googleButtonRef.current) {
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 340,
          text: mode === 'register' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
        });
      }
    };

    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      script.onload = initGoogle;
    }
  }, [googleClientId, mode, onAuthenticated]);

  const handleGoogleSignInClick = () => {
    if (!googleClientId) {
      setError('Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID to your .env file and restart the backend.');
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google Sign-In script is still loading. Please wait a moment and try again.');
    }
  };

  const handleApiError = (err: any, fallbackMessage: string) => {
    const issues = Array.isArray(err?.details)
      ? err.details.map((issue: { message?: string }) => issue.message).filter(Boolean).join('. ')
      : '';
    setError(issues || err?.message || fallbackMessage);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setInfoMessage('');

    if (mode === 'register') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setBusy(true);
      try {
        const result = await api.register(name, email, password);
        setMode('login');
        setInfoMessage(result.message || 'Registration complete. Please log in.');
      } catch (err: any) {
        handleApiError(err, 'Could not register. Please try again.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'login') {
      setBusy(true);
      try {
        const result = await api.login(email, password);
        window.history.replaceState({}, '', '/');
        onAuthenticated(result.user);
      } catch (err: any) {
        handleApiError(err, 'Could not authenticate. Please check your credentials and try again.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'forgot') {
      setBusy(true);
      try {
        const result = await api.forgotPassword(email.trim().toLowerCase());
        setInfoMessage(result.message || 'If an account exists with this email, a password reset link has been sent.');
      } catch (err: any) {
        handleApiError(err, 'Could not request password reset.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'reset') {
      const cleanToken = resetToken.trim();
      if (!cleanToken) {
        setError('Password reset token is missing or invalid.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setBusy(true);
      try {
        const result = await api.resetPassword(cleanToken, password);
        setInfoMessage(result.message || 'Password has been reset successfully! You can now log in.');
        setPassword('');
        setConfirmPassword('');
        setMode('login');
      } catch (err: any) {
        handleApiError(err, 'Could not reset password. The link may have expired or is invalid.');
      } finally {
        setBusy(false);
      }
      return;
    }
  };

  const handleGuestDemo = async () => {
    setBusy(true);
    setError('');
    setInfoMessage('');
    try {
      const result = await api.login('guest_paypal@example.com', 'GUEST_paypal@1502');
      window.history.replaceState({}, '', '/');
      onAuthenticated(result.user);
    } catch (err: any) {
      setError(err?.message || 'Could not log into demo. Please try manual login.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-secondary-tint bg-surface p-7 sm:p-9 shadow-card">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Story & Overview</span>
          </button>
        )}

        <div className="flex items-center gap-3 mb-7">
          <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center text-white shadow-soft">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight">ShopPilot <span className="text-brand">AI</span></h1>
            <p className="text-xs text-ink-muted">Autonomous Restocking</p>
          </div>
        </div>

        {/* Header by Mode */}
        {mode === 'login' && (
          <>
            <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
            <p className="text-sm text-ink-muted mb-6">Log in to your ShopPilot household.</p>
          </>
        )}
        {mode === 'register' && (
          <>
            <h2 className="text-2xl font-bold mb-1">Create your account</h2>
            <p className="text-sm text-ink-muted mb-6">Set up your personal ShopPilot workspace.</p>
          </>
        )}
        {mode === 'forgot' && (
          <>
            <div className="inline-flex p-2.5 rounded-xl bg-brand/10 text-brand mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold mb-1">Forgot your password?</h2>
            <p className="text-sm text-ink-muted mb-6">
              Enter your email address and we'll send you a password reset link.
            </p>
          </>
        )}
        {mode === 'reset' && (
          <>
            <div className="inline-flex p-2.5 rounded-xl bg-brand/10 text-brand mb-3">
              <KeyRound className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold mb-1">Set new password</h2>
            <p className="text-sm text-ink-muted mb-6">
              Enter and confirm your new secure password.
            </p>
          </>
        )}

        {/* Google One-Click Auth (Only on Login and Register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="mb-5">
            <div ref={googleButtonRef} className="flex justify-center min-h-[44px]">
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={busy}
                className="w-full py-2.5 px-4 rounded-xl border border-secondary-tint bg-white hover:bg-paper text-ink font-semibold text-sm flex items-center justify-center gap-2.5 cursor-pointer shadow-xs transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{mode === 'register' ? 'Sign up with Google' : 'Sign in with Google'}</span>
              </button>
            </div>
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-secondary-tint" />
              </div>
              <span className="relative bg-surface px-3 text-xs text-ink-muted uppercase tracking-wider font-semibold">
                Or with email
              </span>
            </div>
          </div>
        )}

        {/* Alerts */}
        {infoMessage && (
          <div role="status" className="mb-4 rounded-xl border border-teal/20 bg-teal/10 px-3.5 py-2.5 text-sm text-teal flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-teal" />
            <span>{infoMessage}</span>
          </div>
        )}
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <label className="block text-sm font-medium">Name
              <input
                autoComplete="name"
                required
                maxLength={80}
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-secondary-tint bg-white px-3.5 py-3 text-sm outline-none focus:border-brand"
                placeholder="Jane Doe"
              />
            </label>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <label className="block text-sm font-medium">Email address
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-secondary-tint bg-white px-3.5 py-3 text-sm outline-none focus:border-brand"
                placeholder="you@example.com"
              />
            </label>
          )}

          {mode === 'login' && (
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium" htmlFor="login-password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setInfoMessage('');
                  }}
                  className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-secondary-tint bg-white px-3.5 py-3 text-sm outline-none focus:border-brand"
              />
            </div>
          )}

          {mode === 'reset' && (
            <>
              {!resetToken && (
                <label className="block text-sm font-medium">Reset Token
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={e => setResetToken(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-secondary-tint bg-white px-3.5 py-3 text-sm outline-none focus:border-brand font-mono text-xs"
                    placeholder="Paste reset token from email"
                  />
                </label>
              )}
              <label className="block text-sm font-medium">New Password
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-secondary-tint bg-white px-3.5 py-3 text-sm outline-none focus:border-brand"
                />
              </label>
            </>
          )}

          {(mode === 'register' || mode === 'reset') && (
            <>
              <p className="-mt-1 text-xs text-ink-muted">
                Use at least 8 characters with uppercase, lowercase, a number, and a symbol (e.g. @, #, $, !).
              </p>
              <label className="block text-sm font-medium">Confirm password
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-secondary-tint bg-white px-3.5 py-3 text-sm outline-none focus:border-brand"
                />
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-dark disabled:opacity-60 cursor-pointer"
          >
            {busy
              ? 'Please wait…'
              : mode === 'register'
              ? 'Create Account'
              : mode === 'forgot'
              ? 'Send Reset Link'
              : mode === 'reset'
              ? 'Reset Password'
              : 'Log in'}
          </button>
        </form>

        {/* Demo Guest Household Login (on login/register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="mt-5 pt-5 border-t border-secondary-tint/70">
            <button
              type="button"
              onClick={handleGuestDemo}
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-xl border border-secondary-tint bg-paper hover:bg-secondary-tint/50 text-ink font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Zap className="w-3.5 h-3.5 text-accent" />
              <span>Instant Demo (Guest Household)</span>
            </button>
          </div>
        )}

        {/* Mode Switchers */}
        <div className="mt-5 text-center text-sm text-ink-muted">
          {mode === 'login' && (
            <p>
              New to ShopPilot?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                  setInfoMessage('');
                }}
                className="font-semibold text-brand hover:underline cursor-pointer"
              >
                Create an account
              </button>
            </p>
          )}

          {mode === 'register' && (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setInfoMessage('');
                }}
                className="font-semibold text-brand hover:underline cursor-pointer"
              >
                Log in
              </button>
            </p>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <p>
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setInfoMessage('');
                }}
                className="font-semibold text-brand hover:underline cursor-pointer"
              >
                Back to log in
              </button>
            </p>
          )}
        </div>
      </section>
    </main>
  );
};
