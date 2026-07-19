import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { register } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  
  const email = searchParams.get('email');
  const token = searchParams.get('token');
  const password = searchParams.get('pwd'); // Passing password in URL just for the mock simulation

  useEffect(() => {
    // Simulate network request
    const timer = setTimeout(() => {
      if (email && token && password) {
        // Register the user now that they have "clicked the link"
        register(email, password);
        setStatus('success');
      } else {
        setStatus('error');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [email, token, password, register]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8 text-center">
        {status === 'verifying' && (
          <div className="space-y-4">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <h2 className="text-2xl font-bold tracking-tight">Verifying Email...</h2>
            <p className="text-muted-foreground">Please wait while we verify your confirmation link.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-500">
            <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Email Verified!</h2>
            <p className="text-muted-foreground">
              Your account for <strong>{email}</strong> has been successfully verified and created.
            </p>
            <button
              onClick={() => navigate('/signin')}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-md hover:bg-primary/90 transition-colors font-medium mt-6"
            >
              Continue to Sign In
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-500">
            <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Invalid Link</h2>
            <p className="text-muted-foreground">
              This confirmation link is invalid or has expired. Please try signing up again.
            </p>
            <Link
              to="/signup"
              className="inline-block w-full bg-muted text-foreground py-2.5 rounded-md hover:bg-muted/80 transition-colors font-medium mt-6"
            >
              Back to Sign Up
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
