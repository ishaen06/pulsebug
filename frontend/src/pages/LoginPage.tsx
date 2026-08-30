import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Mail, Lock, User as UserIcon, Code2, CheckCircle2,
  AlertCircle, ArrowRight, RefreshCw, KeyRound, Sparkles, Check, Send, Bot
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface LoginPageProps {
  onSuccess: () => void;
  onForgotPassword: () => void;
  initialMode?: 'login' | 'register' | 'verify';
  initialEmail?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onForgotPassword,
  initialMode = 'login',
  initialEmail = ''
}) => {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>(initialMode);
  
  // Form fields
  const [email, setEmail] = useState<string>(initialEmail);
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [role, setRole] = useState<UserRole>('DEVELOPER');
  const [skills, setSkills] = useState<string[]>(['React', 'FastAPI', 'Python']);
  const [newSkill, setNewSkill] = useState<string>('');
  
  // Verification OTP state (6 single-digit inputs)
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  
  // Status & Feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check URL params for direct email verification link e.g. /?verify_email=xyz@domain.com&code=123456
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const vEmail = params.get('verify_email') || params.get('email');
      const vCode = params.get('code') || params.get('verification_code');
      if (vEmail && vCode) {
        setEmail(vEmail);
        setMode('verify');
        const digits = vCode.trim().split('').slice(0, 6);
        setOtp(digits);
        handleDirectVerify(vEmail, vCode.trim());
      }
    } catch {
      // ignore
    }
  }, []);

  // Countdown timer for resend code
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDirectVerify = async (targetEmail: string, codeStr: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.verifyEmail(targetEmail, codeStr);
      if (res.token) {
        localStorage.setItem('pulsebug_token', res.token.access_token);
        setSuccessMessage('Email verified successfully! Logging you in...');
        setTimeout(() => onSuccess(), 1000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Direct verification failed. Please enter the code manually.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.login(email, password);
      localStorage.setItem('pulsebug_token', res.access_token);
      setSuccessMessage('Logged in successfully!');
      setTimeout(() => onSuccess(), 600);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('EMAIL_NOT_VERIFIED')) {
        setErrorMessage('Your email is not verified yet. Please enter the 6-digit verification code.');
        setMode('verify');
        // Trigger a fresh code request automatically
        try {
          const rRes = await api.resendVerification(email);
          if (rRes.verification_code) {
            setSimulatedCode(rRes.verification_code);
          }
        } catch {
          // ignore
        }
      } else {
        setErrorMessage(msg || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.register({
        email,
        password,
        full_name: fullName,
        role,
        skills
      });

      if (res.verification_code) {
        setSimulatedCode(res.verification_code);
      }

      setSuccessMessage(res.message);
      setResendCooldown(45);
      setMode('verify');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const codeStr = otp.join('');
    if (codeStr.length < 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await api.verifyEmail(email, codeStr);
      if (res.token) {
        localStorage.setItem('pulsebug_token', res.token.access_token);
        setSuccessMessage('Email verified successfully! Logging you in...');
        setTimeout(() => onSuccess(), 1000);
      } else {
        setSuccessMessage('Email verified! You can now log in.');
        setMode('login');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !email) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.resendVerification(email);
      if (res.verification_code) {
        setSimulatedCode(res.verification_code);
      }
      setSuccessMessage('A fresh verification code has been dispatched.');
      setResendCooldown(45);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    // Only accept numeric characters
    const cleanVal = val.replace(/[^0-9]/g, '');
    const newOtp = [...otp];

    if (cleanVal.length > 1) {
      // Pasted a full code
      const digits = cleanVal.split('').slice(0, 6);
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      const focusIndex = Math.min(digits.length, 5);
      otpInputRefs.current[focusIndex]?.focus();
      return;
    }

    newOtp[index] = cleanVal;
    setOtp(newOtp);

    // Auto-advance to next input
    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleAutoFillCode = () => {
    if (simulatedCode) {
      const digits = simulatedCode.split('').slice(0, 6);
      setOtp(digits);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.login(demoEmail, 'password123');
      localStorage.setItem('pulsebug_token', res.access_token);
      setSuccessMessage(`Logged in as ${demoEmail}`);
      setTimeout(() => onSuccess(), 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to log in as demo user.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-slate-50 dark:bg-[#070a0f] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-blue-600/15 via-indigo-600/15 to-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Logo & Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/20 mb-1">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Pulse<span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">Bug</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Next-Gen AI Defect Tracking & Role-Based QA Platform
          </p>
        </div>

        {/* Main Authentication Card */}
        <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl shadow-slate-900/10 dark:shadow-black/50 space-y-6">
          {/* Header Tabs: Login vs Register */}
          {mode !== 'verify' && (
            <div className="flex p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMessage(null); setSuccessMessage(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setErrorMessage(null); setSuccessMessage(null); }}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-start gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. SIGN IN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="developer@pulsebug.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. REGISTRATION FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="john.doe@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Role in Engineering</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('DEVELOPER')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      role === 'DEVELOPER'
                        ? 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Developer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('TESTER')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      role === 'TESTER'
                        ? 'bg-teal-500/15 border-teal-500 text-teal-600 dark:text-teal-400 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>QA Tester</span>
                  </button>
                </div>
              </div>

              {/* Skills Tags */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Technical Skills</label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {skills.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 border border-slate-200 dark:border-slate-700"
                    >
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(s)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add skill (e.g. Docker, PostgreSQL)"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Create Account & Verify</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. EMAIL VERIFICATION STEP */}
          {mode === 'verify' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 flex items-center justify-center mx-auto mb-2">
                  <Mail className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Verify your Email</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter the 6-digit code dispatched to <span className="font-bold text-slate-700 dark:text-slate-200">{email}</span>
                </p>
              </div>

              {/* Zero-Friction Deployment Simulation Banner */}
              {simulatedCode && (
                <div className="p-3.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Zero-Friction Dev Code</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoFillCode}
                      className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px] hover:bg-indigo-700 cursor-pointer transition-colors shadow-xs"
                    >
                      Auto-Fill Code
                    </button>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-slate-500 dark:text-slate-400">OTP Code:</span>
                    <span className="font-black text-sm tracking-widest text-indigo-600 dark:text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/20">
                      {simulatedCode}
                    </span>
                  </div>
                </div>
              )}

              {/* 6-Digit OTP Box Grid */}
              <form onSubmit={handleVerifySubmit} className="space-y-4">
                <div className="flex justify-center gap-2 sm:gap-2.5">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      autoFocus={index === 0}
                      className="w-11 h-12 text-center text-lg font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-xs"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.join('').length < 6}
                  className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-600 hover:from-indigo-700 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Verify & Access PulseBug</span>
                      <Check className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Resend Code & Back to Login */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || loading}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </button>

                <button
                  type="button"
                  onClick={() => { setMode('login'); setErrorMessage(null); setSuccessMessage(null); }}
                  className="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

          {/* Quick 1-Click Demo Users (Academic & Grading Acceleration) */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Quick 1-Click Evaluation Login</span>
              <span className="text-[10px] text-indigo-500 lowercase font-mono font-normal">instant switch</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('rahul@pulsebug.io')}
                className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 text-left hover:border-blue-500 transition-all cursor-pointer group"
              >
                <div className="font-bold text-xs text-blue-600 dark:text-blue-400 flex items-center justify-between">
                  <span>Rahul (Dev)</span>
                  <Code2 className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                </div>
                <div className="text-[10px] text-slate-400 truncate">rahul@pulsebug.io</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('alex@pulsebug.io')}
                className="p-2 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-900/40 text-left hover:border-teal-500 transition-all cursor-pointer group"
              >
                <div className="font-bold text-xs text-teal-600 dark:text-teal-400 flex items-center justify-between">
                  <span>Alex (QA)</span>
                  <CheckCircle2 className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                </div>
                <div className="text-[10px] text-slate-400 truncate">alex@pulsebug.io</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-slate-400 text-[11px]">
          PulseBug Defect Tracking System • Ready for Local & Production Deployment
        </div>
      </div>
    </div>
  );
};
