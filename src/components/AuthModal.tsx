import React, { useState } from 'react';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { isSupabaseConfigured } from '../lib/supabase';
import { Shield, Lock, Mail, UserCheck, AlertCircle, CheckCircle2, X, LogOut } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  requireAuth?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, requireAuth = false }) => {
  const { currentUser, authStatus, authError, signInWithPassword, signOut } = useRealtimeStore();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen && !requireAuth) return null;

  const supabaseReady = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const email = emailInput.trim().toLowerCase();
    if (!email || !passwordInput) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signInWithPassword(email, passwordInput);
      if (!res.success) {
        setErrorMsg(res.message);
        return;
      }
      setSuccessMsg('Signed in! Loading workspace...');
      setPasswordInput('');
      if (!requireAuth) {
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    await signOut();
  };

  const displayError = errorMsg || authError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold">SpiceGuard Hub</h2>
              <p className="text-xs text-emerald-200">
                {supabaseReady ? 'Workspace Member Sign In' : 'Local Development Mode'}
              </p>
            </div>
          </div>
          {!requireAuth && (
            <button
              onClick={onClose}
              className="text-emerald-200 hover:text-white p-1 rounded-lg transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Authenticated User Info */}
        {authStatus === 'authenticated' && (
          <div className="bg-emerald-50 px-5 py-3.5 border-b border-emerald-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0"
                style={{ backgroundColor: currentUser.avatar_color }}
              >
                {currentUser.full_name.charAt(0)}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <strong className="text-emerald-950 truncate">{currentUser.full_name}</strong>
                  {currentUser.is_team_lead && (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                      Team Lead
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-emerald-700 truncate">
                  {currentUser.role} · {currentUser.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-2 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-100 text-emerald-900 font-semibold flex items-center gap-1.5 shrink-0 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        )}

        <div className="p-5">
          {!supabaseReady ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <p className="font-semibold text-amber-950">Supabase Not Configured</p>
              <p>
                Running in local development mode using browser storage. Configure{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>{' '}
                to enable multi-user authentication.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Team Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@domain.com"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent"
                  />
                </div>
              </div>

              {displayError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{displayError}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-900 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold shadow-sm transition active:scale-98 flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          <div className="mt-4 p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-[11px] text-stone-600 leading-normal">
            <span className="font-semibold text-stone-800">Invite-Only Workspace:</span> Access is
            restricted to invited SpiceGuard Hub team members.
          </div>
        </div>
      </div>
    </div>
  );
};
