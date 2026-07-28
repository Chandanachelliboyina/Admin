import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound, User, Mail, FileText, ArrowRight, CheckCircle2,
  Clock, XCircle, Loader2, RefreshCw, AlertCircle, ShieldCheck, Lock, Eye, EyeOff
} from 'lucide-react';
import { API_BASE_URL } from '../config';

type RequestStatus = 'pending' | 'approved' | 'rejected';

interface ResetRequest {
  id: string;
  status: RequestStatus;
  created_at: string;
  rejection_reason?: string;
}

export function ForgotPassword() {
  const [step, setStep] = useState<1 | 2>(1);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [requestStatus, setRequestStatus] = useState<ResetRequest | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastChecked, setLastChecked] = useState<string>('');

  useEffect(() => {
    if (step !== 2 || !employeeId) return;
    const checkStatus = async () => {
      try {
        setIsPolling(true);
        const res = await fetch(`${API_BASE_URL}/api/password-reset-requests/employee/${encodeURIComponent(employeeId)}`);
        if (res.ok) {
          const data: ResetRequest[] = await res.json();
          if (data.length > 0) {
            setRequestStatus(data[0]);
            setLastChecked(new Date().toLocaleTimeString());
          }
        }
      } catch (err) {
        console.error('Status check failed:', err);
      } finally {
        setIsPolling(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [step, employeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/password-reset-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId.trim(),
          employee_name: employeeName.trim(),
          email: email.trim(),
          reason: reason.trim(),
          new_password: newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || 'Failed to submit request. Please try again.');
        return;
      }
      setStep(2);
    } catch (err) {
      setError('Could not connect to server. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualRefresh = async () => {
    if (!employeeId) return;
    setIsPolling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/password-reset-requests/employee/${encodeURIComponent(employeeId)}`);
      if (res.ok) {
        const data: ResetRequest[] = await res.json();
        if (data.length > 0) {
          setRequestStatus(data[0]);
          setLastChecked(new Date().toLocaleTimeString());
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPolling(false);
    }
  };

  const handleSubmitAnother = () => {
    setStep(1);
    setEmployeeId('');
    setEmployeeName('');
    setEmail('');
    setReason('');
    setNewPassword('');
    setConfirmPassword('');
    setRequestStatus(null);
    setError('');
  };

  const statusConfig = {
    pending: {
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-700',
      label: 'Pending Review',
      description: 'Your request is awaiting admin review. Once approved, your new password will be activated and you can sign in with it.',
    },
    approved: {
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-700',
      label: 'Approved',
      description: 'Your password reset was approved! Your new password is now active. Please sign in with the password you set in your request.',
    },
    rejected: {
      icon: XCircle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-700',
      label: 'Rejected',
      description: 'Your password reset request was rejected. Please contact your administrator directly for assistance.',
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{boxShadow:'0 8px 24px rgba(99,102,241,0.25)'}}>
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 1 ? 'Forgot Password?' : 'Request Submitted'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 1
              ? 'Set your new password — admin will review and activate it'
              : 'Your admin will review and approve your request'}
          </p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex border-b border-gray-100">
            <div className={`flex-1 px-4 py-3 flex items-center gap-2 text-xs font-semibold ${step >= 1 ? 'text-blue-600 bg-blue-50/50' : 'text-gray-400'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step > 1 ? 'bg-emerald-500 text-white' : step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > 1 ? '✓' : '1'}
              </div>
              Submit Request
            </div>
            <div className={`flex-1 px-4 py-3 flex items-center gap-2 text-xs font-semibold ${step >= 2 ? 'text-blue-600 bg-blue-50/50' : 'text-gray-400'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                2
              </div>
              Track Status
            </div>
          </div>

          <div className="p-8">
            {step === 1 && (
              <div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Employee ID</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        id="forgot-employee-id"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                        placeholder="e.g. BMM001"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        id="forgot-employee-name"
                        value={employeeName}
                        onChange={(e) => setEmployeeName(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                        placeholder="Your registered full name"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="email"
                        id="forgot-email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                      Reason <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <textarea
                        id="forgot-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none"
                        placeholder="Briefly describe why you need a password reset..."
                      />
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-500" />
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="forgot-new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-mono tracking-wider"
                        placeholder="Min. 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        id="forgot-confirm-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className={`w-full pl-10 pr-10 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all font-mono tracking-wider ${
                          confirmPassword && confirmPassword !== newPassword
                            ? 'border-rose-300 focus:ring-rose-500/30 focus:border-rose-400'
                            : confirmPassword && confirmPassword === newPassword
                            ? 'border-emerald-300 focus:ring-emerald-500/30 focus:border-emerald-400'
                            : 'border-gray-200 focus:ring-blue-500/30 focus:border-blue-400'
                        }`}
                        placeholder="Re-enter your new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      {confirmPassword && confirmPassword === newPassword && (
                        <CheckCircle2 className="absolute right-9 top-2.5 w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    {confirmPassword && confirmPassword !== newPassword && (
                      <p className="text-xs text-rose-500 flex items-center gap-1"><XCircle className="w-3 h-3" /> Passwords do not match</p>
                    )}
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 leading-relaxed">
                      You set your own new password. The admin will review your request and simply approve or reject it — no password is shared with the admin.
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-600">
                      <XCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    id="forgot-submit-btn"
                    disabled={!employeeId || !employeeName || !email || !newPassword || !confirmPassword || newPassword !== confirmPassword || isSubmitting}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{boxShadow:'0 4px 16px rgba(99,102,241,0.3)'}}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Submitting Request...</>
                    ) : (
                      <>Submit Reset Request <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
                <div className="mt-6 text-center">
                  <Link to="/signin" className="text-sm text-blue-600 hover:underline font-medium">
                    ← Back to Sign In
                  </Link>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                {requestStatus ? (() => {
                  const cfg = statusConfig[requestStatus.status];
                  const Icon = cfg.icon;
                  return (
                    <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-5`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-5 h-5 ${cfg.color}`} />
                          <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.badge}`}>
                          {requestStatus.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{cfg.description}</p>
                      {requestStatus.status === 'rejected' && requestStatus.rejection_reason && (
                        <div className="mt-3 p-3 bg-white/70 rounded-lg border border-rose-100">
                          <p className="text-xs font-semibold text-rose-600 mb-1">Reason:</p>
                          <p className="text-sm text-gray-700">{requestStatus.rejection_reason}</p>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-3">Submitted: {requestStatus.created_at}</p>
                    </div>
                  );
                })() : (
                  <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                      <span className="text-sm font-bold text-amber-600">Request Submitted</span>
                    </div>
                    <p className="text-sm text-gray-600">Your request is being processed. Checking for updates...</p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Details</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400 text-xs block">Employee ID</span>
                      <p className="font-semibold text-gray-800">{employeeId}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Name</span>
                      <p className="font-semibold text-gray-800">{employeeName}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400 text-xs block">Email</span>
                      <p className="font-semibold text-gray-800">{email}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    {lastChecked && <span>Last checked: {lastChecked}</span>}
                  </div>
                  <button
                    onClick={handleManualRefresh}
                    disabled={isPolling}
                    id="refresh-status-btn"
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {requestStatus?.status === 'approved' && (
                    <Link
                      to="/signin"
                      id="go-to-signin-btn"
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all"
                      style={{boxShadow:'0 4px 16px rgba(16,185,129,0.3)'}}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Go to Sign In
                    </Link>
                  )}
                  {requestStatus?.status === 'rejected' && (
                    <button
                      onClick={handleSubmitAnother}
                      id="submit-another-btn"
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all"
                    >
                      Submit Another Request
                    </button>
                  )}
                  <Link
                    to="/signin"
                    className="w-full block text-center py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← Back to Sign In
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
