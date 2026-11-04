import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import { api, AuthUser } from '../api/client';

interface Props { onAuthenticated: (user: AuthUser) => void; }

export const AuthScreen: React.FC<Props> = ({ onAuthenticated }) => {
  const isRegister = window.location.pathname.replace(/\/$/, '') === '/register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const result = isRegister
        ? await api.register(name, email, password)
        : await api.login(email, password);
      window.history.replaceState({}, '', '/');
      onAuthenticated(result.user);
    } catch (err: any) {
      const issues = Array.isArray(err?.details)
        ? err.details.map((issue: { message?: string }) => issue.message).filter(Boolean).join(' ')
        : '';
      setError(issues || err?.message || 'Could not authenticate. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-paper text-ink flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-secondary-tint bg-surface p-7 sm:p-9 shadow-card">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center text-white shadow-soft">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight">ShopPilot <span className="text-brand">AI</span></h1>
            <p className="text-xs text-ink-muted">Autonomous Restocking</p>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-1">{isRegister ? 'Create your account' : 'Welcome back'}</h2>
        <p className="text-sm text-ink-muted mb-6">{isRegister ? 'Set up your personal ShopPilot workspace.' : 'Log in to your ShopPilot household.'}</p>

        <form onSubmit={submit} className="space-y-4">
          {isRegister && <label className="block text-sm font-medium">Name
            <input autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-secondary-tint bg-white px-3.5 py-3 text-sm outline-none focus:border-brand" />
          </label>}
          <label className="block text-sm font-medium">Email address
            <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-secondary-tint bg-white px-3.5 py-3 text-sm outline-none focus:border-brand" />
          </label>
          <label className="block text-sm font-medium">Password
            <input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-secondary-tint bg-white px-3.5 py-3 text-sm outline-none focus:border-brand" />
          </label>
          {isRegister && <>
            <p className="-mt-2 text-xs text-ink-muted">Use at least 12 characters with uppercase, lowercase, a number, and a symbol.</p>
            <label className="block text-sm font-medium">Confirm password
              <input type="password" autoComplete="new-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-secondary-tint bg-white px-3.5 py-3 text-sm outline-none focus:border-brand" />
            </label>
          </>}
          {error && <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-sm text-danger">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-dark disabled:opacity-60">
            {busy ? 'Please wait…' : isRegister ? 'Create Account' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          {isRegister ? 'Already have an account?' : 'New to ShopPilot?'}{' '}
          <a className="font-semibold text-brand hover:underline" href={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Log in' : 'Create an account'}
          </a>
        </p>
      </section>
    </main>
  );
};
