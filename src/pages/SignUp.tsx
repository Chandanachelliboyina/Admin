import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth, ALLOWED_ADMIN_EMAILS } from '../contexts/AuthContext';

export function SignUp() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [emailError, setEmailError] = useState('');

  // Password must contain upper, lower, number, special char, no spaces
  const isValidPassword = (pwd: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;
    return regex.test(pwd) && !/\s/.test(pwd);
  };

  const isFormValid = 
    formData.name.trim() !== '' &&
    formData.email.trim() !== '' &&
    formData.password !== '' &&
    formData.password === formData.confirmPassword &&
    isValidPassword(formData.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    const emailLower = formData.email.toLowerCase().trim();

    if (!ALLOWED_ADMIN_EMAILS.includes(emailLower)) {
      setEmailError('Unauthorized: Only authorized admin emails can create an account.');
      return;
    }

    const storedData = localStorage.getItem('registeredUser');
    if (storedData) {
      setEmailError('We already created an account please sign in.');
      return;
    }

    // Bypass OTP - Directly register and login
    register(formData.email, formData.password);
    navigate('/signin');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8 relative overflow-hidden">
        
        {/* Account Details Form */}
        <div className="transition-all duration-500 ease-in-out opacity-100">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 flex items-center justify-center mb-4">
              <img src="/BMM_LOGO.jpg" alt="BMM Logo" className="w-full h-full object-contain rounded-full border border-border" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Create Admin Account</h2>
            <p className="text-muted-foreground text-sm mt-2">Enter your details to get started</p>
          </div>

          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={`w-full pl-10 pr-4 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary ${emailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-input focus:border-transparent'}`}
                  placeholder="admin@bmm.org"
                />
              </div>
              {emailError && <p className="text-xs text-red-500 mt-1 font-medium">{emailError}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              {formData.password && !isValidPassword(formData.password) && (
                <p className="text-xs text-red-500 mt-1">
                  Must contain upper/lowercase, number, special character, and no spaces.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isFormValid}
              className={`w-full py-2.5 rounded-md transition-colors font-medium mt-6 flex items-center justify-center space-x-2 ${
                isFormValid
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Link to="/signin" className="text-blue-600 hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
