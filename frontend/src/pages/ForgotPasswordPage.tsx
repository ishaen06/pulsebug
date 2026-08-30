import React, { useState } from 'react';
import { KeyRound, Mail, ArrowLeft, Send, CheckCircle2, ShieldCheck, Clock, ExternalLink, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { ForgotPasswordResponse } from '../types';

interface ForgotPasswordPageProps {
  onBackToLogin: () => void;
  onNavigateToReset: (token: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onBackToLogin, onNavigateToReset }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.forgotPassword(email.trim());
      setResult(res);
    } catch (err: any) {
      if (err.message && err.message.includes('429')) {
        setErrorMsg('Too many password reset requests. Please wait a few minutes before trying again.');
      } else {
        // Even on error, show generic message for security
        setResult({
          message: 'If an account exists for this email, a password reset link has been sent.',
          expires_in_minutes: 15
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSimulatedLink = () => {
    if (result?.simulated_reset_link) {
      try {
        const url = new URL(result.simulated_reset_link);
        const token = url.searchParams.get('token');
        if (token) {
          onNavigateToReset(token);
        }
      } catch {
        // Fallback
        const parts = result.simulated_reset_link.split('token=');
        if (parts.length > 1) {
          onNavigateToReset(parts[1]);
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 transition-colors">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs mb-2">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Reset Your Password
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Enter your registered email address and we will generate a secure, single-use reset link.
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!result ? (
            /* Forgot Password Form */
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. rahul@pulsebug.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400">
                  We'll send a time-limited reset link to this address if it is registered.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Generating Secure Token...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Request Sent Confirmation & Interactive Email Preview */
            <div className="space-y-5">
              {/* Security Confirmation Notice */}
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Request Received</span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  {result.message}
                </p>
              </div>

              {/* Interactive Email Inbox Preview for Live Academic Evaluation */}
              {result.simulated_reset_link && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/20 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-blue-500/10 pb-2">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-500" />
                      <span>Simulated User Email Inbox</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-bold">
                      Expires in {result.expires_in_minutes}m
                    </span>
                  </div>

                  <div className="space-y-2 text-slate-700 dark:text-slate-300 text-xs">
                    <div className="text-[11px] text-slate-400">
                      <strong>From:</strong> security@pulsebug.io<br />
                      <strong>To:</strong> {email}<br />
                      <strong>Subject:</strong> Reset Your PulseBug Password
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <p className="leading-relaxed">
                        Hello, we received a request to reset your password for PulseBug. Click the button below to choose a new password:
                      </p>

                      {/* Primary Reset CTA in Email */}
                      <button
                        onClick={handleOpenSimulatedLink}
                        className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Reset Your Password</span>
                      </button>

                      <div className="text-[10px] text-slate-400 text-center font-mono">
                        Link validity: Cryptographically random • Single-use • 15 min expiry
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setResult(null)}
                className="w-full text-center text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Send to a different email address
              </button>
            </div>
          )}

          {/* Back to Login Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={onBackToLogin}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>
          </div>
        </div>

        {/* Security Assurance Badge */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Single-use tokens with SHA-256 database protection & rate limiting</span>
        </div>
      </div>
    </div>
  );
};
