import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { API_BASE_URL } from '../config';

interface AuthContextType {
  isAuthenticated: boolean;
  currentUserEmail: string | null;
  login: (email: string, password: string) => Promise<{success: boolean, message?: string}>;
  logout: () => void;
  register: (email: string, password: string) => void;
  updateAdminPassword: (email: string, newPassword: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Load auth state from localStorage on mount and verify access
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated') === 'true';
    const email = localStorage.getItem('currentUserEmail');
    
    setIsAuthenticated(authStatus);
    if (email) setCurrentUserEmail(email);

    if (authStatus && email && email !== 'admin@example.com') {
      // Verify access with backend (no-cache to ensure fresh status)
      fetch(`${API_BASE_URL}/api/employees`, { cache: 'no-store' })
        .then(res => res.json())
        .then(employees => {
          const emp = employees.find((e: any) => e.email === email || e.id === email);
          if (emp && emp.has_access === false) {
            // Revoke access immediately if they are currently logged in
            setIsAuthenticated(false);
            setCurrentUserEmail(null);
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('currentUserEmail');
            // Force reload to kick them out properly
            window.location.href = '/signin';
          }
        })
        .catch(console.error);
    }
  }, []);

  const register = (email: string, password: string) => {
    localStorage.setItem('registeredUser', JSON.stringify({ email, password }));
    const rawAdmins = localStorage.getItem('adminAccounts');
    const admins = rawAdmins ? JSON.parse(rawAdmins) : {};
    admins[email.toLowerCase()] = password;
    localStorage.setItem('adminAccounts', JSON.stringify(admins));
  };

  const updateAdminPassword = (email: string, newPassword: string) => {
    const cleanEmail = email.toLowerCase();
    const rawAdmins = localStorage.getItem('adminAccounts');
    const admins = rawAdmins ? JSON.parse(rawAdmins) : {};
    admins[cleanEmail] = newPassword;
    localStorage.setItem('adminAccounts', JSON.stringify(admins));

    // Also update registeredUser if email matches
    const storedData = localStorage.getItem('registeredUser');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.email && parsed.email.toLowerCase() === cleanEmail) {
          localStorage.setItem('registeredUser', JSON.stringify({ email: parsed.email, password: newPassword }));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const login = async (email: string, password: string): Promise<{success: boolean, message?: string}> => {
    const cleanEmail = email.toLowerCase();
    const rawAdmins = localStorage.getItem('adminAccounts');
    const admins = rawAdmins ? JSON.parse(rawAdmins) : {};

    // 1. Check if password exists in adminAccounts map (updated after reset)
    if (admins[cleanEmail] && admins[cleanEmail] === password) {
      setIsAuthenticated(true);
      setCurrentUserEmail(email);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('currentUserEmail', email);
      return { success: true };
    }

    // 2. Allowed admin emails check
    const allowedAdminEmails = ['chanduchelliboyina3@gmail.com', 'bbmmwdo.org@gmail.com', 'admin@example.com'];
    if (allowedAdminEmails.includes(cleanEmail)) {
      if (password === 'admin123' || (admins[cleanEmail] && admins[cleanEmail] === password)) {
        setIsAuthenticated(true);
        setCurrentUserEmail(email);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('currentUserEmail', email);
        return { success: true };
      }
    }

    // 3. Default admin fallback
    if (cleanEmail === 'admin@example.com' && (password === 'admin123' || (admins['admin@example.com'] && admins['admin@example.com'] === password))) {
      setIsAuthenticated(true);
      setCurrentUserEmail(email);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('currentUserEmail', email);
      return { success: true };
    }

    // 4. Check stored registeredUser
    const storedData = localStorage.getItem('registeredUser');
    if (storedData) {
      const { email: storedEmail, password: storedPassword } = JSON.parse(storedData);
      if (storedEmail.toLowerCase() === cleanEmail && storedPassword === password) {
        setIsAuthenticated(true);
        setCurrentUserEmail(email);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('currentUserEmail', email);
        return { success: true };
      }
    }

    // 5. Check employee in backend
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees`, { cache: 'no-store' });
      if (response.ok) {
        const employees = await response.json();
        const emp = employees.find((e: any) => e.email?.toLowerCase() === cleanEmail || e.id?.toLowerCase() === cleanEmail);
        if (emp) {
          if (emp.has_access === false) {
            return { success: false, message: "Admin has not granted access to your account." };
          }
          setIsAuthenticated(true);
          setCurrentUserEmail(email);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('currentUserEmail', email);
          return { success: true };
        }
      }
    } catch (e) {
      console.error(e);
    }

    return { success: false, message: "Invalid email or password. Please try again or create an account." };
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUserEmail(null);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUserEmail');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUserEmail, login, logout, register, updateAdminPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
