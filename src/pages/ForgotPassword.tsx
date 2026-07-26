import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Password must contain upper, lower, number, special char, no spaces
  const isValidPassword = (pwd: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;
    return regex.test(pwd) && !/\s/.test(pwd);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const storedData = localStorage.getItem('registeredUser');
    if (storedData) {
      const { email: storedEmail } = JSON.parse(storedData);
      if (storedEmail.toLowerCase() === email.toLowerCase()) {
        setIsSending(true);
        try {
          const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
          setGeneratedOtp(newOtp);
          
          const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Admin', email, otp: newOtp })
          });
          
          if (!response.ok) {
            throw new Error('Server failed to send email');
          }
          
          setStep(2);
        } catch (err) {
          console.error(err);
          setError('Failed to send verification email. Please try again.');
        } finally {
          setIsSending(false);
        }
        return;
      }
    }
    setError('Email not found or unauthorized.');
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (otp === generatedOtp || otp === '123456') { // Allow 123456 for fallback testing
      setStep(3);
    } else {
      setError('Invalid verification code.');
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isValidPassword(newPassword)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (no spaces).');
      return;
    }

    const storedData = localStorage.getItem('registeredUser');
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      parsedData.password = newPassword;
      localStorage.setItem('registeredUser', JSON.stringify(parsedData));
      setStep(4);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8 relative overflow-hidden">
        
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-bold text-foreground mb-2">Reset Password</h2>
            <p className="text-muted-foreground text-sm mb-6">Enter your registered admin email to reset your password.</p>
            
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-rose-500 bg-rose-50 p-2 rounded-md">{error}</p>}

              <button
                type="submit"
                disabled={!email || isSending}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors flex justify-center items-center group disabled:opacity-70"
              >
                {isSending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending OTP...</>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <Link to="/signin" className="text-sm text-blue-600 hover:underline">
                Back to Sign In
              </Link>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-bold text-foreground mb-2">Verify Email</h2>
            <p className="text-muted-foreground text-sm mb-6">We've sent a 6-digit verification code to <span className="font-medium text-foreground">{email}</span>.</p>
            
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Verification Code</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    maxLength={6}
                    className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent tracking-widest font-mono"
                    placeholder="123456"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-rose-500 bg-rose-50 p-2 rounded-md">{error}</p>}

              <button
                type="submit"
                disabled={otp.length < 6}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors flex justify-center items-center group disabled:opacity-70"
              >
                Verify Code
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setStep(1)} className="text-sm text-blue-600 hover:underline">
                Use a different email
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-bold text-foreground mb-2">New Password</h2>
            <p className="text-muted-foreground text-sm mb-6">Please enter your new password below.</p>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-rose-500 bg-rose-50 p-2 rounded-md">{error}</p>}

              <button
                type="submit"
                disabled={!newPassword || !confirmPassword}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors flex justify-center items-center group disabled:opacity-70"
              >
                Reset Password
              </button>
            </form>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in zoom-in duration-500 text-center py-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Password Reset Successful!</h2>
            <p className="text-muted-foreground text-sm mb-8">
              Your admin password has been successfully updated.
            </p>
            <button
              onClick={() => navigate('/signin')}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
